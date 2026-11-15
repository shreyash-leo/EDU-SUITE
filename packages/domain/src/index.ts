import { z } from "zod";
const id = z.string().uuid();
export const targetSchema = z.object({
  scope: z.enum([
    "school",
    "boards",
    "sections",
    "board",
    "section",
    "grade",
    "classroom",
    "grades",
    "classrooms",
  ]),
  ids: z.array(id).default([]),
});
export const ruleSchema = z
  .object({
    type: z.enum(["default", "weekly", "date", "recurring"]),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    nth: z.number().int().min(1).max(5).optional(),
    intervalWeeks: z.number().int().min(1).max(52).default(1),
    anchorDate: z.string().optional(),
    startsOn: z.string().optional(),
    endsOn: z.string().optional(),
  })
  .superRefine((v, c) => {
    for (const date of [v.startsOn, v.endsOn]) if (date !== undefined && !validDate(date)) c.addIssue({ code: "custom", message: "Use a valid start/end date for the recurring range" });
    if (v.startsOn && v.endsOn && v.startsOn > v.endsOn) c.addIssue({ code: "custom", message: "The recurring range must end on or after its start" });
    if (v.type === "date" && (!v.date || !validDate(v.date)))
      c.addIssue({
        code: "custom",
        message: "A valid specific date is required",
      });
    if (["weekly", "recurring"].includes(v.type) && !v.weekdays.length)
      c.addIssue({ code: "custom", message: "Choose at least one weekday" });
    if (v.intervalWeeks > 1 && (!v.anchorDate || !validDate(v.anchorDate)))
      c.addIssue({
        code: "custom",
        message: "An interval requires an anchor date",
      });
  });
