import { z } from "zod";
import type { Board, Config } from "./index";
const name = z.string().trim().min(1).max(100);
export const academicPresetSchema = z.object({
  id: z.string().trim().min(1).max(80), name, boards: z.array(name).min(1).max(30),
  sections: z.array(name).max(30),
  grades: z.array(z.object({ name, section: name.nullable() })).min(1).max(100),
}).superRefine((preset, ctx) => {
  for (const [label, values] of [["boards", preset.boards], ["sections", preset.sections], ["grades", preset.grades.map((g) => g.name)]] as const)
    if (new Set(values.map((n) => n.toLowerCase())).size !== values.length) ctx.addIssue({ code: "custom", message: `Preset ${label} must have unique names` });
  if (preset.grades.some((g) => g.section && !preset.sections.includes(g.section))) ctx.addIssue({ code: "custom", message: "Every suggested grade section must belong to the same preset" });
});
export const presetSelectionSchema = z.object({
  sections: z.array(name).max(30),
  grades: z.array(z.object({ name, section: name.nullable() })).min(1).max(100),
  assignExisting: z.boolean().default(false),
  active: z.boolean().default(true),
}).superRefine((selection, ctx) => {
  if (new Set(selection.grades.map((g) => g.name.toLowerCase())).size !== selection.grades.length) ctx.addIssue({ code: "custom", message: "Remove duplicate grade names from the preview" });
  if (new Set(selection.sections.map((n) => n.toLowerCase())).size !== selection.sections.length) ctx.addIssue({ code: "custom", message: "Remove duplicate section names from the preview" });
});
export type AcademicPreset = z.infer<typeof academicPresetSchema>;
export type PresetSelection = z.infer<typeof presetSelectionSchema>;
const grades = (from: number, to: number, section: string, prefix = "Grade") => Array.from({ length: to - from + 1 }, (_, n) => ({ name: `${prefix} ${from + n}`, section }));
const early = ["Nursery", "Junior KG", "Senior KG"].map((name) => ({ name, section: "Foundation" }));
export const defaultAcademicPresets: AcademicPreset[] = [
  { id: "cbse", name: "CBSE suggested structure", boards: ["CBSE"], sections: ["Foundation", "Preparatory", "Middle", "Secondary"], grades: [...early, ...grades(1, 2, "Foundation"), ...grades(3, 5, "Preparatory"), ...grades(6, 8, "Middle"), ...grades(9, 12, "Secondary")] },
  { id: "icse", name: "ICSE / CISCE suggested structure", boards: ["ICSE", "CISCE", "ICSE/CISCE"], sections: ["Foundation", "Primary", "Middle", "Secondary"], grades: [...early, ...grades(1, 5, "Primary"), ...grades(6, 8, "Middle"), ...grades(9, 10, "Secondary")] },
  { id: "isc", name: "ISC senior secondary", boards: ["ISC"], sections: ["Senior Secondary"], grades: grades(11, 12, "Senior Secondary") },
  { id: "ib", name: "IB programme starting point", boards: ["IB"], sections: ["Primary Years", "Middle Years", "Diploma"], grades: [{ name: "Early Years 1", section: "Primary Years" }, { name: "Early Years 2", section: "Primary Years" }, ...grades(1, 5, "Primary Years"), ...grades(6, 10, "Middle Years"), ...grades(11, 12, "Diploma")] },
  { id: "cambridge", name: "IGCSE / CAIE suggested structure", boards: ["IGCSE", "CAIE", "IGCSE/CAIE", "Cambridge"], sections: ["Foundation", "Primary", "Lower Secondary", "Upper Secondary", "Advanced"], grades: [{ name: "Reception", section: "Foundation" }, ...grades(1, 6, "Primary", "Year"), ...grades(7, 9, "Lower Secondary", "Year"), ...grades(10, 11, "Upper Secondary", "Year"), ...grades(12, 13, "Advanced", "Year")] },
  { id: "state-ssc", name: "State board / SSC suggested structure", boards: ["State Board", "MAHA SSC", "SSC", "Maharashtra SSC"], sections: ["Foundation", "Primary", "Upper Primary", "Secondary"], grades: [...early, ...grades(1, 5, "Primary"), ...grades(6, 8, "Upper Primary"), ...grades(9, 10, "Secondary")] },
  { id: "state-hsc", name: "State board / HSC suggested structure", boards: ["MAHA HSC", "HSC", "Maharashtra HSC"], sections: ["Higher Secondary"], grades: grades(11, 12, "Higher Secondary") },
];
export function presetsForBoard(presets: AcademicPreset[], board: string) { return presets.filter((p) => p.boards.some((name) => name.toLowerCase() === board.trim().toLowerCase())); }
export function applyAcademicPreset(config: Config, boardId: string, input: PresetSelection, makeId: () => string) {
  const selection = presetSelectionSchema.parse(input);
  const board = config.boards.find((b) => b.id === boardId);
  if (!board) throw Error("The selected board does not belong to this school year");
  const next: Board = structuredClone(board);
  const sectionMap = new Map(next.sections.map((s) => [s.name.toLowerCase(), s.id]));
  let createdSections = 0, createdGrades = 0, reusedGrades = 0;
  for (const name of selection.sections) if (!sectionMap.has(name.toLowerCase())) { const id = makeId(); next.sections.push({ id, name }); sectionMap.set(name.toLowerCase(), id); createdSections++; }
  for (const suggestion of selection.grades) {
    const sectionId = suggestion.section ? sectionMap.get(suggestion.section.toLowerCase()) : null;
    if (suggestion.section && !sectionId) throw Error(`Select or create the section “${suggestion.section}” before applying these grades`);
    const existing = next.grades.find((g) => g.name.toLowerCase() === suggestion.name.toLowerCase());
    if (existing) { reusedGrades++; if (selection.assignExisting) existing.sectionId = sectionId || null; }
    else { next.grades.push({ id: makeId(), name: suggestion.name, active: selection.active, sectionId: sectionId || null, classrooms: [] }); createdGrades++; }
  }
  return { config: { ...config, boards: config.boards.map((b) => b.id === boardId ? next : b) }, createdSections, createdGrades, reusedGrades };
}
