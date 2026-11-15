"use client";
import React, { useMemo, useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  Search,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { type Board, type Target, type Config, applicableRules } from "../../../../packages/domain/src";
import {
  selectedClassrooms,
  appliesToSelection,
  type calendarDay,
  scheduleDiagnostics,
} from "../../../../packages/domain/src/enhancements";
import { Badge, Button, DataTable, Empty } from "../../components/ui";
import { api, dateLabel, time, type RecordData } from "../../lib/api";
export function BellCalendar({
  board: b,
  initialView = "Default Bell Time",
  config,
  editable,
  onChange,
  onEdit,
  onDelete,
  year,
}: {
  board: Board;
  initialView?: string;
  config: Config;
  editable: boolean;
  onChange: (b: Board) => void;
  onEdit: (type: string, record?: RecordData) => void;
  onDelete: (kind: string, record: RecordData) => void;
  year: RecordData;
}) {
  const [view, setView] = useState(initialView),
    [sectionId, setSection] = useState(""),
    [gradeId, setGrade] = useState(""),
    [classroomId, setClassroom] = useState(""),
    [date, setDate] = useState(year.startsAt.slice(0, 10)),
    [month, setMonth] = useState(year.startsAt.slice(0, 7)),
    [scope, setScope] = useState("all"),
    [mode, setMode] = useState("grid"),
    [previewPage, setPreviewPage] = useState(0);
  const [schedulePage, setSchedulePage] = useState(0);
  const [ruleAction, setRuleAction] = useState("schedule"), [calendarAction, setCalendarAction] = useState("holiday");
  const whenLabel = (rule: Board["events"][number]["rule"]) => rule.type === "date" ? rule.date : rule.type === "default" ? "Every working day" : `${rule.nth ? ["", "First", "Second", "Third", "Fourth", "Fifth"][rule.nth] + " " : "Every "}${rule.weekdays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}${rule.intervalWeeks > 1 ? ` · every ${rule.intervalWeeks} weeks` : ""}`;
  const targetName = (target: Target) => target.scope === "school" ? "Entire school" : target.scope === "board" ? b.name : target.ids.map((id) => config.boards.flatMap((board) => [board, ...board.sections, ...board.grades, ...board.grades.flatMap((g) => g.classrooms)]).find((x) => x.id === id)?.name || "Unavailable target").join(", ");

  useEffect(() => setSchedulePage(0), [view, sectionId, gradeId, classroomId]);
  const grades = b.grades.filter(
    (g) => !sectionId || g.sectionId === sectionId,
  );
  const rooms = useMemo(
    () => selectedClassrooms(b, { sectionId, gradeId, classroomId }),
    [b, sectionId, gradeId, classroomId],
  );
  const allRooms = selectedClassrooms(b, { sectionId, gradeId });
  const applies = (target: Target) =>
    (!sectionId && !gradeId && !classroomId) ||
    appliesToSelection(target, b, rooms);
  const rules = applicableRules(b, config);
  const schedules = rules.schedules.filter((s) => applies(s.target) && (view === "Default Bell Time" ? s.rule.type === "default" : s.rule.type !== "default"));
  const events = rules.events.filter(
    (e) => (scope === "all" || scope === e.target.scope) && applies(e.target),
  );
  const start = year.startsAt.slice(0, 10),
    end = year.endsAt.slice(0, 10);
  const [y, m] = month.split("-").map(Number);
  const days =
    Number.isFinite(y) && Number.isFinite(m)
      ? new Date(Date.UTC(y, m, 0)).getUTCDate()
      : 0;
  const offset = days ? new Date(month + "-01T00:00:00Z").getUTCDay() : 0;
  const [resolved, setResolved] = useState<Record<string, ReturnType<typeof calendarDay>>>({});
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  useEffect(() => {
    let current = true;
    setPreviewLoading(true);
    const dates = [...new Set([
      ...Array.from({ length: days }, (_, n) => `${month}-${String(n + 1).padStart(2, "0")}`), date,
    ])].filter((d) => d >= start && d <= end);
    if (!dates.length) { setResolved({}); setPreviewLoading(false); return; }
    const timer = setTimeout(() => {
      void api(`/years/${year.id}/preview`, "POST", { board: b, config, dates, filter: { sectionId, gradeId, classroomId } })
        .then((rows: (ReturnType<typeof calendarDay> & {date: string})[]) => {
          if (current) { setResolved(Object.fromEntries(rows.map((r) => [r.date, r]))); setPreviewError(""); }
        })
        .catch((e) => { if (current) { setPreviewError(e.message); setResolved({}); } })
        .finally(() => { if (current) setPreviewLoading(false); });
    }, 200);
    return () => { current = false; clearTimeout(timer); };
  }, [b, config, month, days, date, start, end, sectionId, gradeId, classroomId, year.id]);
  const [summary, setSummary] = useState<RecordData | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryScope, setSummaryScope] = useState("board");
  useEffect(() => {
    let current = true;
    setSummary(null); setSummaryError("");
    const timer = setTimeout(() => {
      void api(`/years/${year.id}/calendar-summary`, "POST", { config,
        ...(summaryScope === "board" ? { boardId: b.id, filter: { sectionId, gradeId, classroomId } } : {}) })
        .then((result) => { if (current) setSummary(result); })
        .catch((error) => { if (current) setSummaryError(error.message); });
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [config, year.id, b.id, sectionId, gradeId, classroomId, summaryScope]);
  const monthRows = Array.from({ length: days }, (_, n) => {
    const d = `${month}-${String(n + 1).padStart(2, "0")}`;
    return { id: d, date: d, ...(resolved[d] || { status: "loading", label: previewLoading ? "Resolving…" : "Unavailable", results: [] }), outside: d < start || d > end };
  });
  const effective = date >= start && date <= end ? resolved[date] : null;
  const targetLabel = classroomId
    ? rooms[0]?.name
    : gradeId
      ? grades.find((g) => g.id === gradeId)?.name
      : sectionId
        ? b.sections.find((s) => s.id === sectionId)?.name
        : `Entire ${b.name} board`;
  return (
    <>
      {previewError && <div className="notice error" role="alert">{previewError}</div>}
      {previewLoading && !["Default Bell Time", "Advanced Scheduling"].includes(view) && <p role="status">Resolving calendar…</p>}
      <div className="bell-subnav">
        {[["Default Bell Time", "Default Bell Schedule"], ["Advanced Scheduling", "Advanced Scheduling"], ["Calendar", "Academic Calendar"]].map(([value, name]) => <button key={value} className={(value === "Calendar" ? !["Default Bell Time", "Advanced Scheduling"].includes(view) : view === value) ? "selected" : ""} onClick={() => setView(value)}>{value === "Calendar" ? <CalendarDays size={16} /> : <Clock size={16} />}{name}</button>)}
      </div>
      {!["Default Bell Time", "Advanced Scheduling"].includes(view) && <div className="tabs compact calendar-view-tabs">{[["Calendar", "Monthly calendar"], ["Effective preview", "Classroom date preview"], ["Year summary", "Year summary"]].map(([value, name]) => <button key={value} className={view === value ? "active" : ""} onClick={() => setView(value)}>{name}</button>)}</div>}
      <details className="filter-disclosure"><summary>Target filters · {targetLabel}</summary>
      <div className="calendar-target-filters">
        <label>
          Academic section
          <select
            value={sectionId}
            onChange={(e) => {
              setSection(e.target.value);
              setGrade("");
              setClassroom("");
              setPreviewPage(0);
            }}
          >
            <option value="">All sections</option>
            {b.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grade
          <select
            value={gradeId}
            onChange={(e) => {
              setGrade(e.target.value);
              setClassroom("");
              setPreviewPage(0);
            }}
          >
            <option value="">All grades</option>
            {grades.map((g) => (
              <option value={g.id} key={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Classroom
          <select
            value={classroomId}
            onChange={(e) => {
              setClassroom(e.target.value);
              setPreviewPage(0);
            }}
          >
            <option value="">All classrooms</option>
            {allRooms.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => {
            setSection("");
            setGrade("");
            setClassroom("");
            setScope("all");
            setPreviewPage(0);
          }}
        >
          Clear target filters
        </Button>
      </div>
      </details>
      <p className="form-help">
        Showing {targetLabel} · {rooms.length} classroom
        {rooms.length === 1 ? "" : "s"}. Group results show mixed days when
        classrooms follow different rules.
      </p>
      {view === "Default Bell Time" && (
        <>
          <div className="section-head">
            <div>
              <h2>{view === "Default Bell Time" ? "Default bell time" : "Advanced scheduling"}</h2>
              <p>
                Defaults define normal operation. Advanced rules override selected targets and dates. Full holidays take precedence.
              </p>
            </div>
            <Button
              variant="dark"
              disabled={!editable}
              onClick={() => onEdit("schedule", { suggestedRule: "default" })}
            >
              <Plus size={15} /> Add schedule
            </Button>
          </div>
          {schedules.length ? (
            schedules.slice(schedulePage * 5, schedulePage * 5 + 5).map((s) => {
              const diagnostics = scheduleDiagnostics(s);
              const affected = new Set(diagnostics.flatMap((d) => d.slotIds));
              return (
                <div className="schedule-card" key={s.id}>
                  <div className="section-head">
                    <div>
                      <h3>{s.name}</h3>
                      <p>
                        {s.target.scope} · {s.rule.type}
                        {s.rule.nth ? ` · occurrence ${s.rule.nth}` : ""} ·{" "}
                        {time(s.arrival)}–{time(s.dispersal)}
                      </p>
                      {diagnostics.length > 0 && (
                        <small className="error-text">
                          {diagnostics.length} timing issue(s) — edit to resolve
                        </small>
                      )}
                    </div>
                    <div className="row-actions">
                      <Button
                        disabled={!editable}
                        onClick={() => onEdit("schedule", s)}
                      >
                        <Pencil size={14} /> Edit
                      </Button>
                      <Button
                        disabled={!editable}
                        onClick={() => onDelete("schedule", s)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="schedule-timeline">
                    {[...s.slots]
                      .sort((a, b) => a.start - b.start)
                      .map((p) => (
                        <div
                          key={p.id}
                          className={
                            p.kind + (affected.has(p.id) ? " invalid-slot" : "")
                          }
                          style={{ flex: Math.max(1, p.end - p.start) }}
                          title={`${p.name}: ${time(p.start)}–${time(p.end)}`}
                        >
                          <strong>{p.name}</strong>
                          <small>{time(p.start)}</small>
                        </div>
                      ))}
                  </div>
                  {!s.slots.length && <p>No slots configured.</p>}
                </div>
              );
            })
          ) : (
            <Empty
              title="No schedules for these targets"
              text="Create a school default or add a scoped schedule. Use Advanced Scheduling for recurring and date exceptions."
            />
          )}
        </>
      )}
      {view === "Default Bell Time" && schedules.length > 5 && <div className="pagination"><span>{schedules.length} schedules</span><div className="row-actions"><Button disabled={schedulePage === 0} onClick={() => setSchedulePage(schedulePage - 1)}>Previous schedules</Button><Button disabled={(schedulePage + 1) * 5 >= schedules.length} onClick={() => setSchedulePage(schedulePage + 1)}>Next schedules</Button></div></div>}
      {view === "Advanced Scheduling" && <>
        <div className="section-head"><div><h2>Advanced scheduling rules</h2><p>Choose who is affected, when the rule applies and what should happen.</p></div><div className="row-actions"><select aria-label="New rule action" value={ruleAction} onChange={(e) => setRuleAction(e.target.value)}><option value="schedule">Different bell schedule</option><option value="half-day">Half-day schedule</option><option value="holiday">Full holiday</option><option value="working">Special working day</option></select><Button variant="dark" disabled={!editable} onClick={() => onEdit(["schedule", "half-day"].includes(ruleAction) ? "schedule" : "event", { suggestedRule: "recurring", suggestedAction: ruleAction, suggestedDayType: ruleAction === "half-day" ? "half" : "full" })}>Add rule</Button></div></div>
        <DataTable data={[
          ...rules.schedules.filter((s) => s.rule.type !== "default" && applies(s.target)).map((s) => ({ ...s, entryType: "schedule", action: s.dayType === "half" ? "Half-day schedule" : "Different schedule", validation: scheduleDiagnostics(s).length ? "Needs correction" : "Ready" })),
          ...events.map((e) => ({ ...e, entryType: "event", action: e.kind === "holiday" ? "Full holiday" : e.kind === "half-day" ? "Half-day" : "Special working day", validation: e.kind === "half-day" ? "Review matching bell schedule" : "Ready" })),
        ]} columns={[
          { accessorKey: "name", header: "Rule name" },
          { id: "target", header: "Who", accessorFn: (r) => targetName(r.target) },
          { id: "when", header: "When", accessorFn: (r) => whenLabel(r.rule) },
          { accessorKey: "action", header: "What happens" },
          { accessorKey: "validation", header: "Status" },
          { id: "edit", header: "Actions", cell: (c) => <div className="row-actions"><Button disabled={!editable} onClick={() => onEdit(c.row.original.entryType, c.row.original)}>Edit</Button><Button disabled={!editable} onClick={() => onDelete(c.row.original.entryType, c.row.original)}>Delete</Button></div> },
        ]} />
      </>}
      {view === "Calendar" && (
        <>
          <div className="section-head">
            <div>
              <h2>Academic calendar</h2>
              <p>
                {dateLabel(year.startsAt)} – {dateLabel(year.endsAt)}
              </p>
            </div>
            <div className="row-actions"><select aria-label="Calendar entry type" value={calendarAction} onChange={(e) => setCalendarAction(e.target.value)}><option value="holiday">Holiday</option><option value="half-day">Half-day</option><option value="working">Special working day</option></select><Button variant="dark" disabled={!editable} onClick={() => onEdit("event", { suggestedRule: "date", suggestedAction: calendarAction })}>Add calendar entry</Button></div>
          </div>
          <div className="calendar-options">
            <label>
              Weekly non-working days
              <div className="weekday-picker">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (d, n) => (
                    <button
                      key={d}
                      className={b.nonWorkingDays.includes(n) ? "selected" : ""}
                      disabled={!editable}
                      onClick={() =>
                        onChange({
                          ...b,
                          nonWorkingDays: b.nonWorkingDays.includes(n)
                            ? b.nonWorkingDays.filter((x) => x !== n)
                            : [...b.nonWorkingDays, n],
                        })
                      }
                    >
                      {d}
                    </button>
                  ),
                )}
              </div>
            </label>
            <label>
              Month
              <input
                type="month"
                value={month}
                min={start.slice(0, 7)}
                max={end.slice(0, 7)}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
              />
            </label>
            <label>
              View
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="grid">Month grid</option>
                <option value="list">Resolved day list</option>
              </select>
            </label>
          </div>
          {mode === "grid" ? (
            <div className="calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div className="calendar-weekday" key={d}>
                  {d}
                </div>
              ))}
              {Array.from({ length: offset }, (_, n) => (
                <div className="calendar-blank" key={"offset" + n} />
              ))}
              {monthRows.map((r) => (
                <button
                  key={r.date}
                  disabled={r.outside || previewLoading}
                  className={`calendar-day ${r.status}${r.outside ? " outside" : ""}`}
                  onClick={() => {
                    setDate(r.date);
                    setPreviewPage(0);
                    setView("Effective preview");
                  }}
                >
                  <strong>{Number(r.date.slice(-2))}</strong>
                  <small>{r.label}</small>
                </button>
              ))}
            </div>
          ) : (
            <DataTable
              data={monthRows.filter((r) => !r.outside)}
              columns={[
                { accessorKey: "date", header: "Date" },
                { accessorKey: "status", header: "Resolved status" },
                { accessorKey: "label", header: "Applicable school day" },
                {
                  id: "actions",
                  header: "Details",
                  cell: (c) => (
                    <Button
                      onClick={() => {
                        setDate(c.row.original.date);
                        setPreviewPage(0);
                        setView("Effective preview");
                      }}
                    >
                      View classrooms
                    </Button>
                  ),
                },
              ]}
            />
          )}
          <div className="section-head">
            <h3>Events & exceptions</h3>
            <select
              aria-label="Filter event scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              {[
                "all",
                "school",
                "boards",
                "sections",
                "board",
                "section",
                "grade",
                "classroom",
                "grades",
                "classrooms",
              ].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All target scopes" : s}
                </option>
              ))}
            </select>
          </div>
          <DataTable
            data={events}
            columns={[
              { accessorKey: "name", header: "Event" },
              { accessorKey: "kind", header: "Type" },
              {
                id: "rule",
                accessorFn: (r) =>
                  r.rule.type === "date" ? r.rule.date : r.rule.type,
                header: "Date rule",
              },
              {
                id: "scope",
                accessorFn: (r) => r.target.scope,
                header: "Target",
              },
              {
                id: "actions",
                header: "Actions",
                cell: (c) => (
                  <div className="row-actions">
                    <Button
                      disabled={!editable}
                      onClick={() => onEdit("event", c.row.original)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      disabled={!editable}
                      onClick={() => onDelete("event", c.row.original)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
      {view === "Year summary" && <>
        <div className="section-head"><div><h2>Academic year totals</h2><p>Dates are resolved once per classroom. Half-days count as working days. Working weeks count Monday–Sunday weeks with at least one working day, including partial weeks. Weekly counts vary when exceptions change the pattern.</p></div>
          <select aria-label="Summary scope" value={summaryScope} onChange={(e) => setSummaryScope(e.target.value)}><option value="board">Selected board and target filters</option><option value="school">Entire school</option></select></div>
        {summaryError && <div className="notice error" role="alert">{summaryError}</div>}
        {!summary && !summaryError && <p role="status">Calculating calendar totals…</p>}
        {summary && <>
          <div className="calendar-summary">{[["Working days", summary.workingDays], ["Full working days", summary.fullWorkingDays], ["Regular weekly working days", summary.regularWeeklyWorkingDays], ["Holidays / non-working", summary.holidays], ["Half-days", summary.halfDays], ["Working days per week", summary.workingDaysPerWeek], ["Working weeks", summary.workingWeeks]].map(([name, value]) => <div key={name}><small>{name}</small><strong>{value === null ? (summary.classrooms ? "Varies" : "—") : value}</strong></div>)}</div>
          {summary.provisional && <div className="notice amber-notice">Some dates have missing or conflicting schedules. Review the unresolved days before relying on these totals.</div>}
          {summary.mixed && <div className="notice amber-notice">Classrooms follow different calendars. Totals vary by classroom; review the rows below.</div>}
          <DataTable data={summary.rows} columns={[
            { accessorKey: "board", header: "Board" }, { accessorKey: "classroom", header: "Classroom" },
            { accessorKey: "workingDays", header: "Working days" }, { accessorKey: "holidays", header: "Holidays" },
            { accessorKey: "halfDays", header: "Half-days" }, { accessorKey: "workingWeeks", header: "Working weeks" },
            { accessorKey: "unresolvedDays", header: "Unresolved days" },
          ]} />
          {summary.rows.length === 1 && <><h3>Holiday list</h3><DataTable data={summary.rows[0].holidayDates} columns={[{ accessorKey: "date", header: "Date" }, { accessorKey: "reason", header: "Reason" }]} /></>}
          {summary.rows.length > 1 && <p className="form-help">Select one classroom to see its full holiday list. Missing or conflicting bell schedules appear as unresolved days.</p>}
        </>}
      </>}
      {view === "Effective preview" && (
        <>
          <div className="section-head">
            <div>
              <h2>Which schedule applies?</h2>
              <p>
                Holiday rules → date specificity → classroom, grade, section and
                board precedence.
              </p>
            </div>
          </div>
          <label className="preview-date">
            Preview date
            <input
              type="date"
              min={start}
              max={end}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPreviewPage(0);
              }}
            />
          </label>
          {previewLoading ? <p role="status">Loading effective schedules…</p> : !effective ? (
            <div className="notice error">
              Choose a date within this academic year.
            </div>
          ) : !rooms.length ? (
            <Empty
              title="No classrooms match"
              text="Adjust the target filters or add classrooms to this board."
            />
          ) : (
            <>
              <div className="notice">
                {effective.label} · {dateLabel(date)}
              </div>
              {effective.results
                .slice(previewPage * 10, previewPage * 10 + 10)
                .map((r) => (
                  <details
                    className="effective-card"
                    key={r.classroomId}
                    open={effective.results.length === 1}
                  >
                    <summary>
                      <strong>{r.classroomName}</strong>
                      <Badge
                        value={
                          ["working", "half-day"].includes(r.status)
                            ? r.schedule?.dayType === "half" ? "HALF_DAY" : "WORKING_DAY"
                            : r.status.toUpperCase()
                        }
                      />
                      <span>{r.schedule?.name || r.reason}</span>
                    </summary>
                    <p>{r.reason}</p>
                    {r.schedule &&
                      scheduleDiagnostics(r.schedule).map((d, n) => (
                        <div className="notice error" key={n}>
                          {d.message} {d.suggestion}
                        </div>
                      ))}
                    {r.schedule?.slots.map((p) => (
                      <div className="effective-slot" key={p.id}>
                        <span>
                          {time(p.start)} <small>– {time(p.end)}</small>
                        </span>
                        <i className={p.kind} />
                        <strong>{p.name}</strong>
                        <small>
                          {p.end - p.start} min · {p.kind}
                        </small>
                      </div>
                    ))}
                  </details>
                ))}
              <div className="pagination">
                <span>
                  {Math.min(previewPage * 10 + 1, rooms.length)}–
                  {Math.min(previewPage * 10 + 10, rooms.length)} of{" "}
                  {rooms.length} classrooms
                </span>
                <div className="row-actions">
                  <Button
                    disabled={previewPage === 0}
                    onClick={() => setPreviewPage(previewPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={(previewPage + 1) * 10 >= rooms.length}
                    onClick={() => setPreviewPage(previewPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
