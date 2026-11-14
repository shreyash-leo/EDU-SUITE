"use client";
import { ShadcnButton } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input, Textarea } from "./ui/input";
import { useNavigation, useNavigationGuard } from "../lib/navigation";
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
} from "../../../packages/domain/src";
import { label, type RecordData } from "../lib/api";
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        (value === "ACTIVE" || value === "PAID" || value === "APPROVED"
          ? "green"
          : value.includes("DRAFT") ||
              value.includes("PENDING") ||
              value === "ONBOARDING" ||
              value === "INCOMPLETE_ACTIVE"
            ? "amber"
            : "gray")
      }
    >
      <i />
      {label(value)}
    </span>
  );
}
export function Button({
  children,
  onClick,
  variant = "",
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <ShadcnButton
      type={type}
      variant={
        variant === "dark"
          ? "default"
          : variant === "danger"
            ? "destructive"
            : "outline"
      }
      className={variant}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </ShadcnButton>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Layers size={25} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  page = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  page?: boolean;
}) {
  const { navigate } = useNavigation();
  const pageRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => { if (page) pageRef.current?.focus(); }, [page, title]);
  if (page) return (
    <section ref={pageRef} tabIndex={-1} className="workflow-page" aria-label={title}>
      <div className="workflow-page-inner">
        <button className="text-back" onClick={() => void navigate(onClose)}><ArrowLeft size={15} /> Back to workspace</button>
        <header className="workflow-page-header"><div><p className="eyebrow">Workspace / {title}</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></header>
        <div className="workflow-page-body">{children}</div>
      </div>
    </section>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void navigate(onClose);
      }}
    >
      <DialogContent className={wide ? "wide" : ""}>
        <header>
          <div>
            <DialogTitle asChild>
              <h2>{title}</h2>
            </DialogTitle>
            <DialogDescription className={subtitle ? "" : "sr-only"}>
              {subtitle || "Edit the fields below, then save your changes."}
            </DialogDescription>
          </div>
          <button
            aria-label="Close dialog"
            className="icon-button"
            onClick={() => void navigate(onClose)}
          >
            <X size={19} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
export type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
  autoComplete?: string;
  section?: string;
};
export function Form({
  fields,
  initial = {},
  onSubmit,
  submit = "Save changes",
  extraDirty = false,
  onDiscard,
}: {
  fields: Field[];
  initial?: RecordData;
  onSubmit: (v: RecordData) => Promise<void>;
  submit?: string;
  extraDirty?: boolean;
  onDiscard?: () => void;
}) {
  const formId = React.useId();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RecordData>({ defaultValues: initial });
  const [error, setError] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty || extraDirty;
  const submitValues = async (v: RecordData) => {
    setError("");
    try {
      await onSubmit(v);
      dirtyRef.current = false;
      reset(v);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };
  const save = () =>
    handleSubmit(submitValues, () => {
      setError("Complete the required fields before saving");
      throw Error("Complete the required fields before continuing");
    })();
  useNavigationGuard({
    label: fields[0] ? `Form: ${fields[0].label}` : "Form changes",
    isDirty: () => dirtyRef.current,
    save,
    discard: () => {
      dirtyRef.current = false;
      onDiscard?.();
      reset();
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save().catch(() => {});
      }}
    >
      <div className="form-grid">
        {fields.map((f) => (
          <React.Fragment key={f.key}>
          {f.section && <div className="form-section-heading"><h3>{f.section}</h3></div>}
          <label key={f.key} className={f.type === "textarea" ? "span2" : ""}>
            {f.label}
            {f.required && <b className="required"> *</b>}
            {f.options ? (
              <select aria-invalid={!!errors[f.key]} aria-describedby={[f.help ? `${formId}-${f.key}-help` : "", errors[f.key] ? `${formId}-${f.key}-error` : ""].filter(Boolean).join(" ") || undefined} {...register(f.key, { required: f.required })}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <Textarea aria-invalid={!!errors[f.key]} aria-describedby={[f.help ? `${formId}-${f.key}-help` : "", errors[f.key] ? `${formId}-${f.key}-error` : ""].filter(Boolean).join(" ") || undefined} {...register(f.key, { required: f.required })} />
            ) : (
              <Input
                type={f.type === "password" && visiblePasswords[f.key] ? "text" : f.type || "text"}
                autoComplete={f.autoComplete}
                aria-invalid={!!errors[f.key]}
                aria-describedby={[f.help ? `${formId}-${f.key}-help` : "", errors[f.key] ? `${formId}-${f.key}-error` : ""].filter(Boolean).join(" ") || undefined}
                {...register(f.key, {
                  required: f.required,
                  valueAsNumber: f.type === "number",
                })}
              />
            )}{" "}
            {f.type === "password" && (
              <button
                type="button"
                aria-pressed={!!visiblePasswords[f.key]}
                aria-label={`${visiblePasswords[f.key] ? "Hide" : "Show"} ${f.label.toLowerCase()}`}
                onClick={() => setVisiblePasswords((previous) => ({ ...previous, [f.key]: !previous[f.key] }))}
              >
                {visiblePasswords[f.key] ? "Hide password" : "Show password"}
              </button>
            )}
            {errors[f.key] && (
              <small className="error-text" id={`${formId}-${f.key}-error`}>{f.label} is required</small>
            )}
            {f.help && <small id={`${formId}-${f.key}-help`}>{f.help}</small>}
          </label>
          </React.Fragment>
        ))}
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      <footer className="form-footer">
        <Button type="submit" variant="dark" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 size={15} className="spin" />
          ) : (
            <Check size={15} />
          )}{" "}
          {submit}
        </Button>
      </footer>
    </form>
  );
}
export { DataTable } from "./data-table";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <Layers size={23} />
      </span>
      <div>
        PLAN<span>EDU SUITE</span>
      </div>
    </div>
  );
}
export function PageHead({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  const Icon = /organization/i.test(title) ? Building2 : /school/i.test(title) ? School : /subscription/i.test(title) ? Receipt : /onboarding/i.test(title) ? Route : /request|setting/i.test(title) ? Settings : Layers;
  const caption = eyebrow.charAt(0).toUpperCase() + eyebrow.slice(1).toLowerCase();
  return (
    <div className="page-head">
      <div className="record-heading">
        <span className="record-type-icon"><Icon size={23} /></span>
        <div><p className="eyebrow">{caption}</p>
        <h1>
          {title}

        </h1>
        <p>{text}</p></div>
      </div>
      {action}
    </div>
  );
}
export function DetailGrid({
  record,
  keys,
}: {
  record: RecordData;
  keys: string[];
}) {
  return (
    <dl className="detail-grid">
      {keys.map((k) => (
        <div key={k}>
          <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
          <dd>{record[k] === undefined || record[k] === null || record[k] === "" ? "Not provided" : record[k]}</dd>
        </div>
      ))}
    </dl>
  );
}
