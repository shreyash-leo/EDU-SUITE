import type { Board } from "./index";
export const commonGrades = ["Nursery", "Junior KG", "Senior KG", ...Array.from({ length: 12 }, (_, n) => `Grade ${n + 1}`)];
export function gradePresets(board: string) {
  return /IGCSE|Cambridge/i.test(board) ? ["Nursery", "Reception", ...Array.from({ length: 13 }, (_, n) => `Year ${n + 1}`)]
    : /^IB$/i.test(board) ? ["Early Years 1", "Early Years 2", ...Array.from({ length: 12 }, (_, n) => `Grade ${n + 1}`)] : commonGrades;
}
export function gradeRange(from: number, to: number) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > 30) throw Error("Choose a grade range from 1 to 30, with the last grade after the first.");
  return Array.from({ length: to - from + 1 }, (_, n) => `Grade ${from + n}`);
}
export function gradePreview(existing: string[], candidates: string[]) {
  const seen = new Set(existing.map((s) => s.trim().toLowerCase()));
  const accepted: string[] = [], skipped: { name: string; reason: string }[] = [];
  for (const raw of candidates) {
    const name = raw.trim();
    if (!name) continue;
    if (name.length > 100) throw Error(`“${name.slice(0, 30)}…” is too long. Use at most 100 characters.`);
    if (seen.has(name.toLowerCase())) skipped.push({ name, reason: "Already exists or appears twice" });
    else { accepted.push(name); seen.add(name.toLowerCase()); }
  }
  if (accepted.length > 100) throw Error("Add up to 100 grades in one operation.");
  return { accepted, skipped };
}
export type ClassroomCandidate = { key: string; gradeId: string; gradeName: string; name: string };
export function classroomPreview(board: Board, gradeId: string, count: number): ClassroomCandidate[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw Error("Enter between 1 and 100 classrooms per grade.");
  const grades = board.grades.filter((g) => gradeId === "ALL" || g.id === gradeId);
  if (!grades.length) throw Error("Choose a grade first.");
  const names = new Set(board.grades.flatMap((g) => g.classrooms.map((c) => c.name.toLowerCase())));
  const rows: ClassroomCandidate[] = [];
  const suffix = (index: number): string => { let value = index + 1, result = ""; while (value) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); } return result; };
  for (const grade of grades) {
    let index = 0;
    for (let n = 0; n < count; n++) {
      let name = "";
      do { name = grade.name + suffix(index++); } while (names.has(name.toLowerCase()));
      names.add(name.toLowerCase()); rows.push({ key: `${grade.id}-${n}`, gradeId: grade.id, gradeName: grade.name, name });
    }
  }
  return rows;
}
export function validateClassroomPreview(board: Board, rows: ClassroomCandidate[]) {
  const names = new Set(board.grades.flatMap((g) => g.classrooms.map((c) => c.name.toLowerCase())));
  if (!rows.length) throw Error("Generate at least one classroom to save.");
  for (const row of rows) {
    if (!board.grades.some((g) => g.id === row.gradeId)) throw Error("The selected grade is no longer available. Generate the preview again.");
    const name = row.name.trim();
    if (!name || name.length > 100) throw Error("Each classroom needs a name of 1–100 characters.");
    if (names.has(name.toLowerCase())) throw Error(`“${name}” already exists in this board or appears twice in the preview.`);
    names.add(name.toLowerCase());
  }
}
