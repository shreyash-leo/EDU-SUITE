"use client";
import { useRef, useState } from "react";
import { Button, Badge } from "../../components/ui";
import { useNavigationGuard } from "../../lib/navigation";
import { gradePresets, gradeRange, gradePreview, classroomPreview, validateClassroomPreview, type ClassroomCandidate } from "../../../../packages/domain/src/bulk";
import type { Board } from "../../../../packages/domain/src";

export function BulkGrades({ board, onSave, onCancel }: { board: Board; onSave: (names: string[], active: boolean, skipped: number) => Promise<void>; onCancel: () => void }) {
  const [method, setMethod] = useState("range"), [from, setFrom] = useState(1), [to, setTo] = useState(12), [selected, setSelected] = useState<string[]>([]), [custom, setCustom] = useState("");
  const [preview, setPreview] = useState<string[] | null>(null), [skipped, setSkipped] = useState<{ name: string; reason: string }[]>([]), [active, setActive] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dirty = useRef(false);
  useNavigationGuard({ label: "Bulk grade creation", isDirty: () => dirty.current, discard: () => { dirty.current = false; } });
  function generate() { try { const result = gradePreview(board.grades.map((g) => g.name), method === "range" ? gradeRange(from, to) : method === "presets" ? selected : custom.split(/\r?\n/)); setPreview(result.accepted); setSkipped(result.skipped); dirty.current = true; setError(""); } catch (e) { setError((e as Error).message); } }
  return <>
    <p className="form-help">Add several grades to {board.name}. Existing grades and published versions are preserved.</p>
    <div className="tabs compact">{[["range", "Grade range"], ["presets", "Select grades"], ["custom", "Custom names"]].map(([value, text]) => <button key={value} className={method === value ? "active" : ""} onClick={() => { setMethod(value); setPreview(null); }}>{text}</button>)}</div>
    <div className="builder-inputs">
      {method === "range" && <div className="form-grid"><label>From grade<input type="number" min={1} max={30} value={from} onChange={(e) => { setFrom(Number(e.target.value)); setPreview(null); dirty.current = true; }} /></label><label>To grade<input type="number" min={from} max={30} value={to} onChange={(e) => { setTo(Number(e.target.value)); setPreview(null); dirty.current = true; }} /></label></div>}
      {method === "presets" && <div className="preset-grid">{gradePresets(board.name).map((name) => <label className="check-option" key={name}><input type="checkbox" checked={selected.includes(name)} onChange={(e) => { setSelected(e.target.checked ? [...selected, name] : selected.filter((n) => n !== name)); setPreview(null); dirty.current = true; }} />{name}</label>)}</div>}
      {method === "custom" && <label>One grade name per line<textarea rows={6} placeholder={"Foundation 1\nFoundation 2\nYear 3"} value={custom} onChange={(e) => { setCustom(e.target.value); setPreview(null); dirty.current = true; }} /></label>}
      <Button onClick={generate}>Generate preview</Button>
    </div>
    {preview && <><div className="section-head"><h3>{preview.length} grades ready</h3><label className="inline-label">Create as<select value={String(active)} onChange={(e) => setActive(e.target.value === "true")}><option value="true">Active</option><option value="false">Inactive</option></select></label></div>
      <div className="preview-chips">{preview.map((name) => <span key={name}>{name}<button aria-label={`Remove ${name} from preview`} onClick={() => setPreview(preview.filter((n) => n !== name))}>×</button></span>)}</div>
      {skipped.length > 0 && <details className="builder-skips"><summary>{skipped.length} duplicate grades will be skipped</summary>{skipped.map((s, n) => <p key={n}>{s.name} — {s.reason}</p>)}</details>}
    </>}
    {error && <div className="notice error" role="alert">{error}</div>}
    <footer className="form-footer"><Button disabled={busy} onClick={onCancel}>Cancel</Button><Button variant="dark" disabled={busy || !preview?.length} onClick={() => { setBusy(true); setError(""); void (async () => { try { const result = gradePreview(board.grades.map((g) => g.name), preview!); if (!result.accepted.length) throw Error("All selected grades already exist. Generate a fresh preview."); await onSave(result.accepted, active, skipped.length + result.skipped.length); dirty.current = false; } catch (e) { setError((e as Error).message); } finally { setBusy(false); } })(); }}>{busy ? "Saving…" : `Create ${preview?.length || ""} grades`}</Button></footer>
  </>;
}

