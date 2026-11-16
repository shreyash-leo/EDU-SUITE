"use client";
import { WorkspaceTabs } from "../../components/workspace/tabs";
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
import { BoardAffiliations } from "./board-affiliations";
export function InstitutionForm({
  onCancel,
  catalog = ["CBSE", "ICSE", "ISC", "IB", "IGCSE", "MAHA SSC", "MAHA HSC", "State Board"],
  organizations,
  initial = {},
  onSubmit,
}: {
  onCancel?: () => void;
  catalog?: string[];
  organizations: RecordData[];
  initial?: RecordData;
  onSubmit: (v: RecordData) => Promise<void>;
}) {
  const [logo, setLogo] = useState(initial.logo || "");
  const [boards, setBoards] = useState<string[]>(initial.boards || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  return (
    <>
      <div className="logo-upload">
        {logo ? <img src={logo} alt="School logo" /> : <School size={30} />}
        <div>
          <strong>School logo</strong>
          <small>
            Required before completing onboarding. PNG, JPEG or WebP, up to 2
            MB.
          </small>
          <label className="upload-button">
            <Upload size={14} />
            {uploading ? "Uploading…" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  setUploadError("Choose an image under 2 MB");
                  return;
                }
                setUploading(true);
                setUploadError("");
                try {
                  const bytes = await f.arrayBuffer();
                  let binary = "";
                  for (const b of new Uint8Array(bytes))
                    binary += String.fromCharCode(b);
                  const r = await api("/assets", "POST", {
                    mime: f.type,
                    base64: btoa(binary),
                  });
                  setLogo(r.url);
                } catch (e) {
                  setUploadError((e as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
      </div>
      {uploadError && <div className="notice error">{uploadError}</div>}
      <BoardAffiliations catalog={catalog} selected={boards} onChange={setBoards} locked={!!initial.years?.length} protectedBoards={initial.boards || []} years={initial.years?.map((y: RecordData) => y.label)} />
      <Form
        onCancel={onCancel}
        extraDirty={logo !== (initial.logo || "") || JSON.stringify(boards) !== JSON.stringify(initial.boards || [])}
        onDiscard={() => { setLogo(initial.logo || ""); setBoards(initial.boards || []); }}
        initial={initial}
        fields={[
          {
            key: "organizationId",
            label: "Organization",
            section: "School registration",
            required: true,
            options: organizations.map((o) => ({ value: o.id, label: o.name })),
          },
          { key: "name", label: "School name", required: true },
          { key: "registration", label: "Registration number", required: true },
          { key: "address", label: "School address", section: "School contact" },
          { key: "officer", label: "School relation officer" },
          { key: "phone", label: "Contact number" },
          { key: "email", label: "Contact email", type: "email" },
        ]}
        onSubmit={async (v) => {
          if (uploading) throw Error("Wait for logo upload");
          if (!boards.length) throw Error("Add at least one board affiliation before saving.");
          await onSubmit({
            ...v,
            logo,
            boards,
          });
        }}
      />
    </>
  );
}
export function SubscriptionForm({
  defaultClassroomLimit = 40,
  organizations,
  institutions,
  initial = {},
  onSubmit,
}: {
  organizations: RecordData[];
  institutions: RecordData[];
  defaultClassroomLimit?: number;
  initial?: RecordData;
  onSubmit: (v: RecordData) => Promise<void>;
}) {
  const [org, setOrg] = useState(
    initial.organizationId || organizations[0]?.id || "",
  );
  return (
    <>
      <label>
        Organization
        <select value={org} disabled={!!initial.id} onChange={(e) => setOrg(e.target.value)}>
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
      <div className="notice">
        One classroom allowance shared by every school and board. Inactive classrooms count. User allowance is contractual; V1 provides one organization administrator.
      </div>
      <Form
        extraDirty={org !== (initial.organizationId || organizations[0]?.id || "")}
        onDiscard={() => setOrg(initial.organizationId || organizations[0]?.id || "")}
        initial={{
          ...initial,
          classroomLimit: initial.classroomLimit ?? defaultClassroomLimit,
          userLimit: initial.userLimit ?? 1,
          amount: Number(initial.amount || 0),
          startsAt: initial.startsAt?.slice(0, 10) || today(),
          endsAt:
            initial.endsAt?.slice(0, 10) ||
            `${new Date().getUTCFullYear() + 1}-03-31`,
          status: initial.status || "ACTIVE",
          agreementStatus: initial.agreementStatus || "PENDING",
          paymentStatus: initial.paymentStatus || "PENDING",
        }}
        fields={[
          { key: "reference", label: "Subscription reference", required: true, section: "Contract & allowances" },
          { key: "classroomLimit", label: "Organization classroom allowance", type: "number", required: true },
          { key: "userLimit", label: "Organization user allowance", type: "number", required: true },
          {
            key: "amount",
            label: "Agreed quotation amount (₹)",
            type: "number",
            required: true,
          },
          {
            key: "startsAt",
            label: "Start date",
            section: "Contract period",
            type: "date",
            required: true,
          },
          { key: "endsAt", label: "End date", type: "date", required: true },
          {
            key: "status",
            label: "Status",
            section: "Commercial status",
            options: ["DRAFT", "ACTIVE", "EXPIRED", "SUSPENDED"].map(
              (value) => ({ value, label: label(value) }),
            ),
          },
          {
            key: "agreementStatus",
            label: "Agreement",
            options: ["PENDING", "SIGNED", "EXCEPTION"].map((value) => ({
              value,
              label: label(value),
            })),
          },
          {
            key: "paymentStatus",
            label: "Payment",
            options: ["PENDING", "PAID", "PARTIAL", "EXCEPTION"].map(
              (value) => ({ value, label: label(value) }),
            ),
          },
          { key: "paymentReference", label: "Payment reference", section: "References & renewal" },
          { key: "exceptionReason", label: "Authorized exception reason" },
          { key: "renewalNotes", label: "Renewal details" },
          { key: "notes", label: "Commercial notes", type: "textarea" },
        ]}
        onSubmit={(v) =>
          onSubmit({
            ...v,
            organizationId: org,
            startsAt: new Date(v.startsAt).toISOString(),
            endsAt: new Date(v.endsAt + "T23:59:59Z").toISOString(),

          })
        }
      />
    </>
  );
}
export function LifecycleForm({
  institution: i,
  onSubmit,
}: {
  institution: RecordData;
  onSubmit: (v: RecordData) => Promise<void>;
}) {
  const [action, setAction] = useState(
    i.status === "DELETION_PENDING"
      ? "restore"
      : i.status === "ACTIVE"
        ? "deactivate"
        : "reactivate",
  );
  return (
    <>
      <div className="notice">
        Deactivation preserves data indefinitely. Deletion restricts access
        immediately and permanently removes school data after 60 days.
      </div>
      {i.deletionDueAt && (
        <p>
          Scheduled deletion: <strong>{dateLabel(i.deletionDueAt)}</strong>
        </p>
      )}
      <label>
        Action
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          {(i.status === "DELETION_PENDING"
            ? ["restore"]
            : i.status === "ACTIVE"
              ? ["deactivate", "delete"]
              : ["reactivate", "delete"]
          ).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <Form
        key={action}
        fields={
          action === "delete"
            ? [
                {
                  key: "confirmation",
                  label: `Type “${i.name}” to confirm scheduled deletion`,
                  required: true,
                },
              ]
            : []
        }
        onSubmit={(v) => onSubmit({ ...v, action })}
        submit={
          action === "delete"
            ? "Schedule deletion in 60 days"
            : action === "restore"
              ? "Restore school"
              : "Confirm action"
        }
      />
    </>
  );
}
export function Onboarding({
  overview,
  org,
  institutions,
  subscriptions,
  edit,
  view,
  complete,
  activate,
  busy,
}: {
  org: RecordData;
  overview?: RecordData;
  institutions: RecordData[];
  subscriptions: RecordData[];
  edit: (type: string, record?: RecordData) => void;
  view: (kind: "institution" | "subscription", record: RecordData) => void;
  complete: (step: number) => Promise<void>;
  activate: (regen: boolean) => Promise<void>;
  busy: boolean;
}) {
  const tabsId = React.useId();
  const [step, setStep] = useState(Math.min(overview?.currentStep || org.onboardingStep, 7));
  useEffect(
    () => setStep(Math.min(overview?.currentStep || org.onboardingStep, 7)),
    [org.id, org.onboardingStep, overview?.currentStep],
  );
  const names = [
    "Organization",
    "Schools",
    "Subscription",
    "Agreement & payment",
    "Administrator",
    "Activate client",
    "Client workspace",
  ];
  return (
    <div className="onboarding process-workspace">
      <header className="journey-summary" data-tone="info"><span className="semantic-icon"><Route size={21}/></span><div><p className="eyebrow">Organization onboarding</p><h2>Client setup progress</h2><p>Step {step} of 7 · {names[step-1]}</p></div><div className="journey-progress"><strong>{overview?.progress ?? Math.round(org.completedSteps.length/7*100)}% complete</strong><progress max={100} value={overview?.progress ?? Math.round(org.completedSteps.length/7*100)} aria-label="Organization onboarding completion"/></div></header>
      <WorkspaceTabs id={tabsId} label="Onboarding steps" className="process-tabs" numbered disabled={busy}
        value={String(step)} onChange={(value) => setStep(Number(value))}
        tabs={names.map((name, index) => {
          const complete = overview ? overview.checklist[index].complete : org.completedSteps.includes(index + 1);
          return { value: String(index + 1), label: name, complete, caption: complete ? "Completed" : (overview?.currentStep || org.onboardingStep) === index + 1 ? "In progress" : "Pending" };
        })} />
      <div className="step-panel" role="tabpanel" id={`${tabsId}-panel-${step}`} aria-labelledby={`${tabsId}-tab-${step}`} tabIndex={0}>
        <p className="eyebrow">STEP {step} OF 7</p>
        <h2>{names[step - 1]}</h2>
        {overview && (
          <div className="onboarding-status">

            <small>
              Last updated{" "}
              {new Date(overview.updatedAt).toLocaleString("en-IN")}
            </small>
            {overview.checklist.find((c: RecordData) => c.step === step)
              ?.blockers.length > 0 && (
              <div className="notice amber-notice">
                <div>
                  <strong>Complete these items</strong>
                  <ul>
                    {overview.checklist
                      .find((c: RecordData) => c.step === step)
                      .blockers.map((b: string) => (
                        <li key={b}>{b}</li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
        {step === 1 && (
          <>
            <p>Complete organization identity and registration details.</p>
            <DetailGrid
              record={org}
              keys={[
                "name",
                "legalName",
                "email",
                "contactName",
                "phone",
                "address",
                "city",
                "state",
                "postalCode",
              ]}
            />
            <Button onClick={() => edit("organization", org)}>
              <Pencil size={14} /> Edit registration
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <p>
              Register one or more schools. Each requires its logo and
              contact details before completion.
            </p>
            {institutions.map((i) => (
              <div className="list-item" key={i.id}>
                <div>
                  <button className="record-link" onClick={() => view("institution", i)}>{i.name}</button>
                  <small>
                    {i.boards.join(" · ")} ·{" "}
                    {i.logo ? "Logo uploaded" : "Logo required"}
                  </small>
                </div>
                <Button onClick={() => edit("institution", i)}>Edit</Button>
              </div>
            ))}
            <Button onClick={() => edit("institution")}>
              <Plus size={14} /> Add school
            </Button>
          </>
        )}
        {(step === 3 || step === 4) && (
          <>
            <p>
              {step === 3
                ? "Configure the agreed quotation, validity and shared organization classroom/user allowances."
                : "Record the signed agreement and manual payment. Exceptions require an explicit reason."}
            </p>
            {subscriptions.map((s) => (
              <div className="list-item" key={s.id}>
                <div>
                  <strong><button className="record-link" onClick={() => view("subscription", s)}>{s.reference}</button> · ₹{Number(s.amount).toLocaleString("en-IN")}</strong>
                  <small>
                    Agreement: {label(s.agreementStatus)} · Payment:{" "}
                    {label(s.paymentStatus)}
                  </small>
                </div>
                <Button onClick={() => edit("subscription", s)}>Edit</Button>
              </div>
            ))}
            <Button onClick={() => edit("subscription")}>
              <Plus size={14} /> Configure subscription
            </Button>
          </>
        )}
        {step === 5 && (
          <>
            <p>
              One organization administrator manages every school in this
              organization.
            </p>
            <DetailGrid record={org} keys={["contactName", "email", "phone"]} />
            <Button onClick={() => edit("organization", org)}>
              Edit administrator details
            </Button>
          </>
        )}
        {step === 6 && (
          <>
            <p>
              Activation creates the administrator account and a secure
              temporary password. Share the credentials manually.
            </p>
            <div className="notice amber-notice">
              The temporary password is shown once. The administrator must
              replace it at first login.
            </div>
            <Button
              variant="dark"
              disabled={busy}
              onClick={() => void activate(!!org.activatedAt)}
            >
              <ShieldCheck size={16} />
              {org.activatedAt ? "Regenerate credentials" : "Activate client"}
            </Button>
          </>
        )}
        {step === 7 && (
          <>
            <h3>
              {org.completedSteps.includes(7)
                ? "Client workspace ready"
                : "Awaiting the client’s first login"}
            </h3>
            <p>
              The administrator signs in, changes the temporary password and
              opens their school workspaces. School structure can be
              configured independently after organization activation.
            </p>
            <Badge value={org.status} />
          </>
        )}
        <div className="step-footer">
          <Button disabled={step === 1} onClick={() => setStep(step - 1)}>
            <ChevronLeft size={14} /> Previous
          </Button>
          {step <= 5 ? (
            <Button
              variant="dark"
              disabled={busy}
              onClick={() => void complete(step)}
            >
              Validate & continue <ChevronRight size={14} />
            </Button>
          ) : (
            <Button disabled={step === 7} onClick={() => setStep(step + 1)}>
              Next <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
