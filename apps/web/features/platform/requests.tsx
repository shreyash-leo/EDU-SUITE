"use client";
import React, { useRef, useState } from "react";
import { Button } from "../../components/ui";
import { api, type RecordData } from "../../lib/api";
import { useNavigation, useNavigationGuard } from "../../lib/navigation";
const keys = [
  "name",
  "registration",
  "address",
  "boards",
  "logo",
  "officer",
  "phone",
  "email",
] as const;
const labels = {
  name: "School name",
  registration: "Registration number",
  address: "Address",
  boards: "Board affiliations (comma-separated)",
  logo: "School logo URL",
  officer: "School relation officer",
  phone: "Contact number",
  email: "Contact email",
};
export function RegistrationRequestForm({
  institution,
  onSaved,
}: {
  institution: RecordData;
  onSaved: () => void | Promise<void>;
}) {
  const initial = Object.fromEntries(
    keys.map((k) => [
      k,
      k === "boards" ? institution.boards.join(", ") : institution[k] || "",
    ]),
  );
  const [values, setValues] = useState<Record<string, string>>(initial),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const current = useRef({ values, reason });
  current.current = { values, reason };
  const clean = useRef(false);
  const changed = () =>
    keys.some((k) => current.current.values[k] !== initial[k]) ||
    !!current.current.reason;
  async function save() {
    if (uploading) throw Error("Wait for logo upload");
    const c = current.current;
    const proposed: RecordData = {};
    for (const k of keys) {
      const value =
        k === "boards"
          ? c.values[k]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : c.values[k].trim();
      if (
        JSON.stringify(value) !==
        JSON.stringify(institution[k] || (k === "boards" ? [] : ""))
      )
        proposed[k] = value;
    }
    if (!Object.keys(proposed).length)
      throw Error("Change at least one registration field");
    if (c.reason.trim().length < 5)
      throw Error("Enter a reason with at least five characters");
    setBusy(true);
    setError("");
    try {
      await api("/requests", "POST", {
        institutionId: institution.id,
        proposed,
        reason: c.reason.trim(),
      });
      clean.current = true;
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  useNavigationGuard({
    label: `Registration change request for ${institution.name}`,
    isDirty: () => !clean.current && changed(),
    save,
    discard: () => {
      clean.current = true;
      setValues(initial);
      setReason("");
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save().catch((e) => setError(e.message));
      }}
    >
      <p className="form-help">
        Changes require Super Admin approval. Registered boards with academic
        history cannot be removed.
      </p>
      <div className="form-grid">
        {keys.map((k) => (
          <label key={k}>
            {labels[k]}
            <input
              type={k === "email" ? "email" : "text"}
              value={values[k]}
              onChange={(e) => {
                clean.current = false;
                setValues({ ...values, [k]: e.target.value });
              }}
            />
          </label>
        ))}
        <label className="span2">
          Upload replacement logo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setError("Logo must be under 2 MB");
                return;
              }
              setUploading(true);
              try {
                const bytes = new Uint8Array(await file.arrayBuffer());
                let binary = "";
                for (const b of bytes) binary += String.fromCharCode(b);
                const r = await api("/assets", "POST", {
                  mime: file.type,
                  base64: btoa(binary),
                });
                clean.current = false;
                setValues((old) => ({ ...old, logo: r.url }));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        <label className="span2">
          Reason for the requested changes
          <textarea
            value={reason}
            onChange={(e) => {
              clean.current = false;
              setReason(e.target.value);
            }}
            required
            minLength={5}
          />
        </label>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <footer className="form-footer">
        <Button type="submit" variant="dark" disabled={busy || uploading}>
          {busy ? "Submitting…" : "Submit change request"}
        </Button>
      </footer>
    </form>
  );
}
export function RequestComposer({
  institutions,
  onSaved,
}: {
  institutions: RecordData[];
  onSaved: () => void | Promise<void>;
}) {
  const [id, setId] = useState(institutions[0]?.id || "");
  const { navigate } = useNavigation();
  const i = institutions.find((i) => i.id === id);
  return (
    <>
      <label>
        School
        <select
          value={id}
          onChange={(e) => {
            const next = e.target.value;
            void navigate(() => setId(next));
          }}
        >
          {institutions.map((i) => (
            <option value={i.id} key={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      {i ? (
        <RegistrationRequestForm key={i.id} institution={i} onSaved={onSaved} />
      ) : (
        <p>No active schools are available.</p>
      )}
    </>
  );
}
