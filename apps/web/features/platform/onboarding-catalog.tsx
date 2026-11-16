"use client";
import { useMemo, useState } from "react";
import { ArrowRight, Building2, LayoutGrid, List, Search } from "lucide-react";
import { Badge, Button, DataTable } from "../../components/ui";
import { dateLabel, label, type RecordData } from "../../lib/api";

export type OnboardingView = "list" | "cards";
export function onboardingAction(row: RecordData) {
  return row.progress === 100 ? "View onboarding" : row.progress === 0 ? "Start onboarding" : "Continue onboarding";
}
export function OnboardingCatalog({ rows, view, onViewChange, onOpen }: {
  rows: RecordData[];
  view: OnboardingView;
  onViewChange: (view: OnboardingView) => void;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => rows.filter((r) => {
    const text = `${r.name} ${r.email} ${label(r.status)}`.toLowerCase();
    const matches = query.trim().toLowerCase().split(/\s+/).every((q) => text.includes(q));
    return matches && (status === "all" || (status === "complete" ? r.progress === 100 : status === "not-started" ? r.progress === 0 : r.progress > 0 && r.progress < 100));
  }), [rows, query, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 9));
  const currentPage = Math.min(page, pages - 1);
  const nextStep = (row: RecordData) => row.progress === 100 ? "All steps completed" : row.checklist?.find((s: RecordData) => s.step === row.currentStep)?.title || `Step ${row.currentStep}`;

  return <section className="onboarding-catalog" data-tone="info" aria-label="Organization onboarding">
    <div className="catalog-toolbar">
      <div className="search catalog-search"><Search size={16} aria-hidden="true" /><input aria-label="Search onboarding" placeholder="Search organizations or email" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></div>
      <label className="catalog-status"><span className="sr-only">Onboarding progress filter</span><select aria-label="Onboarding progress filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
        <option value="all">All onboarding</option><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="complete">Completed</option>
      </select></label>
      <span className="catalog-count">{filtered.length} organization{filtered.length === 1 ? "" : "s"}</span>
      <div className="view-switch" role="group" aria-label="Onboarding view">
        <button aria-pressed={view === "list"} onClick={() => onViewChange("list")}><List size={16} /> List view</button>
        <button aria-pressed={view === "cards"} onClick={() => onViewChange("cards")}><LayoutGrid size={16} /> Card view</button>
      </div>
    </div>
    {view === "list" ? <DataTable data={filtered} hideSearch emptyTitle={rows.length && !filtered.length ? "No matching organizations" : undefined} emptyText={rows.length && !filtered.length ? "Adjust the search or progress filter." : undefined} columns={[
      { accessorKey: "name", header: "Organization", cell: (c) => <div className="catalog-organization"><button className="record-link" onClick={() => onOpen(c.row.original.id)}>{c.getValue()}</button><small>{c.row.original.email}</small></div> },
      { accessorKey: "status", header: "Status", cell: (c) => <Badge value={c.getValue()} /> },
      { id: "nextStep", header: "Current step", accessorFn: nextStep },
      { accessorKey: "progress", header: "Progress", cell: (c) => <div className="progress-cell"><progress max={100} value={c.getValue()} /><span>{c.getValue()}%</span></div> },
      { accessorKey: "updatedAt", header: "Last updated", cell: (c) => dateLabel(c.getValue()) },
      { id: "actions", header: "Action", enableSorting: false, cell: (c) => <Button onClick={() => onOpen(c.row.original.id)}>{onboardingAction(c.row.original)} <ArrowRight size={13} /></Button> },
    ]} /> : <>
      <div className="onboarding-card-grid">
        {filtered.slice(currentPage * 9, currentPage * 9 + 9).map((row) => <article className="onboarding-card" key={row.id}>
          <div className="onboarding-card-top"><span className="record-type-icon"><Building2 size={20} /></span><Badge value={row.status} /></div>
          <h2><button className="record-link" onClick={() => onOpen(row.id)}>{row.name}</button></h2>
          <p className="onboarding-card-email">{row.email}</p>
          <div className="onboarding-card-progress"><span>{row.checklist.filter((s: RecordData) => s.complete).length} of 7 steps complete</span><strong>{row.progress}%</strong><progress max={100} value={row.progress} aria-label={`${row.name} onboarding progress`} /></div>
          <div className="onboarding-card-next"><small>{row.progress === 100 ? "Onboarding status" : "Continue with"}</small><strong>{nextStep(row)}</strong><p>{row.blockingIssues?.[0] || (row.progress === 100 ? "The client has completed first login." : "Open this organization to review the next step.")}</p></div>
          <footer><small>Updated {dateLabel(row.updatedAt)}</small><Button onClick={() => onOpen(row.id)}>{onboardingAction(row)} <ArrowRight size={13} /></Button></footer>
        </article>)}
        {!filtered.length && <div className="catalog-empty"><Building2 size={25} /><h3>{rows.length ? "No matching organizations" : "No onboarding records yet"}</h3><p>{rows.length ? "Adjust the search or progress filter." : "Create an organization to begin onboarding."}</p></div>}
      </div>
      {filtered.length > 9 && <div className="catalog-pagination"><span>Page {currentPage + 1} of {pages}</span><div className="row-actions"><Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button disabled={currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>}
    </>}
  </section>;
}
