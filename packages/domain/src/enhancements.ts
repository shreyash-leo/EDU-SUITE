import { z } from "zod";
import {
  type Board,
  type Config,
  type Schedule,
  type Target,
  resolve,
  targetRank,
} from "./index";
export type SlotDiagnostic = {
  slotIds: string[];
  message: string;
  suggestion: string;
};
export function scheduleDiagnostics(s: Schedule): SlotDiagnostic[] {
  const out: SlotDiagnostic[] = [];
  const add = (slotIds: string[], message: string, suggestion: string) =>
    out.push({ slotIds, message, suggestion });
  if (s.dispersal <= s.arrival)
    add([], "Dispersal must follow arrival.", "Set a later dispersal time.");
  const slots = [...s.slots].sort((a, b) => a.start - b.start);
  let cursor = s.arrival;
  for (let n = 0; n < slots.length; n++) {
    const p = slots[n];
    if (p.end <= p.start)
      add(
        [p.id],
        `${p.name} has a non-positive duration.`,
        "Set its end after its start.",
      );
    if (p.start < s.arrival || p.end > s.dispersal)
      add(
        [p.id],
        `${p.name} falls outside the school day.`,
        "Move the slot inside arrival and dispersal, or adjust school hours.",
      );
    const overlaps = slots
      .slice(0, n)
      .filter((q) => q.start < p.end && q.end > p.start);
    if (overlaps.length)
      add(
        [p.id, ...overlaps.map((q) => q.id)],
        `${p.name} overlaps ${overlaps.map((q) => q.name).join(", ")}.`,
        "Move or shorten the highlighted slots so their times do not overlap.",
      );
    if (p.start > cursor)
      add(
        [p.id],
        `${p.start - cursor} minutes are uncovered before ${p.name}.`,
        "Add a routine or period, or extend the preceding slot to cover the gap.",
      );
    cursor = Math.max(cursor, p.end);
  }
  if (cursor < s.dispersal)
    add(
      slots.length ? [slots.at(-1)!.id] : [],
      `${s.dispersal - cursor} minutes are uncovered at the end of the day.`,
      "Add a slot or adjust dispersal to achieve exact coverage.",
    );
  if (cursor > s.dispersal)
    add(
      slots.filter((p) => p.end > s.dispersal).map((p) => p.id),
      "Slots extend beyond dispersal.",
      "Shorten the final slot or set a later dispersal.",
    );
  return out;
}
export type ClassroomFilter = {
  sectionId?: string;
  gradeId?: string;
  classroomId?: string;
};
export function selectedClassrooms(b: Board, f: ClassroomFilter) {
  return b.grades
    .filter(
      (g) =>
        (!f.sectionId || g.sectionId === f.sectionId) &&
        (!f.gradeId || g.id === f.gradeId),
    )
    .flatMap((g) =>
      g.classrooms
        .filter((c) => !f.classroomId || c.id === f.classroomId)
        .map((c) => ({
          ...c,
          gradeId: g.id,
          gradeName: g.name,
          sectionId: g.sectionId,
        })),
    );
}
export function appliesToSelection(
  target: Target,
  b: Board,
  rooms: ReturnType<typeof selectedClassrooms>,
) {
  return (
    ["board", "school"].includes(target.scope) ||
    rooms.some((c) => targetRank(target, b, c.id) > 0)
  );
}
export function calendarDay(
  b: Board,
  rooms: ReturnType<typeof selectedClassrooms>,
  date: string,
  config?: Config,
) {
  const results = rooms.map((c) => {
    const r = resolve(b, c.id, date, config);
    const invalid = r.schedule && scheduleDiagnostics(r.schedule).length;
    return {
      classroomId: c.id,
      classroomName: c.name,
      ...r,
      ...(invalid
        ? {
            status: "invalid",
            reason: "Applicable schedule contains timing errors",
          }
        : {}),
    };
  });
  const statuses = new Set(results.map((r) => r.status));
  const schedules = new Set(results.map((r) => r.schedule?.id || r.reason));
  return {
    status: !results.length
      ? "empty"
      : statuses.size === 1
        ? [...statuses][0]
        : "mixed",
    label: !results.length
      ? "No classrooms"
      : results.length === 1
        ? results[0].schedule?.name || results[0].reason
        : statuses.size === 1 && schedules.size === 1
          ? results[0].schedule?.name || results[0].reason
          : `${results.length} classrooms · ${statuses.size > 1 ? "mixed school day" : "multiple schedules"}`,
    results,
  };
}
export type ConfigurationChange = {
  kind: "added" | "updated" | "deleted";
  entity: string;
  id: string;
  name: string;
  board: string;
  fields: { field: string; before: unknown; after: unknown }[];
};
function flatten(c: Config | null) {
  const rows = new Map<
    string,
    {
      entity: string;
      id: string;
      name: string;
      board: string;
      value: Record<string, unknown>;
    }
  >();
  for (const b of c?.boards || []) {
    const put = (
      entity: string,
      item: { id: string; name: string },
      value: Record<string, unknown>,
    ) =>
      rows.set(entity + ":" + item.id, {
        entity,
        id: item.id,
        name: item.name,
        board: b.name,
        value,
      });
    put("Board", b, { name: b.name, nonWorkingDays: b.nonWorkingDays });
    for (const x of b.sections)
      put("Section", x, { name: x.name, boardId: b.id });
    for (const g of b.grades) {
      put("Grade", g, {
        name: g.name,
        active: g.active,
        section: g.sectionId
          ? b.sections.find((s) => s.id === g.sectionId)?.name || g.sectionId
          : null,
        boardId: b.id,
      });
      for (const r of g.classrooms)
        put("Classroom", r, {
          name: r.name,
          active: r.active,
          grade: g.name,
          gradeId: g.id,
          boardId: b.id,
        });
    }
    for (const x of b.schedules)
      put("Bell schedule", x, {
        name: x.name,
        arrival: x.arrival,
        dispersal: x.dispersal,
        dayType: x.dayType || "full",
        target: x.target,
        rule: x.rule,
        slots: x.slots,
        boardId: b.id,
      });
    for (const x of b.events)
      put("Calendar event", x, {
        name: x.name,
        kind: x.kind,
        overridesHoliday: x.overridesHoliday || false,
        target: x.target,
        rule: x.rule,
        boardId: b.id,
      });
  }
  return rows;
}
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export function configurationChanges(
  before: Config | null,
  after: Config,
): ConfigurationChange[] {
  const old = flatten(before),
    next = flatten(after),
    changes: ConfigurationChange[] = [];
  for (const key of new Set([...old.keys(), ...next.keys()])) {
    const a = old.get(key),
      b = next.get(key),
      item = b || a!;
    const fields = [
      ...new Set([
        ...Object.keys(a?.value || {}),
        ...Object.keys(b?.value || {}),
      ]),
    ]
      .filter(
        (field) => canonical(a?.value[field]) !== canonical(b?.value[field]),
      )
      .map((field) => ({
        field,
        before: a?.value[field] ?? null,
        after: b?.value[field] ?? null,
      }));
    if (fields.length)
      changes.push({
        entity: item.entity,
        id: item.id,
        name: item.name,
        board: item.board,
        kind: !a ? "added" : !b ? "deleted" : "updated",
        fields,
      });
  }
  return changes;
}
export const platformSettingsSchema = z
  .object({
    supportEmail: z.union([z.string().email(), z.literal("")]).default(""),
    supportPhone: z.string().trim().max(40).default(""),
    supportNotes: z.string().trim().max(1000).default(""),
    maintenanceNotice: z.string().trim().max(1000).default(""),
    defaultClassroomLimit: z.number().int().min(0).max(100000).default(40),
  })
  .strict();
