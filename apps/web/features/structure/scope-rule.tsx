"use client";
import { useState } from "react";
import type { Board, Target, Rule } from "../../../../packages/domain/src";
import { label, today } from "../../lib/api";
export function ScopeRule({
  boards,
  board,
  target,
  rule,
  onTarget,
  onRule,
  showWhen = true,
}: {
  boards?: Board[];
  board: Board;
  target: Target;
  rule: Rule;
  onTarget: (t: Target) => void;
  onRule: (r: Rule) => void;
  showWhen?: boolean;
}) {
  const [query, setQuery] = useState("");
  const all = boards || [board];
  const options = target.scope === "boards" ? all : target.scope === "sections" ? all.flatMap((b) => b.sections.map((s) => ({ ...s, name: `${b.name} / ${s.name}` })))
    : target.scope === "section" ? board.sections
    : target.scope === "grades" ? all.flatMap((b) => b.grades.map((g) => ({ ...g, name: `${b.name} / ${g.name}` })))
    : target.scope === "grade" ? board.grades
    : target.scope === "classrooms" ? all.flatMap((b) => b.grades.flatMap((g) => g.classrooms.map((c) => ({ ...c, name: `${b.name} / ${g.name} / ${c.name}` }))))
    : board.grades.flatMap((g) => g.classrooms);
  return (
    <div className="scope-rule">
      <div className="form-grid">
        <label>
          Who does this apply to?
          <select
            value={target.scope}
            onChange={(e) =>
              { setQuery(""); onTarget({ scope: e.target.value as Target["scope"], ids: [] }); }
            }
          >
            {["school", "board", "boards", "sections", "grades", "classrooms", ...(["section", "grade", "classroom"].includes(target.scope) ? [target.scope] : [])            ].map((s) => (
              <option key={s} value={s}>
                {s === "school" ? "Entire school" : s === "board" ? "Current board" : s === "boards" ? "Selected boards" : s === "sections" ? "Selected sections" : s === "grades" ? "Selected grades" : s === "classrooms" ? "Selected classrooms" : s}
              </option>
            ))}
          </select>
        </label>
        {showWhen && <label>
          When does it apply?
          <select
            value={rule.type}
            onChange={(e) =>
              onRule({ ...rule, type: e.target.value as Rule["type"], nth: undefined, intervalWeeks: 1, anchorDate: undefined })
            }
          >
            {["default", "weekly", "recurring", "date"].map((t) => (
              <option key={t} value={t}>
                {t === "date" ? "Specific date" : label(t)}
              </option>
            ))}
          </select>
        </label>}
        {!["school", "board"].includes(target.scope) && (
          <div className="span2 scope-targets"><label>Search targets<input value={query} placeholder="Search by board, grade or name…" onChange={(e) => setQuery(e.target.value)} /></label><p className="form-help">{target.ids.length} selected · Select one or multiple targets.</p><div className="target-checklist">{options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase())).map((o) => <label className="check-option" key={o.id}><input type="checkbox" checked={target.ids.includes(o.id)} onChange={(e) => onTarget({ ...target, ids: e.target.checked ? [...target.ids, o.id] : target.ids.filter((id) => id !== o.id) })} />{o.name}</label>)}</div></div>
        )}
        {showWhen && <div className="span2 recurrence-presets"><span>Quick setup</span><button type="button" onClick={() => onRule({ ...defaultRule(), type: "recurring", weekdays: [6], nth: 2 })}>Second Saturday</button><button type="button" onClick={() => onRule({ ...defaultRule(), type: "recurring", weekdays: [6], nth: 4 })}>Fourth Saturday</button><button type="button" onClick={() => onRule({ ...defaultRule(), type: "weekly", weekdays: [1, 2, 3, 4, 5] })}>Every weekday</button><button type="button" onClick={() => onRule({ ...defaultRule(), type: "date", date: today() })}>Specific date</button></div>}
        {showWhen && rule.type === "date" && (
          <label>
            Specific date
            <input
              type="date"
              value={rule.date || ""}
              onChange={(e) => onRule({ ...rule, date: e.target.value })}
            />
          </label>
        )}
        {showWhen && ["weekly", "recurring"].includes(rule.type) && (
          <>
            <label className="span2">
              Weekdays
              <div className="weekday-picker">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (d, n) => (
                    <button
                      type="button"
                      key={d}
                      className={rule.weekdays.includes(n) ? "selected" : ""}
                      onClick={() =>
                        onRule({
                          ...rule,
                          weekdays: rule.weekdays.includes(n)
                            ? rule.weekdays.filter((x) => x !== n)
                            : [...rule.weekdays, n],
                        })
                      }
                    >
                      {d}
                    </button>
                  ),
                )}
              </div>
            </label>
            <details className="span2 recurring-range"><summary>Limit this rule to a date range</summary><div className="form-grid"><label>Applies from<input type="date" value={rule.startsOn || ""} onChange={(e) => onRule({ ...rule, startsOn: e.target.value || undefined })} /></label><label>Applies until<input type="date" value={rule.endsOn || ""} onChange={(e) => onRule({ ...rule, endsOn: e.target.value || undefined })} /></label></div><small>Leave blank to use the full academic year. Both endpoints are included.</small></details>
            {rule.type === "recurring" && (
              <>
                <label>
                  Nth weekday in month
                  <select
                    value={rule.nth || ""}
                    onChange={(e) =>
                      onRule({
                        ...rule,
                        nth: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  >
                    <option value="">Every occurrence</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Repeat every N weeks
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={rule.intervalWeeks}
                    onChange={(e) =>
                      onRule({ ...rule, intervalWeeks: Number(e.target.value) })
                    }
                  />
                </label>
                {rule.intervalWeeks > 1 && (
                  <label>
                    Recurrence anchor date
                    <input
                      type="date"
                      value={rule.anchorDate || ""}
                      onChange={(e) =>
                        onRule({ ...rule, anchorDate: e.target.value })
                      }
                    />
                  </label>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
export const defaultRule = (): Rule => ({
  type: "default",
  weekdays: [],
  intervalWeeks: 1,
});
