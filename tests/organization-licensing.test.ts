import { describe, expect, it } from "vitest";
import { randomUUID as id } from "node:crypto";
import { countClassrooms, licensedUsage, organizationUtilization, organizationCategory, emptyConfig, autoAssign, resolve, review, validateSlots, type Schedule, type Rule } from "../packages/domain/src";
import { onboardingChecklist } from "../packages/domain/src/enhancements";

const rule = (v: Partial<Rule> = {}): Rule => ({ type: "default", weekdays: [], intervalWeeks: 1, ...v });
function fixture() {
  const config = emptyConfig(["CBSE"], id), board = config.boards[0];
  const section = { id: id(), name: "Primary" };
  board.sections.push(section);
  const grade = { id: id(), name: "Grade 1", sectionId: section.id, active: true, classrooms: [{ id: id(), name: "1A", active: true }, { id: id(), name: "1B", active: true }] };
  board.grades.push(grade);
  const schedule = (v: Partial<Schedule> = {}): Schedule => ({ id: id(), name: "Full school day", arrival: 480, dispersal: 600, target: { scope: "board", ids: [] }, rule: rule(), slots: autoAssign(480, 600, [60,60], [], id), ...v });
  board.schedules.push(schedule());
  return { config, board, grade, section, schedule };
}
describe("Organization license algorithm", () => {
  it("uses the greater revision count rather than the union of IDs", () => {
    const { config } = fixture();
    const draft = structuredClone(config);
    draft.boards[0].grades[0].classrooms = [{ id: id(), name: "Replacement", active: false }];
    expect(licensedUsage(config, draft)).toBe(2);
    expect(countClassrooms(draft)).toBe(1);
  });
  it("aggregates institutions while taking the maximum year reservation", () => {
    const usage = organizationUtilization([
      { institutionId: "A", years: [{ yearId: "2026", published: 45, draft: 40 }, { yearId: "2027", published: 30, draft: 35 }] },
      { institutionId: "B", years: [{ yearId: "2026", published: 25, draft: 20 }] },
      { institutionId: "C", years: [{ yearId: "2026", published: 0, draft: 20 }] },
    ]);
    expect(usage.used).toBe(90);
    expect(usage.institutions.map((i) => i.used)).toEqual([45, 25, 20]);
  });
  it("does not add duplicate or historical years together", () => {
    expect(organizationUtilization([{ institutionId: "A", years: [
      { yearId: "old", published: 8, draft: 0 }, { yearId: "new", published: 8, draft: 8 },
    ] }]).used).toBe(8);
  });
  it("handles an organization with no institutions or no years", () => {
    expect(organizationUtilization([]).used).toBe(0);
    expect(organizationUtilization([{ institutionId: "A", years: [] }]).used).toBe(0);
  });
  it.each([ ["DRAFT", "ONBOARDING"], ["ONBOARDING", "ONBOARDING"], ["ACTIVE", "ACTIVE"], ["INACTIVE", "INACTIVE"], ["SUSPENDED", "INACTIVE"], ["DELETION_PENDING", "INACTIVE"] ])("categorizes %s as %s", (status, expected) => expect(organizationCategory(status)).toBe(expected));
  it("rejects ambiguous overlapping active contracts during onboarding", () => {
    const contract = { status: "ACTIVE", startsAt: "2026-01-01", endsAt: "2030-12-31", classroomLimit: 10, userLimit: 1, agreementStatus: "SIGNED", paymentStatus: "PAID" };
    expect(onboardingChecklist({ completedSteps: [] }, [], [contract, contract], new Date("2026-11-14"))[2].blockers.join()).toMatch(/overlapping/);
  });
});
describe("Complete bell priority and half-day validation", () => {
  it("resolves a regular weekday", () => {
    const { board, grade } = fixture();
    expect(resolve(board, grade.classrooms[0].id, "2026-11-02").status).toBe("working");
  });
  it("prefers a grade to a section rule", () => {
    const { board, grade, section, schedule } = fixture();
    board.schedules.push(schedule({ name: "Section", target: { scope: "section", ids: [section.id] } }), schedule({ name: "Grade", target: { scope: "grade", ids: [grade.id] } }));
    expect(resolve(board, grade.classrooms[0].id, "2026-11-02").schedule?.name).toBe("Grade");
  });
  it("resolves a second Saturday as a half-day with a matching schedule", () => {
    const { board, grade, schedule } = fixture();
    const recurring = rule({ type: "recurring", weekdays: [6], nth: 2 });
    board.events.push({ id: id(), name: "Second Saturday", kind: "half-day", target: { scope: "board", ids: [] }, rule: recurring });
    board.schedules.push(schedule({ name: "Half day", dayType: "half", rule: recurring }));
    expect(resolve(board, grade.classrooms[0].id, "2026-11-14").schedule?.dayType).toBe("half");
  });
  it("blocks a half-day event that resolves to a full day", () => {
    const { config, board, grade } = fixture();
    board.events.push({ id: id(), name: "Half day", kind: "half-day", target: { scope: "board", ids: [] }, rule: rule({ type: "date", date: "2026-11-14" }) });
    expect(resolve(board, grade.classrooms[0].id, "2026-11-14").status).toBe("invalid");
    expect(review(config, 5, "2026-11-14", "2026-11-14").some((i) => i.severity === "error" && /half-day/i.test(i.message))).toBe(true);
  });
  it("does not let a default half-day schedule satisfy a higher priority event", () => {
    const { board, grade } = fixture(); board.schedules[0].dayType = "half";
    board.events.push({ id: id(), name: "Half day", kind: "half-day", target: { scope: "board", ids: [] }, rule: rule({ type: "date", date: "2026-11-14" }) });
    expect(resolve(board, grade.classrooms[0].id, "2026-11-14").status).toBe("invalid");
  });
  it("full holidays override recurring half-days and fourth Saturdays", () => {
    const { board, grade } = fixture();
    board.events.push({ id: id(), name: "Fourth Saturday", kind: "holiday", target: { scope: "board", ids: [] }, rule: rule({ type: "recurring", weekdays: [6], nth: 4 }) });
    expect(resolve(board, grade.classrooms[0].id, "2026-11-28").status).toBe("holiday");
    board.events.push({ id: id(), name: "Half day", kind: "half-day", target: { scope: "board", ids: [] }, rule: rule({ type: "recurring", weekdays: [6], nth: 2 }) }, { id: id(), name: "Festival", kind: "holiday", target: { scope: "board", ids: [] }, rule: rule({ type: "date", date: "2026-11-14" }) });
    expect(resolve(board, grade.classrooms[0].id, "2026-11-14").status).toBe("holiday");
  });
  it("a specific-date working exception can override a recurring half-day", () => {
    const { board, grade, schedule } = fixture();
    board.events.push({ id: id(), name: "Half day", kind: "half-day", target: { scope: "board", ids: [] }, rule: rule({ type: "recurring", weekdays: [6], nth: 2 }) }, { id: id(), name: "Full working date", kind: "working", target: { scope: "board", ids: [] }, rule: rule({ type: "date", date: "2026-11-14" }) });
    board.schedules.push(schedule({ name: "Special date", rule: rule({ type: "date", date: "2026-11-14" }) }));
    expect(resolve(board, grade.classrooms[0].id, "2026-11-14").schedule?.name).toBe("Special date");
  });
  it("allows different classrooms to follow different schedules on the same date", () => {
    const { board, grade, schedule } = fixture();
    board.schedules.push(schedule({ name: "Classroom override", target: { scope: "classroom", ids: [grade.classrooms[0].id] } }));
    expect(resolve(board, grade.classrooms[0].id, "2026-11-02").schedule?.name).toBe("Classroom override");
    expect(resolve(board, grade.classrooms[1].id, "2026-11-02").schedule?.name).toBe("Full school day");
  });
  it("marks a schedule invalid in the resolver when teaching overlaps lunch", () => {
    const { board, grade } = fixture();
    board.schedules[0].slots.push({ id: id(), name: "Lunch", kind: "routine", start: 530, end: 560 });
    expect(resolve(board, grade.classrooms[0].id, "2026-11-02").status).toBe("invalid");
  });
  it("detects non-chronological stored slots", () => {
    const { board } = fixture(); board.schedules[0].slots.reverse();
    expect(validateSlots(board.schedules[0]).join()).toMatch(/chronological/);
  });
  it("inactive grades suppress all schedules", () => {
    const { board, grade } = fixture(); grade.active = false;
    expect(resolve(board, grade.classrooms[0].id, "2026-11-02").status).toBe("inactive");
  });
});
