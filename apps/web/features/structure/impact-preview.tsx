"use client";
import type { ConfigurationImpact } from "../../../../packages/domain/src/impact";
export function ImpactPreview({ impact, title = "What will change" }: { impact: ConfigurationImpact & { effective?: {changedDates:number;classroomDates:number} }; title?: string }) {
  return <section className="impact-preview" aria-label={title}><h3>{title}</h3><p className="form-help">Changes are saved to your configuration. Use Save & apply when ready.</p>
    {impact.effective && <p className="notice">Calculated effective changes: {impact.effective.changedDates} dates · {impact.effective.classroomDates} classroom/date combinations across this academic year. Historical records are preserved.</p>}
    <div className="impact-counts"><span><strong>{impact.created}</strong> created</span><span><strong>{impact.updated}</strong> updated</span><span><strong>{impact.removed}</strong> removed</span><span><strong>{impact.classrooms.length}</strong> classrooms affected</span></div>
    {impact.boards.length > 0 && <p className="form-help">Board: {impact.boards.join(", ")}</p>}
    <div className="impact-lists">{[["Grades", impact.grades], ["Academic sections", impact.sections], ["Classrooms", impact.classrooms], ["Affected bell schedules", impact.schedules], ["Affected calendar rules", impact.calendarRules]].map(([label, items]) => { const rows = items as ConfigurationImpact["grades"]; return rows.length > 0 ? <details key={label as string}><summary>{label as string} ({rows.length})</summary><ul>{rows.map((r) => <li key={r.id}>{r.name} <small>· {r.board}</small></li>)}</ul></details> : null; })}</div>
    {impact.byEntity.length > 0 && <details><summary>Record changes</summary><div className="impact-records">{impact.byEntity.map((r) => <p key={r.entity}><strong>{r.entity}</strong> · {r.created} created · {r.updated} updated · {r.removed} removed</p>)}</div></details>}
    {(impact.schedules.length > 0 || impact.calendarRules.length > 0) && <p className="form-help">Affected rules may be removed, narrowed or resolve differently after these changes. Check the effective calendar before applying.</p>}
  </section>;
}