export const slotSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["period", "routine"]),
  start: z.number().int().min(0).max(1439),
  end: z.number().int().min(1).max(1440),
});
export const scheduleSchema = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  arrival: z.number().int().min(0).max(1439),
  dispersal: z.number().int().min(1).max(1440),
  dayType: z.enum(["full", "half"]).optional(),
  target: targetSchema,
  rule: ruleSchema,
  slots: z.array(slotSchema).max(100),
});
export const eventSchema = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["holiday", "working", "half-day"]),
  target: targetSchema,
  rule: ruleSchema,
  overridesHoliday: z.boolean().optional(),
}).superRefine((event, context) => {
  if (event.overridesHoliday && (event.kind !== "working" || event.rule.type !== "date"))
    context.addIssue({ code: "custom", message: "A holiday reopening requires a specific-date working-day exception" });
});
export const boardSchema = z.object({
  id,
  name: z.string().trim().min(1),
  nonWorkingDays: z.array(z.number().int().min(0).max(6)).default([0]),
  sections: z.array(z.object({ id, name: z.string().trim().min(1).max(100) })),
  grades: z.array(
    z.object({
      id,
      name: z.string().trim().min(1).max(100),
      active: z.boolean(),
      sectionId: id.nullable(),
      classrooms: z.array(
        z.object({
          id,
          name: z.string().trim().min(1).max(100),
          active: z.boolean(),
        }),
      ),
    }),
  ),
  schedules: z.array(scheduleSchema),
  events: z.array(eventSchema),
});
export const configSchema = z.object({ boards: z.array(boardSchema).max(20) });
export type Config = z.infer<typeof configSchema>;
export type Board = Config["boards"][number];
export type Schedule = z.infer<typeof scheduleSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type Target = z.infer<typeof targetSchema>;
export type Slot = z.infer<typeof slotSchema>;
export type Issue = { severity: "error" | "warning"; message: string };
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
export function countClassrooms(c: Config) {
  return c.boards.flatMap((b) => b.grades.flatMap((g) => g.classrooms)).length;
}
export function licensedUsage(published: Config | null, draft: Config) {
  return Math.max(published ? countClassrooms(published) : 0, countClassrooms(draft));
}
export function organizationUtilization(institutions: {
  institutionId: string;
  years: { yearId: string; published: number; draft: number }[];
}[]) {
  const rows = institutions.map((i) => ({
    institutionId: i.institutionId,
    years: i.years,
    used: Math.max(0, ...i.years.map((y) => Math.max(y.published, y.draft))),
  }));
  return { institutions: rows, used: rows.reduce((n, i) => n + i.used, 0) };
}
export function organizationCategory(status: string) {
  if (status === "ACTIVE") return "ACTIVE";
  if (["DRAFT", "ONBOARDING"].includes(status)) return "ONBOARDING";
  return "INACTIVE";
}
export function validateSlots(s: Schedule): string[] {
  const e: string[] = [];
  if (s.dispersal <= s.arrival) e.push("Dispersal must be after arrival");
  if (s.slots.some((p, n) => n > 0 && p.start < s.slots[n - 1].start)) e.push("Slots must be in chronological order");
  const slots = [...s.slots].sort((a, b) => a.start - b.start);
  let cursor = s.arrival;
  for (const p of slots) {
    if (p.end <= p.start) e.push(`${p.name}: duration must be positive`);
    if (p.start < cursor) e.push(`${p.name}: overlap with preceding slot`);
    if (p.start > cursor) e.push(`${p.name}: uncovered gap before slot`);
    if (p.start < s.arrival || p.end > s.dispersal)
      e.push(`${p.name}: outside school hours`);
    cursor = Math.max(cursor, p.end);
  }
  if (cursor !== s.dispersal)
    e.push("Schedule must cover arrival through dispersal exactly");
  return e;
}
export function autoAssign(
  arrival: number,
  dispersal: number,
  durations: number[],
  routines: Slot[],
  makeId: () => string,
): Slot[] {
  if (
    dispersal <= arrival ||
    durations.some((d) => !Number.isInteger(d) || d <= 0)
  )
    throw Error("Use positive period durations and a valid school day");
  const anchors = [...routines].sort((a, b) => a.start - b.start);
  let previous = arrival;
  for (const r of anchors) {
    if (r.start < previous || r.end <= r.start || r.end > dispersal)
      throw Error("Fixed routines overlap or fall outside school hours");
    previous = r.end;
  }
  const output: Slot[] = [];
  let cursor = arrival;
  let n = 0;
  for (const r of [
    ...anchors,
    {
      id: makeId(),
      name: "End",
      kind: "routine" as const,
      start: dispersal,
      end: dispersal,
    },
  ]) {
    while (cursor < r.start && n < durations.length) {
      const d = durations[n];
      if (cursor + d > r.start)
        throw Error(
          `Period ${n + 1} cannot fit before ${r.name}. Adjust a period duration or routine time.`,
        );
      output.push({
        id: makeId(),
        name: `Period ${n + 1}`,
        kind: "period",
        start: cursor,
        end: cursor + d,
      });
      cursor += d;
      n++;
    }
    if (cursor !== r.start)
      throw Error(
        `Uncovered time before ${r.name}. Adjust period count or durations.`,
      );
    if (r.end > r.start) output.push(r);
    cursor = r.end;
  }
  if (n !== durations.length)
    throw Error(
      "Required periods exceed the school day. Reduce periods or extend dispersal.",
    );
  return output;
}
export function matches(rule: Rule, date: string) {
  if (!validDate(date) || rule.startsOn && date < rule.startsOn || rule.endsOn && date > rule.endsOn) return false;
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = d.getUTCDay();
  if (rule.type === "date") return date === rule.date;
  if (rule.type === "default") return true;
  if (!rule.weekdays.includes(weekday)) return false;
  if (rule.nth && Math.ceil(d.getUTCDate() / 7) !== rule.nth) return false;
  if (rule.intervalWeeks > 1) {
    const anchor = new Date(`${rule.anchorDate}T00:00:00Z`);
    const diff = Math.floor((d.getTime() - anchor.getTime()) / 86400000);
    if (diff < 0 || Math.floor(diff / 7) % rule.intervalWeeks !== 0)
      return false;
  }
  return true;
}
export function targetRank(t: Target, b: Board, classroomId: string) {
  const grade = b.grades.find((g) =>
    g.classrooms.some((c) => c.id === classroomId),
  );
  if (!grade) return 0;
  switch (t.scope) {
    case "school":
      return 1;
    case "boards":
      return t.ids.includes(b.id) ? 2 : 0;
    case "board":
      return 2;
    case "section":
    case "sections":
      return grade.sectionId && t.ids.includes(grade.sectionId) ? 3 : 0;
    case "grade":
    case "grades":
      return t.ids.includes(grade.id) ? 4 : 0;
    case "classroom":
    case "classrooms":
      return t.ids.includes(classroomId) ? 5 : 0;
  }
}
const dateRank = { default: 0, weekly: 1, recurring: 2, date: 3 };
function ranked<T extends { target: Target; rule: Rule }>(
  items: T[],
  b: Board,
  c: string,
  date: string,
) {
  return items
    .map((item) => ({
      item,
      rank: dateRank[item.rule.type] * 10 + targetRank(item.target, b, c),
    }))
    .filter((x) => x.rank % 10 > 0 && matches(x.item.rule, date))
    .sort((a, b) => b.rank - a.rank);
}
export const sharedScopes = new Set(["school", "boards", "sections", "grades", "classrooms"]);
// Shared rules are stored once, on their owning board, within the same revision.
export function applicableRules(b: Board, config?: Config) {
  return {
    schedules: (config?.boards || [b]).flatMap((owner) => owner.schedules.filter((r) => owner.id === b.id || sharedScopes.has(r.target.scope))),
    events: (config?.boards || [b]).flatMap((owner) => owner.events.filter((r) => owner.id === b.id || sharedScopes.has(r.target.scope))),
  };
}
export function resolve(
  b: Board,
  classroom: string,
  date: string,
  config?: Config,
): { status: string; schedule?: Schedule; reason: string } {
  if (!validDate(date)) throw Error("Invalid preview date");
  const grade = b.grades.find((g) =>
    g.classrooms.some((c) => c.id === classroom),
  );
  if (!grade) throw Error("Classroom does not belong to board");
  if (
    !grade.active ||
    !grade.classrooms.find((c) => c.id === classroom)?.active
  )
    return { status: "inactive", reason: "Grade or classroom is inactive" };
  const rules = applicableRules(b, config);
  const ev = ranked(rules.events, b, classroom, date);
  const holiday = ev.find((x) => x.item.kind === "holiday");
  const working = ev.find((x) => x.item.kind === "working");
  const reopening = working && working.item.overridesHoliday === true && working.item.rule.type === "date";
  if (holiday && working && holiday.rank === working.rank)
    return {
      status: "conflict",
      reason: "Conflicting holiday and working-day exceptions",
    };
  if (holiday && (!reopening || holiday.rank >= working.rank))
    return { status: "holiday", reason: holiday.item.name };
  const half = ev.find((x) => x.item.kind === "half-day");
  const schedules = ranked(rules.schedules, b, classroom, date);
  const explicitHalfDay = schedules[0]?.item.dayType === "half" && schedules[0].item.rule.type !== "default";
  if (
    b.nonWorkingDays.includes(new Date(date + "T00:00:00Z").getUTCDay()) &&
    !working && !half && !explicitHalfDay
  )
    return { status: "non-working", reason: "Weekly non-working day" };
  if (!schedules.length)
    return { status: "missing", reason: "No applicable bell schedule" };
  if (schedules.length > 1 && schedules[0].rank === schedules[1].rank)
    return {
      status: "conflict",
      reason: `Equal-priority schedules: ${schedules
        .filter((s) => s.rank === schedules[0].rank)
        .map((s) => s.item.name)
        .join(", ")}`,
    };
  const selected = schedules[0];
  const timing = validateSlots(selected.item);
  if (timing.length) return { status: "invalid", schedule: selected.item, reason: timing.join("; ") };
  if (half && (!working || working.rank <= half.rank) && (selected.item.dayType !== "half" || selected.rank < half.rank))
    return { status: "invalid", schedule: selected.item, reason: "Half-day event requires a matching half-day bell schedule at the same or higher priority" };
  return {
    status: "working",
    schedule: selected.item,
    reason: `${selected.item.name} · ${selected.item.dayType === "half" ? "Half-day" : "Working day"} · ${selected.item.rule.type} / ${selected.item.target.scope}${reopening && holiday ? " · explicit holiday reopening: " + working.item.name : ""}`,
  };
}
export function review(
  c: Config,
  limit: number,
  start: string,
  end: string,
): Issue[] {
  const out: Issue[] = [];
  const err = (message: string) => out.push({ severity: "error", message });
  const warn = (message: string) => out.push({ severity: "warning", message });
  if (countClassrooms(c) > limit) err("Classroom entitlement exceeded");
  if (!c.boards.length) warn("No academic boards configured");
  if (new Set(c.boards.map((b) => b.name.toLowerCase())).size !== c.boards.length) err("Boards: duplicate names");
  const allIds = new Set<string>();
  const seen = (name: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) err(`${name}: duplicate names`);
  };
  for (const b of c.boards) {
    seen(
      b.name + " sections",
      b.sections.map((s) => s.name.toLowerCase()),
    );
    seen(
      b.name + " grades",
      b.grades.map((g) => g.name.toLowerCase()),
    );
    seen(
      b.name + " classrooms",
      b.grades.flatMap((g) => g.classrooms.map((r) => r.name.toLowerCase())),
    );
    for (const item of [
      b,
      ...b.sections,
      ...b.grades,
      ...b.grades.flatMap((g) => g.classrooms),
      ...b.schedules,
      ...b.events,
    ]) {
      if (allIds.has(item.id)) err("Duplicate permanent entity ID");
      allIds.add(item.id);
    }
    for (const g of b.grades) {
      if (g.sectionId && !b.sections.some((s) => s.id === g.sectionId))
        err(`${g.name}: invalid section`);
      if (!g.sectionId) warn(`${g.name}: academic section is unassigned`);
    }
    for (const s of b.schedules) {
      if (new Set(s.slots.map((p) => p.id)).size !== s.slots.length) err(`${s.name}: duplicate slot IDs`);
      for (const m of validateSlots(s)) err(`${b.name} / ${s.name}: ${m}`);
    }
    for (const x of [...b.schedules, ...b.events]) {
      const sharedBoards = sharedScopes.has(x.target.scope) ? c.boards : [b];
      const valid =
        x.target.scope === "boards" ? c.boards.map((item) => item.id) :
        x.target.scope === "board" || x.target.scope === "school"
          ? []
          : ["section", "sections"].includes(x.target.scope)
            ? sharedBoards.flatMap((b) => b.sections.map((s) => s.id))
            : ["grade", "grades"].includes(x.target.scope)
              ? sharedBoards.flatMap((b) => b.grades.map((g) => g.id))
              : sharedBoards.flatMap((b) => b.grades.flatMap((g) => g.classrooms.map((r) => r.id)));
      if (
        !["board", "school"].includes(x.target.scope) &&
        (!x.target.ids.length || x.target.ids.some((id) => !valid.includes(id)))
      )
        err(`${x.name}: invalid target reference`);
    }
    const missing = new Set<string>();
    const conflicts = new Set<string>();
    for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10);
      for (const g of b.grades)
        for (const r of g.classrooms) {
          const result = resolve(b, r.id, date, c);
          if (["conflict", "invalid"].includes(result.status)) conflicts.add(`${date} / ${r.name}: ${result.reason}`);
          if (result.status === "missing") missing.add(r.name);
          const ev = ranked(
            applicableRules(b, c).events.filter((e) => e.kind !== "half-day"),
            b,
            r.id,
            date,
          );
          if (
            ev.length > 1 &&
            ev[0].rank === ev[1].rank &&
            ev[0].item.kind !== ev[1].item.kind
          )
            conflicts.add(
              `${date}: conflicting holiday / working-day exceptions`,
            );

        }
    }
    for (const m of conflicts) err(m);
    for (const m of missing)
      warn(`${m}: no bell schedule on one or more working days`);
  }
  return out;
}
export function emptyConfig(boards: string[], makeId: () => string): Config {
  return {
    boards: boards.map((name) => ({
      id: makeId(),
      name,
      nonWorkingDays: [0],
      sections: [],
      grades: [],
      schedules: [],
      events: [],
    })),
  };
}
export function copyYear(c: Config): Config {
  return {
    boards: structuredClone(c).boards.map((b) => ({
      ...b,
      events: b.events.filter((e) => e.rule.type !== "date" && !e.rule.startsOn && !e.rule.endsOn),
      schedules: b.schedules.filter((s) => s.rule.type !== "date" && !s.rule.startsOn && !s.rule.endsOn),
    })),
  };
}
export function deletionDue(now: Date) {
  return new Date(now.getTime() + 60 * 86400000);
}
export function removeFromBoard(board: Board, kind: string, id: string): Board {
  const next = structuredClone(board);
  const removed = new Set([id]);
  if (kind === "section") {
    next.sections = next.sections.filter((s) => s.id !== id);
    next.grades = next.grades.map((g) => ({
      ...g,
      sectionId: g.sectionId === id ? null : g.sectionId,
    }));
  } else if (kind === "grade") {
    for (const room of next.grades.find((g) => g.id === id)?.classrooms || [])
      removed.add(room.id);
    next.grades = next.grades.filter((g) => g.id !== id);
  } else if (kind === "classroom")
    next.grades = next.grades.map((g) => ({
      ...g,
      classrooms: g.classrooms.filter((c) => c.id !== id),
    }));
  else if (kind === "schedule") {
    next.schedules = next.schedules.filter((s) => s.id !== id);
    return next;
  } else if (kind === "event") {
    next.events = next.events.filter((e) => e.id !== id);
    return next;
  } else throw Error("Unsupported deletion type");
  const prune = <T extends { target: Target }>(items: T[]) =>
    items
      .map((item) => ({
        ...item,
        target: {
          ...item.target,
          ids: item.target.ids.filter((key) => !removed.has(key)),
        },
      }))
      .filter(
        (item) => ["board", "school"].includes(item.target.scope) || item.target.ids.length > 0,
      );
  next.schedules = prune(next.schedules);
  next.events = prune(next.events);
  return next;
}


