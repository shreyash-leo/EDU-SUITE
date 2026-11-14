"use client";
import { useEffect, useRef } from "react";
import { useNavigation } from "./navigation";

type Route = { page?: string; school?: string; onboarding?: string; workflow?: string; record?: string; organization?: string };
const keys = ["page", "school", "onboarding", "workflow", "record", "organization"] as const;

// Routes contain IDs and view names only. Credentials and form values never enter URLs.
export function useWorkspaceLocation(enabled: boolean, state: Route, restore: (route: Route) => void) {
  const { navigate } = useNavigation();
  const latest = useRef(restore); latest.current = restore;
  const restoring = useRef(false);
  const initialized = useRef(false);
  const previousUrl = useRef("");
  useEffect(() => {
    if (!enabled) { initialized.current = false; return; }
    const read = () => {
      const params = new URL(location.href).searchParams;
      return Object.fromEntries(keys.map((key) => [key, params.get(key) || undefined])) as Route;
    };
    restoring.current = true;
    latest.current(read()); initialized.current = true;
    previousUrl.current = location.href;
    const back = () => {
      const route = read(), old = previousUrl.current;
      void navigate(() => { restoring.current = true; latest.current(route); previousUrl.current = location.href; })
        .then((ok) => { if (!ok) history.pushState(null, "", old); });
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [enabled, navigate]);
  const serialized = JSON.stringify(state);
  useEffect(() => {
    if (!enabled || !initialized.current) return;
    if (restoring.current) { restoring.current = false; return; }
    const current = JSON.parse(serialized) as Route;
    const url = new URL(location.href);
    for (const key of keys) {
      if (current[key]) url.searchParams.set(key, current[key]!);
      else url.searchParams.delete(key);
    }
    if (url.href !== location.href) history.pushState(null, "", url);
    previousUrl.current = url.href;
  }, [enabled, serialized]);
}
