# V1 workspace completion update — 14 November 2026

This revision completes the remaining code/interface improvements agreed after the first source delivery. Organization-wide licensing now supersedes the original institution allocation model; see `REFINEMENT.md` and `ARCHITECTURE.md`. This is not a verified production deployment.

## Tables and bulk actions

- Editable organization/institution names and organization types in platform tables.
- Editable grade/classroom names and activation states inside working drafts.
- Blur or Enter commits an inline edit; Escape cancels it. Validation failures retain the value and show an error.
- Per-column filters, global search, sorting, filtered record counts, selectable page sizes and clear empty results.
- Selection uses permanent record IDs; bulk operations apply to the selected records matching the current filters.
- Explicit activate/deactivate actions for grades and classrooms. Inactive classrooms continue to consume entitlement.
- Platform organization/institution bulk lifecycle changes validate the entire selection in one transaction. A failing record prevents the entire batch. Platform bulk endpoints accept at most 200 records.

## Bell time and calendar

- Immediate timing diagnostics identify both sides of an overlap, nested overlaps, gaps, nonpositive durations and school-hour bounds.
- Highlighted slot rows and timeline segments, with specific corrective suggestions. Invalid timing can remain in a draft; publication still blocks it.
- Board-wide, section, grade and classroom filters shared across schedules, events and effective previews.
- Resolved month grids and daily list views. Multiple selected classrooms produce aggregate/mixed results instead of silently showing the first classroom's day.
- Per-classroom details explain the applicable schedule and rule. Large selections are paginated.
- Equal-priority opposing holiday/working-day exceptions display a conflict consistently with publication review.

## Review, requests and onboarding

- Publication review lists added, changed and removed boards, sections, grades, classrooms, schedules and calendar events.
- Field-by-field published/draft comparisons, entity/action filters and detailed publication audit records.
- Clients can request changes to every supported registration identity field: name, registration number, address, board affiliations, logo, relation officer, phone and email. Replacement logos use the existing validated upload API.
- The request contains changed fields only and requires a meaningful reason. Super Admin approval/rejection remains mandatory.
- Onboarding overview includes progress, current step, last-updated time and actual blocking issues. Completing an earlier step does not conceal information that subsequently becomes incomplete or a subscription that expires.
- Institution identity checks apply to every institution; commercial checks apply to the single organization-wide contract.

## Settings and navigation

- Editable, audited support email/phone/information, workspace notice and suggested classroom allowance for new agreements.
- Settings updates use an optimistic lock. Client portals receive only the public support/notice fields.
- The agreed sixty-day deletion recovery period, eight-hour sessions and one-administrator model remain unchanged.
- Shared navigation protection covers forms, inline edits, structure drafts and schedule/calendar editors, including modal close, sidebar navigation, academic-year/board changes and sign-out.
- Save & continue waits for pending work and also saves a parent draft newly dirtied by committing an editor. Failed saves keep navigation blocked. Discard & continue explicitly drops unsaved edits; it does not delete a saved database draft.
- Shared shadcn-style source components use Radix Dialog/Slot, class-variance-authority and the standard `cn` helper; native inputs and textareas share the same component layer. Dialogs provide focus trapping, semantic titles/descriptions and keyboard handling.

## Verification boundary

Strict application TypeScript checks, both production builds and 64 unit tests pass. Three Playwright browser tests are included and discover successfully. The PostgreSQL, HTTP and browser suites still require execution against a running environment. The CI workflow now includes browser installation and browser regression execution; it has not run here.

Exact visual matching still requires the original screenshot. Production deployment remains outside this local source revision. The cross-year counting policy is now explicitly documented in `ARCHITECTURE.md`.


## Enterprise interface revision — Salesforce / Teams direction

- Persistent indigo application bar with PLAN identity, workspace search and account settings.
- Compact navigation, selected-item indicator, collapsible desktop sidebar and dismissible mobile navigation overlay.
- Record-style page headers with object icons, breadcrumb context and visible primary actions.
- Shared blue accents, neutral workspace surfaces, Segoe UI/native font fallbacks and readable table/form text.
- More compact list rows, sticky column headers, selected-row states and accessible sort semantics. Non-sortable columns are rendered without misleading sort buttons.
- Consistent structure tabs, onboarding steps, settings forms, calendar controls and dialogs.
- Real search across the user's existing loaded organizations/institutions and navigation sections. Cmd/Ctrl+K, arrow keys, Enter and Escape are supported. Opening results respects existing navigation guards; no backend search endpoint or new data access was introduced.
- A skip-to-workspace link and reduced-motion preferences are supported.

