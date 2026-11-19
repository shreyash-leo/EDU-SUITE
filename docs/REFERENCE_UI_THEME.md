# Reference interface and workflow

Implemented from the user's education-dashboard and client-profile screenshots, refined after the 17 November layout feedback.

## Visual system

Lavender `#cbb9f4`, pistachio `#ddefb9`, ink `#202027`, white cards and a pale `#f4f3f6` canvas. Existing Inter typography has lighter headings, consistent supporting text and system fallbacks. Screenshot font files were not supplied; exact font identification is not claimed.

Shared controls use 44px fields, pill buttons, consistent dropdown chevrons and 24px cards. Tables retain local horizontal scrolling at narrow widths. Header actions, filters and section controls wrap instead of stretching pages. Account identity, contact and address have separate cards; subscription details, school information, academic tools and calendar controls have their own surfaces.

## Page layout

The header and breadcrumbs now participate in normal document flow. The desktop sidebar occupies its own grid column. The mobile drawer closes on Escape or destination selection. Full-page forms render within the content column, replacing the current content instead of floating over it. Opening a form focuses its content without unexpectedly scrolling the header away. Removed legacy rules that hid the main region and locked body scrolling when editors opened. Long forms now scroll normally, including to their submit controls. Success notifications appear at the lower edge of the window.

`apps/web/app/design-tokens.css` owns colors/dimensions. `apps/web/app/reference-theme.css` owns the final shared presentation. `apps/web/app/page.tsx` owns the shell.

## Academic setup

- Removed the academic Review & History navigation, publication review page, summary-entry gate and history actions from the user flow.
- Academic setup opens directly for editing. Incomplete work continues to save automatically.
- **Save & apply** saves pending changes, then applies through existing backend validation. No approval or separate review screen is required.
- Blocking validation messages appear inline. Invalid schedules do not replace the active configuration.
- Grade assignments apply immediately and offer Undo. Suggested structures can be applied directly; impact preview is optional.
- Editing is disabled while an apply operation runs, avoiding changes being overwritten by its reload.
- Internal revision storage and concurrency checks remain in place, preserving existing records and active versions.

The user explicitly selected “Academic setup only; keep registration permissions.” School/organization registration requests, permissions, subscription checks and platform administrator controls are retained.

## Validation

Production build, TypeScript checks, all 233 unit tests and all 15 isolated browser tests pass. Browser checks cover both roles, sign-in, menus, search, tables, forms, account cards, school detail tabs, all four academic tabs, direct assignments/Undo, and desktop/mobile widths. The direct-save live-database check verifies that an overlapping schedule is blocked, a corrected configuration applies without review, and the applied result survives refresh. Isolated browser runs use temporary schemas and remove them afterward; customer records are not used for test writes.

Screenshots are under `artifacts/ui-redesign/layout-refinement/` and `layout-refinement-live/`; preview screenshots use isolated sample records.

## Running locally

Use one app server at a time. For development, stop Docker's `api` and `web`, keep PostgreSQL/MinIO running, then start `npm run dev`. Docker-only updates require rebuilding with `docker compose up -d --build`. The development startup checks occupied app ports. See START-HERE.md.

## Portal settings and interruption-free navigation

Settings is now a full page in both portals, accessible from the sidebar, account identity, and password actions. Account & security contains the actual signed-in identity and an explicitly submitted password form with confirmation. Preferences provides a working default start page, default table size, table spacing and reduced motion, saved per account on this browser. Help uses configured platform support contacts. Platform administrators additionally see support/workspace defaults and academic preset controls; organization users do not receive these controls. Registration permissions are unchanged.

Navigation no longer opens a Save/Discard/Stay dialog or registers browser before-unload prompts. Working academic configurations, schedule edits and inline table edits save quietly before navigation. Save failures remain visible inline and keep the affected editor available. Ordinary forms do not create records or update passwords just because someone navigates away. Their edited visible fields are retained in session memory and merged into current form defaults when returning; reverting a field removes its cached change. Form drafts are cleared when the signed-in account changes and are not stored on disk. Password fields are excluded and cleared after a successful explicit update.

Validation includes both portal settings at desktop/tablet/mobile sizes, navigation with untouched and edited forms, restoration and reversion of unsaved inputs, explicit password submission, preference persistence and its actual effects, plus the full existing browser workflow suite. All 15 browser tests passed against a disposable database; the production build and 233 unit tests pass.