export const defaultPlatformSettings = platformSettingsSchema.parse({});
type Org = {
  name?: string;
  legalName?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  activatedAt?: unknown;
  completedSteps: number[];
};
type Institution = {
  id: string;
  name: string;
  logo: string;
  officer: string;
  phone: string;
  email: string;
};
type Subscription = {
  status: string;
  startsAt: Date | string;
  endsAt: Date | string;
  agreementStatus: string;
  paymentStatus: string;
  classroomLimit: number;
  userLimit: number;
};
export function onboardingChecklist(
  o: Org,
  institutions: Institution[],
  subscriptions: Subscription[],
  now = new Date(),
) {
  const titles = [
    "Organization",
    "Schools",
    "Subscription",
    "Agreement & payment",
    "Administrator",
    "Activate client",
    "Client workspace",
  ];
  const blockers: string[][] = Array.from({ length: 7 }, () => []);
  for (const key of [
    "name",
    "legalName",
    "address",
    "city",
    "state",
    "postalCode",
    "contactName",
    "phone",
    "email",
  ] as const)
    if (!o[key]?.trim())
      blockers[0].push(
        `Organization ${key.replace(/([A-Z])/g, " $1").toLowerCase()} is required`,
      );
  if (!institutions.length)
    blockers[1].push("Register at least one school");
  for (const i of institutions) {
    for (const key of ["logo", "officer", "phone", "email"] as const)
      if (!i[key]) blockers[1].push(`${i.name}: ${key} is required`);
  }
  const active = subscriptions.filter((s) => s.status === "ACTIVE" && new Date(s.startsAt) <= now && new Date(s.endsAt) >= now);
  const s = active.length === 1 ? active[0] : null;
  if (!s) blockers[2].push(active.length > 1 ? "Resolve overlapping organization contracts" : "Configure a currently valid active organization subscription");
  if (s && (s.classroomLimit < 0 || s.userLimit < 1)) blockers[2].push("Set organization classroom and user allowances");
  if (!s || !["SIGNED", "EXCEPTION"].includes(s.agreementStatus) || !["PAID", "EXCEPTION"].includes(s.paymentStatus))
    blockers[3].push("Record organization agreement and payment, or an authorized exception");
  if (!institutions.length) {
    blockers[2].push("Register schools before configuring subscriptions");
    blockers[3].push(
      "Register schools before recording commercial checks",
    );
  }
  for (const key of ["contactName", "phone", "email"] as const)
    if (!o[key]?.trim()) blockers[4].push(`Administrator ${key} is required`);
  if (!o.activatedAt)
    blockers[5].push(
      "Super Admin must activate the client after completing steps 1–5",
    );
  if (!o.completedSteps.includes(7))
    blockers[6].push("Client must log in and replace the temporary password");
  return titles.map((title, n) => ({
    step: n + 1,
    title,
    blockers: blockers[n],
    complete:
      blockers[n].length === 0 && (n >= 5 || o.completedSteps.includes(n + 1)),
  }));
}


