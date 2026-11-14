import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  autoAssign,
  removeFromBoard,
  configSchema,
  copyYear,
  countClassrooms,
  deletionDue,
  emptyConfig,
  licensedUsage,
  matches,
  resolve,
  review,
  validateSlots,
  type Board,
  type Config,
  type Rule,
  type Schedule,
} from "../packages/domain/src";
import { hash, verify } from "../apps/api/src/password";
const id = randomUUID;
const rule = (v: Partial<Rule> = {}): Rule => ({
  type: "default",
  weekdays: [],
  intervalWeeks: 1,
  ...v,
});
function fixture() {
  const c = emptyConfig(["CBSE", "ICSE"], id);
  const b = c.boards[0];
  const section = { id: id(), name: "Primary" };
  b.sections.push(section);
  b.grades.push({
    id: id(),
    name: "Grade 1",
    active: true,
    sectionId: section.id,
    classrooms: [
      { id: id(), name: "Grade 1A", active: true },
      { id: id(), name: "Grade 1B", active: false },
    ],
  });
  return c;
}
function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: id(),
    name: "Regular",
    arrival: 480,
    dispersal: 600,
    target: { scope: "board", ids: [] },
    rule: rule(),
    slots: autoAssign(480, 600, [60, 60], [], id),
    ...overrides,
  };
}
const classroom = (b: Board) => b.grades[0].classrooms[0].id;
describe("Bell generation and integrity", () => {
  it("positions teaching periods around anchored routines with complete coverage", () => {
    const lunch = {
      id: id(),
      name: "Lunch",
      kind: "routine" as const,
      start: 600,
      end: 630,
    };
    const slots = autoAssign(480, 750, [60, 60, 60, 60], [lunch], id);
    expect(slots.map((p) => p.start)).toEqual([480, 540, 600, 630, 690]);
    expect(validateSlots(schedule({ dispersal: 750, slots }))).toEqual([]);
  });
  it("rejects an impossible anchored arrangement and provides an adjustment", () =>
    expect(() =>
      autoAssign(
        480,
        700,
        [50, 50, 50],
        [{ id: id(), name: "Lunch", kind: "routine", start: 540, end: 560 }],
        id,
      ),
    ).toThrow(/Adjust/));
  it("rejects a negative period duration", () =>
    expect(() => autoAssign(480, 600, [-30], [], id)).toThrow(/positive/));
  it("rejects overlapping fixed routines", () =>
    expect(() =>
      autoAssign(
        480,
        600,
        [60],
        [
          { id: id(), name: "Assembly", kind: "routine", start: 480, end: 540 },
          { id: id(), name: "Lunch", kind: "routine", start: 530, end: 550 },
        ],
        id,
      ),
    ).toThrow(/overlap/));
  it("rejects teaching time exceeding dispersal", () =>
    expect(() => autoAssign(480, 600, [60, 60, 60], [], id)).toThrow(/exceed/));
  it("detects uncovered gaps", () =>
    expect(validateSlots(schedule({ slots: [] }))).toContain(
      "Schedule must cover arrival through dispersal exactly",
    ));
  it("detects overlaps", () => {
    const s = schedule();
    s.slots[1].start = 530;
    expect(validateSlots(s).some((m) => m.includes("overlap"))).toBe(true);
  });
  it("detects time outside school hours", () => {
    const s = schedule();
    s.slots[1].end = 610;
    expect(validateSlots(s).some((m) => m.includes("outside"))).toBe(true);
  });
  it("detects zero duration", () => {
    const s = schedule();
    s.slots[1].end = s.slots[1].start;
    expect(validateSlots(s).some((m) => m.includes("positive"))).toBe(true);
  });
});
describe("Recurrence and deterministic resolution", () => {
  it.each([
    ["2026-11-14", true],
    ["2026-11-07", false],
    ["2026-11-28", false],
  ])("resolves second Saturday on %s", (date, expected) =>
    expect(
      matches(rule({ type: "recurring", weekdays: [6], nth: 2 }), date),
    ).toBe(expected),
  );
  it("matches fourth Saturday independently", () =>
    expect(
      matches(rule({ type: "recurring", weekdays: [6], nth: 4 }), "2026-11-28"),
    ).toBe(true));
  it("supports a recurring two-week pattern", () => {
    const r = rule({
      type: "recurring",
      weekdays: [1],
      intervalWeeks: 2,
      anchorDate: "2026-11-02",
    });
    expect(matches(r, "2026-11-09")).toBe(false);
    expect(matches(r, "2026-11-16")).toBe(true);
  });
  it("prefers exact date over classroom weekly rules", () => {
    const b = fixture().boards[0];
    b.schedules = [
      schedule({
        name: "Weekly classroom",
        target: { scope: "classroom", ids: [classroom(b)] },
        rule: rule({ type: "weekly", weekdays: [1] }),
      }),
      schedule({
        name: "Exact board",
        rule: rule({ type: "date", date: "2026-11-02" }),
      }),
    ];
    expect(resolve(b, classroom(b), "2026-11-02").schedule?.name).toBe(
      "Exact board",
    );
  });
  it("prefers classroom over grade, section and board at the same date specificity", () => {
    const b = fixture().boards[0];
    b.schedules = [
      schedule({ name: "Board" }),
      schedule({
        name: "Section",
        target: { scope: "section", ids: [b.sections[0].id] },
      }),
      schedule({
        name: "Grade",
        target: { scope: "grades", ids: [b.grades[0].id] },
      }),
      schedule({
        name: "Classroom",
        target: { scope: "classrooms", ids: [classroom(b)] },
      }),
    ];
    expect(resolve(b, classroom(b), "2026-11-02").schedule?.name).toBe(
      "Classroom",
    );
  });
  it("reports equally specific schedules instead of silently choosing", () => {
    const b = fixture().boards[0];
    b.schedules = [schedule(), schedule({ name: "Duplicate priority" })];
    expect(resolve(b, classroom(b), "2026-11-02").status).toBe("conflict");
  });
  it("full holiday overrides a half-day schedule", () => {
    const b = fixture().boards[0];
    b.schedules = [
      schedule({
        name: "Half day",
        rule: rule({ type: "recurring", weekdays: [6], nth: 2 }),
      }),
    ];
    b.events = [
      {
        id: id(),
        name: "Festival holiday",
        kind: "holiday",
        target: { scope: "board", ids: [] },
        rule: rule({ type: "date", date: "2026-11-14" }),
      },
    ];
    expect(resolve(b, classroom(b), "2026-11-14")).toMatchObject({
      status: "holiday",
      reason: "Festival holiday",
    });
  });
  it("weekly non-working days have no schedule", () => {
    const b = fixture().boards[0];
    b.schedules = [schedule()];
    expect(resolve(b, classroom(b), "2026-11-01").status).toBe("non-working");
  });
  it("an explicit working-day exception opens a weekly non-working date", () => {
    const b = fixture().boards[0];
    b.schedules = [schedule()];
    b.events = [
      {
        id: id(),
        name: "Special Sunday",
        kind: "working",
        target: { scope: "board", ids: [] },
        rule: rule({ type: "date", date: "2026-11-01" }),
      },
    ];
    expect(resolve(b, classroom(b), "2026-11-01").status).toBe("working");
  });
  it("inactive classrooms return no active schedule", () => {
    const b = fixture().boards[0];
    expect(resolve(b, b.grades[0].classrooms[1].id, "2026-11-02").status).toBe(
      "inactive",
    );
  });
});
describe("Licensing and publication review", () => {
  it("counts inactive classrooms and all boards", () => {
    const c = fixture();
    c.boards[1].grades = structuredClone(c.boards[0].grades);
    expect(countClassrooms(c)).toBe(4);
  });
  it("reserves published classrooms until a draft deletion is published", () => {
    const p = fixture();
    const d = structuredClone(p);
    d.boards[0].grades[0].classrooms = [];
    expect(countClassrooms(d)).toBe(0);
    expect(licensedUsage(p, d)).toBe(2);
  });
  it("does not double-count unchanged classroom IDs across revisions", () => {
    const p = fixture();
    expect(licensedUsage(p, structuredClone(p))).toBe(2);
  });
  it("blocks entitlement violations", () =>
    expect(
      review(fixture(), 1, "2026-11-02", "2026-11-02").some(
        (x) => x.severity === "error" && x.message.includes("entitlement"),
      ),
    ).toBe(true));
  it("treats unassigned grades as warnings", () => {
    const c = fixture();
    c.boards[0].grades[0].sectionId = null;
    expect(
      review(c, 50, "2026-11-02", "2026-11-02").find((i) =>
        i.message.includes("unassigned"),
      )?.severity,
    ).toBe("warning");
  });
  it("allows zero active classrooms", () => {
    const c = fixture();
    c.boards[0].grades[0].classrooms = [];
    expect(
      review(c, 50, "2026-11-02", "2026-11-02").some(
        (i) => i.severity === "error",
      ),
    ).toBe(false);
  });
  it("blocks case-insensitive duplicate classroom names within a board", () => {
    const c = fixture();
    c.boards[0].grades[0].classrooms[1].name = "grade 1a";
    expect(
      review(c, 50, "2026-11-02", "2026-11-02").some((i) =>
        i.message.includes("duplicate names"),
      ),
    ).toBe(true);
  });
  it("blocks unresolved schedule ambiguity on any academic date", () => {
    const c = fixture();
    c.boards[0].schedules = [schedule(), schedule()];
    expect(
      review(c, 50, "2026-11-01", "2026-11-03").some(
        (i) => i.severity === "error" && i.message.includes("Equal-priority"),
      ),
    ).toBe(true);
  });
  it("blocks invalid target references", () => {
    const c = fixture();
    c.boards[0].schedules = [
      schedule({ target: { scope: "grade", ids: [id()] } }),
    ];
    expect(
      review(c, 50, "2026-11-02", "2026-11-02").some((i) =>
        i.message.includes("invalid target"),
      ),
    ).toBe(true);
  });
  it("copies years without date-specific holidays or date-specific bell exceptions", () => {
    const c = fixture();
    const b = c.boards[0];
    b.schedules = [
      schedule(),
      schedule({ rule: rule({ type: "date", date: "2026-11-14" }) }),
    ];
    b.events = [
      {
        id: id(),
        name: "Festival",
        kind: "holiday",
        target: { scope: "board", ids: [] },
        rule: rule({ type: "date", date: "2026-11-14" }),
      },
      {
        id: id(),
        name: "Fourth Saturday",
        kind: "holiday",
        target: { scope: "board", ids: [] },
        rule: rule({ type: "recurring", weekdays: [6], nth: 4 }),
      },
    ];
    const d = copyYear(c);
    expect(d.boards[0].schedules.length).toBe(1);
    expect(d.boards[0].events.map((e) => e.name)).toEqual(["Fourth Saturday"]);
    expect(c.boards[0].schedules.length).toBe(2);
  });
  it("validates recurrence fields server-side", () => {
    const c = fixture();
    c.boards[0].schedules = [schedule({ rule: rule({ type: "date" }) })];
    expect(configSchema.safeParse(c).success).toBe(false);
  });
  it("uses exactly sixty days for deletion", () => {
    const now = new Date("2026-11-14T12:01:02Z");
    expect(deletionDue(now).getTime() - now.getTime()).toBe(60 * 86400000);
  });
});
describe("Credential protection", () => {
  it("creates salted Argon2id hashes and validates passwords", async () => {
    const a = await hash("DevelopmentPassword!2026");
    const b = await hash("DevelopmentPassword!2026");
    expect(a).toMatch(/^\$argon2id\$v=19/);
    expect(a).not.toBe(b);
    expect(await verify(a, "DevelopmentPassword!2026")).toBe(true);
    expect(await verify(a, "WrongPassword!2026")).toBe(false);
  });
  it("rejects malformed stored hashes", async () =>
    expect(await verify("not-a-hash", "password")).toBe(false));
});

