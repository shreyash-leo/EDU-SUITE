"use client";
import { useEffect, useState } from "react";
import { Button, DataTable, Badge, Empty } from "../../components/ui";
import { assignGrades } from "../../../../packages/domain/src/impact";
import type { Board } from "../../../../packages/domain/src";

export function SectionAssignments({ board, editable, onChange, onEdit, onDelete }: { board: Board; editable: boolean; onChange: (board: Board) => void; onEdit: (section?: Board["sections"][number]) => void; onDelete: (section: Board["sections"][number]) => void }) {
  const [selected, setSelected] = useState("unassigned"), [adding, setAdding] = useState(false), [destination, setDestination] = useState(""), [undo, setUndo] = useState<Board | null>(null), [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setError(""); setSelected("unassigned"); setAdding(false); setDestination(""); setUndo(null); setMessage(""); }, [board.id]);
  useEffect(() => { if (selected !== "unassigned" && !board.sections.some((s) => s.id === selected)) { setSelected("unassigned"); setAdding(false); } }, [board.sections, selected]);
  const current = board.sections.find((s) => s.id === selected);
  const rows = board.grades.filter((g) => adding ? g.sectionId !== selected : selected === "unassigned" ? !g.sectionId : g.sectionId === selected);
  function assign(ids: string[], target: string | null) {
    if (!editable || !ids.length) return;
    try {
      const next = assignGrades(board, ids, target);
      setUndo(structuredClone(board));
      onChange(next);
      setMessage(`${ids.length} grade${ids.length === 1 ? "" : "s"} ${target ? "assigned to " + board.sections.find((s) => s.id === target)?.name : "moved to Unassigned"}.`);
      setAdding(false); setError("");
    } catch (error) { setError((error as Error).message); }
  }
  return <>
    <div className="section-head"><div><h2>Academic sections</h2><p>Select a section, then select grades to assign, move or unassign them.</p></div><Button variant="dark" disabled={!editable} onClick={() => onEdit()}>Add section</Button></div>
    {message && <div className="notice success" role="status"><span>{message}</span>{undo && <Button disabled={!editable} onClick={() => { onChange({ ...board, grades: board.grades.map((g) => { const previous = undo.grades.find((x) => x.id === g.id); return previous ? { ...g, sectionId: previous.sectionId && board.sections.some((s) => s.id === previous.sectionId) ? previous.sectionId : null } : g; }) }); setUndo(null); setMessage("Last assignment undone."); }}>Undo assignment</Button>}</div>}
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="summary-strip"><span>Assigned grades: <strong>{board.grades.filter(g=>g.sectionId).length}</strong></span><span>Unassigned: <strong>{board.grades.filter(g=>!g.sectionId).length}</strong></span><span>Moving a grade updates its inherited timing and holiday rules. You can undo the last assignment.</span></div>
    <div className="assignment-layout"><aside className="section-picker" aria-label="Academic sections">
      {[{ id: "unassigned", name: "Unassigned grades" }, ...board.sections].map((s) => <button key={s.id} className={selected === s.id ? "selected" : ""} aria-pressed={selected === s.id} onClick={() => { setSelected(s.id); setAdding(false); setDestination(""); }}><span>{s.name}</span><strong>{board.grades.filter((g) => s.id === "unassigned" ? !g.sectionId : g.sectionId === s.id).length}</strong></button>)}
    </aside><section className="assignment-content" aria-label="Grades in selected section">
      <div className="section-head"><div><h3>{adding ? `Add grades to ${current?.name}` : current?.name || "Unassigned grades"}</h3><p>{adding ? "Select one or multiple grades below, then use Assign selected grades." : `${rows.length} grades · ${rows.reduce((n, g) => n + g.classrooms.length, 0)} classrooms`}</p></div>
        <div className="row-actions">{current && !adding && <><Button disabled={!editable} onClick={() => onEdit(current)}>Rename</Button><Button disabled={!editable} onClick={() => onDelete(current)}>Delete section</Button><Button disabled={!editable} onClick={() => setAdding(true)}>Add grades</Button></>}{adding && <Button onClick={() => setAdding(false)}>Cancel assignment</Button>}</div>
      </div>
      {!adding && <label className="assignment-destination">Move selected grades to<select value={destination} disabled={!editable} onChange={(e) => setDestination(e.target.value)}><option value="">Choose a section</option><option value="unassigned">Unassigned</option>{board.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      {board.grades.length ? <DataTable key={`${selected}-${adding}`} data={rows} columns={[
        { accessorKey: "name", header: "Grade" },
        { id: "section", header: "Current section", accessorFn: (g) => board.sections.find((s) => s.id === g.sectionId)?.name || "Unassigned" },
        { accessorKey: "active", header: "Status", cell: (c) => <Badge value={c.getValue() ? "ACTIVE" : "INACTIVE"} /> },
        { id: "classrooms", header: "Classrooms", accessorFn: (g) => g.classrooms.length },
        { id: "assign", header: "Assignment", cell: (c) => <select aria-label={`Assign ${c.row.original.name} to section`} disabled={!editable} value={c.row.original.sectionId || ""} onChange={(e) => assign([c.row.original.id], e.target.value || null)}><option value="">Unassigned</option>{board.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select> },
      ]} bulkActions={editable ? adding ? [{ label: "Assign selected grades", action: (rows) => assign(rows.map((r) => r.id), selected) }] : [{ label: "Move selected grades", action: (rows) => { if (!destination) throw Error("Choose a destination section above the table first."); assign(rows.map((r) => r.id), destination === "unassigned" ? null : destination); } }, { label: "Unassign selected grades", action: (rows) => assign(rows.map((r) => r.id), null) }] : []} /> : <Empty title="No grades yet" text="Add grades in School Registration, then assign them here." />}
    </section></div>
  </>;
}
