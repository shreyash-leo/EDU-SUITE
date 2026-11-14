"use client";
import React, { useState } from "react";
import { type ConfigurationChange } from "../../../../packages/domain/src/enhancements";
import type { Config } from "../../../../packages/domain/src";
import { time } from "../../lib/api";
function display(
  value: unknown,
  field: string,
  names: Map<string, string>,
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  if (
    typeof value === "number" &&
    ["arrival", "dispersal", "start", "end"].includes(field)
  )
    return time(value);
  if (typeof value === "string") return names.get(value) || value;
  if (Array.isArray(value))
    return value
      .map((v) =>
        typeof v === "object"
          ? display(v, field, names)
          : display(v, field, names),
      )
      .join("\n");
  if (typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== "id")
      .map(([k, v]) => `${k}: ${display(v, k, names)}`)
      .join("; ");
  return String(value);
}
export function ChangeReview({
  changes,
  before,
  after,
}: {
  changes: ConfigurationChange[];
  before: Config | null;
  after: Config;
}) {
  const [filter, setFilter] = useState("all");
  const names = new Map<string, string>();
  for (const config of [before, after])
    for (const b of config?.boards || [])
      for (const entity of [
        b,
        ...b.sections,
        ...b.grades,
        ...b.grades.flatMap((g) => g.classrooms),
      ])
        names.set(entity.id, entity.name);
  return (
    <section className="change-review">
      <h3>Changes in this publication</h3>
      <div className="tabs compact">
        {["all", "added", "updated", "deleted"].map((k) => (
          <button
            type="button"
            className={filter === k ? "active" : ""}
            key={k}
            onClick={() => setFilter(k)}
          >
            {k} ({changes.filter((c) => k === "all" || c.kind === k).length})
          </button>
        ))}
      </div>
      {!changes.length && (
        <p>No structural changes from the current publication.</p>
      )}
      <div className="change-list">
        {changes
          .filter((c) => filter === "all" || filter === c.kind)
          .map((c) => (
            <details key={c.entity + c.id}>
              <summary>
                <span className={`change-kind ${c.kind}`}>{c.kind}</span>
                <strong>{c.name}</strong>
                <small>
                  {c.board} · {c.entity}
                </small>
              </summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Previously published</th>
                      <th>Working draft</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.fields
                      .filter((f) => !["boardId", "gradeId"].includes(f.field))
                      .map((f) => (
                        <tr key={f.field}>
                          <td>{f.field}</td>
                          <td>
                            <pre>{display(f.before, f.field, names)}</pre>
                          </td>
                          <td>
                            <pre>{display(f.after, f.field, names)}</pre>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
      </div>
    </section>
  );
}
