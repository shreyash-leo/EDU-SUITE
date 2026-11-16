# PLAN EDU SUITE — Complete Platform UI/UX Redesign

Date: 16 November 2026

## Delivered implementation

Actual React and CSS changes redesign the existing Super Admin, onboarding, Client Portal and Structure Management application. This report covers presentation and usability work only. The previously implemented three-part scheduling system is retained, not presented as new redesign functionality.

The implementation adds a shared semantic color system, application shell, operational dashboard, grouped forms, record hierarchy, accessible action states, consistent tables, contextual navigation, workflow pages and responsive layouts. Existing APIs, database schema, domain algorithms and scheduling rules were not changed during this redesign.

## Repository and dependency audit

The application is a workspace monorepo: `apps/web` is a Next.js 15.5.25 / React 19.3.1 application; `apps/api` is NestJS 11; `packages/domain` owns configuration, scheduling and validation; Prisma 6.19.3 owns persistence. Node 24.11.1 was used. The current web app has one route entry (`app/page.tsx`), with page state and feature components selecting the platform, client and school workspaces. Therefore page coverage includes feature views and workflow pages rather than only filesystem routes.

Existing UI dependencies retained: Radix Dialog 1.1.23 and Slot 1.2.3, TanStack React Table 8.21.3, React Hook Form 7.91.0, Lucide 0.468.0, CVA 0.7.1, clsx 2.1.1, tailwind-merge 3.6.0, Tailwind/PostCSS 4.3.3. Existing root dependencies Zod 3.25.76, Prisma, TypeScript, Vitest and Playwright remain unchanged. No package or lockfile changes were required.

The audit found competing legacy visual layers, mixed button styles, weak page hierarchy, repeated record headings, dense ungrouped forms, nested scrolling, inconsistent status colors and a purely summary-oriented dashboard. The shared design layer addresses these across all existing consumers; direct component changes address structural and accessibility issues.

## Page-by-page coverage

“Shared” means the existing view receives redesigned shell, controls, tables, workflow layout or dialog styling without rewriting its business component. Browser verification uses the real production-built frontend with explicit synthetic fixtures; functional API testing is separate.