export function removeFromConfig(config: Config, boardId: string, kind: string, entityId: string): Config {
  const owner = config.boards.find((b) => b.id === boardId);
  if (!owner) throw Error("Board does not belong to this school year");
  const removed = new Set([entityId]);
  if (kind === "grade") for (const c of owner.grades.find((g) => g.id === entityId)?.classrooms || []) removed.add(c.id);
  const next = structuredClone(config);
  next.boards = next.boards.map((b) => b.id === boardId ? removeFromBoard(b, kind, entityId) : b);
  for (const b of next.boards) {
    const prune = <T extends { target: Target }>(rows: T[]) => rows.map((r) => ({ ...r, target: { ...r.target, ids: r.target.ids.filter((id) => !removed.has(id)) } }))
      .filter((r) => ["board", "school"].includes(r.target.scope) || r.target.ids.length > 0);
    b.schedules = prune(b.schedules); b.events = prune(b.events);
  }
  return next;
}


export function recurrenceDates(rule: Rule, start: string, end: string) {
  ruleSchema.parse(rule);
  if (!validDate(start) || !validDate(end) || end < start || Date.parse(end) - Date.parse(start) > 550 * 86400000) throw Error("Choose a valid academic-year range of at most 550 days");
  const dates: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000) { const date = new Date(t).toISOString().slice(0, 10); if (matches(rule, date)) dates.push(date); }
  return dates;
}
