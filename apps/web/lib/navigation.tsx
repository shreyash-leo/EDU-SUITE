"use client";
import { settleNavigationGuards } from "./navigation-core";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { ShadcnButton } from "../components/ui/button";
export type NavigationGuard = {
  label: string;
  isDirty: () => boolean;
  save?: () => Promise<void>;
  discard: () => void | Promise<void>;
};
type NavigationContextType = {
  register: (id: string, guard: NavigationGuard) => () => void;
  navigate: (action: () => void | Promise<void>) => Promise<boolean>;
};
const NavigationContext = createContext<NavigationContextType | null>(null);
export function NavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const guards = useRef(new Map<string, NavigationGuard>());
  const pendingRef = useRef<{
    action: () => void | Promise<void>;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const register = useCallback((id: string, guard: NavigationGuard) => {
    guards.current.set(id, guard);
    return () => {
      guards.current.delete(id);
    };
  }, []);
  const navigate = useCallback(async (action: () => void | Promise<void>) => {
    if (pendingRef.current) return false;
    if (![...guards.current.values()].some((g) => g.isDirty())) {
      await action();
      return true;
    }
    return new Promise<boolean>((resolve) => {
      pendingRef.current = { action, resolve };
      setError("");
      setPending(true);
    });
  }, []);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if ([...guards.current.values()].some((g) => g.isDirty())) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const links = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !a ||
        e.defaultPrevented ||
        e.button ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        a.target === "_blank" ||
        a.hasAttribute("download") ||
        !/^https?:/.test(a.href) ||
        ![...guards.current.values()].some((g) => g.isDirty())
      )
        return;
      e.preventDefault();
      void navigate(() => {
        location.assign(a.href);
      });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", links);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", links);
    };
  }, [navigate]);
  const decide = async (choice: "stay" | "save" | "discard") => {
    if (busy) return;
    const request = pendingRef.current;
    if (!request) return;
    if (choice === "stay") {
      pendingRef.current = null;
      setPending(false);
      request.resolve(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await settleNavigationGuards(() => [...guards.current.values()], choice);
      pendingRef.current = null;
      setPending(false);
      await request.action();
      request.resolve(true);
    } catch (e) {
      pendingRef.current = request;
      setPending(true);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <NavigationContext.Provider
      value={useMemo(() => ({ register, navigate }), [register, navigate])}
    >
      {children}
      <Dialog
        open={pending}
        onOpenChange={(open) => {
          if (!open) void decide("stay");
        }}
      >
        <DialogContent className="navigation-dialog">
          <header>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              Save your work before continuing, or explicitly discard the
              unsaved edits.
            </DialogDescription>
          </header>
          <div className="modal-body">
            <ul>
              {[...guards.current.values()]
                .filter((g) => g.isDirty())
                .map((g, n) => (
                  <li key={n}>{g.label}</li>
                ))}
            </ul>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <div className="row-actions">
              <ShadcnButton disabled={busy} onClick={() => void decide("stay")}>
                Stay here
              </ShadcnButton>
              <ShadcnButton
                variant="destructive"
                disabled={busy}
                onClick={() => void decide("discard")}
              >
                Discard & continue
              </ShadcnButton>
              <ShadcnButton
                variant="default"
                disabled={
                  busy ||
                  [...guards.current.values()].some(
                    (g) => g.isDirty() && !g.save,
                  )
                }
                onClick={() => void decide("save")}
              >
                {busy ? "Saving…" : "Save & continue"}
              </ShadcnButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </NavigationContext.Provider>
  );
}
export function useNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw Error("NavigationProvider is required");
  return value;
}
export function useNavigationGuard(guard: NavigationGuard) {
  const { register } = useNavigation();
  const id = useId();
  const latest = useRef(guard);
  latest.current = guard;
  useEffect(
    () =>
      register(id, {
        label: guard.label,
        isDirty: () => latest.current.isDirty(),
        save: guard.save ? () => latest.current.save!() : undefined,
        discard: () => latest.current.discard(),
      }),
    [id, register, guard.label, !!guard.save],
  );
}
