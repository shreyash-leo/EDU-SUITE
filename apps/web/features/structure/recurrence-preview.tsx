"use client";
import { useEffect, useState } from "react";
import type { Rule } from "../../../../packages/domain/src";
import { Button } from "../../components/ui";
import { api, dateLabel } from "../../lib/api";
export function RecurrencePreview({ yearId, rule }: { yearId: string; rule: Rule }) {
  const [dates, setDates] = useState<string[]>([]), [page, setPage] = useState(0), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  useEffect(() => { let current = true; setLoading(true); setDates([]); setError(""); setPage(0); const timer = setTimeout(() => { void api(`/years/${yearId}/rule-preview`, "POST", { rule }).then((result) => { if (current) setDates(result.dates); }).catch((error) => { if (current) { setDates([]); setError(error.message); } }).finally(() => { if (current) setLoading(false); }); }, 200); return () => { current = false; clearTimeout(timer); }; }, [yearId, JSON.stringify(rule)]);
  return <details className="recurrence-date-preview" open><summary>Pattern Preview · matching dates {loading ? "· calculating…" : `(${dates.length})`}</summary>{error ? <p className="error-text">{error}</p> : <><div className="preview-chips">{dates.slice(page * 12, page * 12 + 12).map((date) => <span key={date}>{dateLabel(date)}</span>)}</div>{!loading && !dates.length && <p className="form-help">No dates match this rule in the selected academic year. Missing fifth-weekday occurrences are skipped.</p>}{dates.length > 12 && <div className="pagination"><span>{dates.length} matching dates</span><div className="row-actions"><Button disabled={!page} onClick={() => setPage(page - 1)}>Previous dates</Button><Button disabled={(page + 1) * 12 >= dates.length} onClick={() => setPage(page + 1)}>Next dates</Button></div></div>}<p className="form-help">These dates match the pattern. Full holidays and more specific rules still determine the effective day for each classroom.</p></>}</details>;
}
