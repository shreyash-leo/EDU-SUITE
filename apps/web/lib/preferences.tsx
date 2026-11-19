"use client";
import { createContext, useContext, useEffect, useState } from "react";
export type PortalPreferences = { startPage: string; pageSize: number; density: "comfortable" | "compact"; reduceMotion: boolean };
export const defaultPreferences: PortalPreferences = { startPage: "", pageSize: 10, density: "comfortable", reduceMotion: false };
export function readPreferences(userId: string): PortalPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(`plan-preferences-${userId}`) || "{}");
    return { startPage: typeof value.startPage === "string" ? value.startPage : "", pageSize: [10,25,50].includes(value.pageSize) ? value.pageSize : 10, density: value.density === "compact" ? "compact" : "comfortable", reduceMotion: value.reduceMotion === true };
  } catch { return defaultPreferences; }
}
const PreferencesContext = createContext({ preferences: defaultPreferences, updatePreferences: (_patch: Partial<PortalPreferences>) => {} });
export function PortalPreferencesProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<PortalPreferences>(() => readPreferences(userId));
  useEffect(() => {
    document.documentElement.dataset.portalDensity = preferences.density;
    document.documentElement.dataset.portalMotion = preferences.reduceMotion ? "reduce" : "system";
    return () => { delete document.documentElement.dataset.portalDensity; delete document.documentElement.dataset.portalMotion; };
  }, [preferences]);
  function updatePreferences(patch: Partial<PortalPreferences>) {
    const next = { ...preferences, ...patch };
    localStorage.setItem(`plan-preferences-${userId}`, JSON.stringify(next));
    setPreferences(next);
  }
  return <PreferencesContext.Provider value={{ preferences, updatePreferences }}>{children}</PreferencesContext.Provider>;
}
export function usePortalPreferences() { return useContext(PreferencesContext); }
