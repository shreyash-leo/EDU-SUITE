"use client";
import { usePortalPreferences } from "../../lib/preferences";
import { statusTone } from "../../lib/design-system";
import {
  WorkspaceSkeleton,
  SectionIntro,
} from "../../components/platform-primitives";
import {
  useEffect,
  useState,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import {
  School,
  ArrowRight,
  ArrowLeft,
  List,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { api, dateLabel, label, type RecordData } from "../../lib/api";
import {
  Badge,
  Button,
  Empty,
  PageHead,
  DetailGrid,
  DataTable,
} from "../../components/ui";
import {
  schoolEntryDestination,
  structureStatuses,
  type StructureStatus,
} from "../../../../packages/domain/src/portal";
export type SchoolIntent =
  "default" | "review" | "calendar" | "grades" | "edit" | "bell" | "history";
type Open = (
  school: RecordData,
  view: "details" | "workspace",
  intent?: SchoolIntent,
) => void;
function structureAction(status: string) {
  return status === "NOT_STARTED" ? "Set up school" : "Open configuration";
}
function Logo({ school }: { school: RecordData }) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  return (
    <span className="client-school-logo">
      {school.logo && school.logo !== failedLogo ? (
        <img
          src={school.logo}
          alt=""
          onError={() => setFailedLogo(school.logo)}
        />
      ) : (
        <School size={20} aria-hidden="true" />
      )}
    </span>
  );
}
function structureLabel(value: string) {
  return (
    (
      {
        DRAFT: "Setup in progress",
        DRAFT_CHANGES_PENDING: "Changes to apply",
        EDITING_DRAFT_NO_CHANGES: "Configured",
        ACTIVE: "Active",
        INCOMPLETE_ACTIVE: "Needs attention",
        NOT_STARTED: "Not started",
      } as Record<string, string>
    )[value] || label(value)
  );
}
function State({ value }: { value: StructureStatus }) {
  return (
    <span className="badge" data-tone={statusTone(value)}>
      {structureLabel(value)}
    </span>
  );
}
function Metrics({
  items,
}: {
  items: { title: string; value: string | number; onClick?: () => void }[];
}) {
  return (
    <div className="portal-metrics">
      {items.map((m) => (
        <button key={m.title} disabled={!m.onClick} onClick={m.onClick}>
          <small>{m.title}</small>
          <strong>{m.value}</strong>
          {m.onClick && <ArrowRight size={14} />}
        </button>
      ))}
    </div>
  );
}
function activityTitle(activity: RecordData) {
  if (activity.action === "structure.updated") {
    const changes = Array.isArray(activity.detail?.changes)
      ? activity.detail.changes
      : [];
    if (
      changes.some(
        (c: RecordData) => c.entity === "Grade" && c.kind === "added",
      )
    )
      return "Grades added to draft";
    if (changes.some((c: RecordData) => c.entity === "Classroom"))
      return "Classrooms updated in draft";
    if (
      changes.some((c: RecordData) =>
        ["Calendar event", "Bell schedule"].includes(c.entity),
      )
    )
      return "Bell or calendar rules changed";
    return "Academic structure updated";
  }
  return (
    (
      {
        "structure.published": "Academic configuration applied",
        "structure.draft-created": "Configuration opened for editing",
        "structure.draft-discarded": "Saved changes discarded",
        "academic-year.created": "Academic year created",
      } as Record<string, string>
    )[activity.action] || label(activity.action)
  );
}
function Subscription({
  data,
  onAccount,
}: {
  data: RecordData;
  onAccount: () => void;
}) {
  const contract =
    data.contract ||
    data.subscriptions.find(
      (c: RecordData) => c.id === data.license.contractId,
    );
  return (
    <section className="portal-panel">
      <div className="section-head">
        <h2>Subscription snapshot</h2>
        <Button onClick={onAccount}>Account details</Button>
      </div>
      <dl className="portal-facts">
        <div>
          <dt>Status</dt>
          <dd>
            {data.license.contractConflict
              ? "Contract review required"
              : contract
                ? label(contract.status)
                : "No valid active contract"}
          </dd>
        </div>
        <div>
          <dt>Validity</dt>
          <dd>
            {contract
              ? `${dateLabel(contract.startsAt)} – ${dateLabel(contract.endsAt)}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Licensed Classrooms (organization)</dt>
          <dd>
            {data.license.used} / {data.license.limit}
          </dd>
        </div>
        <div>
          <dt>Remaining Organization Allowance</dt>
          <dd>{Math.max(0, data.license.limit - data.license.used)}</dd>
        </div>
        <div>
          <dt>Contractual users</dt>
          <dd>
            {data.license.users} / {data.license.userLimit}
          </dd>
        </div>
      </dl>
    </section>
  );
}
export function ClientPortal({
  page,
  userId,
  organizationName,
  onOpen,
  onAccount,
  onDirectory,
}: {
  page: string;
  userId: string;
  organizationName: string;
  onOpen: Open;
  onAccount: () => void;
  onDirectory: () => void;
}) {
  const { preferences } = usePortalPreferences();
  const storage = `plan-directory-${userId}`;
  const [filters, setFilters] = useState({
      search: "",
      board: "",
      schoolStatus: "",
      status: "",
      sort: "name",
      page: 1,
    }),
    [view, setView] = useState("list"),
    [ready, setReady] = useState(false),
    [data, setData] = useState<RecordData | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storage) || "null");
      if (stored) {
        setFilters({ ...filters, ...stored.filters });
        setView(stored.view === "cards" ? "cards" : "list");
      }
    } catch {}
    setReady(true);
  }, [storage]);
  useEffect(() => {
    if (ready)
      sessionStorage.setItem(storage, JSON.stringify({ filters, view }));
  }, [storage, ready, filters, view]);
  const overview = ["Dashboard", "Overview"].includes(page),
    structure = page === "Structure Management";
  useEffect(() => {
    if (!ready) return;
    let current = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        ...filters,
        page: String(filters.page),
        pageSize: String(preferences.pageSize),
      });
      const schoolId = sessionStorage.getItem("plan-selected-school");
      if (schoolId) {
        params.set("schoolId", schoolId);
        const year = sessionStorage.getItem(`plan-year-${schoolId}`);
        if (year) params.set("yearId", year);
      }
      void api(`/client-portal?${params}`)
        .then((result) => {
          if (current) setData(result);
        })
        .catch((e) => {
          if (current) setError(e.message);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [ready, filters, page, preferences.pageSize]);
  function filter(patch: Partial<typeof filters>) {
    setFilters({ ...filters, ...patch, page: 1 });
  }
  function drillTo(status: string) {
    const next = {
      search: "",
      board: "",
      schoolStatus: "",
      status,
      sort: "name",
      page: 1,
    };
    setFilters(next);
    sessionStorage.setItem(storage, JSON.stringify({ filters: next, view }));
    onDirectory();
  }
  function openSchoolEntry(school: RecordData) {
    const target = schoolEntryDestination(
      page,
      school.status,
      school.structureStatus,
    );
    onOpen(school, target.view, target.intent);
  }
  function rowClick(event: MouseEvent, school: RecordData) {
    if (
      (event.target as Element).closest(
        "button,a,input,select,textarea,summary",
      )
    )
      return;
    openSchoolEntry(school);
  }
  function rowKey(event: KeyboardEvent, school: RecordData) {
    if (
      event.target !== event.currentTarget ||
      !["Enter", " "].includes(event.key)
    )
      return;
    event.preventDefault();
    openSchoolEntry(school);
  }
  if (error && !data)
    return (
      <div className="notice error" role="alert">
        {error}
      </div>
    );
  if (!data)
    return (
      <WorkspaceSkeleton label="Loading organization workspace" rows={5} />
    );
  const metricItems = overview
    ? [
        {
          title: "Registered schools",
          value: data.metrics.total,
          onClick: () => drillTo(""),
        },
        {
          title: "Active structures",
          value: data.metrics.configured,
          onClick: () => drillTo("CONFIGURED"),
        },
        {
          title: "Setup required",
          value: data.metrics.inProgress,
          onClick: () => drillTo("IN_PROGRESS"),
        },
        {
          title: "Organization classroom usage",
          value: `${data.license.used} / ${data.license.limit}`,
          onClick: onAccount,
        },
      ]
    : [
        {
          title: "Total schools",
          value: data.metrics.total,
          onClick: () => filter({ status: "" }),
        },
        {
          title: "Schools with active structures",
          value: data.metrics.configured,
          onClick: () => filter({ status: "CONFIGURED" }),
        },
        {
          title: "Schools not configured",
          value: data.metrics.inProgress,
          onClick: () => filter({ status: "IN_PROGRESS" }),
        },
        {
          title: "Changes to apply",
          value: data.metrics.pending,
          onClick: () => filter({ status: "DRAFT_CHANGES_PENDING" }),
        },
      ];
  return (
    <div className="client-portal">
      <PageHead
        tone={overview ? "brand" : "teal"}
        eyebrow="Organization workspace"
        title={
          overview
            ? organizationName || "Organization overview"
            : structure
              ? "Structure Management"
              : "Schools"
        }
        text={
          overview
            ? "Your schools, academic setup and shared subscription at a glance."
            : structure
              ? "Manage academic structures, classrooms, bell schedules and calendars across your schools."
              : "Browse every registered school. Registration details are managed by Super Admin."
        }
      />
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <Metrics items={metricItems} />
      {overview && (
        <details className="portal-classroom-details">
          <summary>Classroom usage details</summary>
          <div className="summary-strip">
            <span>
              Total Classrooms: <strong>{data.metrics.totalClassrooms}</strong>
            </span>
            <span>
              Active Classroom Flags:{" "}
              <strong>{data.metrics.activeClassroomFlags}</strong>
            </span>
            <span>
              Operationally Active Classrooms:{" "}
              <strong>{data.metrics.operationallyActiveClassrooms}</strong>
            </span>
            <span>
              Inactive Classrooms:{" "}
              <strong>
                {data.metrics.totalClassrooms -
                  data.metrics.activeClassroomFlags}
              </strong>
            </span>
            <span>
              Licensed Classrooms: <strong>{data.license.used}</strong>
            </span>
            <span>
              Remaining Organization Allowance:{" "}
              <strong>
                {Math.max(0, data.license.limit - data.license.used)}
              </strong>
            </span>
          </div>
        </details>
      )}
      <p className="portal-basis">
        Manage the selected academic year for each school. Classroom allowances
        are shared across your organization.
      </p>
      {overview && (
        <>
          <div className="portal-columns portal-overview-columns">
            <section className="portal-panel">
              <div className="section-head">
                <h2>Structure status</h2>
                <Button onClick={() => drillTo("")}>Browse schools</Button>
              </div>
              <div className="portal-status-list">
                {structureStatuses.map((status) => (
                  <button
                    key={status}
                    data-tone={statusTone(status)}
                    onClick={() => drillTo(status)}
                  >
                    <span className="portal-status-name">
                      <i aria-hidden="true" />
                      {structureLabel(status)}
                    </span>
                    <strong>{data.metrics[status]}</strong>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            </section>
            <section className="portal-panel">
              <div className="section-head">
                <h2>Schools requiring attention</h2>
                <Button onClick={() => drillTo("ATTENTION")}>View all</Button>
              </div>
              {data.attention.length ? (
                <div
                  className="portal-table-wrap"
                  role="region"
                  tabIndex={0}
                  aria-label="Schools requiring attention; scroll horizontally for more columns"
                >
                  <table className="portal-table portal-attention-table">
                    <thead>
                      <tr>
                        <th>School</th>
                        <th>Academic year</th>
                        <th>Current status</th>
                        <th>Required action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.attention.map((s: RecordData) => (
                        <tr key={s.id}>
                          <td>
                            <button
                              className="record-link"
                              onClick={() => onOpen(s, "details")}
                            >
                              {s.name}
                            </button>
                          </td>
                          <td>{s.yearLabel || "Not created"}</td>
                          <td>{structureLabel(s.structureStatus)}</td>
                          <td>
                            <Button
                              disabled={s.status !== "ACTIVE"}
                              onClick={() =>
                                onOpen(
                                  s,
                                  "workspace",
                                  s.structureStatus === "DRAFT_CHANGES_PENDING"
                                    ? "review"
                                    : s.structureStatus === "INCOMPLETE_ACTIVE"
                                      ? "edit"
                                      : "default",
                                )
                              }
                            >
                              {structureAction(s.structureStatus)}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="All schools are up to date"
                  text="There are no outstanding setup or configuration tasks."
                />
              )}
            </section>
          </div>
          <div className="portal-columns">
            <section className="portal-panel">
              <h2>Recent activity</h2>
              {data.activity.length ? (
                <ol className="portal-activity">
                  {data.activity.map((a: RecordData) => (
                    <li key={a.id}>
                      <div>
                        <strong>{activityTitle(a)}</strong>
                        <button
                          className="record-link"
                          onClick={() => {
                            sessionStorage.setItem(
                              `plan-year-${a.schoolId}`,
                              a.yearId,
                            );
                            onOpen(
                              {
                                id: a.schoolId,
                                name: a.schoolName,
                                status: "ACTIVE",
                                yearId: a.yearId,
                              },
                              "details",
                            );
                          }}
                        >
                          {a.schoolName} · {a.yearLabel}
                        </button>
                        {Array.isArray(a.detail?.changes) &&
                          a.detail.changes.length > 0 && (
                            <small>
                              {a.detail.changes.length} recorded structure
                              changes
                            </small>
                          )}
                      </div>
                      <time dateTime={a.createdAt}>
                        {new Date(a.createdAt).toLocaleString("en-IN")}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty
                  title="No activity yet"
                  text="Academic-year and configuration updates will appear here."
                />
              )}
            </section>
            <Subscription data={data} onAccount={onAccount} />
          </div>
        </>
      )}
      {!overview && (
        <section
          className="portal-panel portal-directory"
          aria-label="School directory"
        >
          <div className="section-head">
            <div>
              <p className="eyebrow">
                {structure ? "Academic workspace" : "School directory"}
              </p>
              <h2>
                {page === "Schools"
                  ? "Registered schools"
                  : "School configurations"}
              </h2>
            </div>
            <div className="row-actions">
              <div
                className="portal-view-toggle"
                role="group"
                aria-label="School directory view"
              >
                <Button
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                >
                  <List size={14} />
                  List
                </Button>
                <Button
                  aria-pressed={view === "cards"}
                  onClick={() => setView("cards")}
                >
                  <LayoutGrid size={14} />
                  Cards
                </Button>
              </div>
            </div>
          </div>
          <div className="portal-filters">
            <label>
              Search schools
              <input
                type="search"
                value={filters.search}
                placeholder="School name"
                onChange={(e) => filter({ search: e.target.value })}
              />
            </label>
            <label>
              Board
              <select
                value={filters.board}
                onChange={(e) => filter({ board: e.target.value })}
              >
                <option value="">All boards</option>
                {data.boards.map((b: string) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label>
              School status
              <select
                value={filters.schoolStatus}
                onChange={(e) => filter({ schoolStatus: e.target.value })}
              >
                <option value="">All school statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label>
              Structure status
              <select
                value={filters.status}
                onChange={(e) => filter({ status: e.target.value })}
              >
                <option value="">All statuses</option>
                <option value="CONFIGURED">Has published configuration</option>
                <option value="IN_PROGRESS">Setup in progress</option>
                <option value="ATTENTION">Requires attention</option>
                {structureStatuses.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort by
              <select
                value={filters.sort}
                onChange={(e) => filter({ sort: e.target.value })}
              >
                <option value="name">School name</option>
                <option value="updated">Last updated</option>
              </select>
            </label>
            <Button
              onClick={() =>
                setFilters({
                  search: "",
                  board: "",
                  schoolStatus: "",
                  status: "",
                  sort: "name",
                  page: 1,
                })
              }
            >
              Clear filters
            </Button>
          </div>
          <div className="portal-results" aria-live="polite">
            {loading ? "Updating schools…" : `${data.total} schools found`}
          </div>
          <div aria-busy={loading} className={loading ? "portal-loading" : ""}>
            {data.rows.length ? (
              view === "cards" ? (
                <div className="portal-school-grid">
                  {data.rows.map((s: RecordData) => (
                    <article
                      className="portal-school-card clickable-school"
                      key={s.id}
                      tabIndex={0}
                      aria-label={`${structure && s.status === "ACTIVE" ? "Open configuration for" : "View school details for"} ${s.name}`}
                      onClick={(event) => rowClick(event, s)}
                      onKeyDown={(event) => rowKey(event, s)}
                    >
                      <div className="portal-school-title">
                        <Logo school={s} />
                        <div>
                          <button
                            className="record-link"
                            onClick={() => openSchoolEntry(s)}
                          >
                            {s.name}
                          </button>
                          <small>{s.boards.join(" · ")}</small>
                        </div>
                      </div>
                      <State value={s.structureStatus} />
                      <dl className="portal-facts">
                        <div>
                          <dt>Registration</dt>
                          <dd>{s.registration || "—"}</dd>
                        </div>
                        <div>
                          <dt>Academic year</dt>
                          <dd>{s.yearLabel || "Not created"}</dd>
                        </div>
                        <div>
                          <dt>Classrooms in this school</dt>
                          <dd>{s.classroomCount}</dd>
                        </div>
                        <div>
                          <dt>Account</dt>
                          <dd>{label(s.status)}</dd>
                        </div>
                      </dl>
                      <div className="row-actions">
                        <Button onClick={() => onOpen(s, "details")}>
                          Open School
                        </Button>
                        {structure && (
                          <Button
                            disabled={s.status !== "ACTIVE"}
                            onClick={() => onOpen(s, "workspace", "default")}
                          >
                            {structureAction(s.structureStatus)}
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="portal-table-wrap">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        {[
                          "School",
                          "Boards",
                          "Academic year",
                          "Structure status",
                          "Classrooms",
                          "Account",
                          "Last updated",
                          "Actions",
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((s: RecordData) => (
                        <tr
                          key={s.id}
                          className="clickable-school"
                          tabIndex={0}
                          aria-label={`${structure && s.status === "ACTIVE" ? "Open configuration for" : "View school details for"} ${s.name}`}
                          onClick={(event) => rowClick(event, s)}
                          onKeyDown={(event) => rowKey(event, s)}
                        >
                          <td>
                            <div className="portal-school-title">
                              <Logo school={s} />
                              <div>
                                <button
                                  className="record-link"
                                  onClick={() => openSchoolEntry(s)}
                                >
                                  {s.name}
                                </button>
                                <small>{s.registration}</small>
                              </div>
                            </div>
                          </td>
                          <td>{s.boards.join(" · ")}</td>
                          <td>{s.yearLabel || "Not created"}</td>
                          <td>
                            <State value={s.structureStatus} />
                          </td>
                          <td>{s.classroomCount}</td>
                          <td>{label(s.status)}</td>
                          <td>{dateLabel(s.lastUpdated)}</td>
                          <td>
                            <Button onClick={() => onOpen(s, "details")}>
                              Open School
                            </Button>
                            {structure && (
                              <Button
                                disabled={s.status !== "ACTIVE"}
                                onClick={() =>
                                  onOpen(s, "workspace", "default")
                                }
                              >
                                {structureAction(s.structureStatus)}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <Empty
                title="No schools match"
                text="Clear the filters, or contact Super Admin if your school has not been registered."
              />
            )}
          </div>
          <div className="pagination">
            <span>
              Page {data.page} · {data.total} schools
            </span>
            <div className="row-actions">
              <Button
                disabled={loading || filters.page <= 1}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page - 1 })
                }
              >
                Previous
              </Button>
              <Button
                disabled={loading || data.page * data.pageSize >= data.total}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page + 1 })
                }
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
export function ClientSchoolDetails({
  schoolId,
  onBack,
  onOpen,
  onRequest,
}: {
  schoolId: string;
  onBack: () => void;
  onOpen: Open;
  onRequest: (school: RecordData) => void;
}) {
  const [data, setData] = useState<RecordData | null>(null),
    [error, setError] = useState(""),
    [year, setYear] = useState(""),
    [tab, setTab] = useState("School Overview");
  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    const selected =
      year || sessionStorage.getItem(`plan-year-${schoolId}`) || "";
    void api(
      `/institutions/${schoolId}/portal${selected ? `?yearId=${selected}` : ""}`,
    )
      .then((result) => {
        if (current) {
          setData(result);
          if (result.year)
            sessionStorage.setItem(`plan-year-${schoolId}`, result.year.id);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [schoolId, year]);
  if (error)
    return (
      <>
        <Button onClick={onBack}>Back to Schools</Button>
        <div className="notice error" role="alert">
          {error}
        </div>
      </>
    );
  if (!data)
    return <WorkspaceSkeleton label="Loading school details" rows={5} />;
  const s = data.school,
    editable = s.status === "ACTIVE",
    boardTotals = data.boards.reduce(
      (a: RecordData, b: RecordData) => ({
        grades: a.grades + b.grades,
        classrooms: a.classrooms + b.classrooms,
      }),
      { grades: 0, classrooms: 0 },
    );
  const open = (intent: SchoolIntent = "default") =>
    onOpen({ ...s, yearId: data.year?.id }, "workspace", intent);
  return (
    <div className="client-school-details">
      <Button className="school-back" variant="ghost" onClick={onBack}>
        <ArrowLeft size={14} />
        Back to Schools
      </Button>
      <PageHead
        tone="teal"
        eyebrow="Schools / School details"
        title={s.name}
        text={`${s.boards.join(" · ")} · ${s.registration}`}
        leading={<Logo school={s} />}
      />
      <div className="school-detail-bar">
        <div className="school-statuses">
          <Badge value={s.status} />
          <State value={data.status} />
        </div>
        <label>
          <span>Academic year</span>
          <select
            aria-label="School details academic year"
            value={data.year?.id || ""}
            onChange={(e) => setYear(e.target.value)}
          >
            {!s.years.length && <option value="">No academic year</option>}
            {s.years.map((y: RecordData) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row-actions school-quick-actions">
        <Button variant="dark" disabled={!editable} onClick={() => open()}>
          {structureAction(data.status)}
        </Button>
        {!data.hasCalendar && (
          <Button
            disabled={!editable || !data.year}
            onClick={() => open("calendar")}
          >
            Configure Calendar
          </Button>
        )}
        {!data.hasGrades && (
          <Button
            disabled={!editable || !data.year}
            onClick={() => open("grades")}
          >
            Manage Grades
          </Button>
        )}
        <Button disabled={!editable} onClick={() => onRequest(s)}>
          Request Changes
        </Button>
      </div>
      {!editable && (
        <div className="notice">
          This school account is {label(s.status)}. Identity remains available;
          ask Super Admin to reactivate it before editing.
        </div>
      )}
      <nav className="portal-detail-tabs" aria-label="School details sections">
        {["School Overview", "Academic Structure", "Bell Time & Calendar"].map(
          (name) => (
            <button
              aria-current={tab === name ? "page" : undefined}
              className={tab === name ? "selected" : ""}
              key={name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ),
        )}
      </nav>
      <section className="portal-panel">
        {tab === "School Overview" && (
          <>
            <div className="summary-strip">
              {Object.entries(data.counts || {}).map(([key, value]) => (
                <span key={key}>
                  {
                    (
                      {
                        total: "Total Classrooms",
                        activeFlags: "Active Classroom Flags",
                        operationallyActive: "Operationally Active Classrooms",
                        inactive: "Inactive Classrooms",
                        licensed: "Licensed Classrooms",
                      } as Record<string, string>
                    )[key]
                  }
                  : <strong>{String(value)}</strong>
                </span>
              ))}
            </div>
            <h2>School information</h2>
            <p className="form-help">
              Registered details are read-only. Request Changes sends protected
              edits through approval.
            </p>
            <div className="school-information">
              <section>
                <h3>Identity and affiliation</h3>
                <DetailGrid
                  record={s}
                  keys={["name", "registration", "boards"]}
                />
              </section>
              <section>
                <h3>Contact information</h3>
                <DetailGrid
                  record={s}
                  keys={["officer", "email", "phone", "address"]}
                />
              </section>
            </div>
            <h3>Academic structure</h3>
            <dl className="portal-facts">
              <div>
                <dt>Academic year</dt>
                <dd>{data.year?.label || "Not created"}</dd>
              </div>
              <div>
                <dt>Grades</dt>
                <dd>{boardTotals.grades}</dd>
              </div>
              <div>
                <dt>Classrooms in this school</dt>
                <dd>{boardTotals.classrooms}</dd>
              </div>
            </dl>
          </>
        )}
        {tab === "Academic Structure" && (
          <>
            <div className="section-head">
              <h2>Academic structure · {data.year?.label || "No year"}</h2>
              <Button
                variant="dark"
                disabled={!editable}
                onClick={() => open()}
              >
                Manage Structure
              </Button>
            </div>
            <p className="form-help">
              {data.basis}. Operationally active requires both grade and
              classroom to be active. Inactive classroom flags still consume
              licenses.
            </p>
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    {[
                      "Board",
                      "Sections",
                      "Grades",
                      "Active / inactive grades",
                      "Classrooms",
                      "Operationally active / not operational",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.boards.map((b: RecordData) => (
                    <tr key={b.id}>
                      <td>{b.name}</td>
                      <td>{b.sections}</td>
                      <td>{b.grades}</td>
                      <td>
                        {b.activeGrades} / {b.grades - b.activeGrades}
                      </td>
                      <td>{b.classrooms}</td>
                      <td>
                        {b.activeClassrooms} /{" "}
                        {b.classrooms - b.activeClassrooms}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.boards.map((b: RecordData) => (
              <details className="portal-board-details" key={b.id}>
                <summary>
                  <span>
                    <strong>{b.name}</strong>
                    <small>
                      {b.sections} sections · {b.grades} grades · {b.classrooms}{" "}
                      classrooms
                    </small>
                  </span>
                  <span className="board-details-action">
                    View details <ChevronDown size={16} />
                  </span>
                </summary>
                <p className="form-help">
                  Academic sections:{" "}
                  {b.sectionNames.join(" · ") || "None configured"}
                </p>
                <DataTable
                  data={b.gradeRows}
                  columns={[
                    { accessorKey: "name", header: "Grade" },
                    { accessorKey: "section", header: "Academic section" },
                    {
                      accessorKey: "active",
                      header: "Status",
                      cell: (c) => (
                        <Badge value={c.getValue() ? "ACTIVE" : "INACTIVE"} />
                      ),
                    },
                    {
                      id: "classrooms",
                      header: "Classrooms",
                      accessorFn: (g) =>
                        g.classrooms
                          .map(
                            (c: RecordData) =>
                              `${c.name}${c.active ? "" : " (inactive)"}`,
                          )
                          .join(", ") || "None",
                    },
                  ]}
                />
              </details>
            ))}
            {!data.boards.length && (
              <Empty
                title="No structure yet"
                text="Start configuration to create the first academic year."
              />
            )}
          </>
        )}
        {tab === "Bell Time & Calendar" && (
          <div className="school-calendar-summary">
            <div className="section-head">
              <div>
                <h2>Bell Time & Calendar</h2>
                <p className="form-help">
                  {data.readiness} ·{" "}
                  {data.year
                    ? `${dateLabel(data.year.startsAt)} – ${dateLabel(data.year.endsAt)}`
                    : "No academic year selected"}
                </p>
              </div>
              <div className="row-actions">
                <Button
                  disabled={!editable || !data.year}
                  onClick={() => open("bell")}
                >
                  Manage Bell Time
                </Button>
                <Button
                  disabled={!editable || !data.year}
                  onClick={() => open("calendar")}
                >
                  Open Calendar
                </Button>
              </div>
            </div>
            {data.calendar?.provisional && (
              <p className="notice amber-notice">
                Calendar totals are provisional; resolve missing or conflicting
                schedules in Structure Management.
              </p>
            )}
            {data.calendar?.mixed && (
              <p className="form-help">
                Classroom calendars differ. Open Academic Calendar for scoped
                totals.
              </p>
            )}
            <section aria-labelledby="board-schedule-heading">
              <h3 id="board-schedule-heading">Board schedules</h3>
              {data.boards.length ? (
                <div
                  className="portal-table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Board schedules, scroll horizontally if needed"
                >
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th scope="col">Board</th>
                        <th scope="col">Default schedules</th>
                        <th scope="col">Advanced schedules</th>
                        <th scope="col">Calendar rules</th>
                        <th scope="col">Weekly off-days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.boards.map((b: RecordData) => (
                        <tr key={b.id}>
                          <th scope="row">{b.name}</th>
                          <td>{b.defaultSchedules}</td>
                          <td>{b.advancedSchedules}</td>
                          <td>{b.calendarRules}</td>
                          <td>{b.weeklyOffDays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="No board schedules yet"
                  text="Create an academic year and configure a board to manage schedules."
                />
              )}
            </section>
            {data.calendar && (
              <section aria-labelledby="calendar-totals-heading">
                <h3 id="calendar-totals-heading">Calendar summary</h3>
                <dl className="portal-facts calendar-facts">
                  {[
                    ["Calendar working dates", data.calendar.workingDays],
                    [
                      "Validated instructional dates",
                      data.calendar.validatedWorkingDays,
                    ],
                    ["Provisional dates", data.calendar.provisionalWorkingDays],
                    ["Invalid / conflict dates", data.calendar.conflictingDays],
                    ["Holidays / weekly off", data.calendar.holidays],
                    ["Half-days", data.calendar.halfDays],
                    ["Working weeks", data.calendar.workingWeeks],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <dt>{k}</dt>
                      <dd>{v === null ? "Varies / no classrooms" : v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
