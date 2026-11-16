import { describe, it, expect } from "vitest";
import { randomUUID as id } from "node:crypto";
import { emptyConfig, autoAssign, resolve, review, copyYear, removeFromConfig, eventSchema, type Schedule, type Rule, type Target } from "../packages/domain/src";
import { calendarDay, calendarSummary, selectedClassrooms } from "../packages/domain/src/enhancements";
const rule = (v: Partial<Rule> = {}): Rule => ({ type: "default", weekdays: [], intervalWeeks: 1, ...v });
const schedule = (target: Target, v: Partial<Schedule> = {}): Schedule => ({ id: id(), name: "Normal day", arrival: 480, dispersal: 600, target, rule: rule(), slots: autoAssign(480, 600, [60, 60], [], id), ...v });
function setup() {
  const config = emptyConfig(["CBSE", "ICSE", "IB"], id);
  for (const b of config.boards) {
    const section = { id: id(), name: "Primary" }; b.sections.push(section);
    b.grades.push({ id: id(), name: "Grade 1", active: true, sectionId: section.id, classrooms: [{ id: id(), name: "Grade 1A", active: true }] });
  }
  config.boards[0].schedules.push(schedule({ scope: "school", ids: [] }));
  const [a, b, c] = config.boards;
  const room = (board: typeof a) => board.grades[0].classrooms[0].id;
  return { config, a, b, c, room };
}
describe("School-wide and multi-board scheduling", () => {
  it("inherits one school default across every registered board", () => {
    const { config, room } = setup();
    for (const b of config.boards) expect(resolve(b, room(b), "2026-11-16", config)).toMatchObject({ status: "working", schedule: { name: "Normal day" } });
    expect(review(config, 3, "2026-11-16", "2026-11-16")).toEqual([]);
  });
  it("uses board, section, grade and classroom specificity above the school default", () => {
    const { config, b, room } = setup();
    const variants: Target[] = [{ scope: "board", ids: [] }, { scope: "section", ids: [b.sections[0].id] }, { scope: "grade", ids: [b.grades[0].id] }, { scope: "classroom", ids: [room(b)] }];
    variants.forEach((target, index) => { b.schedules.push(schedule(target, { name: `Override ${index}` })); expect(resolve(b, room(b), "2026-11-16", config).schedule?.name).toBe(`Override ${index}`); });
  });
  it("targets several boards without affecting another board", () => {
    const { config, a, b, c, room } = setup();
    a.schedules.push(schedule({ scope: "boards", ids: [a.id, b.id] }, { name: "Two boards" }));
    expect(resolve(b, room(b), "2026-11-16", config).schedule?.name).toBe("Two boards");
    expect(resolve(c, room(c), "2026-11-16", config).schedule?.name).toBe("Normal day");
  });
  it.each(["sections", "grades", "classrooms"] as const)("supports selected %s across boards", (scope) => {
    const { config, a, b, c, room } = setup();
    const ids = [a, b].map((board) => scope === "sections" ? board.sections[0].id : scope === "grades" ? board.grades[0].id : room(board));
    a.schedules.push(schedule({ scope, ids }, { name: "Shared scope" }));
    expect(resolve(b, room(b), "2026-11-16", config).schedule?.name).toBe("Shared scope");
    expect(resolve(c, room(c), "2026-11-16", config).schedule?.name).toBe("Normal day");
    expect(review(config, 3, "2026-11-16", "2026-11-16")).toEqual([]);
  });
  it("keeps date priority ahead of scope priority", () => {
    const { config, a, b, room } = setup();
    b.schedules.push(schedule({ scope: "classroom", ids: [room(b)] }, { name: "Classroom default" }));
    a.schedules.push(schedule({ scope: "school", ids: [] }, { name: "School exception", rule: rule({ type: "date", date: "2026-11-16" }) }));
    expect(resolve(b, room(b), "2026-11-16", config).schedule?.name).toBe("School exception");
  });
  it("rejects ambiguous equal-priority shared schedules", () => {
    const { config, a, b, room } = setup();
    a.schedules.push(schedule({ scope: "school", ids: [] }));
    expect(resolve(b, room(b), "2026-11-16", config).status).toBe("conflict");
  });
  it("rejects target IDs outside the school configuration", () => {
    const { config, a } = setup();
    a.schedules.push(schedule({ scope: "boards", ids: [id()] }));
    expect(review(config, 3, "2026-11-16", "2026-11-16")).toContainEqual(expect.objectContaining({ severity: "error", message: expect.stringContaining("invalid target") }));
  });
  it("preserves board-local legacy defaults", () => {
    const { config, a, b, room } = setup();
    a.schedules = [schedule({ scope: "board", ids: [] })];
    expect(resolve(b, room(b), "2026-11-16", config).status).toBe("missing");
  });
});
describe("Full holidays and deliberate reopening", () => {
  it("full school holiday overrides a more specific half-day", () => {
    const { config, a, b, room } = setup();
    a.events.push({ id: id(), name: "Holiday", kind: "holiday", target: { scope: "school", ids: [] }, rule: rule() });
    b.events.push({ id: id(), name: "Half-day", kind: "half-day", target: { scope: "classroom", ids: [room(b)] }, rule: rule({ type: "date", date: "2026-11-14" }) });
    expect(resolve(b, room(b), "2026-11-14", config)).toMatchObject({ status: "holiday", reason: "Holiday" });
  });
  it("does not silently reopen full holidays with a normal working exception", () => {
    const { config, a, b, room } = setup();
    a.events.push({ id: id(), name: "School holiday", kind: "holiday", target: { scope: "school", ids: [] }, rule: rule() });
    b.events.push({ id: id(), name: "Working date", kind: "working", target: { scope: "board", ids: [] }, rule: rule({ type: "date", date: "2026-11-16" }) });
    expect(resolve(b, room(b), "2026-11-16", config).status).toBe("holiday");
    b.events[0].overridesHoliday = true;
    expect(resolve(b, room(b), "2026-11-16", config).status).toBe("working");
  });
  it("requires a specific date and explicit working action for reopening", () => {
    const event = { id: id(), name: "Reopen", kind: "working", target: { scope: "school", ids: [] }, rule: rule(), overridesHoliday: true };
    expect(eventSchema.safeParse(event).success).toBe(false);
    expect(eventSchema.safeParse({ ...event, rule: rule({ type: "date", date: "2026-11-16" }) }).success).toBe(true);
  });
});
describe("Academic hierarchy, copying and calendar totals", () => {
  it("preserves same names in independent boards but blocks duplicates within a board", () => {
    const { config, a } = setup();
    expect(review(config, 3, "2026-11-16", "2026-11-16")).toEqual([]);
    a.grades.push({ ...a.grades[0], id: id(), classrooms: [] });
    expect(review(config, 3, "2026-11-16", "2026-11-16").some((i) => /grades: duplicate/.test(i.message))).toBe(true);
  });
  it("unassigns grades and prunes shared section targets when a section is removed", () => {
    const { config, a, b } = setup();
    a.events.push({ id: id(), name: "Shared section holiday", kind: "holiday", target: { scope: "sections", ids: [a.sections[0].id, b.sections[0].id] }, rule: rule() });
    const next = removeFromConfig(config, b.id, "section", b.sections[0].id);
    expect(next.boards[1].grades[0].sectionId).toBe(null);
    expect(next.boards[1].grades[0].classrooms).toHaveLength(1);
    expect(next.boards[0].events[0].target.ids).toEqual([a.sections[0].id]);
    expect(config.boards[1].grades[0].sectionId).toBe(b.sections[0].id);
  });
  it("removes draft grade classrooms and cross-board target references without mutating the source", () => {
    const { config, a, b, room } = setup();
    a.schedules.push(schedule({ scope: "classrooms", ids: [room(b)] }));
    const next = removeFromConfig(config, b.id, "grade", b.grades[0].id);
    expect(next.boards[1].grades).toHaveLength(0);
    expect(next.boards[0].schedules).toHaveLength(1);
    expect(config.boards[1].grades).toHaveLength(1);
  });
  it("copies recurring school rules but excludes fixed-date exceptions", () => {
    const { config, a } = setup();
    a.events.push({ id: id(), name: "Fixed holiday", kind: "holiday", target: { scope: "school", ids: [] }, rule: rule({ type: "date", date: "2026-11-16" }) },
      { id: id(), name: "Fourth Saturday", kind: "holiday", target: { scope: "school", ids: [] }, rule: rule({ type: "recurring", weekdays: [6], nth: 4 }) });
    const copied = copyYear(config);
    expect(copied.boards[0].events.map((e) => e.name)).toEqual(["Fourth Saturday"]);
    expect(config.boards[0].events).toHaveLength(2);
  });
  it("counts overlapping holidays once per classroom and shows differing calendars as mixed", () => {
    const { config, a, b, room } = setup();
    a.events.push({ id: id(), name: "School Monday", kind: "holiday", target: { scope: "school", ids: [] }, rule: rule({ type: "date", date: "2026-11-16" }) });
    b.events.push({ id: id(), name: "Board Monday", kind: "holiday", target: { scope: "board", ids: [] }, rule: rule({ type: "date", date: "2026-11-16" }) },
      { id: id(), name: "Board Tuesday", kind: "holiday", target: { scope: "board", ids: [] }, rule: rule({ type: "date", date: "2026-11-17" }) });
    const summary = calendarSummary(config, "2026-11-16", "2026-11-18");
    expect(summary.mixed).toBe(true); expect(summary.workingDays).toBe(null);
    const row = summary.rows.find((r) => r.classroomId === room(b))!;
    expect(row.holidays).toBe(2); expect(row.workingDays).toBe(1);
    expect(row.holidayDates).toHaveLength(2);
    expect(calendarDay(b, selectedClassrooms(b, {}), "2026-11-16", config).status).toBe("holiday");
  });
  it("shows mixed even when totals match but holiday dates differ", () => {
    const { config, a, b } = setup();
    for (const [board, date] of [[a, "2026-11-16"], [b, "2026-11-17"]] as const) board.events.push({ id: id(), name: "Board holiday", kind: "holiday", target: { scope: "board", ids: [] }, rule: rule({ type: "date", date }) });
    expect(calendarSummary(config, "2026-11-16", "2026-11-18").mixed).toBe(true);
  });
  it("supports zero active classrooms without fabricated totals", () => {
    const { config } = setup(); for (const b of config.boards) b.grades[0].classrooms[0].active = false;
    expect(calendarSummary(config, "2026-11-16", "2026-11-18")).toMatchObject({ classrooms: 0, workingDays: null, holidays: null });
  });
});

