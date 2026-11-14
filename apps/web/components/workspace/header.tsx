"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Building2, Command, Layers, Search, School, X } from "lucide-react";
import { Brand } from "../ui";
import type { RecordData } from "../../lib/api";

export type WorkspaceDestination = {
  id: string;
  name: string;
  kind: "section" | "organization" | "institution";
  description: string;
};

export function WorkspaceHeader({ user, sections, organizations, institutions, onOpen, onAccount }: {
  user: RecordData;
  sections: { name: string }[];
  organizations: RecordData[];
  institutions: RecordData[];
  onOpen: (destination: WorkspaceDestination) => Promise<boolean>;
  onAccount: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLDivElement>(null);
  const resultsId = useId();
  const destinations = useMemo<WorkspaceDestination[]>(() => [
    ...sections.map((s) => ({ id: s.name, name: s.name, kind: "section" as const, description: "Workspace section" })),
    ...organizations.map((o) => ({ id: o.id, name: o.name, kind: "organization" as const, description: o.email || "Organization" })),
    ...institutions.filter((i) => i.status === "ACTIVE").map((i) => ({ id: i.id, name: i.name, kind: "institution" as const, description: `${i.boards.join(" · ")} · School` })),
  ], [sections, organizations, institutions]);
  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return destinations.filter((d) => terms.every((term) => `${d.name} ${d.description}`.toLowerCase().includes(term))).slice(0, 8);
  }, [query, destinations]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !document.querySelector('[role="dialog"]')) {
        event.preventDefault(); input.current?.focus(); setOpen(true);
      }
    };
    const outside = (event: PointerEvent) => {
      if (!search.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", keyboard);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", keyboard); document.removeEventListener("pointerdown", outside); };
  }, []);

  async function select(destination: WorkspaceDestination) {
    if (await onOpen(destination)) {
      setOpen(false); setQuery(""); input.current?.blur();
    }
  }

  return <header className="suite-bar">
    <div className="suite-identity"><Brand /><span className="suite-divider" /><span className="suite-product">Academic operations</span></div>
    <div className="workspace-search" ref={search} onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
    }}>
      <Search size={16} aria-hidden="true" />
      <input
        ref={input}
        role="combobox"
        aria-label="Search workspace"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? resultsId : undefined}
        aria-activedescendant={open && results.length ? `${resultsId}-${Math.min(active, results.length - 1)}` : undefined}
        placeholder="Search workspace"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((n) => results.length ? (n + 1) % results.length : 0); }
          if (e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setActive((n) => results.length ? (n - 1 + results.length) % results.length : 0); }
          if (e.key === "Enter" && open && results.length) { e.preventDefault(); void select(results[Math.min(active, results.length - 1)]); }
        }}
      />
      {query ? <button className="search-clear" aria-label="Clear workspace search" onClick={() => { setQuery(""); setActive(0); input.current?.focus(); }}><X size={14} /></button> : <kbd><Command size={11} /> K</kbd>}
      {open && <div className="workspace-search-popover">
        <div className="search-caption">{query.trim() ? "Matching sections and records" : "Go to a section or record"}</div>
        <div id={resultsId} role="listbox" aria-label="Workspace search results">
          {results.map((result, index) => {
            const Icon = result.kind === "organization" ? Building2 : result.kind === "institution" ? School : Layers;
            return <button key={`${result.kind}-${result.id}`} id={`${resultsId}-${index}`} role="option" aria-selected={index === active}
              onMouseEnter={() => setActive(index)} onMouseDown={(e) => e.preventDefault()} onClick={() => void select(result)}>
              <span className={`search-result-icon ${result.kind}`}><Icon size={17} /></span>
              <span><strong>{result.name}</strong><small>{result.description}</small></span><ArrowUpRight size={14} />
            </button>;
          })}
          {!results.length && <p className="search-no-results">No matching sections or records.</p>}
        </div>
        <div className="search-hint">↑ ↓ Navigate <span>Enter Open</span><span>Esc Close</span></div>
      </div>}
    </div>
    <button className="suite-account" onClick={onAccount} aria-label={`Account settings for ${user.name}`}>
      <span className="suite-account-text"><strong>{user.name}</strong><small>{user.role === "PLATFORM_ADMIN" ? "Super Admin" : "Organization admin"}</small></span>
      <span className="suite-avatar">{user.name.slice(0, 1)}</span>
    </button>
  </header>;
}
