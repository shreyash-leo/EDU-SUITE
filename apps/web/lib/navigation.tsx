"use client";
import { settleNavigationGuards } from "./navigation-core";
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
export type NavigationGuard = {
  label: string;
  isDirty: () => boolean;
  save?: () => Promise<void>;
  discard: () => void | Promise<void>;
  autoSave?: boolean;
};
type NavigationContextType = {
  register: (id: string, guard: NavigationGuard) => () => void;
  navigate: (action: () => void | Promise<void>) => Promise<boolean>;
  readDraft: (key: string) => Record<string, any> | undefined;
  writeDraft: (key: string, values: Record<string, any>) => void;
  clearDraft: (key: string) => void;
  clearDrafts: () => void;
};
const NavigationContext = createContext<NavigationContextType | null>(null);
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const guards = useRef(new Map<string, NavigationGuard>());
  // Session memory only. Password fields never enter this cache.
  const drafts = useRef(new Map<string, Record<string, any>>());
  const navigating = useRef(false);
  const [error, setError] = useState("");
  const register = useCallback((id: string, guard: NavigationGuard) => {
    guards.current.set(id, guard);
    return () => { guards.current.delete(id); };
  }, []);
  const navigate = useCallback(async (action: () => void | Promise<void>) => {
    if (navigating.current) return false;
    navigating.current = true;
    setError("");
    try {
      await settleNavigationGuards(() => [...guards.current.values()].filter(g => g.autoSave && g.save), "save");
      await action();
      return true;
    } catch (error) {
      setError(`Your changes could not be saved. ${(error as Error).message}`);
      return false;
    } finally { navigating.current = false; }
  }, []);
  useEffect(() => {
    const links = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === "_blank" || anchor.hasAttribute("download") || !/^https?:/.test(anchor.href) || ![...guards.current.values()].some(g => g.autoSave && g.isDirty())) return;
      event.preventDefault();
      void navigate(() => location.assign(anchor.href));
    };
    document.addEventListener("click", links);
    return () => document.removeEventListener("click", links);
  }, [navigate]);
  const value = useMemo(() => ({ register, navigate,
    readDraft: (key: string) => drafts.current.get(key),
    writeDraft: (key: string, values: Record<string, any>) => { drafts.current.set(key, values); },
    clearDraft: (key: string) => { drafts.current.delete(key); },
    clearDrafts: () => { drafts.current.clear(); setError(""); },
  }), [register, navigate]);
  return <NavigationContext.Provider value={value}>{children}{error && <div className="navigation-save-error notice error" role="alert"><span>{error}</span><button type="button" className="button small" onClick={() => setError("")}>Dismiss</button></div>}</NavigationContext.Provider>;
}
export function useNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw Error("NavigationProvider is required");
  return value;
}
export function useNavigationGuard(guard: NavigationGuard) {
  const { register } = useNavigation();
  const id = useId();
  const latest = useRef(guard); latest.current = guard;
  useEffect(() => register(id, {
    label: guard.label,
    isDirty: () => latest.current.isDirty(),
    save: guard.save ? () => latest.current.save!() : undefined,
    discard: () => latest.current.discard(),
    autoSave: guard.autoSave,
  }), [id, register, guard.label, !!guard.save, guard.autoSave]);
}
