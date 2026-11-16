"use client";
import { useId, useState } from "react";
import { Button } from "../../components/ui";
export function BoardAffiliations({ catalog, selected, onChange, locked = false, protectedBoards = [], years = [] }: { catalog: string[]; selected: string[]; onChange: (boards: string[]) => void; locked?: boolean; protectedBoards?: string[]; years?: string[] }) {
  const list = useId(), errorId = useId(), [query, setQuery] = useState(""), [error, setError] = useState("");
  function add() { const board = catalog.find((s) => s.toLowerCase() === query.trim().toLowerCase()); if (!board) { setError("Select a supported board. Add missing boards in Requests & Settings → Board catalogue."); return; } if (selected.some((s) => s.toLowerCase() === board.toLowerCase())) { setError(`${board} is already selected.`); return; } onChange([...selected, board]); setQuery(""); setError(""); }
  return <section className="board-affiliation-manager" aria-label="Board affiliations"><div className="section-head"><div><h3>Board affiliations <b className="required">*</b></h3><p>Add one or more boards. Each has its own grades, sections and classrooms.</p></div></div>
    <div className="board-add-row"><label>Select board<input list={list} value={query} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} placeholder="Search supported boards…" onChange={(e) => { setQuery(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /><datalist id={list}>{catalog.map((s) => <option key={s} value={s} />)}</datalist></label><Button onClick={add}>Add board</Button></div>
    <div className="preview-chips">{selected.map((board) => <span key={board}>{board}<button aria-label={`Remove ${board} affiliation`} disabled={locked && protectedBoards.includes(board)} onClick={() => onChange(selected.filter((s) => s !== board))}>×</button></span>)}</div>
    {locked && <div className="notice">Existing affiliations are protected by academic configurations{years.length ? `: ${years.join(", ")}` : ""}. You can add boards; removing them would affect academic history.</div>}
    {!selected.length && <p className="form-help">Select at least one board before saving.</p>}
    {error && <div id={errorId} className="notice error" role="alert">{error}</div>}
  </section>;
}
