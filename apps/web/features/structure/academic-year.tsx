"use client";
import { useEffect, useState } from "react";
import { Form } from "../../components/ui";
import { api, type RecordData } from "../../lib/api";
import { copyYear, countClassrooms, type Config } from "../../../../packages/domain/src";

export function AcademicYearForm({ years, onSubmit }: { years: RecordData[]; onSubmit: (v: RecordData) => Promise<void> }) {
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<RecordData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setPreview(null); setError("");
    if (!source) { setLoading(false); return; }
    setLoading(true);
    const year = years.find((y) => y.id === source);
    // Match backend copying: use the current publication when one exists.
    void api(`/years/${source}/config${year?.publishedRevisionId ? `?revisionId=${year.publishedRevisionId}` : ""}`)
      .then((r) => {
        if (!current) return;
        const original = r.config as Config, copied = copyYear(original);
        setPreview({
          boards: copied.boards.length,
          sections: copied.boards.reduce((n, b) => n + b.sections.length, 0),
          grades: copied.boards.reduce((n, b) => n + b.grades.length, 0),
          classrooms: countClassrooms(copied),
          schedules: copied.boards.reduce((n, b) => n + b.schedules.length, 0),
          calendarRules: copied.boards.reduce((n, b) => n + b.events.length, 0),
          excluded: original.boards.reduce((n, b) => n + b.events.filter((e) => e.rule.type === "date").length + b.schedules.filter((s) => s.rule.type === "date").length, 0),
        });
      })
      .catch((e) => { if (current) setError(e.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [source, years]);
  return <>
    <label>Starting configuration
      <select value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="">Start fresh</option>
        {years.map((y) => <option key={y.id} value={y.id}>Copy {y.label}</option>)}
      </select>
    </label>
    {loading && <p role="status">Loading copy preview…</p>}
    {error && <div role="alert" className="notice error">{error}</div>}
    {preview ? <div className="notice copy-preview">
      <strong>Copy preview</strong>
      <span>{preview.boards} boards · {preview.sections} sections · {preview.grades} grades · {preview.classrooms} classrooms</span>
      <span>{preview.schedules} reusable bell schedules · {preview.calendarRules} calendar rules</span>
      <span>Excluded: {preview.excluded} fixed-date holidays and bell exceptions.</span>
      <span>Review the new dates and recurrence anchors before publication. Copies remain independent.</span>
    </div> : !source && <div className="notice">Start a blank draft using this school’s registered boards.</div>}
    <Form
      extraDirty={!!source}
      onDiscard={() => setSource("")}
      fields={[
        { key: "label", label: "Academic year", required: true },
        { key: "start", label: "Start date", type: "date", required: true },
        { key: "end", label: "End date", type: "date", required: true },
      ]}
      initial={{ label: `${new Date().getUTCFullYear()}–${String(new Date().getUTCFullYear() + 1).slice(2)}`, start: `${new Date().getUTCFullYear()}-04-01`, end: `${new Date().getUTCFullYear() + 1}-03-31` }}
      submit="Create academic year"
      onSubmit={async (v) => {
        if (source && (loading || !preview)) throw Error(error || "Wait for the copy preview before creating the year");
        await onSubmit({ ...v, copyFrom: source || undefined });
      }}
    />
  </>;
}
