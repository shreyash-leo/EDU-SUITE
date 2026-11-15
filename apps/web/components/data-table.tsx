"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { Search, ChevronLeft, ChevronRight, Loader2, SlidersHorizontal } from "lucide-react";
import { ShadcnButton as Button } from "./ui/button";
import { useNavigation, useNavigationGuard } from "../lib/navigation";
import type { RecordData } from "../lib/api";
export type EditableField = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  parse?: (v: string) => unknown;
  validate?: (v: string, row: RecordData) => string | undefined;
};
export type BulkAction = {
  label: string;
  action: (rows: RecordData[]) => void | Promise<void>;
  confirm?: string;
};
function InlineCell({
  row,
  field,
  onEdit,
}: {
  row: RecordData;
  field: EditableField;
  onEdit: (r: RecordData, p: RecordData) => Promise<void>;
}) {
  const original = String(row[field.key] ?? "");
  const [value, setValue] = useState(original);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const clean = useRef(original);
  const current = useRef(value);
  current.current = value;
  const flight = useRef<Promise<void> | null>(null);
  const skipBlur = useRef(false);
  useEffect(() => {
    if (current.current === clean.current) {
      setValue(original);
      current.current = original;
    }
    clean.current = original;
  }, [original]);
  const save = async () => {
    if (flight.current) return flight.current;
    if (current.current === clean.current) return;
    const snapshot = current.current;
    const reason = field.validate?.(snapshot, row);
    if (reason) {
      setError(reason);
      throw Error(reason);
    }
    setSaving(true);
    setError("");
    const p = (async () => {
      try {
        await onEdit(row, {
          [field.key]: field.parse
            ? field.parse(snapshot)
            : field.type === "number"
              ? Number(snapshot)
              : snapshot.trim(),
        });
        clean.current = snapshot;
      } catch (e) {
        setError((e as Error).message);
        throw e;
      } finally {
        setSaving(false);
        flight.current = null;
      }
    })();
    flight.current = p;
    return p;
  };
  const discard = () => {
    skipBlur.current = true;
    current.current = clean.current;
    setValue(clean.current);
    setError("");
  };
  useNavigationGuard({
    label: `${row.name || "Record"}: ${field.label}`,
    isDirty: () => !!flight.current || current.current !== clean.current,
    save,
    discard: async () => {
      if (flight.current) await flight.current.catch(() => {});
      discard();
    },
  });
  const common = {
    value,
    disabled: saving,
    "aria-label": `Edit ${field.label} for ${row.name || row.reference || "record"}`,
    "aria-invalid": !!error,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValue(e.target.value);
      setError("");
    },
    onBlur: () => {
      if (skipBlur.current) {
        skipBlur.current = false;
        return;
      }
      void save().catch(() => {});
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        discard();
        (e.target as HTMLElement).blur();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
    },
  };
  return (
    <div className="inline-cell">
      {field.type === "select" ? (
        <select {...common}>
          {field.options?.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input {...common} type={field.type === "number" ? "number" : "text"} />
      )}{" "}
      {saving && <Loader2 size={12} className="spin" />}
      {error && (
        <small className="error-text" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
export function DataTable({
  data,
  columns,
  placeholder = "Search records…",
  bulkAction,
  bulkActions = [],
  editableFields = [],
  onEdit,
  hideSearch = false,
}: {
  data: RecordData[];
  columns: ColumnDef<RecordData, any>[];
  placeholder?: string;
  hideSearch?: boolean;
  bulkAction?: (rows: RecordData[]) => void;
  bulkActions?: BulkAction[];
  editableFields?: EditableField[];
  onEdit?: (row: RecordData, patch: RecordData) => Promise<void>;
}) {
  const { navigate } = useNavigation();
  const [globalFilter, setGlobalFilter] = useState(""),
    [sorting, setSorting] = useState<SortingState>([]),
    [rowSelection, setRowSelection] = useState<Record<string, boolean>>({}),
    [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]),
    [filtersOpen, setFiltersOpen] = useState(false),
    [actionIndex, setActionIndex] = useState(""),
    [confirmation, setConfirmation] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const allActions = bulkActions.length
    ? bulkActions
    : bulkAction
      ? [{ label: "Toggle selected statuses", action: bulkAction }]
      : [];
  const effectiveColumns = useMemo(
    () => columns.map((c) => ({ ...c, filterFn: "includesString" as const })),
    [columns],
  );
  const table = useReactTable({
    data,
    columns: effectiveColumns,
    getRowId: (row, index) => String(row.id ?? index),
    state: { globalFilter, sorting, rowSelection, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  useEffect(() => {
    const valid = new Set(data.map((r, n) => String(r.id ?? n)));
    setRowSelection((old) =>
      Object.fromEntries(Object.entries(old).filter(([id]) => valid.has(id))),
    );
  }, [data]);
  const selected = table
    .getFilteredSelectedRowModel()
    .rows.map((r) => r.original);
  const selectAll = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate =
        table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected();
  });
  const run = async (index: number) => {
    setError("");
    setBusy(true);
    try {
      await allActions[index].action(selected);
      setRowSelection({});
      setActionIndex("");
      setConfirmation(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        {!hideSearch && <div className="search">
          <Search size={16} />
          <input
            aria-label={placeholder}
            value={globalFilter}
            onChange={(e) => {
              const value = e.target.value;
              void navigate(() => setGlobalFilter(value));
            }}
            placeholder={placeholder}
          />
        </div>}
        <Button aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
          <SlidersHorizontal size={14} /> Filters{columnFilters.length ? ` (${columnFilters.length})` : ""}
        </Button>
        <span className="muted">
          {table.getFilteredRowModel().rows.length} records
        </span>
        {selected.length > 0 && allActions.length > 0 && (
          <div className="row-actions">
            <span>{selected.length} selected</span>
            {allActions.length > 1 && <select
              aria-label="Bulk action"
              value={actionIndex}
              onChange={(e) => {
                setActionIndex(e.target.value);
                setConfirmation(null);
              }}
            >
              <option value="">Choose action</option>
              {allActions.map((a, n) => (
                <option value={n} key={n}>
                  {a.label}
                </option>
              ))}
            </select>}
            <Button
              disabled={(allActions.length > 1 && actionIndex === "") || busy}
              onClick={() => {
                const n = allActions.length === 1 ? 0 : Number(actionIndex);
                if (allActions[n].confirm) setConfirmation(n);
                else void run(n);
              }}
            >
              {allActions.length === 1 ? allActions[0].label : "Apply"}
            </Button>
          </div>
        )}
      </div>
      {filtersOpen && (
        <div className="column-filters">
          {table
            .getAllLeafColumns()
            .filter((c) => c.getCanFilter())
            .map((c) => {
              const values = [
                ...new Set(
                  data.map((_, i) =>
                    String(
                      table.getCoreRowModel().rows[i]?.getValue(c.id) ?? "",
                    ),
                  ),
                ),
              ]
                .filter(Boolean)
                .sort();
              return (
                <label key={c.id}>
                  {typeof c.columnDef.header === "string"
                    ? c.columnDef.header
                    : c.id}
                  {values.length <= 30 ? (
                    <select
                      value={String(c.getFilterValue() || "")}
                      onChange={(e) => {
                        const value = e.target.value;
                        void navigate(() =>
                          c.setFilterValue(value || undefined),
                        );
                      }}
                    >
                      <option value="">All</option>
                      {values.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={String(c.getFilterValue() || "")}
                      onChange={(e) => {
                        const value = e.target.value;
                        void navigate(() =>
                          c.setFilterValue(value || undefined),
                        );
                      }}
                      placeholder="Contains…"
                    />
                  )}
                </label>
              );
            })}
          <Button
            onClick={() => {
              setColumnFilters([]);
              setGlobalFilter("");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      {confirmation !== null && (
        <div className="notice amber-notice bulk-confirmation">
          <span>
            {allActions[confirmation].confirm} Applies to {selected.length}{" "}
            filtered, selected records.
          </span>
          <Button
            disabled={busy}
            variant="destructive"
            onClick={() => void run(confirmation)}
          >
            {busy ? "Applying…" : "Confirm action"}
          </Button>
          <Button disabled={busy} onClick={() => setConfirmation(null)}>
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {allActions.length > 0 && (
                  <th>
                    <input
                      ref={selectAll}
                      aria-label="Select all filtered rows"
                      type="checkbox"
                      checked={
                        table.getFilteredRowModel().rows.length > 0 &&
                        table
                          .getFilteredRowModel()
                          .rows.every((r) => r.getIsSelected())
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRowSelection((old) => {
                          const next = { ...old };
                          for (const r of table.getFilteredRowModel().rows)
                            next[r.id] = checked;
                          return next;
                        });
                      }}
                    />
                  </th>
                )}
                {g.headers.map((h) => (
                  <th key={h.id} scope="col" aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined}>
                    {h.column.getCanSort() ? <button
                      className="sort"
                      onClick={() =>
                        void navigate(() => h.column.toggleSorting())
                      }
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === "asc"
                        ? " ↑"
                        : h.column.getIsSorted() === "desc"
                          ? " ↓"
                          : ""}
                    </button> : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} data-selected={r.getIsSelected() ? "true" : undefined}>
                {allActions.length > 0 && (
                  <td>
                    <input
                      aria-label={`Select ${r.original.name || r.original.reference || "record"}`}
                      type="checkbox"
                      checked={r.getIsSelected()}
                      onChange={r.getToggleSelectedHandler()}
                    />
                  </td>
                )}
                {r.getVisibleCells().map((c) => (
                  <td key={c.id}>
                    {onEdit &&
                    editableFields.some((f) => f.key === c.column.id) ? (
                      <InlineCell
                        row={r.original}
                        field={
                          editableFields.find((f) => f.key === c.column.id)!
                        }
                        onEdit={onEdit}
                      />
                    ) : (
                      flexRender(c.column.columnDef.cell, c.getContext())
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!table.getRowModel().rows.length && (
          <div className="empty">
            <h3>{data.length ? "No matching records" : "No records yet"}</h3>
            <p>
              {data.length
                ? "Change or clear the filters to see more records."
                : "Create your first record to get started."}
            </p>
          </div>
        )}
      </div>
      <div className="pagination">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {Math.max(1, table.getPageCount())}
        </span>
        <div className="row-actions">
          <label className="page-size">
            Rows
            <select
              aria-label="Rows per page"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                const value = Number(e.target.value);
                void navigate(() => table.setPageSize(value));
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() => void navigate(() => table.previousPage())}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            onClick={() => void navigate(() => table.nextPage())}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}
