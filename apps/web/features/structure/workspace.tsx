"use client";
import { AcademicYearForm } from "./academic-year";
import { BellCalendar } from "./calendar";
import { ChangeReview } from "./change-review";
import { RegistrationRequestForm } from "../platform/requests";
import {
  configurationChanges,
  scheduleDiagnostics,
} from "../../../../packages/domain/src/enhancements";
import { scheduleSchema, eventSchema } from "../../../../packages/domain/src";
import { useNavigation, useNavigationGuard } from "../../lib/navigation";
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useForm } from "react-hook-form";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  LayoutDashboard,
  Building2,
  School,
  Route,
  Receipt,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Check,
  Clock,
  Layers,
  CalendarDays,
  BookOpen,
  Menu,
  X,
  Upload,
  AlertCircle,
  Save,
  History,
  CheckCircle2,
  Trash2,
  Pencil,
  Copy,
  ArrowLeft,
  MoreHorizontal,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  autoAssign,
  removeFromBoard,
  removeFromConfig,
  applicableRules,
  countClassrooms,
  licensedUsage,
  resolve,
  emptyConfig,
  type Board,
  type Config,
  type Schedule,
  type Target,
  type Rule,
  type Slot,
} from "../../../../packages/domain/src";
import {
  api,
  setCsrf,
  uid,
  today,
  time,
  minutes,
  label,
  dateLabel,
  type RecordData,
} from "../../lib/api";
import {
  Badge,
  Button,
  Empty,
  Modal,
  Form,
  DataTable,
  Brand,
  PageHead,
  DetailGrid,
  type Field,
} from "../../components/ui";
export function Structure({
  institution: i,
  workspaceSection = "Structure Management",
  onOpenStructure,
  onBack,
  notify,
}: {
  institution: RecordData;
  workspaceSection?: string;
  onOpenStructure?: () => void;
  onBack: () => void;
  notify: (s: string) => void;
}) {
  const [years, setYears] = useState<RecordData[]>([]);
  const [yearId, setYearId] = useState("");
  const [record, setRecord] = useState<RecordData | null>(null);
  const [config, setConfig] = useState<Config>({ boards: [] });
  const [tab, setTab] = useState("School Registration");
  const [boardId, setBoardId] = useState("");
  useEffect(() => { if (boardId) sessionStorage.setItem(`plan-board-${i.id}`, boardId); }, [boardId, i.id]);
  const [modal, setModalState] = useState<RecordData | null>(null);
  const { navigate } = useNavigation();
  const setModal = (value: RecordData | null) => {
    if (value) void navigate(() => setModalState(value));
    else setModalState(null);
  };
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("Saved");
  const [dirty, setDirty] = useState(false);
  const [license, setLicense] = useState<RecordData>({ used: 0, limit: 0, institutions: [] });
  const [issues, setIssues] = useState<RecordData[]>([]);
  const [history, setHistory] = useState<RecordData[]>([]);
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(0);
  const latest = useRef(config);
  const changeSeq = useRef(0);
  const savedSeq = useRef(0);
  const flight = useRef<Promise<void> | null>(null);
  const yearRef = useRef(yearId);
  yearRef.current = yearId;
  const editable = record?.revision?.status === "DRAFT";
  const localUsage = record ? licensedUsage(record.published, config) : 0;
  const institutionUsage = license.institutions?.find((x: RecordData) => x.institutionId === i.id);
  const institutionReserved = institutionUsage?.used || 0;
  const otherYearUsage = Math.max(0, ...(institutionUsage?.years || []).filter((y: RecordData) => y.yearId !== record?.year.id).map((y: RecordData) => Math.max(y.published, y.draft)));
  // Optimistic display only; all writes are checked under the backend organization lock.
  const displayedUsage = editable ? license.used - institutionReserved + Math.max(otherYearUsage, localUsage) : license.used;
  const board = config.boards.find((b) => b.id === boardId) || config.boards[0];
  const loadYears = useCallback(async () => {
    const ys = await api(`/institutions/${i.id}/years`);
    setYears(ys);
    return ys;
  }, [i.id]);
  const load = useCallback(async (id: string, revisionId?: string) => {
    const r = await api(
      `/years/${id}/config${revisionId ? "?revisionId=" + revisionId : ""}`,
    );
    setRecord(r);
    setLicense(r.license);
    setConfig(r.config);
    latest.current = r.config;
    lockRef.current = r.revision.lock;
    changeSeq.current = 0;
    savedSeq.current = 0;
    setDirty(false);
    setSaveState("Saved");
    setBoardId((old) =>
      r.config.boards.some((b: Board) => b.id === (old || sessionStorage.getItem(`plan-board-${i.id}`)))
        ? old || sessionStorage.getItem(`plan-board-${i.id}`)!
        : r.config.boards[0]?.id || "",
    );
  }, []);
  useEffect(() => {
    void loadYears()
      .then((ys) => {
        if (ys.length) { const saved = sessionStorage.getItem(`plan-year-${i.id}`); setYearId(ys.some((y: RecordData) => y.id === saved) ? saved! : ys[0].id); }
      })
      .catch((e) => setError(e.message));
  }, [loadYears]);
  useEffect(() => {
    setRecord(null);
    if (yearId) { sessionStorage.setItem(`plan-year-${i.id}`, yearId); void load(yearId).catch((e) => setError(e.message)); }
  }, [yearId, load]);
  const persist = useCallback(async () => {
    if (flight.current) await flight.current;
    if (savedSeq.current === changeSeq.current) return;
    const seq = changeSeq.current;
    const data = latest.current;
    setSaveState("Saving…");
    const p = (async () => {
      try {
        const r = await api(`/years/${yearRef.current}/config`, "PUT", {
          config: data,
          lock: lockRef.current,
        });
        lockRef.current = r.lock;
        setLicense(r.license);
        setRecord((old) => old ? { ...old, config: data } : old);
        savedSeq.current = seq;
        setDirty(seq !== changeSeq.current);
        setSaveState(seq === changeSeq.current ? "Saved" : "Unsaved changes");
      } catch (e) {
        setSaveState("Save failed");
        setError((e as Error).message);
        throw e;
      }
    })();
    flight.current = p;
    try {
      await p;
    } finally {
      flight.current = null;
    }
  }, []);
  useEffect(() => {
    if (!dirty || !editable) return;
    const timer = setTimeout(() => {
      void persist().catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [config, dirty, editable, persist]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (savedSeq.current !== changeSeq.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  function change(next: Config) {
    if (!editable) return;
    latest.current = next;
    changeSeq.current++;
    setConfig(next);
    setDirty(true);
    setSaveState("Unsaved changes");
  }
  function updateBoard(next: Board) {
    change({
      ...config,
      boards: config.boards.map((b) => (b.id === next.id ? next : b)),
    });
  }
  function patchGrade(id: string, patch: RecordData) {
    const current = latest.current.boards.find((b) => b.id === board?.id);
    if (current)
      updateBoard({
        ...current,
        grades: current.grades.map((g) =>
          g.id === id ? { ...g, ...patch } : g,
        ),
      });
  }
  function patchClassroom(id: string, patch: RecordData) {
    const current = latest.current.boards.find((b) => b.id === board?.id);
    if (current)
      updateBoard({
        ...current,
        grades: current.grades.map((g) => ({
          ...g,
          classrooms: g.classrooms.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),
      });
  }
  async function act(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function ensureSaved() {
    await persist();
    if (savedSeq.current !== changeSeq.current) await persist();
    if (savedSeq.current !== changeSeq.current)
      throw Error("Wait for changes to save");
  }
  useNavigationGuard({
    label: `Structure draft for ${i.name}`,
    isDirty: () => savedSeq.current !== changeSeq.current,
    save: ensureSaved,
    discard: async () => {
      if (flight.current) await flight.current.catch(() => {});
      await load(yearRef.current);
    },
  });
  const close = useCallback(() => setModal(null), []);
  async function remove(kind: string, id: string) {
    if (!board) return;
    const owner = config.boards.find((b) => kind === "schedule" ? b.schedules.some((s) => s.id === id) : kind === "event" ? b.events.some((e) => e.id === id) : b.id === board.id);
    if (owner) change(removeFromConfig(config, owner.id, kind, id));
    setModal(null);
  }
  return (
    <>
      <button className="text-back" onClick={() => void navigate(onBack)}>
        <ArrowLeft size={14} /> All schools
      </button>
      <PageHead
        eyebrow="SCHOOL WORKSPACE"
        title={i.name}
        text="Build the academic foundation, one clear decision at a time."
        action={
          <div className="row-actions">
            <Button onClick={() => setModal({ type: "year" })}>
              <Plus size={15} /> Academic year
            </Button>
            <Button
              onClick={() =>
                void act(async () => {
                  setHistory(await api(`/years/${yearId}/history`));
                  setModal({ type: "history" });
                })
              }
              disabled={!yearId}
            >
              <History size={15} /> History
            </Button>
          </div>
        }
      />
      <div className="structure-toolbar">
        <div className="row-actions">
          <select
            aria-label="Academic year"
            value={yearId}
            onChange={(e) => {
              const id = e.target.value;
              void navigate(() => setYearId(id));
            }}
          >
            <option value="">Select academic year</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
          {record && (
            <Badge
              value={
                editable
                  ? record.published
                    ? "DRAFT_CHANGES_PENDING"
                    : "DRAFT"
                  : record.revision.status
              }
            />
          )}
        </div>
        <div className="row-actions">
          <span className={"save-state " + (dirty ? "pending" : "")}>
            <i />
            {saveState}
          </span>
          {editable ? (
            <>
              <Button
                disabled={busy || !dirty}
                onClick={() => void act(() => persist())}
              >
                <Save size={14} />
                Save draft
              </Button>
              <Button
                variant="dark"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await ensureSaved();
                    const result = await api(`/years/${yearId}/review`);
                    setIssues(result.issues);
                    setModal({ type: "review" });
                  })
                }
              >
                Review & {record?.published ? "publish" : "activate"}
                <ArrowUpRight size={14} />
              </Button>
            </>
          ) : (
            record && (
              <Button
                variant="dark"
                onClick={() =>
                  void act(async () => {
                    if (!record.year.draftRevisionId)
                      await api(`/years/${yearId}/draft`, "POST", {});
                    await load(yearId);
                  })
                }
              >
                <Pencil size={15} />{" "}
                {record.year.draftRevisionId
                  ? "Return to working draft"
                  : "Edit configuration"}
              </Button>
            )
          )}
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          <AlertCircle size={17} />
          {error}
          <button className="icon-button" onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {!yearId ? (
        <Empty
          title="Start your first academic year"
          text="Create a fresh year or copy a previous configuration."
          action={
            <Button variant="dark" onClick={() => setModal({ type: "year" })}>
              <Plus size={16} /> Create academic year
            </Button>
          }
        />
      ) : !record ? (
        <div className="loading inline">
          <Loader2 className="spin" />
          Loading academic structure…
        </div>
      ) : (
        <>
          {workspaceSection === "Academic Years" && <>
            <h2>Academic years · {i.name}</h2><p>Start fresh or copy reusable structure and recurring rules. Fixed-date exceptions are excluded from copies.</p>
            <DataTable data={years} columns={[
              { accessorKey: "label", header: "Academic year" }, { accessorKey: "startsAt", header: "Starts", cell: (c) => dateLabel(c.getValue()) }, { accessorKey: "endsAt", header: "Ends", cell: (c) => dateLabel(c.getValue()) },
              { id: "status", header: "Configuration", accessorFn: (y) => y.draftRevisionId ? y.publishedRevisionId ? "Draft changes pending" : "Draft" : "Published" },
              { id: "open", header: "Action", cell: (c) => <Button onClick={() => void navigate(() => { setYearId(c.row.original.id); onOpenStructure?.(); })}>Open year</Button> },
            ]} />
          </>}
          {workspaceSection === "Review & History" && <>
            <h2>Review & history · {record.year.label}</h2><p>Published versions stay unchanged while you edit and review a working draft.</p>
            <div className="row-actions"><Button disabled={!editable} onClick={() => void act(async () => { await ensureSaved(); const result = await api(`/years/${yearId}/review`); setIssues(result.issues); setModal({ type: "review" }); })}>Review draft changes</Button>
            <Button onClick={() => void act(async () => { setHistory(await api(`/years/${yearId}/history`)); setModal({ type: "history" }); })}>View published versions</Button>
            <Button onClick={onOpenStructure}>Open structure workspace</Button></div>
            <ChangeReview changes={configurationChanges(record.published, config)} before={record.published} after={config} />
          </>}
          <div hidden={workspaceSection !== "Structure Management"}>
          <div className="tabs structure-tabs">
            {[
              "School Registration",
              "Academic Sections",
              "Classroom Setup",
              "Bell Time & Calendar",
            ].map((t, n) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => void navigate(() => setTab(t))}
              >
                <span>{String(n + 1).padStart(2, "0")}</span>
                {t}
              </button>
            ))}
          </div>
          <div className="board-bar">
            <div className="row-actions">
              <span className="muted">Board</span>
              {config.boards.map((b) => (
                <button
                  key={b.id}
                  className={
                    "board-pill " + (board?.id === b.id ? "selected" : "")
                  }
                  onClick={() => void navigate(() => setBoardId(b.id))}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <span className="muted">
              {editable
                ? "Working draft · Published data stays unchanged"
                : "Published version · Create a draft to make changes"}
            </span>
          </div>
          {tab === "School Registration" && (
            <>
              <div className="registration-card">
                <div className="section-head">
                  <div>
                    <h2>School registration</h2>
                    <p>
                      Registered identity is maintained by your Super Admin.
                    </p>
                  </div>
                  <Button onClick={() => setModal({ type: "changeRequest" })}>
                    Request a change <ArrowUpRight size={14} />
                  </Button>
                </div>
                {editable &&
                  i.boards.some(
                    (name: string) =>
                      !config.boards.some((b) => b.name === name),
                  ) && (
                    <Button
                      onClick={() =>
                        change({
                          boards: [
                            ...config.boards,
                            ...emptyConfig(
                              i.boards.filter(
                                (name: string) =>
                                  !config.boards.some((b) => b.name === name),
                              ),
                              uid,
                            ).boards,
                          ],
                        })
                      }
                    >
                      Sync newly registered boards
                    </Button>
                  )}
                <div className="registration-identity">
                  {i.logo && <img src={i.logo} alt={`${i.name} logo`} />}
                  <DetailGrid
                    record={i}
                    keys={[
                      "name",
                      "registration",
                      "officer",
                      "phone",
                      "email",
                      "address",
                    ]}
                  />
                </div>
              </div>
              {board && (
                <>
                  <div className="section-head">
                    <div>
                      <h2>{board.name} grades</h2>
                      <p>
                        Grade names are unique within each registered board.
                      </p>
                    </div>
                    <Button
                      variant="dark"
                      disabled={!editable}
                      onClick={() => setModal({ type: "grade" })}
                    >
                      <Plus size={15} /> Add grade
                    </Button>
                  </div>
                  <DataTable
                    data={board.grades}
                    editableFields={
                      editable
                        ? [
                            {
                              key: "name",
                              label: "Grade name",
                              validate: (v, row) =>
                                !v.trim()
                                  ? "Grade name is required"
                                  : board.grades.some(
                                        (g) =>
                                          g.id !== row.id &&
                                          g.name.toLowerCase() ===
                                            v.trim().toLowerCase(),
                                      )
                                    ? "Grade name already exists"
                                    : undefined,
                            },
                            {
                              key: "active",
                              label: "Grade status",
                              type: "select",
                              options: [
                                { value: "true", label: "Active" },
                                { value: "false", label: "Inactive" },
                              ],
                              parse: (v) => v === "true",
                            },
                          ]
                        : []
                    }
                    onEdit={async (row, patch) => patchGrade(row.id, patch)}
                    bulkActions={
                      editable
                        ? [
                            {
                              label: "Activate grades",
                              action: (rows) =>
                                updateBoard({
                                  ...board,
                                  grades: board.grades.map((g) =>
                                    rows.some((r) => r.id === g.id)
                                      ? { ...g, active: true }
                                      : g,
                                  ),
                                }),
                            },
                            {
                              label: "Deactivate grades",
                              confirm:
                                "Deactivate the selected grades in this draft?",
                              action: (rows) =>
                                updateBoard({
                                  ...board,
                                  grades: board.grades.map((g) =>
                                    rows.some((r) => r.id === g.id)
                                      ? { ...g, active: false }
                                      : g,
                                  ),
                                }),
                            },
                          ]
                        : []
                    }
                    columns={[
                      {
                        accessorKey: "name",
                        header: "Grade",
                        cell: (c) => <strong>{c.getValue()}</strong>,
                      },
                      {
                        id: "section",
                        header: "Academic section",
                        accessorFn: (r) =>
                          board.sections.find((s) => s.id === r.sectionId)
                            ?.name || "Unassigned",
                      },
                      {
                        accessorKey: "active",
                        header: "Status",
                        cell: (c) => (
                          <Badge value={c.getValue() ? "ACTIVE" : "INACTIVE"} />
                        ),
                      },
                      {
                        id: "count",
                        header: "Classrooms",
                        accessorFn: (r) => r.classrooms.length,
                      },
                      {
                        id: "actions",
                        header: "Actions",
                        cell: (c) => (
                          <div className="row-actions">
                            <Button
                              disabled={!editable}
                              onClick={() =>
                                setModal({
                                  type: "grade",
                                  record: c.row.original,
                                })
                              }
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              disabled={!editable}
                              onClick={() =>
                                setModal({
                                  type: "delete",
                                  kind: "grade",
                                  record: c.row.original,
                                })
                              }
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
            </>
          )}
          {tab === "Academic Sections" && board && (
            <>
              <div className="section-head">
                <div>
                  <h2>Academic sections</h2>
                  <p>
                    Organize grades within {board.name}. Unassigned grades can
                    remain in a draft or incomplete active structure.
                  </p>
                </div>
                <Button
                  variant="dark"
                  disabled={!editable}
                  onClick={() => setModal({ type: "section" })}
                >
                  <Plus size={15} /> Add section
                </Button>
              </div>
              <div className="section-grid">
                {[
                  ...board.sections,
                  { id: "unassigned", name: "Unassigned grades" },
                ].map((s) => (
                  <div className="academic-card" key={s.id}>
                    <div className="academic-card-head">
                      <h3>{s.name}</h3>
                      {s.id !== "unassigned" && (
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            disabled={!editable}
                            onClick={() =>
                              setModal({ type: "section", record: s })
                            }
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="icon-button"
                            disabled={!editable}
                            onClick={() =>
                              setModal({
                                type: "delete",
                                kind: "section",
                                record: s,
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {board.grades
                      .filter((g) =>
                        s.id === "unassigned"
                          ? !g.sectionId
                          : g.sectionId === s.id,
                      )
                      .map((g) => (
                        <div className="grade-assignment" key={g.id}>
                          <strong>{g.name}</strong>
                          <select
                            aria-label={`${g.name} academic section`}
                            value={g.sectionId || ""}
                            disabled={!editable}
                            onChange={(e) =>
                              updateBoard({
                                ...board,
                                grades: board.grades.map((x) =>
                                  x.id === g.id
                                    ? {
                                        ...x,
                                        sectionId: e.target.value || null,
                                      }
                                    : x,
                                ),
                              })
                            }
                          >
                            <option value="">Unassigned</option>
                            {board.sections.map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                {sec.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    {!board.grades.some((g) =>
                      s.id === "unassigned"
                        ? !g.sectionId
                        : g.sectionId === s.id,
                    ) && <p className="muted">No grades assigned</p>}
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Classroom Setup" && board && (
            <>
              <div className="license-banner">
                <div>
                  <span className="license-icon">
                    <School size={21} />
                  </span>
                  <div>
                    <strong>Organization classroom allowance</strong>
                    <p>
                      Shared across every school and board · Inactive classrooms count
                    </p>
                  </div>
                </div>
                <div className="license-numbers">
                  <span>
                    <strong>{displayedUsage}</strong>{" "}
                    Created / reserved
                  </span>
                  <span>
                    <strong>{license.limit || 0}</strong>{" "}
                    Allowed
                  </span>
                  <span>
                    <strong>
                      {Math.max(
                        0,
                        (license.limit || 0) -
                          displayedUsage,
                      )}
                    </strong>{" "}
                    Remaining
                  </span>
                </div>
              </div>
              <div className="section-head">
                <div>
                  <h2>Classroom setup</h2>
                  <p>
                    Class divisions belong to grades. Subject assignment is
                    handled later.
                  </p>
                </div>
                <Button
                  variant="dark"
                  disabled={!editable || !board.grades.length}
                  onClick={() => setModal({ type: "classrooms" })}
                >
                  <Plus size={15} /> Add classrooms
                </Button>
              </div>
              <DataTable
                editableFields={
                  editable
                    ? [
                        {
                          key: "name",
                          label: "Classroom name",
                          validate: (v, row) =>
                            !v.trim()
                              ? "Classroom name is required"
                              : board.grades.some((g) =>
                                    g.classrooms.some(
                                      (c) =>
                                        c.id !== row.id &&
                                        c.name.toLowerCase() ===
                                          v.trim().toLowerCase(),
                                    ),
                                  )
                                ? "Classroom name already exists"
                                : undefined,
                        },
                        {
                          key: "active",
                          label: "Classroom status",
                          type: "select",
                          options: [
                            { value: "true", label: "Active" },
                            { value: "false", label: "Inactive" },
                          ],
                          parse: (v) => v === "true",
                        },
                      ]
                    : []
                }
                onEdit={async (row, patch) => patchClassroom(row.id, patch)}
                bulkActions={
                  editable
                    ? [
                        {
                          label: "Activate classrooms",
                          action: (rows) =>
                            updateBoard({
                              ...board,
                              grades: board.grades.map((g) => ({
                                ...g,
                                classrooms: g.classrooms.map((c) =>
                                  rows.some((r) => r.id === c.id)
                                    ? { ...c, active: true }
                                    : c,
                                ),
                              })),
                            }),
                        },
                        {
                          label: "Deactivate classrooms",
                          confirm:
                            "Deactivate the selected classrooms in this draft? They will continue to count toward your allowance.",
                          action: (rows) =>
                            updateBoard({
                              ...board,
                              grades: board.grades.map((g) => ({
                                ...g,
                                classrooms: g.classrooms.map((c) =>
                                  rows.some((r) => r.id === c.id)
                                    ? { ...c, active: false }
                                    : c,
                                ),
                              })),
                            }),
                        },
                      ]
                    : []
                }
                data={board.grades.flatMap((g) =>
                  g.classrooms.map((c) => ({
                    ...c,
                    gradeId: g.id,
                    gradeName: g.name,
                    sectionName:
                      board.sections.find((s) => s.id === g.sectionId)?.name ||
                      "Unassigned",
                  })),
                )}
                columns={[
                  {
                    accessorKey: "name",
                    header: "Classroom",
                    cell: (c) => <strong>{c.getValue()}</strong>,
                  },
                  { accessorKey: "gradeName", header: "Grade" },
                  { accessorKey: "sectionName", header: "Section" },
                  {
                    accessorKey: "active",
                    header: "Status",
                    cell: (c) => (
                      <Badge value={c.getValue() ? "ACTIVE" : "INACTIVE"} />
                    ),
                  },
                  {
                    id: "actions",
                    header: "Actions",
                    cell: (c) => (
                      <div className="row-actions">
                        <Button
                          disabled={!editable}
                          onClick={() =>
                            setModal({
                              type: "classroom",
                              record: c.row.original,
                            })
                          }
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          disabled={!editable}
                          onClick={() =>
                            setModal({
                              type: "delete",
                              kind: "classroom",
                              record: c.row.original,
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ),
                  },
                ]}
                bulkAction={
                  editable
                    ? (rows) => {
                        const next = structuredClone(board);
                        for (const g of next.grades)
                          g.classrooms = g.classrooms.map((c) =>
                            rows.some((r) => r.id === c.id)
                              ? { ...c, active: !c.active }
                              : c,
                          );
                        updateBoard(next);
                      }
                    : undefined
                }
              />
              <p className="table-help">
                Bulk action toggles selected classroom statuses. Deletions
                reduce the current year reservation after publication; other years may still determine usage.
              </p>
              <div className="summary-strip">
                {board.grades.map((g) => (
                  <span key={g.id}>
                    {g.name}: <strong>{g.classrooms.length}</strong>
                  </span>
                ))}
                {board.sections.map((s) => (
                  <span key={s.id}>
                    {s.name}:{" "}
                    <strong>
                      {board.grades
                        .filter((g) => g.sectionId === s.id)
                        .reduce((n, g) => n + g.classrooms.length, 0)}
                    </strong>
                  </span>
                ))}
              </div>
            </>
          )}
          {tab === "Bell Time & Calendar" && board && (
            <BellCalendar
              key={board.id + record.year.id}
              board={board}
              config={config}
              editable={!!editable}
              onChange={updateBoard}
              onEdit={(type, record) => setModal({ type, ...(record?.suggestedRule ? { suggestedRule: record.suggestedRule } : { record }) })}
              onDelete={(kind, record) =>
                setModal({ type: "delete", kind, record })
              }
              year={record.year}
            />
          )}
          {editable && record.published && (
            <div className="discard">
              <button onClick={() => setModal({ type: "discard" })}>
                Discard draft changes
              </button>
              <span>The current published version will be preserved.</span>
            </div>
          )}
          </div>
        </>
      )}
      {modal && (
        <Modal
          page={!["delete", "discard", "grade", "section", "classroom"].includes(modal.type)}
          title={
            modal.type === "year"
              ? "Create academic year"
              : modal.type === "review"
                ? "Review your configuration"
                : modal.type === "history"
                  ? "Published version history"
                  : modal.type === "delete"
                    ? `Delete ${modal.kind}`
                    : modal.type === "schedule"
                      ? "Bell schedule"
                      : modal.type === "event"
                        ? "Calendar event"
                        : modal.type === "discard"
                          ? "Discard working draft"
                          : modal.type === "changeRequest"
                            ? "Request registration change"
                            : modal.type === "classrooms"
                              ? "Add multiple classrooms"
                              : modal.type === "classroom"
                                ? "Edit classroom"
                                : `${modal.record ? "Edit" : "Add"} ${modal.type}`
          }
          onClose={close}
          wide={["schedule", "review"].includes(modal.type)}
        >
          {modal.type === "year" && (
            <AcademicYearForm years={years} onSubmit={async (v) => {
              await ensureSaved();
              const r = await api(`/institutions/${i.id}/years`, "POST", v);
              await loadYears(); setYearId(r.id); setModal(null);
              notify("Academic year created. Review calendar dates and recurring rules before activation.");
            }} />
          )}
          {modal.type === "grade" && board && (
            <Form
              fields={[
                { key: "name", label: "Grade name", required: true },
                {
                  key: "active",
                  label: "Status",
                  options: [
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ],
                },
              ]}
              initial={
                modal.record
                  ? { ...modal.record, active: String(modal.record.active) }
                  : { active: "true" }
              }
              onSubmit={async (v) => {
                const grade = {
                  ...(modal.record || {
                    id: uid(),
                    sectionId: null,
                    classrooms: [],
                  }),
                  name: v.name.trim(),
                  active: v.active === "true",
                };
                if (
                  board.grades.some(
                    (g) =>
                      g.id !== grade.id &&
                      g.name.toLowerCase() === grade.name.toLowerCase(),
                  )
                )
                  throw Error("Grade name must be unique within this board");
                updateBoard({
                  ...board,
                  grades: modal.record
                    ? board.grades.map((g) => (g.id === grade.id ? grade : g))
                    : [...board.grades, grade],
                });
                setModal(null);
              }}
            />
          )}
          {modal.type === "section" && board && (
            <Form
              fields={[{ key: "name", label: "Section name", required: true }]}
              initial={modal.record}
              onSubmit={async (v) => {
                const section = {
                  id: modal.record?.id || uid(),
                  name: v.name.trim(),
                };
                if (
                  board.sections.some(
                    (s) =>
                      s.id !== section.id &&
                      s.name.toLowerCase() === section.name.toLowerCase(),
                  )
                )
                  throw Error("Section name must be unique within this board");
                updateBoard({
                  ...board,
                  sections: modal.record
                    ? board.sections.map((s) =>
                        s.id === section.id ? section : s,
                      )
                    : [...board.sections, section],
                });
                setModal(null);
              }}
            />
          )}
          {modal.type === "classroom" && board && (
            <Form
              fields={[
                { key: "name", label: "Classroom name", required: true },
                {
                  key: "active",
                  label: "Status",
                  options: [
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ],
                },
              ]}
              initial={{ ...modal.record, active: String(modal.record.active) }}
              onSubmit={async (v) => {
                if (
                  board.grades.some((g) =>
                    g.classrooms.some(
                      (c) =>
                        c.id !== modal.record.id &&
                        c.name.toLowerCase() === v.name.trim().toLowerCase(),
                    ),
                  )
                )
                  throw Error(
                    "Classroom name must be unique within this board",
                  );
                updateBoard({
                  ...board,
                  grades: board.grades.map((g) => ({
                    ...g,
                    classrooms: g.classrooms.map((c) =>
                      c.id === modal.record.id
                        ? {
                            ...c,
                            name: v.name.trim(),
                            active: v.active === "true",
                          }
                        : c,
                    ),
                  })),
                });
                setModal(null);
              }}
            />
          )}
          {modal.type === "classrooms" && board && (
            <Form
              fields={[
                {
                  key: "gradeId",
                  label: "Apply to grade",
                  options: [
                    {
                      value: "ALL",
                      label: "Every grade (same count per grade)",
                    },
                    ...board.grades.map((g) => ({
                      value: g.id,
                      label: g.name,
                    })),
                  ],
                  required: true,
                },
                {
                  key: "count",
                  label: "Number of new classrooms per grade",
                  type: "number",
                  required: true,
                  help: "Names will be suggested automatically: Grade 1A, Grade 1B…",
                },
              ]}
              initial={{ gradeId: board.grades[0]?.id, count: 1 }}
              onSubmit={async (v) => {
                if (!Number.isInteger(v.count) || v.count < 1 || v.count > 100)
                  throw Error("Enter a whole number between 1 and 100");
                const n = structuredClone(board);
                const targets = n.grades.filter(
                  (g) => v.gradeId === "ALL" || g.id === v.gradeId,
                );
                if (
                  Math.max(displayedUsage, license.used - institutionReserved + Math.max(otherYearUsage, localUsage, countClassrooms(config) + targets.length * v.count)) >
                  (license.limit || 0)
                )
                  throw Error(
                    "Organization classroom limit reached. Increase the shared allowance or remove classrooms.",
                  );
                for (const g of targets) {
                  let index = 0;
                  for (let n = 0; n < v.count; n++) {
                    let name = "";
                    do {
                      name =
                        g.name +
                        String.fromCharCode(65 + (index % 26)) +
                        (index >= 26 ? Math.floor(index / 26) : "");
                      index++;
                    } while (
                      board.grades.some((x) =>
                        x.classrooms.some((c) => c.name === name),
                      ) ||
                      g.classrooms.some((c) => c.name === name)
                    );
                    g.classrooms.push({ id: uid(), name, active: true });
                  }
                }
                updateBoard(n);
                setModal(null);
              }}
            />
          )}
          {modal.type === "delete" && (
            <>
              <div className="notice error">
                <AlertCircle size={18} />
                Delete “{modal.record.name}” from this working draft?
              </div>
              <p>
                {modal.kind === "grade"
                  ? `This also removes ${modal.record.classrooms.length} dependent classrooms: ${modal.record.classrooms.map((c: RecordData) => c.name).join(", ") || "none"}.`
                  : modal.kind === "section"
                    ? "Assigned grades become unassigned. Grades and classrooms are preserved. Section-targeted schedules and events are removed from the draft."
                    : "Related target references will be removed from the draft."}{" "}
                Published historical versions are preserved.
              </p>
              <Form
                fields={[
                  {
                    key: "confirmation",
                    label: `Type “${modal.record.name}” to confirm`,
                    required: true,
                  },
                ]}
                submit="Delete from draft"
                onSubmit={async (v) => {
                  if (v.confirmation !== modal.record.name)
                    throw Error("Confirmation does not match");
                  await remove(modal.kind, modal.record.id);
                }}
              />
            </>
          )}
          {modal.type === "discard" && (
            <>
              <p>
                This removes every unpublished change. The published
                configuration stays available.
              </p>
              <Button
                variant="danger"
                onClick={() =>
                  void act(async () => {
                    await ensureSaved();
                    await api(`/years/${yearId}/draft`, "DELETE");
                    await load(yearId);
                    setModal(null);
                  })
                }
              >
                Discard draft
              </Button>
            </>
          )}
          {modal.type === "schedule" && board && (
            <ScheduleEditor
              boards={config.boards}
              board={board}
              ruleType={modal.suggestedRule}
              initial={modal.record}
              onSave={(s) => {
                change({ ...config, boards: config.boards.map((b) => ({ ...b, schedules: b.id === board.id ? [...b.schedules.filter((x) => x.id !== s.id), s] : b.schedules.filter((x) => x.id !== s.id) })) });
                setModal(null);
              }}
            />
          )}
          {modal.type === "event" && board && (
            <EventEditor
              ruleType={modal.suggestedRule}
              boards={config.boards}
              board={board}
              initial={modal.record}
              onSave={(ev) => {
                change({ ...config, boards: config.boards.map((b) => ({ ...b, events: b.id === board.id ? [...b.events.filter((x) => x.id !== ev.id), ev] : b.events.filter((x) => x.id !== ev.id) })) });
                setModal(null);
              }}
            />
          )}
          {modal.type === "review" && (
            <>
              <div
                className={
                  "notice " +
                  (issues.some((x) => x.severity === "error")
                    ? "error"
                    : issues.length
                      ? "amber-notice"
                      : "success")
                }
              >
                <CheckCircle2 size={20} />
                {issues.some((x) => x.severity === "error")
                  ? "Resolve blocking errors before publication"
                  : issues.length
                    ? "Ready to activate with incomplete-setup warnings"
                    : "Configuration is ready for activation"}
              </div>
              <ChangeReview
                changes={configurationChanges(
                  record?.published || null,
                  config,
                )}
                before={record?.published || null}
                after={config}
              />
              <div className="review-stats">
                <strong>
                  {config.boards.length}
                  <span>Boards</span>
                </strong>
                <strong>
                  {config.boards.reduce((n, b) => n + b.grades.length, 0)}
                  <span>Grades</span>
                </strong>
                <strong>
                  {countClassrooms(config)}
                  <span>Classrooms</span>
                </strong>
              </div>
              <div className="issue-list">
                {issues.map((x, n) => (
                  <div key={n} className={x.severity}>
                    <AlertCircle size={15} />
                    <span>{x.message}</span>
                    <small>{x.severity}</small>
                  </div>
                ))}
              </div>
              <Form
                fields={[
                  {
                    key: "summary",
                    label: "Publication summary",
                    type: "textarea",
                    required: true,
                  },
                ]}
                initial={{
                  summary:
                    record?.revision.summary ||
                    "Academic structure configuration",
                }}
                onSubmit={async (v) => {
                  if (issues.some((x) => x.severity === "error"))
                    throw Error("Resolve blocking errors first");
                  await ensureSaved();
                  await api(`/years/${yearId}/publish`, "POST", {
                    summary: v.summary,
                    lock: lockRef.current,
                  });
                  await load(yearId);
                  await loadYears();
                  setModal(null);
                  notify(
                    "Configuration published. Previous versions remain available.",
                  );
                }}
                submit="Publish configuration"
              />
            </>
          )}
          {modal.type === "history" && (
            <>
              {history.length ? (
                <DataTable data={history} columns={[
                  { accessorKey: "sequence", header: "Version" }, { accessorKey: "summary", header: "Publication summary" },
                  { accessorKey: "status", header: "Status", cell: (c) => <Badge value={c.getValue()} /> },
                  { accessorKey: "publishedAt", header: "Published", cell: (c) => dateLabel(c.getValue()) },
                  { id: "actions", header: "Actions", cell: (c) => <div className="row-actions">
                    <Button onClick={() => void act(async () => { await ensureSaved(); await load(yearId, c.row.original.id); setModal(null); onOpenStructure?.(); })}>View</Button>
                    <Button disabled={!!record?.year.draftRevisionId} onClick={() => void act(async () => {
                      await api(`/years/${yearId}/draft`, "POST", { restoreRevisionId: c.row.original.id }); await load(yearId); setModal(null); onOpenStructure?.();
                    })}>Restore as draft</Button>
                  </div> },
                ]} />
              ) : (
                <Empty
                  title="No published versions"
                  text="Activate your first configuration to start the version history."
                />
              )}
              <p className="muted">
                Restoration creates a new working draft. It must pass validation
                before publication.
              </p>
            </>
          )}
          {modal.type === "changeRequest" && (
            <RegistrationRequestForm
              institution={i}
              onSaved={() => {
                setModal(null);
                notify("Registration change submitted for review.");
              }}
            />
          )}
        </Modal>
      )}
    </>
  );
}
function ScopeRule({
  boards,
  board,
  target,
  rule,
  onTarget,
  onRule,
}: {
  boards?: Board[];
  board: Board;
  target: Target;
  rule: Rule;
  onTarget: (t: Target) => void;
  onRule: (r: Rule) => void;
}) {
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
          Apply to
          <select
            value={target.scope}
            onChange={(e) =>
              onTarget({ scope: e.target.value as Target["scope"], ids: [] })
            }
          >
            {[
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
                {s === "school" ? "Entire school" : s === "board" ? "Current board" : s === "boards" ? "Selected boards" : s === "sections" ? "Selected sections" : s === "grades" ? "Selected grades" : s === "classrooms" ? "Selected classrooms" : s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date rule
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
        </label>
        {!["school", "board"].includes(target.scope) && (
          <label className="span2">
            Targets
            <select
              multiple
              value={target.ids}
              onChange={(e) =>
                onTarget({
                  ...target,
                  ids: Array.from(e.target.selectedOptions).map((o) => o.value),
                })
              }
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <small>Use Ctrl / Command to select a group.</small>
          </label>
        )}
        {rule.type === "date" && (
          <label>
            Specific date
            <input
              type="date"
              value={rule.date || ""}
              onChange={(e) => onRule({ ...rule, date: e.target.value })}
            />
          </label>
        )}
        {["weekly", "recurring"].includes(rule.type) && (
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
const defaultRule = (): Rule => ({
  type: "default",
  weekdays: [],
  intervalWeeks: 1,
});
function ScheduleEditor({
  ruleType,
  boards,
  board,
  initial,
  onSave,
}: {
  boards?: Board[];
  board: Board;
  ruleType?: Rule["type"];
  initial?: Schedule;
  onSave: (s: Schedule) => void;
}) {
  const [s, setS] = useState<Schedule>(
    initial || {
      id: uid(),
      name: "Regular school day",
      arrival: 480,
      dispersal: 870,
      target: { scope: "school", ids: [] },
      rule: { ...defaultRule(), type: ruleType || "default", ...(ruleType === "recurring" ? { weekdays: [6], nth: 2 } : {}) },
      slots: [],
    },
  );
  const [periods, setPeriods] = useState(8);
  const [duration, setDuration] = useState(45);
  const [error, setError] = useState("");
  const [durations, setDurations] = useState("");
  const baseline = useRef(JSON.stringify(initial || s));
  const current = useRef(s);
  current.current = s;
  function saveSchedule() {
    const result = scheduleSchema.safeParse(current.current);
    if (!result.success)
      throw Error(result.error.issues.map((i) => i.message).join("; "));
    if (!["school", "board"].includes(result.data.target.scope) && !result.data.target.ids.length)
      throw Error("Choose at least one target");
    const value = {
      ...result.data,
      slots: [...result.data.slots].sort((a, b) => a.start - b.start),
    };
    onSave(value);
    baseline.current = JSON.stringify(current.current);
  }
  useNavigationGuard({
    label: "Bell schedule editor",
    isDirty: () => JSON.stringify(current.current) !== baseline.current,
    save: async () => {
      try {
        saveSchedule();
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    },
    discard: () => {
      baseline.current = JSON.stringify(current.current);
    },
  });
  const diagnostics = scheduleDiagnostics(s);
  const affected = new Set(diagnostics.flatMap((d) => d.slotIds));
  const updateSlot = (id: string, v: Partial<Slot>) => {
    const slot = s.slots.find((p) => p.id === id);
    if (slot?.kind === "routine" && ((v.start !== undefined && v.start !== slot.start) || (v.end !== undefined && v.end !== slot.end) || v.kind === "period") && !window.confirm(`Move or change the fixed routine “${slot.name}”? Auto Assign keeps its current time anchored.`)) return;
    setS({
      ...s,
      slots: s.slots.map((p) => (p.id === id ? { ...p, ...v } : p)),
    });
  };
  return (
    <>
      <div className="form-grid">
        <label className="span2">
          Schedule name
          <input
            value={s.name}
            onChange={(e) => setS({ ...s, name: e.target.value })}
          />
        </label>
        <label>
          School day type
          <select value={s.dayType || "full"} onChange={(e) => setS({ ...s, dayType: e.target.value as "full" | "half" })}>
            <option value="full">Full day</option><option value="half">Half day</option>
          </select>
        </label>
        <label>
          Student arrival
          <input
            type="time"
            value={time(s.arrival)}
            onChange={(e) => setS({ ...s, arrival: minutes(e.target.value) })}
          />
        </label>
        <label>
          Student dispersal
          <input
            type="time"
            value={time(s.dispersal)}
            onChange={(e) => setS({ ...s, dispersal: minutes(e.target.value) })}
          />
        </label>
      </div>
      <ScopeRule
        boards={boards}
        board={board}
        target={s.target}
        rule={s.rule}
        onTarget={(target) => setS({ ...s, target })}
        onRule={(rule) => setS({ ...s, rule })}
      />
      <div className="auto-assign">
        <div>
          <h3>Auto assign periods</h3>
          <p>
            Fixed routines anchor the day. Teaching periods fill the available
            time exactly.
          </p>
        </div>
        <div className="form-grid">
          <label>
            Number of periods
            <input
              type="number"
              min={1}
              max={30}
              value={periods}
              onChange={(e) => setPeriods(Number(e.target.value))}
            />
          </label>
          <label>
            Default duration (minutes)
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
          <label className="span2">
            Individual durations (optional)
            <input
              placeholder="45, 45, 40, 45…"
              value={durations}
              onChange={(e) => setDurations(e.target.value)}
            />
          </label>
        </div>
        <Button
          onClick={() => {
            try {
              if (!Number.isInteger(periods) || periods < 1 || periods > 30)
                throw Error("Choose 1–30 periods");
              const d = durations
                ? durations.split(",").map((x) => Number(x.trim()))
                : Array(periods).fill(duration);
              if (d.length !== periods)
                throw Error("Provide one duration for each period");
              setS({
                ...s,
                slots: autoAssign(
                  s.arrival,
                  s.dispersal,
                  d,
                  s.slots.filter((p) => p.kind === "routine"),
                  uid,
                ),
              });
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Layers size={14} /> Auto assign
        </Button>
      </div>
      <div className="section-head">
        <h3>Periods & routines</h3>
        <div className="row-actions">
          <Button
            onClick={() =>
              setS({
                ...s,
                slots: [
                  ...s.slots,
                  {
                    id: uid(),
                    name: "Lunch",
                    kind: "routine",
                    start: 720,
                    end: 750,
                  },
                ],
              })
            }
          >
            <Plus size={14} /> Routine
          </Button>
          <Button
            onClick={() =>
              setS({
                ...s,
                slots: [
                  ...s.slots,
                  {
                    id: uid(),
                    name: `Period ${s.slots.filter((p) => p.kind === "period").length + 1}`,
                    kind: "period",
                    start: s.arrival,
                    end: s.arrival + duration,
                  },
                ],
              })
            }
          >
            <Plus size={14} /> Period
          </Button>
        </div>
      </div>
      {diagnostics.length > 0 && (
        <div className="schedule-diagnostics" role="status">
          <h3>Timing issues ({diagnostics.length})</h3>
          {diagnostics.map((d, n) => (
            <div className="notice error" key={n}>
              <div>
                <strong>{d.message}</strong>
                <small>{d.suggestion}</small>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="slots-editor">
        {s.slots.map((p) => (
          <div
            className={
              "slot-row " + p.kind + (affected.has(p.id) ? " invalid-slot" : "")
            }
            key={p.id}
          >
            <span className="slot-marker" />
            <input
              aria-label="Slot name"
              value={p.name}
              onChange={(e) => updateSlot(p.id, { name: e.target.value })}
            />
            <select
              aria-label="Slot type"
              value={p.kind}
              onChange={(e) =>
                updateSlot(p.id, { kind: e.target.value as Slot["kind"] })
              }
            >
              <option value="period">Teaching</option>
              <option value="routine">Routine</option>
            </select>
            <input
              aria-label="Start time"
              type="time"
              value={time(p.start)}
              onChange={(e) =>
                updateSlot(p.id, { start: minutes(e.target.value) })
              }
            />
            <span>to</span>
            <input
              aria-label="End time"
              type="time"
              value={time(p.end)}
              onChange={(e) =>
                updateSlot(p.id, { end: minutes(e.target.value) })
              }
            />
            <small>{p.end - p.start}m</small>
            <button
              className="icon-button"
              onClick={() => {
                if (p.kind === "routine" && !window.confirm(`Delete the fixed routine “${p.name}”?`)) return;
                setS({ ...s, slots: s.slots.filter((x) => x.id !== p.id) });
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <p className="muted">
        Change a slot’s start/end to reposition it. Saved slots are sorted
        chronologically. Incomplete schedules can be saved as drafts;
        publication validates coverage and overlap.
      </p>
      {error && <div className="notice error">{error}</div>}
      <footer className="form-footer">
        <Button
          variant="dark"
          onClick={() => {
            try {
              saveSchedule();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Save schedule to draft
        </Button>
      </footer>
    </>
  );
}
function EventEditor({
  ruleType,
  boards,
  board,
  initial,
  onSave,
}: {
  boards?: Board[];
  board: Board;
  ruleType?: Rule["type"];
  initial?: Board["events"][number];
  onSave: (e: Board["events"][number]) => void;
}) {
  const [e, setE] = useState<Board["events"][number]>(
    initial || {
      id: uid(),
      name: "",
      kind: "holiday",
      target: { scope: "school", ids: [] },
      rule: ruleType === "recurring" ? { ...defaultRule(), type: "recurring", weekdays: [6], nth: 2 } : { ...defaultRule(), type: "date", date: today() },
    },
  );
  const baseline = useRef(JSON.stringify(initial || e));
  const current = useRef(e);
  current.current = e;
  const [error, setError] = useState("");
  const saveEvent = () => {
    const result = eventSchema.safeParse(current.current);
    if (!result.success)
      throw Error(result.error.issues.map((i) => i.message).join("; "));
    if (!["school", "board"].includes(result.data.target.scope) && !result.data.target.ids.length)
      throw Error("Choose at least one target");
    if (result.data.overridesHoliday && (result.data.kind !== "working" || result.data.rule.type !== "date")) throw Error("A holiday reopening must be a specific-date working-day exception");
    onSave(result.data);
    baseline.current = JSON.stringify(current.current);
  };
  useNavigationGuard({
    label: "Calendar event editor",
    isDirty: () => JSON.stringify(current.current) !== baseline.current,
    save: async () => {
      try {
        saveEvent();
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    },
    discard: () => {
      baseline.current = JSON.stringify(current.current);
    },
  });
  return (
    <>
      <label>
        Event name
        <input
          value={e.name}
          onChange={(x) => setE({ ...e, name: x.target.value })}
        />
      </label>
      <label>
        Event type
        <select
          value={e.kind}
          onChange={(x) =>
            setE({ ...e, kind: x.target.value as typeof e.kind })
          }
        >
          <option value="holiday">Full holiday</option>
          <option value="working">Working-day exception</option>
          <option value="half-day">
            Half day (also configure a matching bell schedule)
          </option>
        </select>
      </label>
      <ScopeRule
        boards={boards}
        board={board}
        target={e.target}
        rule={e.rule}
        onTarget={(target) => setE({ ...e, target })}
        onRule={(rule) => setE({ ...e, rule })}
      />
      {e.kind === "working" && <label className="checkbox-row"><input type="checkbox" checked={!!e.overridesHoliday}
        onChange={(x) => { if (x.target.checked && !window.confirm("Explicitly reopen an otherwise full holiday for these targets on this specific date?")) return; setE({ ...e, overridesHoliday: x.target.checked }); }} />
        Explicitly reopen a full holiday (specific-date rule required)</label>}
      {error && <div className="notice error" role="alert">{error}</div>}
      <footer className="form-footer">
        <Button
          variant="dark"
          disabled={!e.name.trim()}
          onClick={() => {
            try {
              saveEvent();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Save event to draft
        </Button>
      </footer>
    </>
  );
}