describe("Working-week and exceptional half-day calculations", () => {
  it("requires a calendar exception before a half-day schedule opens a weekly closure", () => {
    const { config, a, b, room } = setup(); b.nonWorkingDays = [0, 6];
    a.schedules.push(schedule({ scope: "school", ids: [] }, { name: "Second Saturday half-day", dayType: "half", rule: rule({ type: "recurring", weekdays: [6], nth: 2 }) }));
    expect(resolve(b, room(b), "2026-11-14", config).status).toBe("non-working");
    b.events.push({ id: id(), name: "Second Saturday half-day", kind: "half-day", target: { scope: "school", ids: [] }, rule: rule({ type: "recurring", weekdays: [6], nth: 2 }) });
    expect(resolve(b, room(b), "2026-11-14", config)).toMatchObject({ status: "working", schedule: { dayType: "half" } });
    expect(resolve(b, room(b), "2026-11-21", config).status).toBe("non-working");
  });
  it("derives weekly counts from actual exceptions and counts working weeks", () => {
    const { config, a } = setup();
    a.events.push({ id: id(), name: "Monday closed", kind: "holiday", target: { scope: "school", ids: [] }, rule: rule({ type: "weekly", weekdays: [1] }) });
    const summary = calendarSummary(config, "2026-11-16", "2026-11-29");
    expect(summary.workingDays).toBe(10); expect(summary.workingWeeks).toBe(2);
    expect(summary.workingDaysPerWeek).toBe(5); expect(summary.holidays).toBe(4);
  });
  it("does not claim a fixed weekly count when nth-weekday closures vary the pattern", () => {
    const { config, a } = setup();
    a.events.push({ id: id(), name: "Fourth Saturday", kind: "holiday", target: { scope: "school", ids: [] }, rule: rule({ type: "recurring", weekdays: [6], nth: 4 }) });
    const summary = calendarSummary(config, "2026-11-16", "2026-11-29");
    expect(summary.workingDays).toBe(11); expect(summary.workingDaysPerWeek).toBe(null);
  });
});


