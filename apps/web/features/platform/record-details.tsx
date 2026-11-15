"use client";
import { useId, useState } from "react";
import { ArrowRight, Building2, Pencil, School } from "lucide-react";
import { Badge, Button, DataTable, DetailGrid } from "../../components/ui";
import { WorkspaceTabs } from "../../components/workspace/tabs";
import { dateLabel, label, type RecordData } from "../../lib/api";

export type DetailKind = "organization" | "institution" | "subscription";
export function RecordDetails({ kind, record, organizations, institutions, subscriptions, usage, onboarding, audit = [], onOpen, onEdit, onOnboarding }: {
  kind: DetailKind;
  record: RecordData;
  organizations: RecordData[];
  institutions: RecordData[];
  subscriptions: RecordData[];
  usage: RecordData[];
  onboarding: RecordData[];
  audit?: RecordData[];
  onOpen: (kind: DetailKind, record: RecordData) => void;
  onEdit: (kind: DetailKind, record: RecordData) => void;
  onOnboarding: (id: string) => void;
}) {
  const [tab, setTab] = useState("overview");
  const id = useId();
  const orgId = kind === "organization" ? record.id : record.organizationId;
  const org = organizations.find((o) => o.id === orgId);
  const pool = usage.find((u) => u.organizationId === orgId);
  const progress = onboarding.find((o) => o.id === orgId);
  const schools = institutions.filter((i) => i.organizationId === orgId);
  const contracts = subscriptions.filter((s) => s.organizationId === orgId);
  const administrator = org?.users?.[0] || record.users?.[0];
  const entities = new Set([orgId, ...schools.map((s) => s.id), ...schools.flatMap((s) => (s.years || []).map((y: RecordData) => y.id)), ...contracts.map((s) => s.id)]);
  const activity = audit.filter((event) => event.organizationId === orgId || entities.has(event.entityId));
  const roomUsage = pool?.institutions?.find((i: RecordData) => i.institutionId === record.id)?.used || 0;
  const canEdit = kind !== "institution" || record.status !== "DELETION_PENDING";
  const tabs = kind === "organization" ? [
    { value: "overview", label: "Overview" }, { value: "institutions", label: `Schools (${schools.length})` },
    { value: "subscriptions", label: `Subscriptions (${contracts.length})` }, { value: "onboarding", label: "Onboarding" }, { value: "administrator", label: "Administrator details" }, { value: "activity", label: "Activity history" },
  ] : [{ value: "overview", label: "Overview" }, ...(kind === "institution" ? [{ value: "academic-years", label: "Academic years" }] : [])];
  return <div className="record-details">
    <div className="record-details-summary">
      <div className="record-details-identity">{kind === "institution" && record.logo ? <img className="record-details-logo" src={record.logo} alt={`${record.name} logo`} /> : <span className="record-type-icon">{kind === "institution" ? <School size={23} /> : <Building2 size={23} />}</span>}<div><p className="eyebrow">{label(kind)} information</p><h3>{record.name || record.reference}</h3><p>{kind === "organization" ? record.email : org ? <button className="record-link" onClick={() => onOpen("organization", org)}>{org.name}</button> : "Organization unavailable"}</p></div></div>
      <div className="row-actions"><Badge value={record.status} />{canEdit && <Button onClick={() => onEdit(kind, record)}><Pencil size={14} /> Edit</Button>}</div>
    </div>
    {kind === "organization" && <div className="record-summary-grid">
      <div><span>Schools</span><strong>{schools.length}</strong></div>
      <div><span>Organization classrooms</span><strong>{pool?.used || 0}<small> / {pool?.limit || 0}</small></strong></div>
      <div><span>Organization users</span><strong>{pool?.users || 0}<small> / {pool?.userLimit || 0}</small></strong></div>
      <div><span>Onboarding</span><strong>{progress?.progress || 0}<small>% complete</small></strong></div>
    </div>}
    <WorkspaceTabs id={id} label={`${label(kind)} information sections`} tabs={tabs} value={tab} onChange={setTab} className="record-tabs" />
    <div id={`${id}-panel-${tab}`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0} className="record-details-panel">
      {tab === "overview" && <>
        <h3>{kind === "subscription" ? "Agreement details" : "Registration details"}</h3>
        <DetailGrid record={kind === "subscription" ? { ...record, amount: `₹${Number(record.amount).toLocaleString("en-IN")}`, startsAt: dateLabel(record.startsAt), endsAt: dateLabel(record.endsAt) } : record}
          keys={kind === "organization" ? ["name", "legalName", "type", "registration", "email", "contactName", "phone", "address", "city", "state", "postalCode", "notes"] : kind === "institution" ? ["name", "registration", "address", "officer", "phone", "email"] : ["reference", "amount", "startsAt", "endsAt", "classroomLimit", "userLimit", "agreementStatus", "paymentStatus", "paymentReference", "exceptionReason", "renewalNotes", "notes"]} />
        {kind === "institution" && <><div className="detail-board-list"><strong>Registered boards</strong>{record.boards.map((b: string) => <span key={b}>{b}</span>)}</div><div className="notice">{roomUsage} classrooms reserved in this school. The organization shares {pool?.used || 0} / {pool?.limit || 0} classrooms across all schools.</div>{record.deletionDueAt && <div className="notice amber-notice">Scheduled deletion: {dateLabel(record.deletionDueAt)}. Restore the school before editing.</div>}</>}
        {kind === "organization" && <div className="record-details-cta"><div><strong>Organization onboarding</strong><p>Review saved information, complete the remaining steps or inspect activation.</p></div><Button onClick={() => onOnboarding(record.id)}>Open onboarding <ArrowRight size={14} /></Button></div>}
        {pool?.contractConflict && <div className="notice error">This organization has overlapping active contracts that require review.</div>}
        {pool?.overLimit && <div className="notice amber-notice">The organization exceeds its classroom allowance. Existing records are preserved.</div>}
      </>}
      {tab === "institutions" && <DataTable data={schools} columns={[
        { accessorKey: "name", header: "School", cell: (c) => <button className="record-link" onClick={() => onOpen("institution", c.row.original)}>{c.getValue()}</button> },
        { accessorKey: "boards", header: "Boards", cell: (c) => c.getValue().join(" · ") },
        { accessorKey: "status", header: "Status", cell: (c) => <Badge value={c.getValue()} /> },
        { id: "usage", header: "Classrooms reserved", accessorFn: (r) => pool?.institutions?.find((i: RecordData) => i.institutionId === r.id)?.used || 0 },
      ]} />}
      {tab === "subscriptions" && <DataTable data={contracts} columns={[
        { accessorKey: "reference", header: "Reference", cell: (c) => <button className="record-link" onClick={() => onOpen("subscription", c.row.original)}>{c.getValue()}</button> },
        { accessorKey: "status", header: "Status", cell: (c) => <Badge value={c.getValue()} /> },
        { accessorKey: "classroomLimit", header: "Classroom allowance" }, { accessorKey: "userLimit", header: "User allowance" },
        { accessorKey: "endsAt", header: "Valid until", cell: (c) => dateLabel(c.getValue()) },
      ]} />}
      {tab === "academic-years" && <DataTable data={record.years || []} columns={[
        { accessorKey: "label", header: "Academic year" },
        { id: "status", header: "Structure status", accessorFn: (y) => y.draftRevisionId ? y.publishedRevisionId ? "Draft changes pending" : "Draft" : label(y.publishedRevision?.status || "Not started") },
      ]} />}
      {tab === "administrator" && <><h3>Organization administrator</h3><DetailGrid record={{ name: administrator?.name || record.contactName, email: administrator?.email || record.email, phone: record.phone, account: administrator ? administrator.mustChangePassword ? "Awaiting first password change" : "Ready" : "Not activated", created: administrator ? dateLabel(administrator.createdAt) : "Not created" }} keys={["name", "email", "phone", "account", "created"]} /><p className="form-help">One administrator manages all registered schools. Credentials are shown once during activation; regenerate them only when needed.</p><Button onClick={() => onOnboarding(orgId)}>Open administrator onboarding</Button></>}
      {tab === "activity" && <><h3>Recent organization activity</h3><p className="form-help">Changes for this organization, its schools and subscriptions from the latest platform activity.</p><DataTable data={activity} columns={[{ id: "action", header: "Action", accessorFn: (r) => label(r.action.replaceAll(".", " ").replaceAll("-", " ")) }, { accessorKey: "createdAt", header: "When", cell: (c) => new Date(c.getValue()).toLocaleString("en-IN") }]} /></>}
      {tab === "onboarding" && <><div className="record-details-cta"><div><strong>{progress?.progress || 0}% complete</strong><p>Saved progress is retained when you leave the process.</p></div><Button variant="dark" onClick={() => onOnboarding(record.id)}>Open onboarding <ArrowRight size={14} /></Button></div><ol className="onboarding-checklist">{progress?.checklist?.map((step: RecordData) => <li key={step.step}><span className={step.complete ? "checklist-number complete" : "checklist-number"}>{step.step}</span><div><strong>{step.title}</strong><p>{step.complete ? "Completed" : step.blockers.join("; ") || "Ready to validate"}</p></div></li>)}</ol></>}
    </div>
  </div>;
}
