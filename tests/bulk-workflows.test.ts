import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { emptyConfig } from "../packages/domain/src";
import { gradeRange, gradePresets, gradePreview, classroomPreview, validateClassroomPreview } from "../packages/domain/src/bulk";
import { platformSettingsSchema } from "../packages/domain/src/enhancements";
function board() { const b = emptyConfig(["CBSE"], randomUUID).boards[0]; b.grades.push({ id: randomUUID(), name: "Grade 3", active: true, sectionId: null, classrooms: [{ id: randomUUID(), name: "Grade 3A", active: false }] }); return b; }
describe("Bulk grade planning", () => {
  it("creates Grades 1–12 in one preview", () => { expect(gradeRange(1, 12)).toHaveLength(12); expect(gradeRange(1, 12).at(-1)).toBe("Grade 12"); });
  it.each([[10, 1], [0, 12], [1, 31], [1.5, 10]])("rejects an invalid range %s–%s", (from, to) => expect(() => gradeRange(from, to)).toThrow(/range/));
  it("skips existing and repeated names without changing custom names", () => {
    expect(gradePreview(["Grade 1"], ["Grade 1", "Foundation 1", "foundation 1", "  Year 4  ", ""])).toEqual({ accepted: ["Foundation 1", "Year 4"], skipped: [{ name: "Grade 1", reason: "Already exists or appears twice" }, { name: "foundation 1", reason: "Already exists or appears twice" }] });
  });
  it("offers board-specific presets without limiting custom entry", () => { expect(gradePresets("IGCSE")).toContain("Year 13"); expect(gradePresets("IB")).toContain("Early Years 1"); expect(gradePresets("ICSE")).toContain("Junior KG"); expect(gradePreview([], ["Custom diploma year"]).accepted).toEqual(["Custom diploma year"]); });
  it("rejects overly long custom names", () => expect(() => gradePreview([], ["a".repeat(101)])).toThrow(/100 characters/));
});
describe("Editable classroom planning", () => {
  it("skips names already used by inactive classrooms", () => { const b = board(), rows = classroomPreview(b, b.grades[0].id, 2); expect(rows.map((r) => r.name)).toEqual(["Grade 3B", "Grade 3C"]); expect(b.grades[0].classrooms).toHaveLength(1); });
  it("continues letters beyond Z", () => { const b = board(), rows = classroomPreview(b, b.grades[0].id, 27); expect(rows.at(-1)?.name).toBe("Grade 3AB"); });
  it("generates the requested count independently for all grades", () => { const b = board(); b.grades.push({ ...b.grades[0], id: randomUUID(), name: "Grade 4", classrooms: [] }); const rows = classroomPreview(b, "ALL", 2); expect(rows).toHaveLength(4); expect(rows[2].name).toBe("Grade 4A"); });
  it("preserves custom preview names and validates them before saving", () => { const b = board(), rows = classroomPreview(b, b.grades[0].id, 2); rows[0].name = "Grade 3 Blue"; expect(() => validateClassroomPreview(b, rows)).not.toThrow(); rows[1].name = "grade 3 blue"; expect(() => validateClassroomPreview(b, rows)).toThrow(/appears twice/); });
  it("rejects invalid counts and unknown grades", () => { const b = board(); expect(() => classroomPreview(b, "missing", 1)).toThrow(/Choose a grade/); expect(() => classroomPreview(b, "ALL", 0)).toThrow(/1 and 100/); });
  it("rejects stale grade references and collisions with existing names", () => { const b = board(), rows = classroomPreview(b, b.grades[0].id, 1); rows[0].name = "grade 3a"; expect(() => validateClassroomPreview(b, rows)).toThrow(/already exists/); rows[0].name = "New"; rows[0].gradeId = randomUUID(); expect(() => validateClassroomPreview(b, rows)).toThrow(/no longer available/); });
});
describe("Editable board catalogue", () => {
  it("loads defaults for existing platform settings records", () => expect(platformSettingsSchema.parse({}).boardCatalog).toContain("IGCSE"));
  it("supports custom boards but rejects case-insensitive duplicates", () => { expect(platformSettingsSchema.parse({ boardCatalog: ["My Board"] }).boardCatalog).toEqual(["My Board"]); expect(platformSettingsSchema.safeParse({ boardCatalog: ["CBSE", "cbse"] }).success).toBe(false); });
});
