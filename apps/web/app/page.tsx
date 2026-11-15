"use client";
import { ClientPortal, ClientSchoolDetails, type SchoolIntent } from "../features/client/portal";
import { RegistrationRequestForm } from "../features/platform/requests";
import { AcademicPresetCatalogue } from "../features/platform/academic-preset-catalogue";
import { OnboardingCatalog, type OnboardingView } from "../features/platform/onboarding-catalog";
import { RecordDetails, type DetailKind } from "../features/platform/record-details";
import { WorkspaceHeader } from "../components/workspace/header";
import { useNavigation } from "../lib/navigation";
import { useWorkspaceLocation } from "../lib/workspace-location";
import { RequestComposer } from "../features/platform/requests";
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
  countClassrooms,
  organizationCategory,
  resolve,
  emptyConfig,
  type Board,
  type Config,
  type Schedule,
  type Target,
  type Rule,
  type Slot,
} from "../../../packages/domain/src";
import { api, setCsrf, label, dateLabel, type RecordData } from "../lib/api";
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
} from "../components/ui";
import { Login } from "../features/auth/login";
import {
  InstitutionForm,
  SubscriptionForm,
  LifecycleForm,
  Onboarding,
} from "../features/platform/forms";
import { Structure } from "../features/structure/workspace";
const orgFields: Field[] = [
  { key: "name", label: "Organization name", required: true, section: "Organization details" },
  { key: "legalName", label: "Legal / registered name" },
  {
    key: "type",
    label: "Organization type",
    options: [
      "Education trust",
      "Private company",
      "Society",
      "Government",
      "Independent",
    ].map((value) => ({ value, label: value })),
  },
  { key: "registration", label: "Registration number" },
  {
    key: "email",
    label: "Registered administrator email",
    section: "Administrator & contact",
    type: "email",
    required: true,
  },
  { key: "contactName", label: "Administrator / contact name" },
  { key: "phone", label: "Contact number" },
  { key: "address", label: "Address", section: "Registered address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postalCode", label: "Postal code" },
  { key: "notes", label: "Additional notes", type: "textarea", section: "Additional information" },
];
const nav = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Organizations", icon: Building2 },
  { name: "Schools", icon: School },
  { name: "Onboarding", icon: Route },
  { name: "Subscriptions", icon: Receipt },
  { name: "Requests & Settings", icon: Settings },
];
const clientNav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Schools", icon: School },
  { name: "Structure Management", icon: Layers },
  { name: "Review & History", icon: History },
  { name: "Account & Subscription", icon: Receipt },
];
export default function App() {
  const { navigate } = useNavigation();
  const [user, setUser] = useState<RecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [page, setPage] = useState("Dashboard");
  const [data, setData] = useState<RecordData>({
    organizations: [],
    institutions: [],
    subscriptions: [],
    requests: [],
    audit: [],
    usage: [],
    dashboard: {},
  });
  const [modal, setModalState] = useState<RecordData | null>(null);
  const setModal = (value: RecordData | null) => {
    if (value) void navigate(() => setModalState(value));
    else setModalState(null);
  };
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [sidebar, setSidebar] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [clientView, setClientView] = useState<"directory" | "details" | "workspace">("directory");
  const [schoolIntent, setSchoolIntent] = useState<SchoolIntent>("default");
  const [institution, setInstitution] = useState<RecordData | null>(null);
  useEffect(() => {
    if (institution) sessionStorage.setItem("plan-selected-school", institution.id);
  }, [institution]);
  useEffect(() => {
    if (!user || user.role === "PLATFORM_ADMIN") return;
    const selected = sessionStorage.getItem("plan-selected-school");
    setInstitution((current) => data.institutions.find((school: RecordData) => school.id === (current?.id || selected) && school.status !== "DELETION_PENDING") || null);
  }, [data.institutions, user?.id]);
  const [onboardId, setOnboardId] = useState("");
  const [settingsView, setSettingsView] = useState("requests");
  const [onboardingView, setOnboardingView] = useState<OnboardingView>("list");
  const [busy, setBusy] = useState(false);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4500);
  };
  const refresh = useCallback(async (u: RecordData) => {
    const paths =
      u.role === "PLATFORM_ADMIN"
        ? [
            "organizations",
            "institutions",
            "subscriptions",
            "requests",
            "audit",
            "usage",
            "dashboard",
            "onboarding",
            "settings",
            "workspace-settings",
          ]
        : ["institutions", "requests", "usage", "workspace-settings", "organization-profile"];
    const results = await Promise.all(paths.map((p) => api("/" + p)));
    setData((old) => ({
      ...old,
      ...Object.fromEntries(paths.map((p, i) => [p, results[i]])),
    }));
    setDataReady(true);
  }, []);
  useEffect(() => {
    api("/auth/me")
      .then(async (d) => {
        setCsrf(d.csrf);
        setUser(d.user);
        if (!d.user.mustChangePassword) await refresh(d.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);
  useWorkspaceLocation(!!user && !user.mustChangePassword && dataReady, {
    page, intent: clientView === "workspace" ? schoolIntent : undefined, school: institution?.id, onboarding: onboardId || undefined,
    workflow: modal && !["credentials", "account", "orgStatus", "institutionAction"].includes(modal.type) ? modal.type : user?.role !== "PLATFORM_ADMIN" && clientView !== "directory" ? clientView === "details" ? "schoolDetails" : "schoolWorkspace" : undefined,
    record: modal?.type === "credentials" ? undefined : modal?.record?.id,
    organization: modal?.organizationId,
  }, (route) => {
    const platform = user?.role === "PLATFORM_ADMIN";
    const allowed = platform ? nav : clientNav;
    setPage(allowed.some((n) => n.name === route.page) ? route.page! : platform ? "Dashboard" : "Overview");
    setInstitution(route.school ? data.institutions.find((i: RecordData) => i.id === route.school && i.status !== "DELETION_PENDING") || null : null);
    setOnboardId(platform && data.organizations.some((o: RecordData) => o.id === route.onboarding) ? route.onboarding! : "");
    if (!platform) {
      setClientView(route.workflow === "schoolDetails" ? "details" : route.workflow === "schoolWorkspace" ? "workspace" : "directory");
      setSchoolIntent(["default", "review", "calendar", "grades", "edit", "bell", "history"].includes(route.intent || "") ? route.intent as SchoolIntent : "default");
      if (["schoolDetails", "schoolWorkspace"].includes(route.workflow || "")) { setModalState(null); return; }
    }
    const types = platform ? ["organizationDetails", "institutionDetails", "subscriptionDetails", "organization", "institution", "subscription", "resolveRequest", "academicPresetCatalogue"] : ["request", "schoolRequest", "resolveRequest"];
    if (!route.workflow || !types.includes(route.workflow)) { setModalState(null); return; }
    const records = route.workflow === "schoolRequest" ? data.institutions : route.workflow.startsWith("organization") ? data.organizations : route.workflow.startsWith("institution") ? data.institutions : route.workflow.startsWith("subscription") ? data.subscriptions : data.requests;
    const record = records.find((r: RecordData) => r.id === route.record);
    setModalState(route.record && !record ? null : { type: route.workflow, record, organizationId: route.organization });
  });
  function openClientSchool(school: RecordData, view: "details" | "workspace", intent: SchoolIntent = "default") {
    void navigate(() => {
      const registered = data.institutions.find((i: RecordData) => i.id === school.id) || school;
      if (school.yearId) sessionStorage.setItem(`plan-year-${school.id}`, school.yearId);
      sessionStorage.setItem("plan-selected-school", school.id);
      setInstitution(registered); setClientView(view); setSchoolIntent(intent);
      setPage(view === "details" ? "Schools" : ["review", "history"].includes(intent) ? "Review & History" : "Structure Management");
    });
  }
  async function action(fn: () => Promise<any>, message?: string) {
    setError("");
    setBusy(true);
    try {
      await fn();
      if (user) await refresh(user);
      if (message) notify(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saved(fn: () => Promise<any>) {
    await fn();
    setModal(null);
    if (user) await refresh(user);
    notify("Changes saved");
  }
  const close = useCallback(() => setModal(null), []);
  if (loading)
    return (
      <main className="loading">
        <Loader2 className="spin" />
        <p>Opening your workspace…</p>
      </main>
    );
  if (!user)
    return (
      <Login
        onLogin={async (d) => {
          setCsrf(d.csrf);
          setUser(d.user);
          if (!d.user.mustChangePassword) await refresh(d.user);
        }}
      />
    );
  if (user.mustChangePassword)
    return (
      <div className="login-shell">
        <div className="login-card">
          <Brand />
          <h1>Make this account yours.</h1>
          <p>Replace your temporary password before opening the workspace.</p>
          <Form
            fields={[
              {
                key: "currentPassword",
                label: "Temporary / current password",
                type: "password",
                autoComplete: "current-password",
                help: "Enter the temporary password used to sign in. Organization passwords are shown in the activation credentials.",
                required: true,
              },
              {
                key: "password",
                label: "New password",
                type: "password",
                autoComplete: "new-password",
                required: true,
                help: "At least 12 characters with uppercase, lowercase, a number and a symbol.",
              },
            ]}
            submit="Set password & continue"
            onSubmit={async (v) => {
              const r = await api("/auth/password", "POST", v);
              setCsrf(r.csrf);
              const d = await api("/auth/me");
              setUser(d.user);
              await refresh(d.user);
            }}
          />
        </div>
      </div>
    );
  const admin = user.role === "PLATFORM_ADMIN";
  const currentOrg = data.organizations.find(
    (o: RecordData) => o.id === onboardId,
  );
  const dashboard = data.dashboard;
  function openDetails(kind: DetailKind, record: RecordData) {
    setModal({ type: kind + "Details", record });
  }
  function openOrganization(id: string) {
    const record = data.organizations.find((o: RecordData) => o.id === id);
    if (record) openDetails("organization", record);
  }
  function openOnboarding(id: string) {
    void navigate(() => { setModalState(null); setInstitution(null); setOnboardId(id); setPage("Onboarding"); });
  }

  const organizationColumns: ColumnDef<RecordData, any>[] = [
    {
      accessorKey: "name",
      header: "Organization",
      cell: (c) => (
        <div className="entity-cell">
          <span className="avatar">
            {c.getValue().slice(0, 2).toUpperCase()}
          </span>
          <div>
            <button className="record-link" onClick={() => openDetails("organization", c.row.original)}>{c.getValue()}</button>
            <small>{c.row.original.email}</small>
          </div>
        </div>
      ),
    },
    { accessorKey: "type", header: "Type" },
    {
      id: "allowance", header: "Organization allowance",
      accessorFn: (r) => data.usage.find((u: RecordData) => u.organizationId === r.id)?.used || 0,
      cell: (c) => {
        const u = data.usage.find((row: RecordData) => row.organizationId === c.row.original.id);
        return <span>{u?.used || 0} / {u?.limit || 0} classrooms{u?.overLimit && <small className="error-text">Over allowance</small>}{u?.contractConflict && <small className="error-text">Contract conflict</small>}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (c) => <Badge value={c.getValue()} />,
    },
    {
      id: "institutions",
      header: "Schools",
      accessorFn: (r) => r._count?.institutions || 0,
    },
    {
      accessorKey: "onboardingStep",
      header: "Onboarding",
      cell: (c) => <span className="muted">Step {c.getValue()} of 7</span>,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: (c) => (
        <div className="row-actions">
          <Button
            onClick={() =>
              setModal({ type: "organization", record: c.row.original })
            }
          >
            <Pencil size={14} /> Edit
          </Button>
          <Button onClick={() => openDetails("organization", c.row.original)}>
            View details <ArrowUpRight size={13} />
          </Button>
          {c.row.original.activatedAt && (
            <Button
              onClick={() =>
                setModal({ type: "orgStatus", record: c.row.original })
              }
            >
              Status
            </Button>
          )}
        </div>
      ),
    },
  ];
  return (
    <div className={"app-shell" + (collapsed ? " sidebar-collapsed" : "")}>
      <a className="skip-link" href="#main-workspace" onClick={(e) => { e.preventDefault(); document.getElementById("main-workspace")?.focus(); }}>Skip to workspace</a>
      <WorkspaceHeader user={user} sections={admin ? nav : clientNav}
        organizations={admin ? data.organizations : []} institutions={data.institutions}
        onAccount={() => setModal({ type: "account" })}
        onOpen={(destination) => navigate(() => {
          setSidebar(false);
          if (destination.kind === "organization") { const record = data.organizations.find((o: RecordData) => o.id === destination.id); if (record) setModalState({ type: "organizationDetails", record }); }
          else if (destination.kind === "institution") {
            const record = data.institutions.find((i: RecordData) => i.id === destination.id);
            if (admin) { setPage("Schools"); setInstitution(null); if (record) setModalState({ type: "institutionDetails", record }); }
            else { setPage("Schools"); setClientView("details"); setInstitution(record || null); }
          }
          else { setPage(destination.name); setClientView("directory"); if (admin) setInstitution(null); }
        })} />
      <aside className={"sidebar " + (sidebar ? "open" : "")}>
        <div className="sidebar-brand"><span className="sidebar-section-title">Workspace</span><button className="icon-button sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><ChevronLeft size={16} /></button></div>
        <div className="workspace-label">
          <span className="workspace-icon">
            {admin ? <ShieldCheck size={17} /> : <Building2 size={17} />}
          </span>
          <div>
            <strong>
              {admin
                ? "Platform workspace"
                : user.organizationName || "Organization workspace"}
            </strong>
            <small>
              {admin ? "Super administrator" : "Organization administrator"}
            </small>
          </div>
        </div>
        <p className="nav-caption">Navigation</p>
        <nav>
          {(admin ? nav : clientNav
          ).map((n) => (
            <button
              key={n.name}
              title={n.name}
              aria-label={n.name}
              aria-current={(page === n.name || (!admin && page === "Dashboard" && n.name === "Overview")) ? "page" : undefined}
              className={
                (
                  admin
                    ? page === n.name
                    : page === n.name ||
                      (page === "Dashboard" && n.name === "Overview")
                )
                  ? "selected"
                  : ""
              }
              onClick={() => {
                void navigate(() => {
                  setPage(n.name);
                  setClientView("directory");
                  if (n.name === "Onboarding") setOnboardId("");
                  if (admin) setInstitution(null);
                  setModalState(null);
                  setSidebar(false);
                });
              }}
            >
              <n.icon size={18} />
              <span>{n.name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {admin && <div className="help-card">
            <span className="tiny-orange">PLAN / V1</span>
            <strong>
              A clear structure.
              <br />A stronger school.
            </strong>
            <p>Your foundation for academic operations.</p>
          </div>}
          <button
            className="account"
            onClick={() => setModal({ type: "account" })}
          >
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <Settings size={15} />
          </button>
          <button
            className="logout"
            onClick={() =>
              void navigate(async () => {
                try {
                  await api("/auth/logout", "POST");
                  setUser(null);
                  setDataReady(false);
                  history.replaceState(null, "", location.pathname);
                  setCsrf("");
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              })
            }
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      {sidebar && <button className="navigation-scrim" aria-label="Close navigation" onClick={() => setSidebar(false)} />}
      <div className="content-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open menu"
            aria-expanded={sidebar}
            onClick={() => setSidebar(!sidebar)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span className="breadcrumb-root">{admin ? "Platform" : user.organizationName || "Organization"}</span> <ChevronRight size={13} />{" "}
            <span>{(admin || clientView !== "directory" ? institution?.name : undefined) || (page === "Onboarding" && currentOrg ? currentOrg.name : page)}</span>
          </div>
          <div className="topbar-right"><span className="workspace-role"><ShieldCheck size={14} />{admin ? "Platform administration" : "School management"}</span></div>
        </header>
        <main className="main" id="main-workspace" tabIndex={-1}>
          {data["workspace-settings"]?.maintenanceNotice && (
            <div className="notice amber-notice" role="status">
              {data["workspace-settings"].maintenanceNotice}
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={17} />
              {error}
              <button className="icon-button" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {toast && (
            <div role="status" className="toast">
              <CheckCircle2 size={17} />
              {toast}
            </div>
          )}
          {admin && page === "Dashboard" && (
            <>
              <PageHead
                eyebrow="Platform administration"
                title="Dashboard"
                text="Manage organization onboarding and access across your platform."
                action={<Button variant="dark" onClick={() => setModal({ type: "organization" })}><Plus size={16} /> Add organization</Button>}
              />
              <div className="overview-heading"><h2>Organization overview</h2><span>Select a status to view its records</span></div>
              <div className="stats" aria-label="Organization status summary">
                {[
                  { title: "Total organizations", count: dashboard.total, filter: "ALL", caption: "All registered organizations", Icon: Building2, tone: "blue" },
                  { title: "Active organizations", count: dashboard.active, filter: "ACTIVE", caption: "Active organization workspaces", Icon: CheckCircle2, tone: "green" },
                  { title: "In onboarding", count: dashboard.onboarding, filter: "ONBOARDING", caption: "Draft and setup in progress", Icon: Route, tone: "amber" },
                  { title: "Inactive organizations", count: dashboard.inactive, filter: "INACTIVE", caption: "Inactive, suspended or pending deletion", Icon: Clock, tone: "neutral" },
                ].map(({ title, count, filter, caption, Icon, tone }) => (
                  <button className={`stat-card metric-${tone}`} key={title} onClick={() => {
                    void navigate(() => { setOrgFilter(filter); setPage("Organizations"); });
                  }}>
                    <span className="metric-heading"><span>{title}</span><span className="metric-icon"><Icon size={18} /></span></span>
                    <strong>{count ?? "—"}</strong>
                    <small>{caption}</small>
                    <span className="metric-link">View organizations <ArrowUpRight size={13} /></span>
                  </button>
                ))}
              </div>
              <section className="workspace-panel" aria-labelledby="recent-organizations-heading">
                <div className="section-head">
                  <div>
                    <h2 id="recent-organizations-heading">Recent organizations</h2>
                    <p>Recently updated organizations and their onboarding progress.</p>
                  </div>
                  <Button
                    onClick={() =>
                      void navigate(() => { setOrgFilter("ALL"); setPage("Organizations"); })
                    }
                  >
                    View all <ArrowUpRight size={14} />
                  </Button>
                </div>
                <DataTable
                  data={dashboard.recent || []}
                  columns={[
                    { accessorKey: "name", header: "Organization", cell: (c) => <button className="record-link" onClick={() => openOrganization(c.row.original.id)}>{c.getValue()}</button> },
                    { id: "institutionCount", accessorFn: (r) => r._count?.institutions || 0, header: "Schools" },
                    { accessorKey: "status", header: "Status", cell: (c) => <Badge value={c.getValue()} /> },
                    { accessorKey: "progress", header: "Onboarding progress", cell: (c) => <span className="progress-cell"><progress max={100} value={c.getValue()} />{c.getValue()}%</span> },
                    { accessorKey: "updatedAt", header: "Last updated", cell: (c) => dateLabel(c.getValue()) },
                    { id: "open", header: "Action", cell: (c) => <Button onClick={() => openOrganization(c.row.original.id)}>View details <ArrowUpRight size={13} /></Button> },
                  ]}
                />
              </section>
              <div className="bottom-note">
                <ShieldCheck size={17} />
                <span>
                  One connected platform. Independent, secure organization
                  workspaces.
                </span>
                <span className="tiny-orange">PLAN EDU SUITE</span>
              </div>
            </>
          )}
          {admin && page === "Organizations" && (
            <>
              <PageHead
                eyebrow="YOUR EDUCATION NETWORK"
                title="Organizations"
                text="Manage registration, onboarding and organization access."
                action={
                  <Button
                    variant="dark"
                    onClick={() => setModal({ type: "organization" })}
                  >
                    <Plus size={16} /> Add organization
                  </Button>
                }
              />
              <div className="tabs compact">
                {[
                  "ALL",
                  "DRAFT",
                  "ONBOARDING",
                  "ACTIVE",
                  "SUSPENDED",
                  "INACTIVE",
                ].map((s) => (
                  <button
                    className={orgFilter === s ? "active" : ""}
                    onClick={() => setOrgFilter(s)}
                    key={s}
                  >
                    {label(s)}
                  </button>
                ))}
              </div>
              <DataTable
                bulkActions={["ACTIVE", "INACTIVE", "SUSPENDED"].map(
                  (status) => ({
                    label:
                      status === "ACTIVE"
                        ? "Reactivate organizations"
                        : status === "INACTIVE"
                          ? "Deactivate organizations"
                          : "Suspend organizations",
                    confirm: "Change access for the selected organizations?",
                    action: async (rows) => {
                      await api("/organizations/bulk-status", "POST", {
                        ids: rows.map((r) => r.id),
                        status,
                      });
                      await refresh(user);
                      notify("Organization statuses updated");
                    },
                  }),
                )}
                data={data.organizations.filter((o: RecordData) => orgFilter === "ALL" || (["ONBOARDING", "INACTIVE"].includes(orgFilter) ? organizationCategory(o.status) === orgFilter : o.status === orgFilter))}
                columns={organizationColumns}
              />
            </>
          )}
          {admin && page === "Schools" && (
            <>
              <PageHead
                eyebrow="SCHOOLS & COLLEGES"
                title="Schools"
                text="Independent schools. One connected education network."
                action={
                  <Button
                    variant="dark"
                    onClick={() => setModal({ type: "institution" })}
                  >
                    <Plus size={16} /> Add school
                  </Button>
                }
              />
              <DataTable
                bulkActions={["ACTIVE", "INACTIVE"].map((status) => ({
                  label:
                    status === "ACTIVE"
                      ? "Reactivate schools"
                      : "Deactivate schools",
                  confirm:
                    "Change access for the selected schools? Data will be preserved.",
                  action: async (rows) => {
                    await api("/institutions/bulk-status", "POST", {
                      ids: rows.map((r) => r.id),
                      status,
                    });
                    await refresh(user);
                    notify("School statuses updated");
                  },
                }))}
                data={data.institutions}
                columns={[
                  {
                    accessorKey: "name",
                    header: "School",
                    cell: (c) => (
                      <div className="entity-cell">
                        <span className="institution-avatar">
                          <School size={18} />
                        </span>
                        <div>
                          <button className="record-link" onClick={() => openDetails("institution", c.row.original)}>{c.getValue()}</button>
                          <small><button className="record-link secondary" onClick={() => openOrganization(c.row.original.organizationId)}>{c.row.original.organization.name}</button></small>
                        </div>
                      </div>
                    ),
                  },
                  { id: "organization", header: "Parent organization", accessorFn: (r) => r.organization.name, cell: (c) => <button className="record-link" onClick={() => openOrganization(c.row.original.organizationId)}>{c.getValue()}</button> },
                  {
                    accessorKey: "boards",
                    header: "Boards",
                    cell: (c) => <span>{c.getValue().join(" · ")}</span>,
                  },
                  {
                    accessorKey: "status",
                    header: "Status",
                    cell: (c) => (
                      <>
                        <Badge value={c.getValue()} />
                        {c.row.original.deletionDueAt && (
                          <small className="error-text">
                            Deletes {dateLabel(c.row.original.deletionDueAt)}
                          </small>
                        )}
                      </>
                    ),
                  },
                  { id: "structure", header: "Structure", accessorFn: (r) => r.years.some((y: RecordData) => y.draftRevisionId && y.publishedRevisionId) ? "Draft changes pending" : r.years.some((y: RecordData) => y.publishedRevisionId) ? "Published" : r.years.length ? "Draft" : "Not started" },
                  {
                    id: "license",
                    header: "Classroom usage",
                    accessorFn: (r) => {
                      const u = data.usage.find(
                        (x: RecordData) => x.organizationId === r.organizationId,
                      );
                      return `${u?.institutions?.find((i: RecordData) => i.institutionId === r.id)?.used || 0} in school · ${u?.used || 0} / ${u?.limit || 0} organization`;
                    },
                    cell: (c) => (
                      <span>
                        {c.getValue()}
                        {data.usage.find(
                          (x: RecordData) =>
                            x.organizationId === c.row.original.organizationId,
                        )?.overLimit && (
                          <small className="error-text">Over entitlement</small>
                        )}
                      </span>
                    ),
                  },
                  {
                    id: "actions",
                    header: "Actions",
                    cell: (c) => (
                      <div className="row-actions">
                        <Button
                          disabled={
                            c.row.original.status === "DELETION_PENDING"
                          }
                          onClick={() =>
                            setModal({
                              type: "institution",
                              record: c.row.original,
                            })
                          }
                        >
                          <Pencil size={14} /> Edit
                        </Button>
                        <Button
                          onClick={() =>
                            setModal({
                              type: "institutionAction",
                              record: c.row.original,
                            })
                          }
                        >
                          Manage
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            </>
          )}
          {admin && page === "Onboarding" && (
            currentOrg ? <>
              <button className="text-back" onClick={() => void navigate(() => setOnboardId(""))}><ArrowLeft size={14} /> All onboarding</button>
              <PageHead eyebrow="Organization onboarding" title={currentOrg.name}
                text="Complete the steps below. Saved progress is retained when you leave."
                action={<Button onClick={() => openDetails("organization", currentOrg)}>View organization <ArrowUpRight size={14} /></Button>} />
              <Onboarding key={currentOrg.id}
                org={currentOrg}
                overview={data.onboarding?.find((o: RecordData) => o.id === onboardId)}
                institutions={data.institutions.filter((i: RecordData) => i.organizationId === onboardId)}
                subscriptions={data.subscriptions.filter((s: RecordData) => s.organizationId === onboardId)}
                edit={(type, record) => setModal({ type, record, organizationId: onboardId })}
                view={openDetails}
                complete={(step) => action(() => api(`/organizations/${onboardId}/onboarding`, "POST", { step }), "Onboarding step completed")}
                activate={(regenerate) => action(async () => {
                  const credentials = await api(`/organizations/${onboardId}/${regenerate ? "regenerate" : "activate"}`, "POST", {});
                  setModal({ type: "credentials", credentials });
                })}
                busy={busy}
              />
            </> : <>
              <PageHead eyebrow="Client operations" title="Client onboarding"
                text="Select an organization to review its progress and complete onboarding."
                action={<Button variant="dark" onClick={() => setModal({ type: "organization", openOnboarding: true })}><Plus size={15} /> New organization</Button>} />
              <OnboardingCatalog rows={data.onboarding || []} view={onboardingView} onViewChange={setOnboardingView} onOpen={openOnboarding} />
            </>
          )}
          {admin && page === "Subscriptions" && (
            <>
              <PageHead
                eyebrow="CUSTOM COMMERCIAL AGREEMENTS"
                title="Subscriptions"
                text="Custom quotations with organization-wide classroom and user allowances."
                action={
                  <Button
                    variant="dark"
                    onClick={() => setModal({ type: "subscription" })}
                  >
                    <Plus size={16} /> Add subscription
                  </Button>
                }
              />
              {data.usage.filter((u: RecordData) => u.contractConflict).map((u: RecordData) => <div className="notice error" role="alert" key={u.organizationId}>
                <strong>{data.organizations.find((o: RecordData) => o.id === u.organizationId)?.name}: overlapping active contracts</strong>
                <span>Edit the subscriptions to keep one valid active contract. Classroom creation and publication are blocked until resolved.</span>
              </div>)}
              <DataTable
                data={data.subscriptions}
                columns={[
                  {
                    accessorKey: "reference",
                    header: "Reference",
                    cell: (c) => <button className="record-link" onClick={() => openDetails("subscription", c.row.original)}>{c.getValue()}</button>,
                  },
                  {
                    accessorFn: (r) => r.organization.name,
                    id: "organization",
                    header: "Organization",
                    cell: (c) => <button className="record-link" onClick={() => openOrganization(c.row.original.organizationId)}>{c.getValue()}</button>,
                  },
                  {
                    accessorKey: "classroomLimit", header: "Classrooms (organization)",
                  },
                  { accessorKey: "userLimit", header: "Users (organization)" },
                  {
                    accessorKey: "amount",
                    header: "Agreed amount",
                    cell: (c) =>
                      `₹${Number(c.getValue()).toLocaleString("en-IN")}`,
                  },
                  {
                    accessorKey: "endsAt",
                    header: "Valid until",
                    cell: (c) => dateLabel(c.getValue()),
                  },
                  {
                    accessorKey: "status",
                    header: "Status",
                    cell: (c) => <Badge value={c.getValue()} />,
                  },
                  {
                    accessorKey: "paymentStatus",
                    header: "Payment",
                    cell: (c) => <Badge value={c.getValue()} />,
                  },
                  {
                    id: "actions",
                    header: "Actions",
                    cell: (c) => (
                      <Button
                        onClick={() =>
                          setModal({
                            type: "subscription",
                            record: c.row.original,
                          })
                        }
                      >
                        <Pencil size={14} /> Edit
                      </Button>
                    ),
                  },
                ]}
              />
            </>
          )}
          {((admin && page === "Requests & Settings") ||
            (!admin && page === "Change requests")) && (
            <>
              <PageHead
                eyebrow="REVIEW & GOVERNANCE"
                title={admin ? "Requests & settings" : "Change requests"}
                text="Review school registration changes and their resolution history."
                action={!admin ? <Button variant="dark" onClick={() => setModal({ type: "request" })}><Plus size={15} /> Request registration change</Button> : undefined}
              />
              {admin && <div className="tabs compact"><button className={settingsView === "requests" ? "active" : ""} onClick={() => void navigate(() => setSettingsView("requests"))}>Change requests</button><button className={settingsView === "settings" ? "active" : ""} onClick={() => void navigate(() => setSettingsView("settings"))}>Platform settings</button><button className={settingsView === "activity" ? "active" : ""} onClick={() => void navigate(() => setSettingsView("activity"))}>Activity history</button></div>}
              {(!admin || settingsView === "requests") && (
              <DataTable
                data={data.requests}
                columns={[
                  {
                    accessorKey: "reason",
                    header: "Request",
                    cell: (c) => (
                      <div>
                        <strong>{c.getValue()}</strong>
                        <small>{c.row.original.organization?.name}</small>
                      </div>
                    ),
                  },
                  {
                    accessorKey: "status",
                    header: "Status",
                    cell: (c) => <Badge value={c.getValue()} />,
                  },
                  {
                    accessorKey: "createdAt",
                    header: "Submitted",
                    cell: (c) => dateLabel(c.getValue()),
                  },
                  { accessorKey: "resolution", header: "Resolution" },
                  {
                    id: "actions",
                    header: "Actions",
                    cell: (c) => (
                      <Button
                        onClick={() =>
                          setModal({
                            type: "resolveRequest",
                            record: c.row.original,
                          })
                        }
                      >
                        View request
                      </Button>
                    ),
                  },
                ]}
              />
              )}
              {admin && (
                <>
                  {settingsView === "settings" && <>
                  <div className="record-details-cta"><div><strong>Academic structure presets</strong><p>Configure board-specific suggested sections and grades. Existing school configurations remain unchanged.</p></div><Button onClick={() => setModal({ type: "academicPresetCatalogue" })}>Edit academic presets</Button></div>
                  <div className="section-head">
                    <div>
                      <h2>Platform defaults</h2>
                      <p>
                        School deletion recovery: 60 days · Session
                        duration: 8 hours · One administrator per organization
                      </p>
                    </div>
                    <Button onClick={() => setModal({ type: "account" })}>
                      Account settings
                    </Button>
                  </div>
                  {data.settings && (
                    <div className="settings-card">
                      <h3>Support & workspace defaults</h3>
                      <p>
                        Changes apply to all organizations. The 60-day recovery
                        period remains fixed.
                      </p>
                      <Form
                        key={"settings-" + data.settings.lock}
                        initial={{ ...data.settings.values, boardCatalog: data.settings.values.boardCatalog.join("\n") }}
                        fields={[
                          {
                            key: "supportEmail",
                            label: "Support email",
                            type: "email",
                          },
                          { key: "supportPhone", label: "Support phone" },
                          { key: "boardCatalog", label: "Board catalogue", type: "textarea", required: true, help: "One supported board per line. Add missing boards here before school registration." },
                          {
                            key: "defaultClassroomLimit",
                            label:
                              "Suggested classroom allowance for new agreements",
                            type: "number",
                            required: true,
                          },
                          {
                            key: "supportNotes",
                            label: "Support information",
                            type: "textarea",
                          },
                          {
                            key: "maintenanceNotice",
                            label: "Workspace notice",
                            type: "textarea",
                          },
                        ]}
                        onSubmit={async (values) => {
                          const boardCatalog = String(values.boardCatalog).split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
                          if (!boardCatalog.length || new Set(boardCatalog.map((b) => b.toLowerCase())).size !== boardCatalog.length) throw Error("Enter at least one board, without duplicate names.");
                          await api("/settings", "PUT", {
                            values: { ...values, boardCatalog },
                            lock: data.settings.lock,
                          });
                          await refresh(user);
                          notify("Platform settings saved");
                        }}
                        submit="Save platform settings"
                      />
                    </div>
                  )}
                  </>}
                  {settingsView === "activity" && <>
                  <h2 className="space-top">Audit history</h2>
                  <DataTable
                    data={data.audit}
                    columns={[
                      { id: "action", accessorFn: (r) => label(r.action.replaceAll(".", " ").replaceAll("-", " ")), header: "Action" },
                      {
                        accessorKey: "entityId",
                        header: "Record",
                        cell: (c) => <code>{c.getValue().slice(0, 12)}…</code>,
                      },
                      {
                        accessorKey: "actorId",
                        header: "Actor",
                        cell: (c) => <code>{c.getValue().slice(0, 12)}</code>,
                      },
                      {
                        accessorKey: "createdAt",
                        header: "Timestamp",
                        cell: (c) =>
                          new Date(c.getValue()).toLocaleString("en-IN"),
                      },
                    ]}
                  />
                  </>}
                </>
              )}
            </>
          )}
          {!admin && page === "Account & Subscription" && <>
            <PageHead eyebrow="Organization account" title="Account & subscription" text="Your registered organization and shared contractual allowances."
              action={<div className="row-actions"><Button onClick={() => setModal({ type: "account" })}>Change password</Button><Button onClick={() => setPage("Change requests")}>Registration change requests</Button></div>} />
            <DetailGrid record={data["organization-profile"] || {}} keys={["name", "legalName", "registration", "contactName", "email", "phone", "address", "city", "state", "postalCode"]} />
            {data.usage[0] && <div className="notice"><strong>Organization allowance</strong><span>{data.usage[0].used} / {data.usage[0].limit} classrooms · {data.usage[0].users} / {data.usage[0].userLimit} users</span></div>}
            <h2>Subscription validity</h2><DataTable data={data["organization-profile"]?.subscriptions || []} columns={[
              { accessorKey: "reference", header: "Contract" }, { accessorKey: "status", header: "Status" },
              { accessorKey: "classroomLimit", header: "Classroom allowance" }, { accessorKey: "userLimit", header: "User allowance" },
              { accessorKey: "startsAt", header: "Valid from", cell: (c) => dateLabel(c.getValue()) }, { accessorKey: "endsAt", header: "Valid until", cell: (c) => dateLabel(c.getValue()) },
            ]} />
          </>}
          {!admin && !["Change requests", "Account & Subscription"].includes(page) && (
            clientView === "workspace" && institution ? <Structure key={institution.id + schoolIntent} institution={institution} workspaceSection={page === "Review & History" ? "Review & History" : "Structure Management"} initialIntent={schoolIntent} onOpenStructure={() => { setPage("Structure Management"); setSchoolIntent("default"); }} onBack={() => { setClientView("directory"); setPage("Structure Management"); }} notify={notify} /> :
            clientView === "details" && institution ? <ClientSchoolDetails key={institution.id} schoolId={institution.id} onBack={() => { setClientView("directory"); setPage("Schools"); }} onOpen={openClientSchool} onRequest={(record) => setModal({ type: "schoolRequest", record })} /> :
            <ClientPortal key={user.id} page={page} userId={user.id} organizationName={user.organizationName} onOpen={openClientSchool} onAccount={() => { setClientView("directory"); setPage("Account & Subscription"); }} onDirectory={() => { setClientView("directory"); setPage("Schools"); }} />
          )}
        </main>
      </div>
      {modal && (
        <Modal
          page={!["credentials", "orgStatus", "institutionAction", "account"].includes(modal.type)}
          key={modal.type + (modal.record?.id || "")}
          subtitle={modal.type.endsWith("Details") ? "Review saved information. Use Edit to make changes." : undefined}
          title={modal.type.endsWith("Details") ? modal.record.name || modal.record.reference : modalTitle(modal.type)}
          onClose={close}
          wide={["subscription", "institution", "organization", "organizationDetails", "institutionDetails", "subscriptionDetails"].includes(
            modal.type,
          )}
        >
          {admin && modal.type === "academicPresetCatalogue" && data.settings && <AcademicPresetCatalogue settings={data.settings} onCancel={close} onSaved={async () => { await refresh(user); setModal(null); notify("Academic preset catalogue saved."); }} />}
          {modal.type.endsWith("Details") && <RecordDetails key={modal.type + modal.record.id}
            kind={modal.type.replace("Details", "") as DetailKind} record={modal.record}
            organizations={data.organizations} institutions={data.institutions} subscriptions={data.subscriptions}
            usage={data.usage} onboarding={data.onboarding || []} audit={data.audit || []}
            onOpen={openDetails} onEdit={(kind, record) => setModal({ type: kind, record })} onOnboarding={openOnboarding}
          />}
          {modal.type === "organization" && (
            <Form
              fields={orgFields}
              initial={modal.record}
              onSubmit={(v) => saved(async () => {
                const result = await api("/organizations" + (modal.record ? "/" + modal.record.id : ""), modal.record ? "PUT" : "POST", v);
                if (modal.openOnboarding) { setOnboardId(result.id); setPage("Onboarding"); }
              })}
              submit={
                modal.record ? "Save organization" : "Create organization draft"
              }
            />
          )}
          {modal.type === "institution" && (
            <InstitutionForm
              onCancel={close}
              catalog={data.settings?.values.boardCatalog}
              organizations={data.organizations}
              initial={modal.record || { organizationId: modal.organizationId }}
              onSubmit={(v) =>
                saved(() =>
                  api(
                    "/institutions" +
                      (modal.record ? "/" + modal.record.id : ""),
                    modal.record ? "PUT" : "POST",
                    v,
                  ),
                )
              }
            />
          )}
          {modal.type === "subscription" && (
            <SubscriptionForm
              defaultClassroomLimit={
                data.settings?.values?.defaultClassroomLimit ?? 40
              }
              organizations={data.organizations}
              institutions={data.institutions}
              initial={modal.record || { organizationId: modal.organizationId }}
              onSubmit={(v) =>
                saved(() =>
                  api(
                    "/subscriptions" +
                      (modal.record ? "/" + modal.record.id : ""),
                    modal.record ? "PUT" : "POST",
                    v,
                  ),
                )
              }
            />
          )}
          {modal.type === "orgStatus" && (
            <Form
              fields={[
                {
                  key: "status",
                  label: "Organization status",
                  options: ["ACTIVE", "SUSPENDED", "INACTIVE"].map((value) => ({
                    value,
                    label: label(value),
                  })),
                },
              ]}
              initial={modal.record}
              onSubmit={(v) =>
                saved(() =>
                  api(`/organizations/${modal.record.id}/status`, "POST", v),
                )
              }
            />
          )}
          {modal.type === "institutionAction" && (
            <LifecycleForm
              institution={modal.record}
              onSubmit={(v) =>
                saved(() =>
                  api(`/institutions/${modal.record.id}/action`, "POST", v),
                )
              }
            />
          )}
          {modal.type === "credentials" && (
            <>
              <div className="notice amber-notice">
                <ShieldCheck size={18} />
                This temporary password is displayed once. Share it manually
                with the administrator.
              </div>
              <label>
                Client login URL
                <input readOnly value={modal.credentials.loginUrl} />
              </label>
              <label>
                Administrator email
                <input readOnly value={modal.credentials.email} />
              </label>
              <label>
                Temporary password
                <input readOnly value={modal.credentials.temporaryPassword} />
              </label>
              <Button
                variant="dark"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(
                      `Login: ${modal.credentials.loginUrl}\nEmail: ${modal.credentials.email}\nTemporary password: ${modal.credentials.temporaryPassword}`,
                    )
                    .then(() => notify("Credentials copied"))
                    .catch(() =>
                      setError(
                        "Clipboard unavailable. Select and copy the displayed credentials.",
                      ),
                    );
                }}
              >
                <Copy size={15} /> Copy credentials
              </Button>
            </>
          )}
          {modal.type === "account" && (
            <Form
              fields={[
                {
                  key: "currentPassword",
                  label: "Current password",
                  type: "password",
                  required: true,
                },
                {
                  key: "password",
                  label: "New password",
                  type: "password",
                  required: true,
                  help: "12+ characters; uppercase, lowercase, number and symbol.",
                },
              ]}
              onSubmit={async (v) => {
                const r = await api("/auth/password", "POST", v);
                setCsrf(r.csrf);
                setModal(null);
                notify("Password changed. Other sessions were signed out.");
              }}
              submit="Update password"
            />
          )}
          {modal.type === "schoolRequest" && <RegistrationRequestForm institution={modal.record} onSaved={async () => { setModal(null); await refresh(user); notify("Registration change submitted"); }} />}
          {modal.type === "request" && (
            <RequestComposer
              institutions={data.institutions}
              onSaved={async () => {
                setModal(null);
                await refresh(user);
                notify("Registration change submitted");
              }}
            />
          )}
          {modal.type === "resolveRequest" && (
            <>
              <p>{modal.record.reason}</p>
              <pre>{JSON.stringify(modal.record.proposed, null, 2)}</pre>
              {admin && modal.record.status === "PENDING" ? (
                <Form
                  fields={[
                    {
                      key: "approve",
                      label: "Decision",
                      options: [
                        { value: "true", label: "Approve requested changes" },
                        { value: "false", label: "Reject request" },
                      ],
                    },
                    {
                      key: "resolution",
                      label: "Resolution notes",
                      type: "textarea",
                      required: true,
                    },
                  ]}
                  onSubmit={(v) =>
                    saved(() =>
                      api(`/requests/${modal.record.id}/resolve`, "POST", {
                        approve: v.approve === "true",
                        resolution: v.resolution,
                      }),
                    )
                  }
                />
              ) : (
                <p>
                  {modal.record.resolution || "Awaiting Super Admin review"}
                </p>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function modalTitle(type: string) {
  return (
    (
      {
        organization: "Organization registration",
        academicPresetCatalogue: "Academic structure preset catalogue",
        schoolRequest: "Request school registration changes",
        institution: "School registration",
        subscription: "Subscription agreement",
        credentials: "Client credentials",
        institutionAction: "School lifecycle",
        orgStatus: "Organization access",
        account: "Account settings",
        request: "Request registration change",
        resolveRequest: "Registration change request",
      } as Record<string, string>
    )[type] || type
  );
}