describe("Calendar day labels", () => {
  it("shows half-day explicitly while retaining the resolved bell schedule", () => {
    const { config, a, b } = setup();
    a.schedules.push(schedule({ scope: "school", ids: [] }, { dayType: "half", rule: rule({ type: "date", date: "2026-11-16" }) }));
    expect(calendarDay(b, selectedClassrooms(b, {}), "2026-11-16", config)).toMatchObject({ status: "half-day", results: [{ status: "half-day", schedule: { dayType: "half" } }] });
  });
});


describe("Final refinement calendar classifications", () => {
  it("separates provisional dates from validated instruction", () => {
    const { config, a } = setup(); a.schedules = [];
    const summary = calendarSummary(config, "2026-11-16", "2026-11-16");
    expect(summary.workingDays).toBe(1); expect(summary.validatedWorkingDays).toBe(0);
    expect(summary.provisionalWorkingDays).toBe(1); expect(summary.fullWorkingDays).toBe(0);
  });
  it("detects mixed half-days even with equal working totals", () => {
    const { config, a, b, room } = setup();
    b.schedules.push(schedule({ scope: "board", ids: [] }, { dayType: "half" }));
    const summary = calendarSummary(config, "2026-11-16", "2026-11-16");
    expect(summary.mixed).toBe(true); expect(summary.workingDays).toBeNull();
    expect(summary.rows.map(r => r.workingDays)).toEqual([1, 1, 1]);
  });
  it("reports incomplete half-day schedules explicitly", () => {
    const { config, a, room } = setup(); a.schedules = [];
    a.events.push({ id: id(), name: "Half", kind: "half-day", target: { scope: "board", ids: [] }, rule: rule() });
    expect(resolve(a, room(a), "2026-11-16", config)).toMatchObject({ status: "missing", reason: expect.stringContaining("half-day") });
  });
});


