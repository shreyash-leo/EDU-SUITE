"use client";
import { PresetPreview } from "./preset-preview";
import { operationalYear } from "../../../../packages/domain/src/portal";
import { ImpactPreview } from "./impact-preview";
import { configurationImpact, type ConfigurationImpact } from "../../../../packages/domain/src/impact";
import { RecurrencePreview } from "./recurrence-preview";
import { ScopeRule, defaultRule } from "./scope-rule";
import { ScheduleWizard } from "./schedule-wizard";
import { BulkGrades, ClassroomBuilder } from "./bulk-builders";
import { SectionAssignments } from "./section-assignments";
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
  initialIntent = "default",
  onOpenStructure,
  onBack,
  notify,
}: {
  institution: RecordData;
  workspaceSection?: string;
  initialIntent?: "default" | "review" | "calendar" | "grades" | "edit" | "bell" | "history";
  onOpenStructure?: () => void;
  onBack: () => void;
  notify: (s: string) => void;
}) {
  const [yearView, setYearView] = useState(false);
  useEffect(() => {
    const saved = sessionStorage.getItem(`plan-structure-tab-${i.id}`);
    if (["calendar", "bell"].includes(initialIntent)) setTab("Bell Time & Calendar");
    else if (initialIntent === "grades") setTab("School Registration");
    else if (saved && ["School Registration", "Academic Sections", "Classroom Setup", "Bell Time & Calendar"].includes(saved)) setTab(saved);
  }, [i.id, initialIntent]);
  const [years, setYears] = useState<RecordData[]>([]);
  const [yearId, setYearId] = useState("");
  const [record, setRecord] = useState<RecordData | null>(null);
  const [config, setConfig] = useState<Config>({ boards: [] });
  const [tab, setTab] = useState(["calendar", "bell"].includes(initialIntent) ? "Bell Time & Calendar" : "School Registration");
  const [classSection, setClassSection] = useState(""), [classGrade, setClassGrade] = useState("");
  const [boardId, setBoardId] = useState("");
  useEffect(() => { setClassSection(""); setClassGrade(""); }, [boardId]);
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
  const revisionRef = useRef("");
  const [reviewImpact, setReviewImpact] = useState<ConfigurationImpact | null>(null);
  const [manualBoard, setManualBoard] = useState("");
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
  const classroomRows = (board?.grades || []).filter((g) => (!classSection || (classSection === "unassigned" ? !g.sectionId : g.sectionId === classSection)) && (!classGrade || g.id === classGrade)).flatMap((g) => g.classrooms.map((c) => ({ ...c, gradeId: g.id, gradeName: g.name, sectionName: board.sections.find((s) => s.id === g.sectionId)?.name || "Unassigned" })));
  const availableClassrooms = license.contractId && !license.contractConflict && displayedUsage <= license.limit ? Math.max(0, license.limit - (license.used - institutionReserved) - countClassrooms(config)) : 0;

  const loadYears = useCallback(async () => {
    const ys = await api(`/institutions/${i.id}/years`);
    setYears(ys);
    return ys;
  }, [i.id]);
  const load = useCallback(async (id: string, revisionId?: string) => {
    const r = await api(
      `/years/${id}/config${revisionId ? "?revisionId=" + revisionId : ""}`,
    );
    const missingBoards = r.revision.status === "DRAFT" ? i.boards.filter((name: string) => !r.config.boards.some((b: Board) => b.name === name)) : [];
    const loadedConfig = missingBoards.length ? { ...r.config, boards: [...r.config.boards, ...emptyConfig(missingBoards, uid).boards] } : r.config;
    setRecord(r);
    setLicense(r.license);
    setConfig(loadedConfig);
    latest.current = loadedConfig;
    lockRef.current = r.revision.lock;
    revisionRef.current = r.revision.id;
    changeSeq.current = missingBoards.length ? 1 : 0;
    savedSeq.current = 0;
    setDirty(!!missingBoards.length);
    setSaveState(missingBoards.length ? "Saving new boards…" : "Saved");
    setBoardId((old) =>
      loadedConfig.boards.some((b: Board) => b.id === (old || sessionStorage.getItem(`plan-board-${i.id}`)))
        ? old || sessionStorage.getItem(`plan-board-${i.id}`)!
        : loadedConfig.boards[0]?.id || "",
    );
  }, [i.id, i.boards.join("|")]);
  useEffect(() => {
    void loadYears()
      .then((ys) => {
        if (ys.length) { const saved = sessionStorage.getItem(`plan-year-${i.id}`); setYearId(operationalYear(ys, saved || undefined)?.id || ys[0].id); }
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
          revisionId: revisionRef.current,
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
  const editIntentHandled = useRef(false);
  useEffect(() => {
    if (initialIntent !== "edit" || !record || editIntentHandled.current) return;
    editIntentHandled.current = true;
    if (record.revision.status === "DRAFT") return;
    void act(async () => {
      if (!record.year.draftRevisionId) await api(`/years/${yearId}/draft`, "POST", {});
      await load(yearId);
    });
  }, [initialIntent, record, yearId, load]);
  const historyIntentHandled = useRef(false);
  useEffect(() => {
    if (initialIntent !== "history" || !record || historyIntentHandled.current) return;
    historyIntentHandled.current = true;
    void act(async () => {
      setHistory(await api(`/years/${yearId}/history`));
      setModal({ type: "history" });
    });
  }, [initialIntent, record, yearId]);
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
  async function commitConfiguration(proposed: Config) {
    await ensureSaved();
    await api(`/years/${yearRef.current}/config`, "PUT", { config: proposed, lock: lockRef.current, revisionId: revisionRef.current });
    await load(yearRef.current);
  }
  async function commitBoard(next: Board) {
    await commitConfiguration({ ...latest.current, boards: latest.current.boards.map((b) => b.id === next.id ? next : b) });
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
        <ArrowLeft size={14} /> Back to Structure Management Dashboard
      </button>
      <PageHead
        eyebrow="SCHOOL WORKSPACE"
        title={i.name}
        text="Build the academic foundation, one clear decision at a time."
        action={
          <div className="row-actions">
            <Button onClick={() => void navigate(() => setYearView(!yearView))}>{yearView ? "Back to configuration" : "Manage academic years"}</Button>
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
                    setIssues(result.issues); setReviewImpact(result.impact);
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
          {yearView && <>
            <h2>Academic years · {i.name}</h2><p>Start fresh or copy reusable structure and recurring rules. Fixed-date exceptions are excluded from copies.</p>
            <DataTable data={years} columns={[
              { accessorKey: "label", header: "Academic year" }, { accessorKey: "startsAt", header: "Starts", cell: (c) => dateLabel(c.getValue()) }, { accessorKey: "endsAt", header: "Ends", cell: (c) => dateLabel(c.getValue()) },
              { id: "status", header: "Configuration", accessorFn: (y) => y.draftRevisionId ? y.publishedRevisionId ? "Draft changes pending" : "Draft" : "Published" },
              { id: "open", header: "Action", cell: (c) => <Button onClick={() => void navigate(() => { setYearId(c.row.original.id); setYearView(false); onOpenStructure?.(); })}>Open year</Button> },
            ]} />
          </>}
          {!yearView && workspaceSection === "Review & History" && <>
            <h2>Review & history · {record.year.label}</h2><p>Published versions stay unchanged while you edit and review a working draft.</p>
            <div className="row-actions"><Button disabled={!editable} onClick={() => void act(async () => { await ensureSaved(); const result = await api(`/years/${yearId}/review`); setIssues(result.issues); setReviewImpact(result.impact); setModal({ type: "review" }); })}>Review draft changes</Button>
            <Button onClick={() => void act(async () => { setHistory(await api(`/years/${yearId}/history`)); setModal({ type: "history" }); })}>View published versions</Button>
            <Button onClick={onOpenStructure}>Open structure workspace</Button></div>
            <ChangeReview changes={configurationChanges(record.published, config)} before={record.published} after={config} />
          </>}
          <div hidden={yearView || workspaceSection !== "Structure Management"}>
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
                onClick={() => void navigate(() => { setTab(t); sessionStorage.setItem(`plan-structure-tab-${i.id}`, t); })}
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
          {board && ["School Registration", "Academic Sections"].includes(tab) && manualBoard !== board.id && <div className="suggested-structure-strip"><div><strong>Start with a suggested {board.name} structure</strong><p>Preview and customize grades and sections for this board. Existing records are preserved.</p></div><div className="row-actions"><Button disabled={!editable || busy} variant="dark" onClick={() => void act(async () => { await ensureSaved(); setModal({ type: "academicPreset" }); })}>Apply Suggested Structure</Button><Button onClick={() => setManualBoard(board.id)}>Customize Manually</Button></div></div>}
          {board && manualBoard === board.id && ["School Registration", "Academic Sections"].includes(tab) && <button className="record-link" onClick={() => setManualBoard("")}>Show suggested board structure</button>}
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
                <div className="detail-board-list"><strong>Registered boards</strong>{i.boards.map((name: string) => <span key={name}>{name}</span>)}</div>
                {!editable && i.boards.some((name: string) => !config.boards.some((b) => b.name === name)) && <div className="notice">New boards are registered. Create a working draft to configure them; your published structure stays unchanged.</div>}
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
                    <div className="row-actions"><Button disabled={!editable} onClick={() => setModal({ type: "grade" })}><Plus size={15} /> Add grade</Button><Button variant="dark" disabled={!editable} onClick={() => setModal({ type: "bulkGrades" })}>Add multiple grades</Button></div>
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
          {tab === "Academic Sections" && board && <SectionAssignments config={config} board={board} editable={!!editable} onChange={updateBoard} onEdit={(section) => setModal({ type: "section", record: section })} onDelete={(section) => setModal({ type: "delete", kind: "section", record: section })} />}
          {tab === "Classroom Setup" && board && (
            <>
              <div className="classroom-filters"><label>Academic section<select value={classSection} onChange={(e) => { setClassSection(e.target.value); setClassGrade(""); }}><option value="">All sections</option><option value="unassigned">Unassigned grades</option>{board.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Grade<select value={classGrade} onChange={(e) => setClassGrade(e.target.value)}><option value="">All grades</option>{board.grades.filter((g) => !classSection || (classSection === "unassigned" ? !g.sectionId : g.sectionId === classSection)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label><div className="classroom-counts"><span><strong>{classroomRows.length}</strong> classrooms</span><span><strong>{classroomRows.filter((c) => c.active).length}</strong> active</span><span><strong>{classroomRows.filter((c) => !c.active).length}</strong> inactive</span></div></div>
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
                <div className="row-actions"><Button disabled={!editable || !board.grades.length} onClick={() => setModal({ type: "newClassroom" })}>Add classroom</Button><Button variant="dark" disabled={!editable || !board.grades.length} onClick={() => setModal({ type: "classrooms" })}>Add multiple classrooms</Button></div>
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
                data={classroomRows}
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
              initialView={initialIntent === "calendar" ? "Calendar" : undefined}
              config={config}
              editable={!!editable}
              onChange={updateBoard}
              onEdit={(type, record) => setModal({ type, ...(record?.suggestedRule ? { suggestedRule: record.suggestedRule, suggestedAction: record.suggestedAction, suggestedDayType: record.suggestedDayType } : { record }) })}
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
          page={!["delete", "discard", "grade", "section", "classroom", "newClassroom"].includes(modal.type)}
          title={
            modal.type === "academicPreset" ? "Suggested board structure" : modal.type === "bulkGrades" ? "Add multiple grades" : modal.type === "newClassroom" ? "Add classroom" : modal.type === "year"
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
              onCancel={close}
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
              onCancel={close}
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
              onCancel={close}
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
          {modal.type === "academicPreset" && board && <PresetPreview yearId={yearId} board={board} lock={lockRef.current} revisionId={revisionRef.current} onCancel={close} onSaved={async (result) => { await load(yearId); setModal(null); notify(`${result.createdGrades} grades and ${result.createdSections} sections created; ${result.reusedGrades} grades reused. Other boards are unchanged.`); }} />}
          {modal.type === "bulkGrades" && board && <BulkGrades board={board} onCancel={close} onSave={async (names, active, skipped) => {
            await commitBoard({ ...board, grades: [...board.grades, ...names.map((name) => ({ id: uid(), name, active, sectionId: null, classrooms: [] }))] });
            notify(`${names.length} grades created in ${board.name}${skipped ? `; ${skipped} duplicates skipped` : ""}.`); setModal(null);
          }} />}
          {["classrooms", "newClassroom"].includes(modal.type) && board && <ClassroomBuilder board={board} initialGrade={classGrade || undefined} single={modal.type === "newClassroom"} available={availableClassrooms} onCancel={close} onSave={async (rows, active) => {
            await commitBoard({ ...board, grades: board.grades.map((g) => ({ ...g, classrooms: [...g.classrooms, ...rows.filter((r) => r.gradeId === g.id).map((r) => ({ id: uid(), name: r.name, active }))] })) });
            notify(`${rows.length} classroom${rows.length === 1 ? "" : "s"} created.`); setModal(null);
          }} />}
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
              {board && <ImpactPreview impact={configurationImpact(config, removeFromConfig(config, (config.boards.find((b) => modal.kind === "schedule" ? b.schedules.some((s) => s.id === modal.record.id) : modal.kind === "event" ? b.events.some((e) => e.id === modal.record.id) : b.id === board.id) || board).id, modal.kind, modal.record.id))} title="Deletion impact" />}
              <Form
              onCancel={close}
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
                    await api(`/years/${yearId}/draft`, "DELETE", { lock: lockRef.current, revisionId: revisionRef.current });
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
            <ScheduleWizard
              boards={config.boards}
              board={board}
              ruleType={modal.suggestedRule}
              dayType={modal.suggestedDayType}
              onCancel={close}
              yearId={yearId}
              initial={modal.record}
              onSave={async (s) => {
                await commitConfiguration({ ...config, boards: config.boards.map((b) => ({ ...b, schedules: b.id === board.id ? [...b.schedules.filter((x) => x.id !== s.id), s] : b.schedules.filter((x) => x.id !== s.id) })) });
                notify("Bell schedule saved to the working draft."); setModal(null);
              }}
            />
          )}
          {modal.type === "event" && board && (
            <EventEditor
              yearId={yearId}
              kind={modal.suggestedAction}
              ruleType={modal.suggestedRule}
              boards={config.boards}
              board={board}
              initial={modal.record}
              onSave={async (ev) => {
                await commitConfiguration({ ...config, boards: config.boards.map((b) => ({ ...b, events: b.id === board.id ? [...b.events.filter((x) => x.id !== ev.id), ev] : b.events.filter((x) => x.id !== ev.id) })) });
                notify("Calendar rule saved to the working draft."); setModal(null);
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
              <ImpactPreview impact={reviewImpact || configurationImpact(record?.published || null, config)} title="Publication impact" />
              <Form
              onCancel={close}
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
          revisionId: revisionRef.current,
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
function EventEditor({
  yearId,
  kind,
  ruleType,
  boards,
  board,
  initial,
  onSave,
}: {
  boards?: Board[];
  board: Board;
  ruleType?: Rule["type"];
  yearId: string;
  kind?: Board["events"][number]["kind"];
  initial?: Board["events"][number];
  onSave: (e: Board["events"][number]) => void | Promise<void>;
}) {
  const [e, setE] = useState<Board["events"][number]>(
    initial || {
      id: uid(),
      name: "",
      kind: kind || "holiday",
      target: { scope: "school", ids: [] },
      rule: ruleType === "recurring" ? { ...defaultRule(), type: "recurring", weekdays: [6], nth: 2 } : { ...defaultRule(), type: "date", date: today() },
    },
  );
  const baseline = useRef(JSON.stringify(initial || e));
  const current = useRef(e);
  current.current = e;
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const saveEvent = async () => {
    const result = eventSchema.safeParse(current.current);
    if (!result.success)
      throw Error(result.error.issues.map((i) => i.message).join("; "));
    if (!["school", "board"].includes(result.data.target.scope) && !result.data.target.ids.length)
      throw Error("Choose at least one target");
    if (result.data.overridesHoliday && (result.data.kind !== "working" || result.data.rule.type !== "date")) throw Error("A holiday reopening must be a specific-date working-day exception");
    await onSave(result.data);
    baseline.current = JSON.stringify(current.current);
  };
  useNavigationGuard({
    label: "Calendar event editor",
    isDirty: () => JSON.stringify(current.current) !== baseline.current,
    save: async () => {
      try {
        await saveEvent();
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
      {["weekly", "recurring", "date"].includes(e.rule.type) && <RecurrencePreview yearId={yearId} rule={e.rule} />}
      {e.kind === "working" && <label className="checkbox-row"><input type="checkbox" checked={!!e.overridesHoliday}
        onChange={(x) => { if (x.target.checked && !window.confirm("Explicitly reopen an otherwise full holiday for these targets on this specific date?")) return; setE({ ...e, overridesHoliday: x.target.checked }); }} />
        Explicitly reopen a full holiday (specific-date rule required)</label>}
      {error && <div className="notice error" role="alert">{error}</div>}
      <footer className="form-footer">
        <Button
          variant="dark"
          disabled={busy || !e.name.trim()}
          onClick={() => { setBusy(true); void saveEvent().catch((error) => setError(error.message)).finally(() => setBusy(false)); }}
        >
          Save event to draft
        </Button>
      </footer>
    </>
  );
}