export function ClassroomBuilder({ board, initialGrade, single = false, available, onSave, onCancel }: { board: Board; initialGrade?: string; single?: boolean; available: number; onSave: (rows: ClassroomCandidate[], active: boolean, capacity?: number) => Promise<void>; onCancel: () => void }) {
  const [gradeId, setGrade] = useState(initialGrade || board.grades[0]?.id || ""), [count, setCount] = useState(1), [rows, setRows] = useState<ClassroomCandidate[]>([]), [active, setActive] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [previewPage, setPreviewPage] = useState(0), [capacity,setCapacity] = useState("");
  const dirty = useRef(false);
  useNavigationGuard({ label: "Classroom preview", isDirty: () => dirty.current, discard: () => { dirty.current = false; } });
  return <>
    <div className="notice"><strong>{available} classroom slots available</strong><span>Shared across all schools and boards. Inactive classrooms also count.</span></div>
    <div className="form-grid"><label>Grade<select value={gradeId} onChange={(e) => { setGrade(e.target.value); setRows([]); dirty.current = true; }}>{!single && <option value="ALL">Every grade — same count per grade</option>}{board.grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    {!single && <label>Number of classrooms per grade<input type="number" min={1} max={100} value={count} onChange={(e) => { setCount(Number(e.target.value)); setRows([]); dirty.current = true; }} /></label>}
    <label>Student capacity (optional)<input type="number" min={1} max={10000} value={capacity} placeholder="Leave blank if unknown" onChange={e=>{setCapacity(e.target.value);dirty.current=true;}}/><small>Applied to every classroom in this batch; each can be edited later.</small></label>
    <label>Create as<select value={String(active)} onChange={(e) => {setActive(e.target.value === "true");dirty.current=true;}}><option value="true">Active</option><option value="false">Inactive</option></select></label></div>
    <Button onClick={() => { try { const next = classroomPreview(board, gradeId, single ? 1 : count); if (next.length > available) throw Error(`This needs ${next.length} slots, but only ${available} are available. Reduce the count or ask Super Admin to increase the allowance.`); setRows(next); setPreviewPage(0); dirty.current = true; setError(""); } catch (e) { setError((e as Error).message); } }}>Generate editable preview</Button>
    {rows.length > 0 && <><div className="section-head"><h3>{rows.length} classrooms ready</h3><Badge value={active ? "ACTIVE" : "INACTIVE"} /></div><div className="classroom-preview">{rows.slice(previewPage * 10, previewPage * 10 + 10).map((r) => <div key={r.key}><span>{r.gradeName}</span><input aria-label={`Classroom name ${r.key}`} value={r.name} maxLength={100} onChange={(e) => setRows(rows.map((x) => x.key === r.key ? { ...x, name: e.target.value } : x))} /><Button onClick={() => { setRows(rows.filter((x) => x.key !== r.key)); setPreviewPage(0); }}>Remove</Button></div>)}</div>{rows.length > 10 && <div className="pagination"><span>{rows.length} classrooms in preview</span><div className="row-actions"><Button disabled={previewPage === 0} onClick={() => setPreviewPage(previewPage - 1)}>Previous</Button><Button disabled={(previewPage + 1) * 10 >= rows.length} onClick={() => setPreviewPage(previewPage + 1)}>Next</Button></div></div>}</>}
    {error && <div className="notice error" role="alert">{error}</div>}
    <footer className="form-footer"><Button disabled={busy} onClick={onCancel}>Cancel</Button><Button variant="dark" disabled={busy || !rows.length} onClick={() => { setBusy(true); setError(""); void (async () => { try { if(capacity && (!Number.isInteger(Number(capacity)) || Number(capacity)<1 || Number(capacity)>10000)) throw Error("Capacity must be a whole number from 1 to 10,000"); validateClassroomPreview(board, rows); if (rows.length > available) throw Error("The classroom allowance changed. Reduce this preview and try again."); await onSave(rows.map((r) => ({ ...r, name: r.name.trim() })), active, capacity ? Number(capacity) : undefined); dirty.current = false; } catch (e) { setError((e as Error).message); } finally { setBusy(false); } })(); }}>{busy ? "Saving…" : `Create ${rows.length || ""} classroom${rows.length === 1 ? "" : "s"}`}</Button></footer>
  </>;
}