describe("Effective classification comparison",()=>{
 it("ignores holiday descriptions when the effective dates are identical",()=>{
  const {config}=setup();
  for(const b of config.boards)b.events.push({id:id(),name:`Different holiday description ${b.name}`,kind:"holiday",target:{scope:"board",ids:[]},rule:rule({type:"date",date:"2026-11-16"})});
  const summary=calendarSummary(config,"2026-11-16","2026-11-16");
  expect(summary.mixed).toBe(false);expect(summary.holidays).toBe(1);
 });
 it("detects different half-day dates even when both annual totals match",()=>{
  const {config,a,b}=setup();
  a.schedules.push(schedule({scope:"board",ids:[]},{dayType:"half",rule:rule({type:"date",date:"2026-11-16"})}));
  b.schedules.push(schedule({scope:"board",ids:[]},{dayType:"half",rule:rule({type:"date",date:"2026-11-17"})}));
  const summary=calendarSummary({boards:[a,b]},"2026-11-16","2026-11-17");
  expect(summary.rows.map(r=>r.halfDays)).toEqual([1,1]);expect(summary.mixed).toBe(true);
 });
});

it("a higher-priority full working exception supersedes a half-day expectation even without a schedule",()=>{
 const {config,a,room}=setup();a.schedules=[];
 a.events.push({id:id(),name:"Weekly half",kind:"half-day",target:{scope:"board",ids:[]},rule:rule({type:"weekly",weekdays:[1]})},{id:id(),name:"Specific full day",kind:"working",target:{scope:"board",ids:[]},rule:rule({type:"date",date:"2026-11-16"})});
 expect(resolve(a,room(a),"2026-11-16",config)).toMatchObject({status:"missing",expectedDayType:"full"});
});
