import type { Board, Config } from "./index";
import { configurationChanges } from "./enhancements";
type Item = { id: string; name: string; board: string };
export function configurationImpact(before: Config | null, after: Config) {
  const changes = configurationChanges(before, after);
  const gradeIds = new Set(changes.filter((c) => c.entity === "Grade").map((c) => c.id));
  const sectionIds = new Set(changes.filter((c) => c.entity === "Section").map((c) => c.id));
  const roomIds = new Set(changes.filter((c) => c.entity === "Classroom").map((c) => c.id));
  const allBoards = [...before?.boards || [], ...after.boards];
  for (const b of allBoards) for (const g of b.grades) if (gradeIds.has(g.id)) { if (g.sectionId) sectionIds.add(g.sectionId); g.classrooms.forEach((c) => roomIds.add(c.id)); }
  // A classroom change also depends on its parent grade/section rules. Add the
  // ancestors after expanding directly changed grades so unaffected sibling
  // classrooms are not reported as changed by a single-classroom deletion.
  for (const b of allBoards) for (const g of b.grades) if (g.classrooms.some((c) => roomIds.has(c.id))) {
    gradeIds.add(g.id);
    if (g.sectionId) sectionIds.add(g.sectionId);
  }
  const collect = (entity: "Grade" | "Section" | "Classroom", ids: Set<string>): Item[] => {
    const rows = new Map<string, Item>();
    for (const b of allBoards) {
      const source = entity === "Grade" ? b.grades : entity === "Section" ? b.sections : b.grades.flatMap((g) => g.classrooms);
      for (const r of source) if (ids.has(r.id)) rows.set(r.id, { id: r.id, name: r.name, board: b.name });
    }
    return [...rows.values()];
  };
  const affectedBoardIds = new Set(allBoards.filter((b) => b.grades.some((g) => gradeIds.has(g.id) || g.classrooms.some((c) => roomIds.has(c.id))) || b.sections.some((s) => sectionIds.has(s.id))).map((b) => b.id));
  const rules = (kind: "schedules" | "events") => {
    const found = new Map<string, Item>();
    const explicit = new Set(changes.filter((c) => c.entity === (kind === "schedules" ? "Bell schedule" : "Calendar event")).map((c) => c.id));
    for (const b of allBoards) for (const r of b[kind]) {
      const t = r.target;
      const dependency = t.scope === "school" ? affectedBoardIds.size > 0 : t.scope === "board" ? affectedBoardIds.has(b.id) : t.scope === "boards" ? t.ids.some((id) => affectedBoardIds.has(id)) : ["section", "sections"].includes(t.scope) ? t.ids.some((id) => sectionIds.has(id)) : ["grade", "grades"].includes(t.scope) ? t.ids.some((id) => gradeIds.has(id)) : t.ids.some((id) => roomIds.has(id));
      if (explicit.has(r.id) || dependency) found.set(r.id, { id: r.id, name: r.name, board: b.name });
    }
    return [...found.values()];
  };
  const byEntity = [...new Set(changes.map((c) => c.entity))].map((entity) => ({ entity, created: changes.filter((c) => c.entity === entity && c.kind === "added").length, updated: changes.filter((c) => c.entity === entity && c.kind === "updated").length, removed: changes.filter((c) => c.entity === entity && c.kind === "deleted").length }));
  return { boards: [...new Set(changes.map((c) => c.board))], grades: collect("Grade", gradeIds), sections: collect("Section", sectionIds), classrooms: collect("Classroom", roomIds), schedules: rules("schedules"), calendarRules: rules("events"), byEntity, changes,
    created: changes.filter((c) => c.kind === "added").length, updated: changes.filter((c) => c.kind === "updated").length, removed: changes.filter((c) => c.kind === "deleted").length };
}
export type ConfigurationImpact = ReturnType<typeof configurationImpact>;
export function assertStableOwnership(before: Config, after: Config) {
  const rows = (config: Config) => {
    const result = new Map<string, { kind: string; board: string; parent: string; name: string }>();
    for (const b of config.boards) {
      for (const s of b.sections) result.set(s.id, { kind: "Section", board: b.id, parent: b.id, name: s.name });
      for (const g of b.grades) { result.set(g.id, { kind: "Grade", board: b.id, parent: b.id, name: g.name }); for (const c of g.classrooms) result.set(c.id, { kind: "Classroom", board: b.id, parent: g.id, name: c.name }); }
    }
    return result;
  };
  const old = rows(before);
  for (const [id, next] of rows(after)) {
    const previous = old.get(id); if (!previous) continue;
    if (previous.kind !== next.kind || previous.board !== next.board || previous.parent !== next.parent) throw Error(`${previous.kind} “${previous.name}” must stay in its original board${previous.kind === "Classroom" ? " and grade" : ""}. Create a new record in the other location instead.`);
  }
}
export function assignGrades(board: Board, gradeIds: string[], sectionId: string | null): Board {
  if (sectionId && !board.sections.some((s) => s.id === sectionId)) throw Error("Choose an academic section in this board");
  if (gradeIds.some((id) => !board.grades.some((g) => g.id === id))) throw Error("All selected grades must belong to this board");
  return { ...board, grades: board.grades.map((g) => gradeIds.includes(g.id) ? { ...g, sectionId } : g) };
}
