"use client";
import { Check } from "lucide-react";
export function WorkspaceTabs({ id, label, tabs, value, onChange, numbered = false, disabled = false, className = "" }: {
  id: string;
  label: string;
  tabs: { value: string; label: string; caption?: string; complete?: boolean }[];
  value: string;
  onChange: (value: string) => void;
  numbered?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return <div role="tablist" aria-label={label} className={`workspace-tabs ${className}`}>
    {tabs.map((tab, index) => <button key={tab.value} id={`${id}-tab-${tab.value}`} role="tab" data-complete={tab.complete || undefined} data-active={value===tab.value} aria-selected={value === tab.value} aria-controls={`${id}-panel-${tab.value}`} tabIndex={value === tab.value ? 0 : -1} disabled={disabled}
      onClick={() => onChange(tab.value)} onKeyDown={(event) => {
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        onChange(tabs[next].value);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}>
      {numbered && <span className={`process-step-number${tab.complete ? " complete" : ""}`}>{tab.complete ? <Check size={14} /> : index + 1}</span>}
      <span className="workspace-tab-label"><strong>{tab.label}</strong>{tab.caption && <small>{tab.caption}</small>}</span>
    </button>)}
  </div>;
}
