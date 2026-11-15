import { describe, expect, it } from "vitest";
import { randomUUID as id } from "node:crypto";
import { emptyConfig, recurrenceDates, ruleSchema, copyYear, removeFromConfig, type Rule } from "../packages/domain/src";
import { academicPresetSchema, defaultAcademicPresets, presetsForBoard, applyAcademicPreset, presetSelectionSchema } from "../packages/domain/src/presets";
import { assignGrades, assertStableOwnership, configurationImpact } from "../packages/domain/src/impact";
import { calendarSummary, platformSettingsSchema } from "../packages/domain/src/enhancements";
function fixture() {
  const config = emptyConfig(["CBSE", "ICSE"], id);
  for (const b of config.boards) { b.sections.push({ id: id(), name: "Primary" }); b.grades.push({ id: id(), name: "Grade 1", active: false, sectionId: b.sections[0].id, classrooms: [{ id: id(), name: "1A", active: false }] }); }
  return config;
}
const selection = { sections: ["Foundation"], grades: [{ name: "Grade 1", section: "Foundation" }, { name: "Grade 2", section: "Foundation" }], assignExisting: false, active: true };
describe("Configurable academic presets", () => {
  it.each(defaultAcademicPresets)("validates $id", (preset) => expect(academicPresetSchema.safeParse(preset).success).toBe(true));
  it("finds aliases independently of case", () => expect(presetsForBoard(defaultAcademicPresets, " caie ")[0].id).toBe("cambridge"));
  it("supports custom board presets with no sections", () => expect(academicPresetSchema.safeParse({ id: "custom", name: "Custom", boards: ["Local"], sections: [], grades: [{ name: "Diploma", section: null }] }).success).toBe(true));
  it("loads presets in existing settings JSON", () => expect(platformSettingsSchema.parse({}).academicPresets).toHaveLength(defaultAcademicPresets.length));
  it("preserves other boards and existing records, without mutating input", () => { const c = fixture(), original = structuredClone(c); const r = applyAcademicPreset(c, c.boards[0].id, selection, id); expect(c).toEqual(original); expect(r.config.boards[1]).toEqual(c.boards[1]); expect(r.config.boards[0].grades[0]).toEqual(c.boards[0].grades[0]); expect(r).toMatchObject({ createdGrades: 1, reusedGrades: 1, createdSections: 1 }); });
  it("reuses IDs when applied again", () => { const c = fixture(), first = applyAcademicPreset(c, c.boards[0].id, selection, id), second = applyAcademicPreset(first.config, c.boards[0].id, selection, id); expect(second.config).toEqual(first.config); expect(second.createdGrades).toBe(0); expect(second.createdSections).toBe(0); });
  it("only reassigns existing grades on explicit selection", () => { const c = fixture(), r = applyAcademicPreset(c, c.boards[0].id, { ...selection, assignExisting: true }, id); expect(r.config.boards[0].grades[0]).toEqual({ ...c.boards[0].grades[0], sectionId: r.config.boards[0].sections[1].id }); });
  it("rejects duplicate preview grades", () => expect(presetSelectionSchema.safeParse({ ...selection, grades: [selection.grades[0], { ...selection.grades[0], name: "grade 1" }] }).success).toBe(false));
  it("rejects missing boards and unknown sections atomically", () => { const c = fixture(), original = structuredClone(c); expect(() => applyAcademicPreset(c, id(), selection, id)).toThrow(/board/); expect(() => applyAcademicPreset(c, c.boards[0].id, { ...selection, sections: [] }, id)).toThrow(/section/); expect(c).toEqual(original); });
});
describe("Assignments, dependencies and stable IDs", () => {
  it("assigns and unassigns while preserving classrooms", () => { const b = fixture().boards[0], next = assignGrades(b, [b.grades[0].id], null); expect(next.grades[0].sectionId).toBe(null); expect(next.grades[0].classrooms).toEqual(b.grades[0].classrooms); expect(b.grades[0].sectionId).not.toBe(null); });
  it("rejects foreign grades and sections", () => { const c = fixture(), [a,b] = c.boards; expect(() => assignGrades(a, [b.grades[0].id], null)).toThrow(/belong/); expect(() => assignGrades(a, [a.grades[0].id], b.sections[0].id)).toThrow(/section/); });
  it("includes dependent classrooms in grade deletion impact", () => { const c = fixture(), a = c.boards[0], next = removeFromConfig(c, a.id, "grade", a.grades[0].id), impact = configurationImpact(c, next); expect(impact.grades[0].id).toBe(a.grades[0].id); expect(impact.classrooms[0].id).toBe(a.grades[0].classrooms[0].id); expect(impact.removed).toBe(2); expect(next.boards[1]).toEqual(c.boards[1]); });
  it("includes inherited rules and ancestors for a classroom deletion without including siblings", () => {
    const c = fixture(), a = c.boards[0], g = a.grades[0], deleted = g.classrooms[0].id;
    g.classrooms.push({ id: id(), name: "1B", active: true });
    for (const target of [{ scope: "grade" as const, ids: [g.id] }, { scope: "section" as const, ids: [a.sections[0].id] }]) a.events.push({ id: id(), name: target.scope + " holiday", kind: "holiday", target, rule: { type: "default", weekdays: [], intervalWeeks: 1 } });
    const impact = configurationImpact(c, removeFromConfig(c, a.id, "classroom", deleted));
    expect(impact.classrooms.map((row) => row.id)).toEqual([deleted]);
    expect(impact.grades.map((row) => row.id)).toEqual([g.id]);
    expect(impact.sections.map((row) => row.id)).toEqual([a.sections[0].id]);
    expect(impact.calendarRules).toHaveLength(2);
    expect(impact.removed).toBe(1);
    expect(impact.updated).toBe(0);
  });
  it("reports section deletion as a grade update without deleting classrooms", () => { const c = fixture(), a = c.boards[0], impact = configurationImpact(c, removeFromConfig(c,a.id,"section",a.sections[0].id)); expect(impact.removed).toBe(1); expect(impact.updated).toBe(1); expect(impact.classrooms).toHaveLength(1); });
  it("includes shared rules when a grade moves section", () => { const c = fixture(), a = c.boards[0]; a.events.push({ id: id(), name: "School closure", kind: "holiday", target: { scope: "school", ids: [] }, rule: { type: "default", weekdays: [], intervalWeeks: 1 } }); const next = structuredClone(c); next.boards[0] = assignGrades(a, [a.grades[0].id], null); expect(configurationImpact(c,next).calendarRules[0].name).toBe("School closure"); });
  it("blocks cross-board identity reuse", () => { const c = fixture(), next = structuredClone(c); next.boards[1].grades.push(next.boards[0].grades.pop()!); expect(() => assertStableOwnership(c,next)).toThrow(/original board/); });
  it("blocks moving classroom IDs between grades", () => { const c = fixture(), next = structuredClone(c), b = next.boards[0]; b.grades.push({ ...b.grades[0], id:id(), name:"Grade 2", classrooms:b.grades[0].classrooms }); b.grades[0].classrooms=[]; expect(() => assertStableOwnership(c,next)).toThrow(/grade/); });
  it("allows rename, status and section edits", () => { const c = fixture(), next = structuredClone(c); Object.assign(next.boards[0].grades[0], { name:"Custom", active:true, sectionId:null }); expect(() => assertStableOwnership(c,next)).not.toThrow(); });
});
describe("Date-limited recurrence", () => {
  const rule: Rule = { type:"recurring", weekdays:[6], nth:5, intervalWeeks:1 };
  it("skips missing fifth Saturdays", () => expect(recurrenceDates(rule,"2026-01-01","2026-03-31")).toEqual(["2026-01-31"]));
  it("honours inclusive start and end dates", () => expect(recurrenceDates({ ...rule, nth:2, startsOn:"2026-02-14", endsOn:"2026-03-14" },"2026-01-01","2026-04-30")).toEqual(["2026-02-14","2026-03-14"]));
  it("supports multiple weekdays", () => expect(recurrenceDates({ ...rule, nth:undefined, weekdays:[1,3], startsOn:"2026-11-16", endsOn:"2026-11-18" },"2026-11-01","2026-11-30")).toEqual(["2026-11-16","2026-11-18"]));
  it("rejects inverted or invalid dates", () => { expect(ruleSchema.safeParse({ ...rule, startsOn:"2026-03-01", endsOn:"2026-02-28" }).success).toBe(false); expect(ruleSchema.safeParse({ ...rule, startsOn:"2026-02-30" }).success).toBe(false); expect(() => recurrenceDates(rule,"2026-01-01","2028-01-01")).toThrow(/550/); });
  it("does not copy date-bound recurrences to a new year", () => { const c=fixture(); c.boards[0].events.push({ id:id(), name:"Term rule", kind:"holiday", target:{scope:"board",ids:[]}, rule:{...rule,startsOn:"2026-01-01"} }); expect(copyYear(c).boards[0].events).toEqual([]); });
});
describe("Effective calendar totals", () => {
  it("counts weekly closures once and deliberately reopened Sundays as working", () => { const c=fixture(), b=c.boards[0]; b.nonWorkingDays=[0]; b.grades[0].active=true; b.grades[0].classrooms[0].active=true; const r:Rule={type:"date",date:"2026-01-04",weekdays:[],intervalWeeks:1}; b.events.push({id:id(),name:"Duplicate Sunday holiday",kind:"holiday",target:{scope:"board",ids:[]},rule:{type:"weekly",weekdays:[0],intervalWeeks:1}}); let totals=calendarSummary(c,"2026-01-01","2026-12-31",b.id); expect(totals.holidays).toBe(52); expect(totals.workingDays).toBe(313); b.events.push({id:id(),name:"Reopen",kind:"working",overridesHoliday:true,target:{scope:"board",ids:[]},rule:r}); totals=calendarSummary(c,"2026-01-01","2026-12-31",b.id); expect(totals.workingDays).toBe(314); expect(totals.holidays).toBe(51); expect(totals.regularWeeklyWorkingDays).toBe(6); expect(totals.provisional).toBe(true); });
});
