"use client";
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
export function Login({
  onLogin,
}: {
  onLogin: (d: RecordData) => Promise<void>;
}) {
  const [portal, setPortal] = useState("platform");
  useEffect(() => {
    if (new URLSearchParams(location.search).get("portal") === "organization")
      setPortal("organization");
  }, []);
  return (
    <div className="login-shell">
      <div className="login-art">
        <Brand />
        <div>
          <span className="eyebrow">
            BUILT FOR EDUCATION. DESIGNED FOR CLARITY.
          </span>
          <h1>
            One workspace for
            <br />
            your academic foundation<span>.</span>
          </h1>
          <p>
            Your schools, academic structure and school days.
            <br />
            Connected in one focused workspace.
          </p>
          <div className="login-art-lines">
            <div>
              <Building2 />
              Organizations
            </div>
            <ChevronRight />
            <div>
              <School />
              Schools
            </div>
            <ChevronRight />
            <div>
              <Layers />
              Structure
            </div>
          </div>
        </div>
        <small>PLAN EDU SUITE · Academic Operations</small>
      </div>
      <div className="login-card">
        <Brand />
        <p className="eyebrow">WELCOME TO YOUR WORKSPACE</p>
        <h1>Sign in to PLAN.</h1>
        <p>Everything you need to set the year in motion.</p>
        <div className="tabs" role="group" aria-label="Sign-in workspace">
          <button
            aria-pressed={portal === "platform"}
            className={portal === "platform" ? "active" : ""}
            onClick={() => setPortal("platform")}
          >
            Super Admin
          </button>
          <button
            aria-pressed={portal === "organization"}
            className={portal === "organization" ? "active" : ""}
            onClick={() => setPortal("organization")}
          >
            Organization
          </button>
        </div>
        <p className="portal-hint">{portal === "platform" ? "Super Admin access for client registration, onboarding and agreements." : "Organization administrator access for your schools and academic setup."}</p>
        <Form
          fields={[
            {
              key: "email",
              label: "Email address",
              type: "email",
              autoComplete: "username",
              required: true,
            },
            {
              key: "password",
              label: "Password",
              type: "password",
              autoComplete: "current-password",
              required: true,
            },
          ]}
          onSubmit={async (v) =>
            onLogin(await api("/auth/login", "POST", { ...v, portal }))
          }
          submit="Sign in to workspace"
        />
        <p className="login-foot">
          <ShieldCheck size={14} /> Secure access. Independent workspaces.
        </p>
      </div>
    </div>
  );
}
