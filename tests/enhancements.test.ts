import { describe, it, expect } from "vitest";
import { randomUUID as id } from "node:crypto";
import { emptyConfig, type Schedule } from "../packages/domain/src";
import {
  configurationChanges,
  scheduleDiagnostics,
  selectedClassrooms,
  appliesToSelection,
  calendarDay,
  onboardingChecklist,
  platformSettingsSchema,
} from "../packages/domain/src/enhancements";
import {
  settleNavigationGuards,
  type GuardTask,
} from "../apps/web/lib/navigation-core";
function fixture() {
  const c = emptyConfig(["CBSE"], id);
  const b = c.boards[0];
  b.sections = [
    { id: id(), name: "Primary" },
    { id: id(), name: "Secondary" },
  ];
  b.grades = [
    {
      id: id(),
      name: "Grade 1",
      active: true,
      sectionId: b.sections[0].id,
      classrooms: [
        { id: id(), name: "1A", active: true },
        { id: id(), name: "1B", active: true },
      ],
    },
    {
      id: id(),
      name: "Grade 9",
      active: true,
      sectionId: b.sections[1].id,
      classrooms: [{ id: id(), name: "9A", active: true }],
    },
  ];
  b.schedules = [
    {
      id: id(),
      name: "Regular",
      arrival: 480,
      dispersal: 600,
      target: { scope: "board", ids: [] },
      rule: { type: "default", weekdays: [], intervalWeeks: 1 },
      slots: [
        { id: id(), name: "P1", kind: "period", start: 480, end: 540 },
        { id: id(), name: "P2", kind: "period", start: 540, end: 600 },
      ],
    },
  ];
  return c;
}
describe("Publication changes", () => {
  it("identifies initial setup as additions", () =>
    expect(
      configurationChanges(null, fixture()).every((c) => c.kind === "added"),
    ).toBe(true));
  it("identifies exactly which grade fields changed", () => {
    const a = fixture(),
      b = structuredClone(a);
    b.boards[0].grades[0].active = false;
    const diff = configurationChanges(a, b);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      kind: "updated",
      entity: "Grade",
      fields: [{ field: "active", before: true, after: false }],
    });
  });
  it("includes dependent classroom deletions in review", () => {
    const a = fixture(),
      b = structuredClone(a);
    b.boards[0].grades.shift();
    const removed = configurationChanges(a, b);
    expect(removed.filter((c) => c.entity === "Classroom")).toHaveLength(2);
    expect(removed.every((c) => c.kind === "deleted")).toBe(true);
  });
  it("does not flag reordered objects or arrays of independent entities", () => {
    const a = fixture(),
      b = structuredClone(a);
    b.boards[0].grades.reverse();
    expect(configurationChanges(a, b)).toEqual([]);
  });
  it("compares slot changes without mutating publications", () => {
    const a = fixture(),
      b = structuredClone(a);
    b.boards[0].schedules[0].slots[0].end = 530;
    expect(configurationChanges(a, b)[0].fields[0].field).toBe("slots");
    expect(a.boards[0].schedules[0].slots[0].end).toBe(540);
  });
});
describe("Editor diagnostics", () => {
  it("marks both sides of an overlap and gives corrective guidance", () => {
    const s = fixture().boards[0].schedules[0];
    s.slots[1].start = 510;
    const d = scheduleDiagnostics(s).find((d) =>
      d.message.includes("overlaps"),
    );
    expect(d?.slotIds).toEqual(
      expect.arrayContaining(s.slots.map((p) => p.id)),
    );
    expect(d?.suggestion).toMatch(/shorten/);
  });
  it("finds nested overlaps rather than checking only adjacent slots", () => {
    const s = fixture().boards[0].schedules[0];
    s.slots[0].end = 600;
    s.slots[1].start = 500;
    s.slots[1].end = 510;
    s.slots.push({
      id: id(),
      name: "P3",
      kind: "period",
      start: 520,
      end: 530,
    });
    expect(
      scheduleDiagnostics(s).filter((d) => d.message.includes("overlaps")),
    ).toHaveLength(2);
  });
  it("reports exact uncovered minutes", () => {
    const s = fixture().boards[0].schedules[0];
    s.slots[1].start = 550;
    expect(
      scheduleDiagnostics(s).some((d) => d.message.includes("10 minutes")),
    ).toBe(true);
  });
  it("reports out-of-day and nonpositive durations", () => {
    const s = fixture().boards[0].schedules[0];
    s.slots[0].start = 470;
    s.slots[1].end = 530;
    expect(
      scheduleDiagnostics(s).some((d) => d.message.includes("outside")),
    ).toBe(true);
    expect(
      scheduleDiagnostics(s).some((d) => d.message.includes("non-positive")),
    ).toBe(true);
  });
  it("accepts a complete valid day", () =>
    expect(scheduleDiagnostics(fixture().boards[0].schedules[0])).toEqual([]));
});
describe("Calendar scopes and outputs", () => {
  it("filters board, section, grade and classroom independently", () => {
    const b = fixture().boards[0];
    expect(selectedClassrooms(b, {})).toHaveLength(3);
    expect(selectedClassrooms(b, { sectionId: b.sections[0].id })).toHaveLength(
      2,
    );
    expect(selectedClassrooms(b, { gradeId: b.grades[1].id })).toHaveLength(1);
    expect(
      selectedClassrooms(b, { classroomId: b.grades[0].classrooms[0].id }),
    ).toHaveLength(1);
  });
  it("does not silently choose the first classroom for board output", () => {
    const b = fixture().boards[0];
    b.events = [
      {
        id: id(),
        name: "Primary holiday",
        kind: "holiday",
        target: { scope: "section", ids: [b.sections[0].id] },
        rule: {
          type: "date",
          date: "2026-11-16",
          weekdays: [],
          intervalWeeks: 1,
        },
      },
    ];
    const r = calendarDay(b, selectedClassrooms(b, {}), "2026-11-16");
    expect(r.status).toBe("mixed");
    expect(r.results.filter((r) => r.status === "holiday")).toHaveLength(2);
    expect(r.results.filter((r) => r.status === "working")).toHaveLength(1);
  });
  it("filters grouped targets by actual classroom applicability", () => {
    const b = fixture().boards[0];
    const rooms = selectedClassrooms(b, { sectionId: b.sections[0].id });
    expect(
      appliesToSelection({ scope: "grades", ids: [b.grades[1].id] }, b, rooms),
    ).toBe(false);
    expect(appliesToSelection({ scope: "board", ids: [] }, b, rooms)).toBe(
      true,
    );
  });
  it("displays an invalid applicable schedule as invalid", () => {
    const b = fixture().boards[0];
    b.schedules[0].slots[1].start = 510;
    expect(calendarDay(b, selectedClassrooms(b, {}), "2026-11-16").status).toBe(
      "invalid",
    );
  });
  it("shows opposing equal-priority calendar exceptions as a conflict", () => {
    const b = fixture().boards[0];
    const shared = {
      target: { scope: "board" as const, ids: [] },
      rule: {
        type: "date" as const,
        date: "2026-11-16",
        weekdays: [],
        intervalWeeks: 1,
      },
    };
    b.events = [
      { ...shared, id: id(), name: "Closed", kind: "holiday" },
      { ...shared, id: id(), name: "Open", kind: "working" },
    ];
    expect(calendarDay(b, selectedClassrooms(b, {}), "2026-11-16").status).toBe(
      "conflict",
    );
  });
});
describe("Onboarding and settings", () => {
  const org = {
    name: "Trust",
    legalName: "Trust Ltd",
    address: "Road",
    city: "Pune",
    state: "MH",
    postalCode: "411001",
    contactName: "Asha",
    phone: "9999999999",
    email: "admin@example.com",
    completedSteps: [1, 2, 3, 4, 5],
  };
  const school = {
    id: id(),
    name: "School",
    logo: "logo.png",
    officer: "Asha",
    phone: "9999",
    email: "school@example.com",
  };
  const subscription = {
    status: "ACTIVE",
    startsAt: "2026-01-01",
    endsAt: "2027-12-31",
    agreementStatus: "SIGNED",
    paymentStatus: "PAID",
    classroomLimit: 40, userLimit: 1,
  };
  it("recalculates missing information even after a step was marked complete", () => {
    const c = onboardingChecklist(
      org,
      [{ ...school, logo: "" }],
      [subscription],
      new Date("2026-11-14"),
    );
    expect(c[1].complete).toBe(false);
    expect(c[1].blockers.join()).toMatch(/logo/);
  });
  it("shares one organization contract across all institutions", () => {
    const c = onboardingChecklist(
      org,
      [school, { ...school, id: id(), name: "Unlicensed school" }],
      [subscription],
      new Date("2026-11-14"),
    );
    expect(c[2].blockers).toEqual([]);
    expect(c[3].complete).toBe(true);
  });
  it("rejects expired entitlements for onboarding", () =>
    expect(
      onboardingChecklist(
        org,
        [school],
        [subscription],
        new Date("2028-01-01"),
      )[2].complete,
    ).toBe(false));
  it("keeps activation and first-login progress separate", () => {
    const c = onboardingChecklist(
      { ...org, activatedAt: new Date() },
      [school],
      [subscription],
      new Date("2026-11-14"),
    );
    expect(c[5].complete).toBe(true);
    expect(c[6].complete).toBe(false);
  });
  it("only accepts supported platform settings and valid values", () => {
    expect(
      platformSettingsSchema.safeParse({ defaultClassroomLimit: -1 }).success,
    ).toBe(false);
    expect(
      platformSettingsSchema.safeParse({ supportEmail: "bad" }).success,
    ).toBe(false);
    expect(
      platformSettingsSchema.safeParse({ deletionRetentionDays: 2 }).success,
    ).toBe(false);
    expect(platformSettingsSchema.parse({}).defaultClassroomLimit).toBe(40);
  });
});
describe("Navigation save ordering", () => {
  it("saves a parent draft dirtied by committing an editor before allowing navigation", async () => {
    let editor = true,
      parent = false;
    const order: string[] = [];
    const guards: GuardTask[] = [
      {
        label: "Draft",
        isDirty: () => parent,
        save: async () => {
          order.push("draft");
          parent = false;
        },
        discard: () => {
          parent = false;
        },
      },
      {
        label: "Editor",
        isDirty: () => editor,
        save: async () => {
          order.push("editor");
          editor = false;
          parent = true;
        },
        discard: () => {
          editor = false;
        },
      },
    ];
    await settleNavigationGuards(() => guards, "save");
    expect(order).toEqual(["editor", "draft"]);
  });
  it("preserves edits and prevents navigation after a save failure", async () => {
    const guard: GuardTask = {
      label: "Draft",
      isDirty: () => true,
      save: async () => {
        throw Error("Database unavailable");
      },
      discard: () => {},
    };
    await expect(settleNavigationGuards(() => [guard], "save")).rejects.toThrow(
      "Database unavailable",
    );
    expect(guard.isDirty()).toBe(true);
  });
  it("supports an explicit discard without saving", async () => {
    let dirty = true,
      saves = 0;
    await settleNavigationGuards(
      () => [
        {
          label: "Draft",
          isDirty: () => dirty,
          save: async () => {
            saves++;
          },
          discard: () => {
            dirty = false;
          },
        },
      ],
      "discard",
    );
    expect(dirty).toBe(false);
    expect(saves).toBe(0);
  });
  it("rejects a dirty guard that cannot save", async () =>
    await expect(
      settleNavigationGuards(
        () => [{ label: "Upload", isDirty: () => true, discard: () => {} }],
        "save",
      ),
    ).rejects.toThrow(/Upload/));
  it("does not loop indefinitely when a guard stays dirty", async () =>
    await expect(
      settleNavigationGuards(
        () => [
          {
            label: "Stale",
            isDirty: () => true,
            save: async () => {},
            discard: () => {},
          },
        ],
        "save",
      ),
    ).rejects.toThrow(/still pending/));
});