describe("Draft deletion safety", () => {
  it("deleting a section unassigns its grades while preserving classrooms and the original publication", () => {
    const original = fixture().boards[0];
    const next = removeFromBoard(original, "section", original.sections[0].id);
    expect(next.sections).toHaveLength(0);
    expect(next.grades[0].sectionId).toBeNull();
    expect(next.grades[0].classrooms).toHaveLength(2);
    expect(original.grades[0].sectionId).not.toBeNull();
  });
  it("deleting a grade removes its classrooms and prunes schedule targets without mutating the source", () => {
    const original = fixture().boards[0];
    original.schedules = [
      schedule({ target: { scope: "classroom", ids: [classroom(original)] } }),
    ];
    const next = removeFromBoard(original, "grade", original.grades[0].id);
    expect(next.grades).toHaveLength(0);
    expect(next.schedules).toHaveLength(0);
    expect(original.grades[0].classrooms).toHaveLength(2);
  });
  it("deleting one classroom retains other members of a group-targeted schedule", () => {
    const original = fixture().boards[0];
    original.schedules = [
      schedule({
        target: {
          scope: "classrooms",
          ids: original.grades[0].classrooms.map((c) => c.id),
        },
      }),
    ];
    const next = removeFromBoard(original, "classroom", classroom(original));
    expect(next.grades[0].classrooms).toHaveLength(1);
    expect(next.schedules[0].target.ids).toEqual([
      original.grades[0].classrooms[1].id,
    ]);
  });
  it("copies academic years without shared mutable grade or classroom arrays", () => {
    const original = fixture();
    const copied = copyYear(original);
    copied.boards[0].grades[0].name = "New year";
    expect(original.boards[0].grades[0].name).toBe("Grade 1");
  });
});