| Area / existing page or view | Implemented redesign | Verification |
|---|---|---|
| Super Admin and organization sign-in | Focused portal selector, product context, responsive two-column layout, autocomplete and pressed states | Browser portal switching and visual check |
| First password replacement | Shared focused authentication layout and form/button states | Source audit and build; no password changed |
| Super Admin dashboard | Real-record organization metrics, school/subscription/request links, unfinished onboarding queue, recent-record table | Browser desktop and phone; screenshot |
| Organizations directory | Shared directory toolbar, row selection feedback, filter reset, pagination, semantic statuses | Browser navigation and detail entry |
| Organization registration / editing | Fieldsets for identity, contact and address; required/optional distinction; clear actions and errors | Empty required submission, unsaved guard, retain/discard and phone layout |
| Organization detail / relationship tabs | Record summary, readable definition labels, distinct profile heading, consistent related school/contract tables | Browser read-only detail and navigation |
| School directory | Shared table and toolbar, teal identity, clear selection state | Browser select-all / clear-selection |
| School registration / edit | Grouped identity, board, contact and address fields; existing logo/board controls retained | Browser form and screenshot |
| School lifecycle and deletion recovery | Shared focused dialogs, destructive action hierarchy and responsive controls | Source audit; no live lifecycle mutation |
| Subscriptions directory | Consistent numeric alignment, statuses, pagination and actions | Browser navigation |
| Subscription registration / edit | Grouped contract allowances, dates, commercial status and references | Browser full form and screenshot |
| Subscription details | Commercial record hierarchy and shared relationship tabs | Source audit / shared rendering |
| Onboarding directory list / cards | Context heading, consistent list/card switch, compact progress/status | Browser directory and Continue handoff |
| Onboarding stages 1–7: Organization, Schools, Subscription, Agreement & payment, Administrator, Activation, Client workspace | One journey summary, numbered complete/current/pending steps, focused stage panels and footer actions | Browser saved steps; ArrowRight and Home keyboard navigation |
| Administrator information / credential display | Shared forms, definition lists and focus-managed dialog presentation | Source audit; no invitation or credential mutation |
| Requests and request detail | Governance context, aligned review table and clear action states | Browser request list; source audit of resolution flow |
| Registration-change composer | Explicit school/request context, grouped form controls and workflow layout | Source audit / shared controls |
| Platform settings / board catalogue | Sectioned defaults, readable field hierarchy, pressed section navigation | Browser settings |
| Academic structure preset catalogue | Catalogue context, section/grade editing layout, paginated rows and shared actions | Browser editor, screenshot and scroll check |
| Activity history | Consistent audit table and readable timestamp hierarchy | Browser rendering |
| Account settings / password dialog | Focused Radix dialog, consistent fields, cancel/primary hierarchy | Browser dialog open/close; no password entered |
| Client overview | Organization context, real-data metrics, attention list, activity and contract panels | Browser screenshot and layout check |
| Client Schools / Structure Management / Review & History directories | Consistent directory context, filters, list/cards, states and actions | Browser Schools; shared directory component covers all three modes |
| Client school overview | Teal identity, readable registration facts, academic-year context and primary actions | Browser |
| Client school Academic Structure | Board totals and consistent structure tables | Browser |
| Client school Bell Time & Calendar | Readable calendar totals and direct management actions | Browser |
| Client school Configuration & History | Version facts, pending-change hierarchy and history table | Browser |
| Account & Subscription / organization profile | Clear organization facts, shared allowance emphasis and contract table | Browser |
| Structure school / academic-year header | Consistent school/year/state context, shared loading skeleton and actions | Browser |
| Structure School Registration / grades | Read-only identity, board context, existing editable grade table | Browser |
| Structure Academic Sections / assignments | Clear section picker and assignment content, consistent controls | Browser |
| Structure Classroom Setup | Shared filters, inline editing, license counts and table actions | Browser |
| Structure Bell Time & Calendar navigation | Semantic normal/holiday/advanced tabs and readable four-step navigation | Browser desktop, tablet and phone |
| Default Bell Timing | Clear schedule summaries, timeline, coverage table and controls | Browser and screenshot |
| Default Holidays | Consistent holiday-family table and override actions | Browser |
| Advanced Scheduling | Violet identity, action selector, rule relationships/status and table | Browser |
| Calendar & effective preview | Readable month/day/list controls, calendar cells, filters and result tables | Browser and screenshot |
| Schedule wizard | Consistent steps, timing inputs, feasibility notice, action footer and workflow scroll | Browser scope/timing steps and screenshot |
| Rule / recurrence editors and effective impact previews | Shared workflow layout, grouped fields, pressed weekday states, consistent tables and notices | Source audit; server-rendering regressions retain existing controls |
| Academic-year management, structure presets, bulk grade/classroom editors | Shared dedicated workflow page, field/form/table styling and consistent action hierarchy | Source audit; build and existing functional regressions |
| Review & publication | Clear readiness, change filters, board/classroom totals and inspection controls | Browser; no publication submitted |
| Published history / restore | Consistent version table and explicit restore consequence | Browser; restore not submitted |
| Confirmation / unsaved-change dialogs | Radix focus management retained, consistent dialog sizes, explicit destructive/cancel actions | Browser Stay here / Discard unsaved changes |

## Design system

| Semantic role | Foreground | Soft background | Use |
|---|---|---|---|
| Primary | `#4f46e5` | `#eef2ff` | Primary actions and platform navigation |
| School / calendar | `#0f766e` | `#effaf7` | School identity, ordinary calendar context |
| Success | `#166534` | `#f0fdf4` | Active, published, ready, completed |
| Attention | `#92400e` | `#fffbeb` | Draft, pending, incomplete, review |
| Destructive | `#b42318` | `#fff1f2` | Errors, expired, rejected and destructive actions |
| Information | `#0369a1` | `#f0f9ff` | Onboarding and helpful context |
| Advanced | `#6d28d9` | `#f5f3ff` | Advanced rules and commercial context |
| Neutral | `#475569` | `#f1f5f9` | Inactive and unassigned states |

Base canvas `#f7f8fb`, white surfaces, text `#172b45`, muted text `#5b6b80`, borders `#e2e7ef`. Inter/system typography, 4px spacing scale, 6/9/12px radii, 38px standard controls and larger mobile controls. Small uppercase context labels distinguish page identity from content headings. Color is supported by text labels and state attributes.