export function calendarSummary(config: Config, start: string, end: string, boardId?: string, filter: ClassroomFilter = {}) {
  const rows = config.boards.filter((b) => !boardId || b.id === boardId).flatMap((b) =>
    selectedClassrooms(b, filter).filter((c) => c.active && b.grades.find((g) => g.id === c.gradeId)?.active).map((c) => {
      const counts = { workingDays: 0, holidays: 0, halfDays: 0, unresolvedDays: 0 };
      const holidayDates: { date: string; reason: string }[] = [];
      const weeks = new Map<string, { days: number; working: number }>();
      for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000) {
        const date = new Date(t).toISOString().slice(0, 10);
        const result = resolve(b, c.id, date, config);
        const monday = new Date(t); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
        const weekKey = monday.toISOString().slice(0, 10);
        const week = weeks.get(weekKey) || { days: 0, working: 0 }; week.days++; weeks.set(weekKey, week);
        if (["holiday", "non-working"].includes(result.status)) {
          counts.holidays++; holidayDates.push({ date, reason: result.reason });
        } else if (["conflict", "invalid"].includes(result.status)) counts.unresolvedDays++;
        else {
          counts.workingDays++; week.working++;
          if (result.schedule?.dayType === "half") counts.halfDays++;
          if (result.status === "missing") counts.unresolvedDays++;
        }
      }
      const fullWeekCounts = [...weeks.values()].filter((w) => w.days === 7).map((w) => w.working);
      const workingDaysPerWeek = fullWeekCounts.length && new Set(fullWeekCounts).size === 1 ? fullWeekCounts[0] : null;
      return { boardId: b.id, board: b.name, classroomId: c.id, classroom: c.name, ...counts, workingDaysPerWeek,
        workingWeeks: [...weeks.values()].filter((w) => w.working > 0).length,
        holidayDates };
    }));
  const same = (key: "workingDays" | "holidays" | "halfDays" | "workingWeeks" | "workingDaysPerWeek") =>
    rows.length && rows.every((row) => row[key] === rows[0][key] && JSON.stringify(row.holidayDates) === JSON.stringify(rows[0].holidayDates)) ? rows[0][key] : null;
  return { classrooms: rows.length, mixed: rows.length > 1 && same("workingDays") === null,
    workingDays: same("workingDays"), holidays: same("holidays"), halfDays: same("halfDays"),
    workingWeeks: same("workingWeeks"), workingDaysPerWeek: same("workingDaysPerWeek"), rows };
}
