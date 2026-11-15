"use client";
import { useRef, useState } from "react";
import { autoAssign, ruleSchema, scheduleSchema, type Board, type Rule, type Schedule, type Slot } from "../../../../packages/domain/src";
import { scheduleDiagnostics } from "../../../../packages/domain/src/enhancements";
import { Button } from "../../components/ui";
import { uid, time, minutes } from "../../lib/api";
import { useNavigationGuard } from "../../lib/navigation";
import { RecurrencePreview } from "./recurrence-preview";
import { ScopeRule, defaultRule } from "./scope-rule";
const steps = ["Select scope", "Day timings", "Fixed routines", "Configure periods", "Preview & save"];
export function ScheduleWizard({ yearId, board, boards, initial, ruleType, dayType, onSave, onCancel }: { yearId: string; board: Board; boards?: Board[]; initial?: Schedule; ruleType?: Rule["type"]; dayType?: "full" | "half"; onSave: (schedule: Schedule) => void | Promise<void>; onCancel: () => void }) {
  const [s, setS] = useState<Schedule>(initial || { id: uid(), name: ruleType && ruleType !== "default" ? "Special day schedule" : "Regular school day", arrival: 480, dispersal: dayType === "half" ? 720 : 870, dayType: dayType || "full", target: { scope: "school", ids: [] }, rule: { ...defaultRule(), type: ruleType || "default", ...(ruleType === "recurring" ? { weekdays: [6], nth: 2 } : {}) }, slots: [] });
  const [step, setStep] = useState(initial ? 3 : 0), [periods, setPeriods] = useState(initial?.slots.filter((p) => p.kind === "period").length || 7), [duration, setDuration] = useState(initial?.slots.find((p) => p.kind === "period") ? initial.slots.find((p) => p.kind === "period")!.end - initial.slots.find((p) => p.kind === "period")!.start : 45), [durations, setDurations] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [routineName, setRoutineName] = useState("Lunch");
  const anchored = useRef(new Set(initial?.slots.filter((p) => p.kind === "routine").map((p) => p.id)));
  const current = useRef(s); current.current = s;
  const baseline = useRef(JSON.stringify(initial || s));
  const diagnostics = scheduleDiagnostics(s);
  const affected = new Set(diagnostics.flatMap((d) => d.slotIds));
  const routines = s.slots.filter((p) => p.kind === "routine");
  async function save() {
    const parsed = scheduleSchema.safeParse(current.current);
    if (!parsed.success) throw Error(parsed.error.issues.map((i) => i.message).join("; "));
    if (!["school", "board"].includes(parsed.data.target.scope) && !parsed.data.target.ids.length) throw Error("Select at least one target.");
    await onSave({ ...parsed.data, slots: [...parsed.data.slots].sort((a, b) => a.start - b.start) });
    baseline.current = JSON.stringify(current.current);
  }
  useNavigationGuard({ label: "Bell schedule", isDirty: () => baseline.current !== JSON.stringify(current.current), save, discard: () => { baseline.current = JSON.stringify(current.current); } });
  function updateSlot(slot: Slot, patch: Partial<Slot>) {
    if (anchored.current.has(slot.id) && (patch.start !== undefined || patch.end !== undefined || patch.kind === "period") && !window.confirm(`Move or change the fixed routine “${slot.name}”? Its current position is anchored.`)) return;
    if (patch.kind === "routine") anchored.current.add(slot.id);
    setS({ ...s, slots: s.slots.map((p) => p.id === slot.id ? { ...p, ...patch } : p) });
  }
  function slotRows(rows: Slot[], editable = true) { return <div className="slots-editor">{rows.map((p) => <div className={`slot-row ${p.kind}${affected.has(p.id) && step >= 3 ? " invalid-slot" : ""}`} key={p.id}>
    <input aria-label="Slot name" value={p.name} readOnly={!editable} onChange={(e) => updateSlot(p, { name: e.target.value })} />
    {editable ? <select aria-label="Slot type" value={p.kind} onChange={(e) => updateSlot(p, { kind: e.target.value as Slot["kind"] })}><option value="period">Teaching</option><option value="routine">Fixed routine</option></select> : <span className="slot-kind">{p.kind === "routine" ? "Fixed routine" : "Teaching"}</span>}
    <input aria-label="Start time" type="time" value={time(p.start)} readOnly={!editable} onChange={(e) => updateSlot(p, { start: minutes(e.target.value) })} /><span>to</span>
    <input aria-label="End time" type="time" value={time(p.end)} readOnly={!editable} onChange={(e) => updateSlot(p, { end: minutes(e.target.value) })} /><small>{p.end - p.start}m</small>
    {editable && <Button onClick={() => { if (p.kind === "routine" && anchored.current.has(p.id) && !window.confirm(`Delete the fixed routine “${p.name}”?`)) return; setS({ ...s, slots: s.slots.filter((x) => x.id !== p.id) }); }}>Remove</Button>}
  </div>)}</div>; }
  function next() {
    try {
      if (step === 0) { if (!s.name.trim()) throw Error("Give this schedule a name."); if (!["school", "board"].includes(s.target.scope) && !s.target.ids.length) throw Error("Select at least one target."); ruleSchema.parse(s.rule); }
      if (step === 1 && (!Number.isInteger(s.arrival) || !Number.isInteger(s.dispersal) || s.dispersal <= s.arrival || !Number.isInteger(periods) || periods < 1 || periods > 30 || duration <= 0)) throw Error("Choose valid arrival/dispersal times and 1–30 periods with a positive duration.");
      if (step === 2) { const sorted = [...routines].sort((a, b) => a.start - b.start); if (sorted.some((p, n) => !Number.isInteger(p.start) || !Number.isInteger(p.end) || p.end <= p.start || p.start < s.arrival || p.end > s.dispersal || n > 0 && p.start < sorted[n - 1].end)) throw Error("Fixed routines must be within school hours, have positive durations and not overlap."); }
      setError(""); setStep(Math.min(4, step + 1));
    } catch (e) { setError(e instanceof Error ? e.message : "Check the details above."); }
  }
  return <>
    <nav className="wizard-steps" aria-label="Bell schedule setup">{steps.map((name, index) => <button key={name} aria-current={step === index ? "step" : undefined} className={step === index ? "selected" : ""} disabled={busy || index > step + 1} onClick={() => { if (index <= step) { setStep(index); setError(""); } else next(); }}><span>{index + 1}</span>{name}</button>)}</nav>
    <div className="wizard-heading"><p className="eyebrow">Step {step + 1} of 5</p><h2>{steps[step]}</h2></div>
    {step === 0 && <><label>Schedule name<input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} maxLength={100} /></label><ScopeRule board={board} boards={boards} target={s.target} rule={s.rule} showWhen={s.rule.type !== "default"} onTarget={(target) => setS({ ...s, target })} onRule={(rule) => setS({ ...s, rule })} /><p className="form-help">A school default applies to every board. More specific schedules can override it later.</p>{s.rule.type === "default" && <details><summary>Advanced date settings</summary><Button onClick={() => setS({ ...s, rule: { ...defaultRule(), type: "weekly", weekdays: [1] } })}>Use selected dates or weekdays instead</Button></details>}</>}
    {step === 0 && s.rule.type !== "default" && <RecurrencePreview yearId={yearId} rule={s.rule} />}
    {step === 1 && <><div className="form-grid"><label>Student arrival<input type="time" value={time(s.arrival)} onChange={(e) => setS({ ...s, arrival: minutes(e.target.value) })} /></label><label>Student dispersal<input type="time" value={time(s.dispersal)} onChange={(e) => setS({ ...s, dispersal: minutes(e.target.value) })} /></label><label>Day type<select value={s.dayType || "full"} onChange={(e) => setS({ ...s, dayType: e.target.value as "full" | "half" })}><option value="full">Full day</option><option value="half">Half-day</option></select></label><label>Number of teaching periods<input type="number" min={1} max={30} value={periods} onChange={(e) => setPeriods(Number(e.target.value))} /></label><label>Default period duration (minutes)<input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label></div><details><summary>Different period durations</summary><label>One duration per period, separated by commas<input placeholder="45, 45, 40, 45…" value={durations} onChange={(e) => setDurations(e.target.value)} /></label></details><div className="notice">School day: {s.dispersal - s.arrival} minutes · Planned teaching: {durations ? durations.split(",").reduce((n, d) => n + (Number(d.trim()) || 0), 0) : periods * duration} minutes. Use routines to cover the remaining time.</div></>}
    {step === 2 && <><p className="form-help">Add assembly, lunch and breaks at fixed times. Auto Assign will keep these routines anchored.</p><div className="routine-toolbar"><label>Routine<select value={routineName} onChange={(e) => setRoutineName(e.target.value)}>{["Assembly", "Lunch", "Breakfast", "Break", "Other routine"].map((name) => <option key={name}>{name}</option>)}</select></label><Button onClick={() => setS({ ...s, slots: [...s.slots, { id: uid(), name: routineName, kind: "routine", start: s.arrival, end: Math.min(s.arrival + 15, s.dispersal) }] })}>Add routine</Button></div>{slotRows(routines)}{!routines.length && <p className="form-help">No routines added. Continue if teaching periods cover the complete day.</p>}</>}
    {step === 3 && <><div className="section-head"><div><h3>Generate or edit periods</h3><p>{periods} periods · {time(s.arrival)}–{time(s.dispersal)} · {routines.length} fixed routines</p></div><div className="row-actions"><Button onClick={() => setStep(1)}>Change timings</Button><Button onClick={() => { try { const values = durations.trim() ? durations.split(",").map((d) => Number(d.trim())) : Array(periods).fill(duration); if (values.length !== periods) throw Error("Provide one duration for each period."); const slots = autoAssign(s.arrival, s.dispersal, values, routines, uid); routines.forEach((r) => anchored.current.add(r.id)); setS({ ...s, slots }); setError(""); } catch (e) { setError((e as Error).message); } }}>Auto Assign</Button><Button onClick={() => { const start = Math.max(s.arrival, ...s.slots.map((p) => p.end)); setS({ ...s, slots: [...s.slots, { id: uid(), name: `Period ${s.slots.filter((p) => p.kind === "period").length + 1}`, kind: "period", start: Math.min(start, 1439), end: Math.min(start + duration, 1440) }] }); }}>Add period manually</Button></div></div>{slotRows(s.slots)}{!s.slots.length && <p className="form-help">Choose Auto Assign or add periods manually.</p>}</>}
    {step === 4 && s.rule.type !== "default" && <RecurrencePreview yearId={yearId} rule={s.rule} />}
    {step === 4 && <><div className="summary-strip"><span><strong>{s.name}</strong></span><span>{s.target.scope} · {s.rule.type}</span><span>{time(s.arrival)}–{time(s.dispersal)}</span><span>{s.dayType === "half" ? "Half-day" : "Full day"}</span></div>{slotRows([...s.slots].sort((a, b) => a.start - b.start), false)}<div className={`notice ${diagnostics.length ? "amber-notice" : "success"}`}>{diagnostics.length ? "This schedule can be saved as a draft. Correct timing issues before publication." : "The schedule covers the complete school day without gaps or overlaps."}</div></>}
    {step >= 3 && diagnostics.length > 0 && <details className="schedule-diagnostics" open><summary>{diagnostics.length} timing issues to resolve</summary>{diagnostics.map((d, n) => <div className="notice error" key={n}><span>{d.message} {d.suggestion}</span></div>)}</details>}
    {error && <div className="notice error" role="alert">{error}</div>}
    <footer className="form-footer"><Button disabled={busy} onClick={onCancel}>Cancel</Button>{step > 0 && <Button disabled={busy} onClick={() => { setStep(step - 1); setError(""); }}>Previous</Button>}{step < 4 ? <Button variant="dark" disabled={busy} onClick={next}>Continue</Button> : <Button variant="dark" disabled={busy} onClick={() => { setBusy(true); setError(""); void save().catch((e) => setError(e.message)).finally(() => setBusy(false)); }}>{busy ? "Saving…" : "Save schedule to draft"}</Button>}</footer>
  </>;
}