The semantic foreground/soft-background pairs pass automated WCAG AA normal-text contrast checks (4.5:1). This is token validation, not a claim of a complete accessibility certification.

## 21st.dev research and integration

Reviewed the public [Origin UI Button](https://21st.dev/@originui/components/button), [Origin UI Dialog](https://21st.dev/@originui/components/dialog), [shadcn Sidebar](https://21st.dev/@shadcn/components/sidebar) and [21st.dev MCP/CLI](https://21st.dev/mcp) references.

Integrated compatible interaction patterns through project-owned React code: Radix Slot/CVA button variants, loading and disabled actions, restrained sidebar hierarchy, semantic state chips and focused dialog styling. Existing Radix Dialog supplies focus trapping and modal semantics; existing TanStack and React Hook Form remain the table/form foundations. Public references informed adaptations; no authenticated registry source was copied or installed. Full component retrieval requires an authenticated 21st.dev session unavailable here. No dependency was added solely for appearance.

## Components and scrolling

- `ShadcnButton` and the public `Button` wrapper now share variants, sizing, loading, disabled and icon-label behavior.
- `Badge`, `PageHead`, `DetailGrid`, `SectionIntro` and `WorkspaceSkeleton` centralize semantic tone and hierarchy.
- `Form` retains existing registration, validation and submit handlers while rendering meaningful fieldsets and legends.
- `DataTable` retains sorting, filtering, selection, inline editing and pagination. It adds selection feedback/clear, filter reset and a keyboard-focusable horizontal region.
- `WorkspaceTabs` retains roving keyboard focus and panel relationships; completed and active states have consistent visual treatment.
- Dashboard operational counts and queues derive from existing records. No fictional production analytics were added.
- Normal pages use document scrolling. Long workflow pages use one vertical scrolling owner. Table regions allow deliberate horizontal scrolling for wide data, without an extra vertical table scroller.
- Reduced-motion preferences and visible focus states are supported. Responsive changes collapse columns, wrap actions and render the four structure steps in two columns on phones.

Real browser testing exposed and fixed search-input double borders, muted metric icon colors, a legacy login panel width, repeated record headings and a legacy 20px span rule that squeezed Structure step captions. All fixes are included in application source.

## Files modified for this redesign

Existing source files changed relative to the UI-task baseline:

- `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`
- `apps/web/components/data-table.tsx`, `apps/web/components/ui.tsx`, `apps/web/components/ui/button.tsx`, `apps/web/components/workspace/tabs.tsx`
- `apps/web/features/auth/login.tsx`
- `apps/web/features/platform/forms.tsx`, `record-details.tsx`, `onboarding-catalog.tsx`, `requests.tsx`, `academic-preset-catalogue.tsx`
- `apps/web/features/client/portal.tsx`
- `apps/web/features/structure/workspace.tsx`, `calendar.tsx`, `scope-rule.tsx`

New files:

- `apps/web/app/design-tokens.css`, `apps/web/app/platform.css`
- `apps/web/lib/design-system.ts`, `apps/web/components/platform-primitives.tsx`
- `tests/platform-design.test.ts`, `tests/fixtures/platform-ui-server.ts`
- `docs/PLATFORM_UI_DESIGN_SYSTEM.md`, this report and `artifacts/platform-ui/*`

Next regenerated `apps/web/next-env.d.ts` during builds; it has no remaining Git diff. Other already-dirty API, domain, migration, navigation, scheduling and scheduling-report files predated this UI task and are not claimed as redesign changes. `artifacts/platform-ui/source-preservation.json` records the 79-file starting snapshot comparison: no API/domain/schema source change during this redesign.

## Verification results

| Check | Result |
|---|---|
| `npm run typecheck` | Passed API and web TypeScript checks |
| `npm test` | 232 passed, 7 database tests skipped in default mode; 11 test files passed, 1 skipped |
| New UI regressions | 6 passed: negative status classification, pending action state, step semantics, readable multi-board details, real-data empty dashboard and semantic color contrast |
| `npm run test:db:isolated` | All 7 integration tests passed; disposable schema migrated and removed |
| `npm run test:http:isolated` | Passed real HTTP onboarding → temporary login → client structure → tenant boundary; disposable schema removed |
| API and production Next builds | Passed; page 112 kB, first-load JS 237 kB |
| `git diff --check` | Passed |
| `npm run test:browser:isolated` | Blocked at Chromium launch: macOS MachPortRendezvous / permission error before application assertions; runner reports 1 failed and 6 not run |
| Real in-app browser | Passed manual interaction and visual checks documented above |
| Responsive Structure layout | 1920×1080, 1440×900, 1366×768, 768×1024, 390×844: no document horizontal overflow |
| Phone dashboard / organization form | 390×844: no document horizontal overflow; form has one workflow scroll owner |

The automated browser launch failure is an environment limitation, not a passing functional test. Database-backed tests and HTTP tests succeeded; they do not replace full automated browser coverage. No email, invitation, password, live deletion, publication or customer configuration mutation was performed as part of visual review.

## Visual evidence and repeatable review

Screenshots are real rendered frontend captures with synthetic identities explicitly labeled UI Preview, not static mockups. Representative files:

- [Platform dashboard](artifacts/platform-ui/dashboard-final.jpg)
- [Phone dashboard](artifacts/platform-ui/dashboard-phone.jpg)
- [Client overview](artifacts/platform-ui/client-overview.jpg)
- [School registration](artifacts/platform-ui/school-registration.jpg)
- [Subscription form](artifacts/platform-ui/subscription-form.jpg)
- [Academic presets](artifacts/platform-ui/academic-presets.jpg)
- [Default Bell Timing](artifacts/platform-ui/structure-bell-timing.jpg)
- [Calendar](artifacts/platform-ui/structure-calendar.jpg)
- [Phone Structure Management](artifacts/platform-ui/structure-phone.jpg)
- [Publication review](artifacts/platform-ui/publication-review.jpg)
- [Bell editor](artifacts/platform-ui/bell-editor.jpg)
- [Phone organization form](artifacts/platform-ui/organization-form-phone.jpg)

`browser-layout-checks.json` records observed viewport/document widths and vertical scroll containers. No pre-redesign screenshots were available for an honest before/after pair.

For a repeatable visual-only review, run the production frontend on port 3302, then `PLAN_UI_PREVIEW_PORT=3304 node --import tsx tests/fixtures/platform-ui-server.ts` and open `http://127.0.0.1:3304/__preview`. This proxy never connects to a database, labels all records, and blocks live-write operations. In-memory configuration changes are disposable. It is not imported by the application or used in production authentication.

## Remaining limitations

- Automated Playwright needs a machine that permits its Chromium process to launch; rerun all 7 browser tests there.
- Authenticated 21st.dev source import was unavailable. The implemented components are original compatible adaptations of public patterns, not a claimed registry installation.
- Browser visual verification used representative synthetic records. Long real organization names, very large datasets, every exceptional modal and every lifecycle branch still merit product acceptance testing with appropriate non-production fixtures.
- No full screen-reader, cross-browser or device-lab audit was performed. Token contrast and keyboard checks provide partial accessibility evidence.
- The application retains legacy CSS for existing feature geometry with the new authoritative token/visual layers loaded last. A future cleanup can remove obsolete selectors after wider acceptance testing; doing so here would risk unrelated feature layouts.
- No database backfill, API migration, deployment or production publication is included or required by the redesign.

## Follow-up implementation — 16 November 2026

Continued the application-code refinement after the initial redesign:

- Connected inline table validation errors to their controls with stable `aria-describedby` IDs.
- Connected each Filters button to its named Column filters region using a unique `aria-controls` ID. Existing column `aria-sort` support was confirmed and retained.
- Connected board-affiliation errors to the board selector, exposed its invalid state and added consistent red invalid-control borders.
- Applied semantic status colors to the Client overview distribution, with both a colored indicator and a readable label/count. Negative and inactive statuses retain their distinct semantics.

Additional files touched: `apps/web/features/platform/board-affiliations.tsx`; follow-up edits also affect `components/data-table.tsx`, `features/client/portal.tsx` and `app/platform.css`.

Revalidation: `npm run typecheck`, `npm test` (232 passed; 7 database cases skipped in default mode), production Next build and `git diff --check` passed. In-app browser verified the six client status tones, the filter button/region relationship, and board validation with `aria-invalid=true` and an error description. Evidence: `artifacts/platform-ui/client-status-summary.jpg` and `artifacts/platform-ui/board-validation.jpg`. No backend or customer data changes were made in this follow-up. Earlier isolated database/HTTP results and the standalone Chromium launch limitation remain as recorded above.