Design references: [Salesforce Lightning layout](https://www.lightningdesignsystem.com/2e1ef8501/p/33e9af-layout), [Teams design fundamentals](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/design/design-teams-app-fundamentals), and [Fluent typography](https://fluent2.microsoft.design/typography). PLAN uses these interaction/layout principles with its own identity and does not copy vendor logos or add chat/CRM modules.

The change is frontend-only; no database migration is required for this interface revision. TypeScript and the optimized frontend build pass. All 86 existing unit/security tests pass. A fourth Playwright scenario covers header search and sidebar collapse; discovery and source compilation pass, but authenticated browser execution remains pending. The running sign-in page was visually checked at 1280 × 720. The authenticated workspace and mobile layouts have not been visually verified in this session.


## Corporate layout and usability refinement

The indigo/blue theme remains. Page introductions now sit above the content rather than inside repeated header cards. Dashboard metrics use an aligned grid with consistent icon, value, caption and action placement. Status colors are restricted to small meaningful accents. Recent organizations are contained in a unified panel with an aligned heading, toolbar, table and pagination. Selecting View all clears previous status filters.

List filters visually join their table. Main content has a controlled maximum width, consistent gutters and responsive metric/academic-section grids. Structure cards, allowance summaries and settings use consistent borders and spacing. Registration-change actions now occupy the page action position.

Organization, institution and subscription forms group related fields under section headings. Error and help descriptions are linked to their inputs for accessibility. Backend operations and the retained color theme are unchanged. TypeScript and the frontend optimized build pass. Native browser access was unavailable, so authenticated visual acceptance of this refinement remains pending.


## Explicit platform editing

Organization names/types and institution names are read-only in platform tables. The labeled Edit action opens the existing form; values are persisted only when the form is saved. Inline draft editing inside Structure Management is unchanged. The existing organization browser regression now checks read-only cells and explicit edit/save persistence.


## Record information and onboarding workspace

- Organization names and View details actions open read-only information, with Overview, Institutions, Subscriptions and Onboarding tabs. Edit remains an explicit separate action.
- Institution names and subscription references open read-only information; related organization names link to their organization information. These links also work within onboarding. Active client institution names open their authorized workspace.
- Workspace search opens information rather than opening an edit form automatically.
- Onboarding now has a separate catalog with list/card views, shared organization/email search and progress filters. Card results are paginated. The selected view is retained when returning from a process.
- Opening a catalog record shows only that organization's process. A back action returns to all onboarding. New organization creation from the catalog opens the saved organization's process.
- The previous Resume label is replaced by Start onboarding, Continue onboarding or View onboarding according to actual completion. The process opens the earliest incomplete step from the backend checklist.
- Seven horizontal process tabs and information tabs support arrow keys, Home/End, active state and labeled panels. Completed/pending/current steps remain visible. Validation and activation still use the existing backend workflows.
- Zero-valued allowances display as zero in information views rather than as missing data.

TypeScript and optimized frontend compilation pass. All 86 unit/security cases pass; two database tests remain skipped. Five Playwright scenarios are discoverable, including read-only record navigation, onboarding list/card views and process-tab keyboard navigation. Authenticated browser execution remains pending. No backend/schema changes or new product modules were introduced.


## Development/build output isolation

Next.js development now uses .next-dev, while production build/start continue using .next. This prevents production verification builds from replacing chunks used by a running development server. The development output is excluded from git and Docker build contexts. TypeScript, production build and configuration phase assertions pass. The running root page returned HTTP 200 after the configuration update.


## Runtime and database startup checks

Root and API development commands validate Node 24.11+/Argon2 before launch. Password hashing rejects an unsupported runtime at module initialization instead of repeatedly failing login. The API checks PostgreSQL connectivity before listening, with a clear startup instruction when unavailable. No hashing algorithm, existing credentials or stored records were changed.


## Fixed sidebar

Removed independent sidebar scrolling. Short viewports use compact navigation spacing and hide secondary workspace labels to keep navigation and sign-out accessible.


## Platform scrollbar appearance

Hidden visible scrollbar tracks/thumbs on pages, onboarding tabs, tables, dialogs and other scrollable regions. Native scrolling remains available through trackpads, mouse wheels and keyboard controls; content is not disabled or clipped by this global styling change.
