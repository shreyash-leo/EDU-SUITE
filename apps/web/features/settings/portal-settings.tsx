"use client";
import { useState } from "react";
import { UserRound, ShieldCheck, SlidersHorizontal, Settings2, Mail, Phone, LifeBuoy, ArrowUpRight, Check, Monitor, Building2 } from "lucide-react";
import { api, setCsrf, type RecordData } from "../../lib/api";
import { usePortalPreferences, type PortalPreferences } from "../../lib/preferences";
import { Button, Form, PageHead } from "../../components/ui";
import { useNavigation } from "../../lib/navigation";
export type SettingsSection = "account" | "preferences" | "platform" | "support";
export function PortalSettings({ user, settings, support, organization, section = "account", onSectionChange, destinations, onSaved, onPresets, onAccount, notify }: {
  user: RecordData; settings?: RecordData; support?: RecordData; organization?: RecordData; section?: SettingsSection; onSectionChange: (section: SettingsSection) => void;
  destinations: { name: string }[]; onSaved: () => Promise<void>; onPresets: () => void; onAccount: () => void; notify: (message: string) => void;
}) {
  const admin = user.role === "PLATFORM_ADMIN";
  const [error, setError] = useState("");
  const { preferences, updatePreferences } = usePortalPreferences();
  const { navigate } = useNavigation();
  const tabs = [{ id: "account", name: "Account & security", Icon: ShieldCheck }, { id: "preferences", name: "Preferences", Icon: SlidersHorizontal }, ...(admin ? [{ id: "platform", name: "Platform defaults", Icon: Settings2 }] : []), { id: "support", name: "Help & support", Icon: LifeBuoy }];
  function update(patch: Partial<PortalPreferences>) {
    try { updatePreferences(patch); setError(""); } catch { setError("This browser could not save the preference. Check that browser storage is available and try again."); }
  }
  const contacts = admin ? settings?.values || support || {} : support || {};
  return <div className="portal-settings">
    <PageHead eyebrow={admin ? "Platform workspace" : "Organization workspace"} title="Settings" text={admin ? "Manage your account, workspace preferences, and platform defaults." : "Manage your account, security, and how your workspace looks."}/>
    <nav className="settings-navigation" aria-label="Settings sections">{tabs.map(tab => <button type="button" key={tab.id} aria-current={section === tab.id ? "page" : undefined} className={section === tab.id ? "selected" : ""} onClick={() => void navigate(() => onSectionChange(tab.id as SettingsSection))}><tab.Icon size={17}/>{tab.name}</button>)}</nav>
    {error && <div className="notice error" role="alert">{error}</div>}
    {section === "account" && <div className="settings-columns">
      <section className="settings-panel"><div className="settings-section-heading"><span className="semantic-icon"><UserRound size={20}/></span><div><h2>Your account</h2><p>Your sign-in identity and workspace access.</p></div></div>
        <div className="settings-profile"><span className="settings-profile-avatar">{user.name?.slice(0,1)}</span><div><strong>{user.name}</strong><span>{admin ? "Super administrator" : "Organization administrator"}</span></div></div>
        <dl className="settings-facts"><div><dt>Email address</dt><dd>{user.email}</dd></div><div><dt>Workspace</dt><dd>{admin ? "Platform administration" : user.organizationName || organization?.name || "Organization workspace"}</dd></div><div><dt>Access</dt><dd><span className="badge" data-tone="success"><Check size={12}/>Active account</span></dd></div></dl>
        {!admin && <div className="settings-context"><Building2 size={18}/><div><strong>Organization registration</strong><p>Registered school and organization details are managed by your platform administrator.</p><Button onClick={onAccount}>View organization account <ArrowUpRight size={14}/></Button></div></div>}
      </section>
      <section className="settings-panel"><div className="settings-section-heading"><span className="semantic-icon" data-tone="advanced"><ShieldCheck size={20}/></span><div><h2>Password & security</h2><p>Choose a password you don’t use elsewhere.</p></div></div>
        <Form fields={[{ key: "currentPassword", label: "Current password", type: "password", autoComplete: "current-password", required: true }, { key: "password", label: "New password", type: "password", autoComplete: "new-password", required: true, help: "At least 12 characters, with uppercase, lowercase, a number, and a symbol." }, { key: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password", required: true }]} onSubmit={async values => {
          if (values.password !== values.confirmPassword) throw Error("The new passwords do not match.");
          const response = await api("/auth/password", "POST", { currentPassword: values.currentPassword, password: values.password });
          setCsrf(response.csrf); notify("Password updated. Other sessions have been signed out.");
        }} submit="Update password"/>
        <p className="settings-security-note"><ShieldCheck size={15}/>Password updates sign out other sessions. Passwords are never saved as form drafts.</p>
      </section>
    </div>}
    {section === "preferences" && <section className="settings-panel settings-preferences"><div className="settings-section-heading"><span className="semantic-icon"><Monitor size={20}/></span><div><h2>Workspace preferences</h2><p>Saved automatically for your account on this browser.</p></div><span className="settings-saved" data-state={error ? "error" : "saved"}><Check size={14}/>{error ? "Not saved" : "Saved"}</span></div>
      <div className="preference-row"><div><h3>Start page</h3><p>The page to open when you enter your workspace.</p></div><label><span className="sr-only">Default start page</span><select value={destinations.some(d=>d.name===preferences.startPage) ? preferences.startPage : ""} onChange={e=>update({startPage:e.target.value})}><option value="">{admin ? "Dashboard (default)" : "Overview (default)"}</option>{destinations.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select></label></div>
      <div className="preference-row"><div><h3>Table rows per page</h3><p>The default number of records shown in data tables.</p></div><label><span className="sr-only">Default table rows per page</span><select value={preferences.pageSize} onChange={e=>update({pageSize:Number(e.target.value)})}>{[10,25,50].map(n=><option key={n} value={n}>{n} rows</option>)}</select></label></div>
      <div className="preference-row"><div><h3>Content spacing</h3><p>Choose more room between records or a denser table layout.</p></div><label><span className="sr-only">Content spacing</span><select value={preferences.density} onChange={e=>update({density:e.target.value as PortalPreferences["density"]})}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div>
      <div className="preference-row"><div><h3>Reduce motion</h3><p>Limit decorative transitions and animations.</p></div><label className="settings-check"><input type="checkbox" checked={preferences.reduceMotion} onChange={e=>update({reduceMotion:e.target.checked})}/><span>Reduce motion</span></label></div>
    </section>}
    {admin && section === "platform" && <div className="settings-platform"><section className="settings-panel"><div className="settings-section-heading"><span className="semantic-icon"><Settings2 size={20}/></span><div><h2>Support & workspace defaults</h2><p>These settings apply across all organization workspaces.</p></div></div>
      {settings && <Form key={settings.lock} draftKey={`platform-settings-${user.id}`} initial={{ ...settings.values, boardCatalog: (settings.values.boardCatalog || []).join("\n") }} fields={[
        { key: "supportEmail", label: "Support email", type: "email", section: "Support contact" }, { key: "supportPhone", label: "Support phone" }, { key: "supportNotes", label: "Support information", type: "textarea" },
        { key: "boardCatalog", label: "Board catalogue", type: "textarea", required: true, section: "Academic defaults", help: "One supported board per line." }, { key: "defaultClassroomLimit", label: "Suggested classroom allowance for new agreements", type: "number", required: true }, { key: "maintenanceNotice", label: "Workspace notice", type: "textarea", section: "Workspace communication", help: "Shown to administrators across the platform." },
      ]} onSubmit={async values => {
        const boardCatalog = String(values.boardCatalog).split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
        if (!boardCatalog.length || new Set(boardCatalog.map(board=>board.toLowerCase())).size !== boardCatalog.length) throw Error("Enter at least one board, without duplicate names.");
        await api("/settings", "PUT", { values: { ...values, boardCatalog }, lock: settings.lock });
        await onSaved(); notify("Platform settings saved");
      }} submit="Save platform settings"/>}
    </section><aside className="settings-side-stack"><section className="settings-panel settings-accent"><h2>Academic presets</h2><p>Manage suggested grades and sections for each board.</p><Button onClick={onPresets}>Edit academic presets <ArrowUpRight size={14}/></Button></section><section className="settings-panel"><h2>Workspace policies</h2><dl className="settings-facts"><div><dt>Session duration</dt><dd>8 hours</dd></div><div><dt>School recovery period</dt><dd>60 days</dd></div><div><dt>Organization access</dt><dd>One administrator per organization</dd></div></dl></section></aside></div>}
    {section === "support" && <div className="settings-columns"><section className="settings-panel"><div className="settings-section-heading"><span className="semantic-icon" data-tone="success"><LifeBuoy size={20}/></span><div><h2>Help & support</h2><p>{admin ? "The support contacts configured for your platform." : "Contact your platform team for account or registration help."}</p></div></div>
      {contacts.supportEmail && <a className="settings-contact" href={`mailto:${contacts.supportEmail}`}><Mail size={19}/><span><small>Email support</small><strong>{contacts.supportEmail}</strong></span><ArrowUpRight size={16}/></a>}
      {contacts.supportPhone && <a className="settings-contact" href={`tel:${String(contacts.supportPhone).replace(/[^+\d]/g,"")}`}><Phone size={19}/><span><small>Call support</small><strong>{contacts.supportPhone}</strong></span><ArrowUpRight size={16}/></a>}
      {!contacts.supportEmail && !contacts.supportPhone && <p className="settings-context">{admin ? "Add a support contact in Platform defaults to make it available to organization administrators." : "Contact your platform administrator. Support contact details have not been configured yet."}</p>}
      {contacts.supportNotes && <p className="settings-support-notes">{contacts.supportNotes}</p>}
    </section><section className="settings-panel settings-accent"><h2>Your portal</h2><p>{admin ? "You manage organizations, school registrations, subscriptions, and platform defaults." : "You manage your organization’s academic structure, school calendars, and classrooms."}</p><p>Use Account & security for password changes and Preferences to personalize this browser.</p></section></div>}
  </div>;
}
