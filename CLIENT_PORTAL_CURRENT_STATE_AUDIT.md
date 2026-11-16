# PLAN EDU SUITE — ORGANIZATION CLIENT PORTAL CURRENT STATE AUDIT

**Audit date:** 15 November 2026 (Asia/Kolkata).  
**Project inspected:** `/Users/shreyash/Documents/Codex/plan-edu-suite`.  
**Purpose:** factual current-state inventory for a later specification comparison. Revised to the attached architecture/functional audit format: 22 sections, seven-column feature matrix, detailed API contracts, calculation inventory and lifecycle scenarios. No Canva comparison or recommendations are included.

**Source fingerprint:** SHA-256 `cf9a9a21b99af432eaba71319100ece6fc9c1ca5680a5d2ffae57a4fb59749e9` over 80 selected first-party source/schema/test/script/package/config files, hashed before and checked after report creation. It identifies the inspected source set; it is not a Git commit or a database snapshot.

**Read-only boundary:** this audit creates/revises this report only. No application source, database, configuration, UI, credentials or existing functionality was changed. No migration, seed, reset, server startup, database test, HTTP mutation or browser suite was run during the audit. Full-suite/build/database/browser results quoted below are earlier executions observed in this same working session, not audit reruns. Section 20.4 retains pure-function checks from the initial read-only audit, performed entirely in memory; they were not rerun for this report-format revision. Live production data quantities were not queried.

## 1. Executive Summary

The repository contains a functioning implementation of an organization-scoped school directory, school details, academic structure editing, bell/calendar resolution, and revision publication. It is a Next.js/React frontend with a NestJS HTTP API, Prisma and PostgreSQL. The frontend's Organization Client Portal has five primary sidebar entries: Overview, Schools, Structure Management, Review & History, Account & Subscription. A separate Change requests page exists outside the sidebar.

The current source separates inspection from editing. A Schools name, row, card or Open School action goes to School Details. Structure Management's sidebar opens a school-selection dashboard. A school selection/configuration action there opens the selected school's workspace. The workspace retains exactly four principal tabs: School Registration, Academic Sections, Classroom Setup, Bell Time & Calendar. Academic-year management is inside this workspace.

Working configurations are stored as database revisions, not solely browser state. Publishing finalizes the existing draft revision, points the academic year at that publication, and preserves older revisions. Historical restoration creates a new draft. Grade/section/classroom IDs are logical persistent keys, distinct from snapshot database row IDs. The normal save/publication flow uses transactions, organization/year locks, a numeric revision lock and an optional revision ID; the web client supplies both lock and revision ID.

Bell rules choose **one complete schedule template** for each classroom/date. They do not merge individual overridden fields. Temporal rule type takes priority over target specificity. Full holidays suppress bell schedules unless a higher-ranked, explicit specific-date reopening wins. Weekly off-days, half-day events, half-day templates and conflicting exceptions have additional rules documented below.

Licensing is organization-wide. It counts active and inactive classrooms and uses the maximum draft/publication count per year, the maximum year reservation per school, and the sum across schools. It is not a sum of all academic years or a union of all logical classroom IDs. Existing edits/reductions can continue when a contract is reduced/expired; classroom additions require a valid contract. Publication requires an active contract, but an already over-limit organization generates a warning rather than an unconditional publication rejection.

Important limitations of the snapshot:

- Current browser interaction and visual correctness have not been established. Earlier Chromium launch was blocked by macOS sandbox permissions. Seven browser scenarios exist in source; discovery is not execution.
- Calendar totals explicitly treat missing schedules as provisional working dates; invalid/conflicting dates are excluded from working/holiday counts. Thus a displayed total is not always a validated instructional-day total.
- Direct continuous date-range holiday entry is not a separate UI/model feature. Bounded weekly/recurring rules can represent a range, including all seven weekdays.
- Some context restoration/history paths, helper-state navigation guards and aggregate calendar flags have source-observed limitations, described without fixes in section 21.
- “Implemented” in the matrix means source and supporting evidence exist. It does not assert that every rendered control was successfully exercised in a browser.

## 2. Current Technology Architecture

### 2.1 Technologies actually declared

| Layer | Actual implementation/source |
| --- | --- |
| Frontend | Next.js **15.5.25**, React/React DOM **19.3.1**, TypeScript; `apps/web/package.json` |
| UI | Lucide icons; TanStack React Table 8.21.3; React Hook Form 7.91.0; Radix Dialog/Slot; shared button/input/dialog components; CSS theme/density files, plus Tailwind 4.3.3 dependencies |
| Backend | NestJS **11.2.8**, Express adapter, Swagger, cookie-parser, Helmet; `apps/api/package.json`, `apps/api/src/main.ts` |
| Shared rules | TypeScript and Zod **3.25.76** in `packages/domain/src` |
| Persistence | Prisma/Prisma Client **6.19.3**, PostgreSQL; schema in `prisma/schema.prisma` |
| Runtime | Node **>=24.11**, npm >=11 declared. Password code actively requires Node's built-in Argon2; Node 22 is rejected |
| Assets | S3-compatible AWS SDK client; local Docker configuration uses MinIO and a public-read logo bucket |
| Development | npm workspaces; `concurrently` starts API/web; `tsx watch` API and `next dev` web |
| Tests | Vitest 4.1.12, Node's test runner for HTTP, Playwright 1.64.1/Chromium |
| Local containers | `compose.yaml`: PostgreSQL 17, MinIO, bucket setup, API, web, backup worker |

The declared font stack is Segoe UI, Inter, Apple/system fallbacks; this is not evidence of an explicitly downloaded Inter/Geist font. `density.css` overrides the earlier theme with a 224px sidebar, 52px app bar, 20px page gutter, 34px controls, 13px body text, navy accents and neutral surfaces.

### 2.2 Frontend → API → database

1. `apps/web/app/page.tsx:App` owns login, current sidebar page, selected school, details/workspace view and top-level forms.
2. `apps/web/lib/api.ts:api` sends JSON to same-origin `/api`, includes session cookies and the in-memory CSRF token, parses JSON and throws the server's message on failure.
3. `apps/web/next.config.ts:rewrites` forwards `/api/:path*` to `API_INTERNAL_URL`, defaulting to `http://localhost:4000`.
4. `apps/api/src/main.ts:ApiController.handle` is a Nest catch-all `/api/{*path}` controller. It authenticates, checks Origin/CSRF for writes, dispatches path/method pairs to `AppService` or auth/asset logic, and converts errors to HTTP responses.
5. `AppService` checks ownership and applies shared Zod/domain validators. `store.ts` reads/writes normalized revision records through Prisma.
6. PostgreSQL holds the authoritative identities, years, drafts/publications, licensing contracts, requests, sessions and audits. Frontend state and `sessionStorage` are navigation/unsaved-edit aids, not the authoritative academic database.

`next dev` uses `.next-dev`; production uses `.next`. `PLAN_NEXT_DIST_DIR` permits an isolated test build directory. This is source configuration, not an audit-time startup action.

### 2.3 Source reference key

All relative references below resolve under the absolute project root printed above. Function names are provided because some JSX files contain long single-line components.

| Key | Actual file / principal symbols |
| --- | --- |
| APP | `apps/web/app/page.tsx` — `App`, `clientNav`, `refresh`, `openClientSchool`, route restore callback |
| CP | `apps/web/features/client/portal.tsx` — `ClientPortal`, `ClientSchoolDetails`, `Metrics`, `Subscription`, `activityTitle`, `openSchoolEntry`, `rowClick`, `rowKey` |
| WS | `apps/web/features/structure/workspace.tsx` — `Structure`, `load`, `persist`, `ensureSaved`, `commitConfiguration`, `commitBoard`, `remove`, `EventEditor` |
| CAL | `apps/web/features/structure/calendar.tsx` — `BellCalendar` |
| WIZ | `apps/web/features/structure/schedule-wizard.tsx` — `ScheduleWizard`, `save`, `next`, `updateSlot` |
| SCOPE | `apps/web/features/structure/scope-rule.tsx` — `ScopeRule`, `defaultRule` |
| BUILD | `apps/web/features/structure/bulk-builders.tsx` — `BulkGrades`, `ClassroomBuilder` |
| SEC | `apps/web/features/structure/section-assignments.tsx` — `SectionAssignments`, `assign`, `confirmAssignment` |
| YEAR | `apps/web/features/structure/academic-year.tsx` — `AcademicYearForm` |
| PRESET-UI | `apps/web/features/structure/preset-preview.tsx` — `PresetPreview`; `apps/web/features/platform/academic-preset-catalogue.tsx` — `AcademicPresetCatalogue` |
| DIFF-UI | `apps/web/features/structure/change-review.tsx:ChangeReview`; `impact-preview.tsx:ImpactPreview` in the same directory |
| REQ | `apps/web/features/platform/requests.tsx` — `RegistrationRequestForm`, `RequestComposer` |
| UI | `apps/web/components/ui.tsx` — `Form`, `Modal`, `Button`, `Badge`, `PageHead`, `DetailGrid`; `apps/web/components/data-table.tsx:DataTable`, `InlineCell` |
| NAV | `apps/web/lib/navigation.tsx:NavigationProvider`, `useNavigationGuard`; `navigation-core.ts:settleNavigationGuards`; `workspace-location.ts:useWorkspaceLocation` |
| HEAD | `apps/web/components/workspace/header.tsx:WorkspaceHeader` |
| API | `apps/api/src/main.ts` — `ApiController.handle`, `login`, `authenticate`, `createSession`, `bootstrap`, `reconcileDeletions` |
| SVC | `apps/api/src/service.ts` — `AppService` methods named in the relevant sections |
| PORTAL-API | `apps/api/src/client-portal.ts` — `querySchema`, `schoolRows`, `clientDirectory`, `clientSchool` |
| STORE | `apps/api/src/store.ts` — `readConfig`, `writeConfig`, `audit`, `revisionInclude` |
| LIC | `apps/api/src/licensing.ts` — `lockOrganization`, `activeContract`, `organizationUsage`, `assertClassroomChange` |
| D | `packages/domain/src/index.ts` — schemas; `validateSlots` (line 135), `autoAssign` (153), `matches` (214), `targetRank` (230), `applicableRules` (270), `resolve` (276), `review` (333), copy/deletion/count helpers |
| E | `packages/domain/src/enhancements.ts` — `scheduleDiagnostics` (16), `selectedClassrooms` (74), `appliesToSelection` (92), `calendarDay` (102), `configurationChanges` (226), `calendarSummary` (374) |
| P | `packages/domain/src/portal.ts` — `structureStatus`, `operationalYear`, `structureAction`, `schoolEntryDestination` |
| B | `packages/domain/src/bulk.ts` — `gradePresets`, `gradeRange`, `gradePreview`, `classroomPreview`, `validateClassroomPreview` |
| PR | `packages/domain/src/presets.ts` — preset schemas/defaults, `presetsForBoard`, `applyAcademicPreset` |
| I | `packages/domain/src/impact.ts` — `configurationImpact`, `assertStableOwnership`, `assignGrades` |
| DB | `prisma/schema.prisma` and `prisma/migrations/*/migration.sql` |

## 3. Complete Navigation & Page Map

### 3.1 Physical routes versus view routes

The main application is one Next.js page at `/`, not separate `app/schools/[id]` or `app/structure/[id]` route files. Distinct experiences are separate components and validated URL query state. `useWorkspaceLocation` reads/writes `page`, `school`, `onboarding`, `workflow`, `record`, `organization`, `intent` and uses browser history/popstate.

Examples below use placeholders, not actual customer identifiers:

| Destination | Representative URL state / component |
| --- | --- |
| Organization login | `/?portal=organization`; `Login` |
| Overview | `/?page=Overview`; CP `ClientPortal` |
| Schools | `/?page=Schools`; CP school directory |
| School Details | `/?page=Schools&school=<school-id>&workflow=schoolDetails`; `ClientSchoolDetails` |
| Structure dashboard | `/?page=Structure%20Management`; `ClientPortal` directory/metrics |
| Structure editor | `/?page=Structure%20Management&school=<school-id>&workflow=schoolWorkspace&intent=default`; `Structure` |
| Calendar destination | Same workspace with `intent=calendar`; opens Bell Time & Calendar/Calendar |
| Bell destination | Same workspace with `intent=bell`; opens Default Bell Schedule |
| Review workspace | `page=Review%20%26%20History`, `workflow=schoolWorkspace`, `intent=review` |
| Direct published history | Review workspace with `intent=history`; loads the existing published-history workflow page |
| Account | `/?page=Account%20%26%20Subscription` |
| Registration request | `workflow=schoolRequest&record=<school-id>` or `workflow=request`; dedicated form workflow |
| Change requests list | Internal `page="Change requests"`; not in `clientNav` and not accepted by the page allowlist on reload |

Year, board and selected structure tab are retained in school-specific `sessionStorage` keys, not separate URL path segments. Directory view/filters use a user-specific session key. These are session-scoped, not permanent cross-device preferences.

### 3.2 Primary navigation and exact click destinations

| Entry/action | Actual destination |
| --- | --- |
| Overview sidebar | Organization overview; does not select an editor |
| Schools sidebar | School directory; current school context can remain retained without rendering its editor |
| Schools name/row/card, Enter/Space on row/card | School Details through `schoolEntryDestination` and `openClientSchool` |
| Open School button in any directory | Explicit School Details, including when on the Structure dashboard |
| Structure Management sidebar | Dashboard/directory, because sidebar handling resets `clientView="directory"` |
| Structure dashboard school name/row/card | Workspace for active accounts; incomplete publication requests edit intent; pending draft requests review intent; inactive account falls back to details |
| Review & History sidebar | School-selection directory; selecting an active school opens its review workspace |
| Header search school result | School Details for the matched active school |
| Detail Back to Schools | School directory |
| Workspace back button | Structure Management dashboard |
| Details Manage Structure | Workspace for that school; published configurations initially remain read-only unless Edit Structure/complete-edit intent is used |
| Account & Subscription | Account/details/subscription list |

Row/card handlers ignore clicks originating in nested buttons, links or form controls, preventing their normal action from being replaced by the container's destination. Academic Years is absent from the primary client sidebar.

### 3.3 Shared shell and non-sidebar surfaces

The shell has a persistent app bar, organization breadcrumb, search, compact/collapsible sidebar, account/password access, sign-out, mobile menu and navigation scrim. Search supports keyboard navigation and Cmd/Ctrl+K, with up to eight results. Its school options come from the initially loaded institution list and include active accounts. A maintenance notice can be displayed globally from `/workspace-settings`.

Complex editors use `Modal page=true`, which renders an in-page/fixed workflow section with its own heading and Back to workspace, rather than a Radix popup. Small grade/section/classroom forms and deletion/discard confirmations remain dialogs. Internal schedule/year/history workflow state is not itself serialized by `useWorkspaceLocation`.

### 3.4 Account & Subscription and Change requests: complete page inventory

**Account & Subscription** uses APP's dedicated branch, not `ClientPortal`. It displays Organization name, legal name, registration, contact name, email, phone, address, city, state and postal code from `/organization-profile`. The allowance notice uses `/usage`: organization classrooms used/limit and organization users/userLimit. The Subscription validity table lists reference, stored status, classroom allowance, user allowance, valid from and valid until. This table includes historical/future/inactive contract records returned by the profile; the Overview's separate snapshot chooses a currently valid active contract. A stored ACTIVE status alone is not a computed statement that its dates are currently valid.

The table uses ordinary DataTable search, column filters, sorting and 10/25/50/100-row pagination, not server directory pagination. Identity/commercial fields are read-only: no client organization edit, contract purchase, renewal, payment or allowance-adjustment action is implemented here. Change password opens a small account dialog with current password and new password; it uses `/auth/password`, rotates CSRF/session state and reports success. Account access is also available from the shell. Registration change requests navigates to the internal Change requests page. Sign out is a shell action invoking `/auth/logout`.

**Change requests** displays reason, status, submission date, resolution and View request, with generic table search/filter/sort/pagination. View request opens a dedicated workflow containing the reason and proposed values; organization clients can inspect, while approve/reject is platform-guarded. Request registration change opens a school selector and `RegistrationRequestForm`. That form covers name, registration, address, boards, logo, officer, phone/email, replacement logo upload and reason. It submits only changed fields. The underlying institution list can include inactive schools even though submission requires the active-school service guard; the generic composer does not prefilter those out. Dedicated inactive school details disable Request Changes. Request cancellation/edit-after-submit is absent.

No separate organization-side audit-log browser exists: clients see the limited recent-activity projection, published version history and registration-request resolution history. Full `/audit` is platform-only.

### 3.5 Shared table/form interaction inventory

`DataTable` uses stable row IDs, global search, sortable column headers, optional column filters (select when <=30 distinct values, contains text otherwise), record counts, client pagination and page-size selection. With bulk actions it supports individual selection and Select all filtered rows across the filtered dataset, not just the current page. Bulk commands apply to filtered selected rows, can ask confirmation, show busy/error and clear selection on success. Explicit bulkActions take precedence over the legacy single bulkAction prop.

`InlineCell` validates before committing; blur/Enter saves, Escape restores the previous clean value, and failed edits retain error/dirty state. A local parent-config update can finish before its backend autosave. `Form` uses React Hook Form on-blur validation, required markers/field help, server-error display, dirty navigation guard, password show/hide controls and busy submission. These primitives do not independently prove end-to-end persistence; the parent/API handlers documented per page determine that.

## 4. Overview Module

**Sources:** CP `ClientPortal`, `activityTitle`, `Subscription`; PORTAL-API `schoolRows`, `clientDirectory`; P status/year selectors. The page fetches `/api/client-portal` after a 180ms debounce. Initial APP refresh separately loads institutions, requests, usage, public settings and organization profile.

### 4.1 Eligibility and represented academic year

Only schools belonging to the session organization, with organization status ACTIVE and school status other than DELETION_PENDING, enter the directory/metrics query. Inactive schools are included. Each school contributes at most one selected academic-year row:

1. For the retained selected school only, a valid requested `yearId` belonging to that school takes precedence.
2. Otherwise choose a year containing now, latest start first if multiple overlap.
3. Otherwise choose the latest started year.
4. Otherwise choose the earliest future year.
5. No year yields Not Started.

The detail API and workspace use `operationalYear`; the directory implements the equivalent selection in PostgreSQL lateral joins. Explicit year selection can be historical; the represented year is displayed. There is no rule prohibiting overlapping academic years. Endpoint calls are not a single repeatable-read snapshot; directory rows, counts and metrics are queried in parallel.

### 4.2 Metrics and filters

Let S be the eligible school rows above. Metrics are computed **before** directory search/board/status filters.

| Display | Exact calculation | Click behavior |
| --- | --- | --- |
| Registered schools | `COUNT(S)` | Schools directory, cleared school/board/search filters |
| Active structures | Count rows with non-null `publishedRevisionId` | Schools filter `CONFIGURED` |
| Setup required | Status in `{NOT_STARTED,DRAFT}` | Schools filter `IN_PROGRESS` |
| Organization classroom usage | `license.used / license.limit` | Account & Subscription |

“Active structures” is a label for **a publication exists**. It includes Incomplete Active and Draft Changes Pending; it does not mean all those publications have no warnings. Active-structure and setup-required counts are disjoint by publication presence.

### 4.3 Status computation

| Status | Actual condition |
| --- | --- |
| NOT_STARTED | No represented year, or no publication/draft pointers |
| DRAFT | Draft pointer present, publication absent |
| DRAFT_CHANGES_PENDING | Both pointers present; does not check whether draft content differs |
| INCOMPLETE_ACTIVE | Publication present, no draft, publication status INCOMPLETE_ACTIVE |
| ACTIVE | Publication present, no draft, publication not INCOMPLETE_ACTIVE |

The status panel shows all five counts and links to filtered Schools. They are exclusive classifications; a school is not counted once per year. Outstanding warnings are reflected principally through the published INCOMPLETE_ACTIVE status, not a fresh review computation for every directory row.

### 4.4 Attention, activity and subscription

- Attention is a compact table: School, Academic year, Current status, Required action. Query: `structureStatus <> 'ACTIVE'`, newest six by lastUpdated. View all opens the ATTENTION filter. Inactive school actions are disabled.
- `structureAction`: Not Started → Start Configuration; Draft → Continue Configuration; Incomplete Active → Complete Missing Details; Active → Open Configuration; Pending draft → Review Changes. The incomplete action uses edit intent, which can create a new draft. Pending review routes to review; it does not automatically publish.
- Recent activity uses the newest eight existing AuditLog entries joined through academic years to authorized schools. Allowed actions: `structure.published`, `structure.draft-created`, `structure.draft-discarded`, `structure.updated`, `academic-year.created`.
- Draft-update labels prioritize added grades, then classroom changes, then bell/calendar changes, otherwise generic structure update. A single save may cover several record changes. The page shows recorded change count, school/year, timestamp and a school-details link. Activity links retain the event's academic year. No data produces an empty state.
- Subscription snapshot shows the unique currently valid active contract, validity, classroom used/limit, users/userLimit. If active contracts overlap, the snapshot reports contract review; if none is current, it reports no valid active contract. The backend fetches recent contracts plus the actual active contract if it was not in that recent set.

## 5. Schools Directory & School Details

### 5.1 Schools directory


**Sources:** CP `ClientPortal`, `openSchoolEntry`, `rowClick`, `rowKey`; PORTAL-API `querySchema`, `clientDirectory`; APP `openClientSchool`.

| Capability | Actual behavior |
| --- | --- |
| School source | Existing Institution records registered by Super Admin; no client re-registration or duplicate projection entities |
| List | Logo/fallback icon, school name, registration, boards, represented year, structure status, classroom count, account status, last updated, Open School; configuration/review actions on relevant dashboards |
| Cards | Logo/fallback, name, boards, structure status, registration, year, classroom count, account status, Open School and contextual dashboard actions |
| Name search | Case-insensitive SQL `ILIKE` substring; search length <=100; SQL wildcard/backslash characters escaped |
| Board filter | Exact affiliation membership in the school's `boards` array |
| School filter | Empty/ACTIVE/INACTIVE; independent of structure status |
| Structure filter | Five exact states plus CONFIGURED, IN_PROGRESS, ATTENTION |
| CONFIGURED | A publication pointer exists |
| IN_PROGRESS | NOT_STARTED or DRAFT |
| ATTENTION | Every state except ACTIVE |
| Sort | School name ascending; or lastUpdated descending; name/ID tie-breakers |
| LastUpdated | Greatest school identity updatedAt, represented publication updatedAt and draft updatedAt |
| Pagination | SQL LIMIT/OFFSET, default 12, max 50 API page size; UI uses 12 and Previous/Next |
| Persistence | Session storage `plan-directory-<user-id>` contains filters, page and List/Card choice; one shared directory preference across portal pages |
| Clear filters | Resets search, board, school status, structure status, name sort and page 1 |
| Error/loading | Loading text, updating indicator, error notice, no-match empty state; old results can remain displayed while a new request is pending |

All filters feed the same backend regardless of List/Card mode. A school with no academic year shows “Not created” and zero current configuration classrooms. Inactive schools are inspectable, but configuration mutations remain forbidden. Pending-deletion schools are excluded even though they can still reserve license capacity until purge.

Click semantics are entry-specific, not merely attached to a button: Schools names/rows/cards always inspect details. Structure dashboard row/card/name selections configure; the explicit Open School button always inspects. Enter/Space activates the whole row/card. A read-only inactive school falls back to details.

This directory is server-paginated, but APP still downloads the full identity list from `/institutions` for shell/search/request selection. It omits year metadata for clients, not the school identity records themselves. Generic tables elsewhere use client pagination instead of this SQL directory pagination.


**Sources:** CP `ClientSchoolDetails`; PORTAL-API `clientSchool`; SVC `clientSchool`. API: `GET /institutions/:id/portal?yearId=...`.

The API checks school ID, session organization, active organization and not-pending-deletion state. It permits inactive identity inspection. It loads available years, the selected working draft or publication, latest 50 published history metadata records and a calendar summary. It does not mutate school/configuration records.

### 5.2 School Details: header and sub-tabs

Header: Back to Schools, school name/logo, registration, board affiliations, school account status, structure status, working-draft/published basis, academic-year selector. Selecting a year refetches details and saves that school-specific selection.

| Sub-tab | Actual information and actions |
| --- | --- |
| School Overview | Read-only name, registration, address, boards, officer, email, phone; academic year; total grades/classrooms from represented configuration |
| Academic Structure | Per-board section count, grade count, active/inactive grade counts, classroom count, effective active/inactive classroom counts; expandable section names and grade rows with assigned section/status/classroom names; Manage Structure |
| Bell Time & Calendar | Year dates; per-owner-board default and advanced schedule counts, calendar-rule count, configured weekly off-day count; common working/holiday/half-day/working-week totals, provisional/mixed notices; Manage Bell Time and Open Calendar |
| Configuration & History | Published version, pending-change label, draft version, last published date, published warnings, latest 50 version summaries; Review Changes when draft exists, Open History, Open Review & History |

An “active classroom” in these board summaries means the classroom flag **and** parent grade flag are active. An inactive-classroom count is total minus this effective active count. Classroom Setup's own filtered active count uses only the classroom flag; these are not identical definitions.

Schedule/rule counts in School Details count records physically owned by that board in the revision, not the number of inherited applicable schedules for that board. A shared school-wide rule is stored once; another board can correctly inherit it while its owner-record count is zero.

### 5.3 School Details: quick actions

| State/action | Actual destination/effect |
| --- | --- |
| Start/Continue Configuration | Workspace; if there are no years, first-year empty state with creation action |
| Incomplete Active → Complete Missing Details | Edit intent; creates/returns to a draft before editing |
| Draft Changes Pending → Review Changes | Review & History school workspace |
| Continue Editing | Current working draft workspace |
| View Configuration | Read-only publication/current configuration |
| Manage Structure | Four-tab workspace for the same school/year |
| Edit Structure (ACTIVE) | Edit intent; requests draft creation if necessary |
| Configure Calendar | Calendar intent; shown when `hasCalendar` is false, enabled only with active school and a year |
| Manage Grades | Registration tab intent; shown when no grade exists, enabled only with year/active school |
| Manage Bell Time | Bell tab / default-schedule view |
| Open Calendar | Bell tab / monthly academic calendar |
| Open History | History intent; loads published history workflow |
| Request Changes | Existing protected registration-change request form |

`hasCalendar` means at least one schedule record exists and the computed calendar summary is not provisional. It is a heuristic, not an explicit completed-calendar checklist. With zero active classrooms, provisional can be false; schedule presence can therefore mark calendar availability without demonstrating classroom coverage.

School identity stays read-only. Editing of academic records occurs only through Structure Management. Inactive-school editor/request controls are disabled and an explanation asks for Super Admin reactivation. No large school-details popup is used.

## 6. Structure Management Dashboard

The sidebar opens `ClientPortal` in directory mode, not the first/last school's editor. Header: Structure Management and a description of structures, classrooms, bells and calendars.

Four metrics use the same represented-year dataset: total schools, schools with active structures (publication pointer), schools not configured (NOT_STARTED/DRAFT), pending draft changes (both pointers). Clicking a metric changes the visible status filter. Directory search, board, account status, structure status, sort and pagination remain available.

Primary action mapping is the same `structureAction` table in section 4. Incomplete completion uses edit intent; Active has Open Configuration and an additional Edit Structure; Pending Draft has Review Changes and Continue Editing. Explicit Open School goes to details. Inactive account configuration buttons are disabled.

The selected school's workspace retrieves `/institutions/:id/years`, retains a valid previously selected year or uses `operationalYear`, then retrieves `/years/:id/config`. It does not require a repeated year-selection dialog. A no-year school gets a Create academic year empty state.

Workspace header: school name, back-to-dashboard, Manage academic years, Academic year creation, History, year selector, configuration badge, save state, Save draft, Review & activate/publish or Edit configuration/Return to working draft. Review controls are available in the top toolbar; publication is inside the review workflow, not a separate unconditional header button. Existing published data is not made editable just because it was opened.

## 7. Academic-Year Management

**Sources:** YEAR `AcademicYearForm`; WS `loadYears`, `load`; SVC `years`, `createYear`, `draft`; D `emptyConfig`, `copyYear`; P `operationalYear`.

- Academic Years is not a main client sidebar module. Manage academic years toggles an in-school table of year label/start/end/configuration status/Open year.
- Creation form has Academic year label, Start date, End date; Starting configuration select offers Start fresh and Copy <existing year>.
- Copy preview loads the source publication when present, otherwise the source draft. It shows board/section/grade/classroom counts, reusable bell/calendar counts and excluded fixed-date/date-limited rules.
- Backend requires a nonempty trimmed label (<=300 characters), valid real ISO dates, end strictly after start and a date difference <=550 days. Because iteration is inclusive, a maximum-span year can contain **551 dates**. Same-day years are rejected. Labels are unique per school; date overlaps are not prohibited.
- New year gets a sequence-1 DRAFT revision; empty registered board records and Sunday weekly closure are initialized for a fresh setup.
- Copy source must belong to the same authorized school. Copy prefers published over draft. It deep-copies structure, names, active flags, section assignments, logical IDs, weekly off-days and reusable schedules/events.
- `copyYear` omits all `rule.type="date"` schedules/events and all rules with startsOn/endsOn. Other recurrence fields, including anchorDate, are retained and require review; there is no automatic anchor-year rebasing.
- New affiliations absent from a copied/restored snapshot are appended as empty boards. Physical snapshot row IDs are newly generated; logical entity keys remain stable across copied years.
- Copy is subject to the same organization classroom-addition checks. Because school usage is a maximum across years, copying the same size normally does not double-count that school's reservation.
- Existing years have selection/history access; no client year rename/delete/date-edit feature or corresponding route was found.
- Year creation is transactional with organization and institution locks; audit action `academic-year.created`. The returned year is then reloaded through normal workspace APIs.

## 8. School Registration

**Sources:** WS registration rendering, `patchGrade`, grade form; REQ; BUILD `BulkGrades`; B grade helpers; PR and PRESET-UI; SVC `saveConfig`, `saveInstitution`, `resolveRequest`.

### 8.1 Identity and board ownership

Displayed identity comes from Institution: name, registration, officer, phone, email, address, logo and registered boards. These are not academic-revision identity fields. They remain read-only in the client workspace. Officer is a string property, not a separate officer account or staff relationship. Request a change opens the same approval workflow as School Details, including officer changes.

The school can have 1–20 case-insensitively unique board affiliations. Board pills switch the editing context across all four tabs. Clients do not directly add/remove registration affiliations; they request changes. A configuration save requires its board-name set to match the registered affiliations. Within draft records, logical entity ownership is validated.

Super Admin identity updates append missing boards to existing drafts and increment their locks; publications remain unchanged. Approved registration requests update identity through `resolveRequest`, which does not execute that same draft-sync loop. The frontend draft loader can append missing registered boards and autosave them. Removal of any registered board is blocked once the school has any academic years, not merely when that particular board contains grades.

### 8.2 Grade operations

- Single Add grade: name and Active/Inactive; new UUID, null section assignment, empty classroom list.
- Grade table: grade name, academic section or Unassigned, status, classroom count, edit/delete actions; search, filters, sorting and pagination from DataTable.
- Rename/status inline cells commit on blur/Enter; Escape discards the inline edit. Local blank/duplicate checks, then draft autosave. Explicit grade editor supports the same fields.
- Active/inactive bulk actions work on filtered selected grades; deactivation asks confirmation. Grade deactivation suppresses effective schedules for its classrooms but does not delete or unlicense them.
- Bulk Add: Grade range (1–30), Select grades from board-oriented name options, Custom names one per line. Preview deduplicates case-insensitively, skips existing/repeated names, permits removing suggestions and choosing active status. At most 100 accepted grade names per operation. Range generation uses “Grade N” even for boards whose selectable name suggestions use Year N.
- Names are trimmed 1–100 characters in the domain schema; case-insensitive uniqueness per board is enforced by review/local checks. Same names in different boards are allowed. PostgreSQL's own string unique index is case-sensitive; application validation supplies the case-insensitive rule.
- Grade deletion shows dependent classrooms, affected scoped rules and impact counts, requires typing the exact grade name, then removes the grade/classrooms from the working draft and prunes targets throughout the revision. A multi-target rule is narrowed; a targeted rule with no remaining IDs is removed. Publications are preserved.
- There is no independent grade API; accepted edits submit the complete configuration through the draft-save service.

### 8.3 Suggested structures and board isolation

Apply Suggested Structure is available in School Registration and Academic Sections. Customize Manually hides the suggestion strip for the current board until reopened in that component session. Suggestions come from validated platform JSON, not inline frontend structure constants.

Default catalogues: CBSE; ICSE/CISCE; ISC; IB; Cambridge/IGCSE/CAIE; state/SSC; HSC. They contain editable early-years and numbered grade suggestions mapped to suggested academic sections. Exact alias matching ignores capitalization/outer whitespace. An unrecognized board shows a no-preset state rather than inventing one.

Preset workflow: choose matching preset → edit/remove/add section suggestions → edit/remove/add grade suggestions → choose new-grade active status → optionally update reused-grade section assignments → Preview impact → Confirm and apply to this board. Grade preview is paginated 12 rows. Existing matching section/grade names are reused case-insensitively. Existing grade UUIDs, names, statuses and classrooms survive; existing section assignment changes only if `assignExisting=true`. Omitted suggestions never delete existing records. Selected-board-only behavior is explicit in `applyAcademicPreset` and tested.

Super Admin can manage the catalogue through platform settings; organization clients can consume/customize a plan but do not own global definitions. A board preset can have zero sections with unassigned grades; selected grades cannot point to a nonexistent suggested/existing section.

## 9. Academic Sections

**Sources:** SEC `SectionAssignments`; WS section form; I `assignGrades`, `configurationImpact`; D `removeFromConfig`; SVC draft save.

The global board selector supplies this tab's board. A compact picker lists Unassigned grades and each section with grade count. The selected section shows its grade rows, current section, status, classroom count and a per-row assignment select. The tab reports selected grade/classroom counts.

- Add section: name only, generated UUID. Rename: same UUID, trimmed name. Names must be nonempty, <=100 characters, case-insensitively unique within this board. No section active/inactive flag exists.
- Add grades mode shows grades not currently in that section; checkbox selection supports one/many/all filtered rows. Assign selected grades creates an impact preview before confirmation.
- Outside add mode, choose a destination section or Unassigned, then Move selected grades; Unassign selected grades is also available. A grade has one nullable sectionId, so moving replaces the previous assignment.
- `assignGrades` rejects a destination section or grade IDs outside the current board. Permanent grade ownership does not change.
- Pending assignment captures serialized board state. Confirmation refuses to apply if that board changed while the preview was open. Confirmation updates the local working config; normal one-second autosave persists it.
- Undo assignment restores assignments from the previous local snapshot for surviving grades/sections, preserving other current grade fields. It is one local undo level, not a historical-version rollback.
- Deleting a section requires typed confirmation and impact preview; grades become unassigned, classrooms survive, section-scoped targets are pruned across all boards. A remaining group target is retained; no-target rules are removed.
- Moving a grade does not rewrite every bell rule. Effective resolution subsequently uses its new sectionId: old section rules cease to apply to that grade, new section rules can apply, while grade/classroom rules retain their more-specific identities.
- Board-specific suggested sections are provided through the shared preset workflow, not a separate hardcoded tab-only generator.

## 10. Classroom Setup

**Sources:** WS classroom filtering/counts/patching; BUILD `ClassroomBuilder`; B classroom helpers; LIC; I impact; D deletion/count helpers.

The board selector is common to the workspace. Section filter supports All sections, Unassigned grades and specific sections; grade filter narrows accordingly. The compact table shows classroom, parent grade, section, classroom flag status and edit/delete actions. A grade belongs to one board and classroom to one grade. No physical room inventory exists.

### 10.1 Creation and editing

- Add classroom uses the same editable-preview builder in single mode: pick one grade, choose status, generate one name, customize, save.
- Add multiple classrooms permits one grade or Every grade, a common count 1–100 **per grade**, active/inactive flag, generated editable preview, removing rows and pagination in groups of 10.
- Default names are exact `grade.name + alphabeticSuffix`: A…Z, AA, AB, etc. For grade “Grade 3”, names are “Grade 3A”, “Grade 3B”… . Generation scans all existing names in the board, including inactive classrooms, and skips collisions; requested count is still produced for each selected grade.
- Custom names must be trimmed 1–100 characters, unique case-insensitively across the entire board and across the preview, and refer to existing grades. Cross-board equal names are allowed.
- Builder rejects a generated/accepted count above its displayed available slots. The backend rechecks the authoritative license inside the save transaction.
- Inline rename/status and explicit edit form exist. Bulk activate/deactivate operate on filtered selected records. Despite legacy `bulkAction` being passed too, DataTable prioritizes the explicit activate/deactivate actions when those exist; the fallback toggle is not the effective menu in this tab.
- Classroom status flags do not change the parent grade or delete records. Inactive classrooms and those under inactive grades still consume licensing allowance.

### 10.2 Counts, deletion and revisions

The filter bar counts matching classrooms and their classroom flag active/inactive totals. The table includes per-grade/section names. Summary strips show all current-board grade classroom counts and section classroom sums. Review shows school-wide total classrooms; School Details shows per-board and school aggregates. Licensing banner shows organization used/reserved, allowance and remaining.

Deletion requires exact-name confirmation and shows impact on parent grade/section/inherited rules. It removes only that logical classroom and target references; siblings remain. Grade deletion removes all its classrooms. A draft deletion does not immediately reduce the published reservation: publication must reduce that year's maximum, and another year may continue to determine the school's reserved maximum.

UI usage is optimistic. Let O = fetched organization usage, S = fetched selected-school reservation, Y = maximum other-year reservation, P = current publication count, D = local draft count. The displayed draft usage is `O - S + max(Y, max(P,D))`. Published viewing uses O directly. The builder's availability uses `max(0, limit - (O-S) - D)` only with a unique valid contract, no conflict and not already over-limit. This is a planning allowance, not a replacement for backend enforcement.

## 11. Default Bell Schedule

**Sources:** CAL Default Bell Time view; WIZ `ScheduleWizard`; D `scheduleSchema`, `slotSchema`, `autoAssign`, `validateSlots`; E `scheduleDiagnostics`; WS schedule-save handler; SVC `saveConfig`, `publish`.

### 11.1 Stored representation and visible controls

A Schedule contains logical id, name (1–100 characters), arrival, dispersal, full/half dayType, target, rule and slots. Each slot has UUID, name (1–80 characters), kind period/routine, integer start/end minutes. Database schedules store target/rule/slots as JSON. Period count, default-duration input and comma-separated duration plan are generator UI state; there are no separate persisted columns for them.

Default view shows default-rule schedules, five cards per page, timing diagnostics, owner/target rule labels, arrival–dispersal, proportional slot timeline, Edit and Delete. A default schedule can target the entire school, a board or selected targets; there is not a single compulsory global template column.

### 11.2 Five-step schedule editor

| Step | Inputs/actions and actual rules |
| --- | --- |
| Select scope | Schedule name, scope, searched target checkboxes; default rules hide ordinary recurrence inputs but offer advanced date settings; new schedules default to school scope |
| Day timings | Arrival/dispersal, Full day/Half-day, 1–30 planned teaching periods, positive default minutes, optional comma-separated individual durations; shows day minutes/planned teaching minutes |
| Fixed routines | Assembly, Lunch, Breakfast, Break, Other routine; add, rename, type, start/end and remove; verifies positive, in-day and nonoverlapping routines before progressing |
| Configure periods | Auto Assign, manual add, change timings; editable names/types/start/end for all slots; highlights implicated slots and shows corrective diagnostics |
| Preview & save | Sorted read-only slot preview, target/rule/day-type summary, matching dates for exceptions, exact-fit or draft-warning notice; Save schedule to draft |

New defaults are arrival 08:00 and dispersal 14:30, seven 45-minute periods, no slots. New half-day suggestions use dispersal 12:00. Editing an existing schedule starts at step 4 (zero-based step 3), with count from its period slots and default duration from its first teaching slot. Existing individual slot times remain until edited or regenerated. The comma-duration plan is not reconstructed from every existing period automatically.

Fixed routines are anchors for Auto Assign. Existing routines, and routines after generation/type conversion, are tracked by an editor-local anchored-ID set. Moving/changing/removing an anchored routine asks a native confirmation. Adding a routine initially places it at arrival for up to 15 minutes; the administrator must position it appropriately. Anchoring is editor behavior plus fixed start/end values, not a persisted immutable-routine flag.

### 11.3 Exact Auto Assign algorithm

All calculations use integer minutes from midnight; no date/timezone arithmetic is needed for the daily template.

1. Reject dispersal <= arrival or a nonpositive/noninteger requested period duration.
2. Sort fixed routines by start.
3. Reject routines that overlap each other, start before the preceding routine/end of day constraints, have nonpositive duration or end after dispersal.
4. Initialize cursor = arrival and next period index = 0.
5. Visit each routine, followed by an artificial zero-length End anchor at dispersal.
6. While cursor is before the next anchor and periods remain, attempt the **next duration in the supplied order**. If it crosses the anchor start, throw an error. Otherwise place the period at cursor, advance cursor by its duration, increment the index.
7. Cursor must equal that anchor's start; otherwise the gap is uncovered and generation fails.
8. Emit a real routine unchanged and move cursor to its end.
9. After End, all requested periods must have been placed; otherwise the teaching requirement exceeds the day.

It is a deterministic sequential packing algorithm. It does not split a period around lunch, reorder durations, infer the period count from remaining time, shorten periods, move routines or search for alternative packing solutions.

### 11.4 Actual tested mathematical example

`tests/domain.test.ts`, “positions teaching periods around anchored routines with complete coverage,” calls:

```text
arrival = 480 (08:00)
dispersal = 750 (12:30)
durations = [60, 60, 60, 60]
fixed Lunch = [600, 630] (10:00–10:30)
```

Day length = 750 − 480 = **270 minutes**. Routine time = 30. Teaching time = 4 × 60 = **240 minutes**. Residual = 270 − 30 − 240 = **0**.

| Output | Start | End | Minutes |
| --- | --- | --- | --- |
| Period 1 | 08:00 (480) | 09:00 (540) | 60 |
| Period 2 | 09:00 (540) | 10:00 (600) | 60 |
| Lunch | 10:00 (600) | 10:30 (630) | 30 |
| Period 3 | 10:30 (630) | 11:30 (690) | 60 |
| Period 4 | 11:30 (690) | 12:30 (750) | 60 |

The test asserts starts `[480,540,600,630,690]` and no validation errors. This example is source-backed by an actual unit-test fixture, not a proposed design.

Equal totals are necessary but insufficient. For an 08:00–11:00 day, three 50-minute periods and a 09:00–09:30 lunch sum to 180 minutes, yet the first pre-lunch gap is 60 minutes. Period 1 ends at 08:50; period 2 would cross lunch. The current algorithm rejects this rather than splitting or rebalancing periods.

### 11.5 Manual schedules, draft acceptance and publication blocking

Manual add appends a teaching slot after the latest existing end, bounded by the day's input time limits; it does not automatically guarantee placement inside dispersal. Slot editing can create gaps, overlap, out-of-day values or invalid duration, which diagnostics display. The save handler sorts slots chronologically.

`validateSlots` checks:

- dispersal strictly after arrival;
- stored slot order chronological;
- each end > start;
- no start before the running end of previous slots;
- no uncovered interval before a slot;
- all slots inside arrival/dispersal;
- final cursor equals dispersal exactly.

The Zod shape separately constrains arrival/start to 0–1439, dispersal/end to 1–1440, integers, slot names and at most 100 slots. Input `type=time` controls do not independently guarantee these server constraints.

Draft save validates schema and references, but deliberately filters temporal errors out of the blocking reference check. A structurally valid schedule with empty slots, gaps or overlaps can be saved as a draft. The wizard explicitly warns that it must be corrected before publication. A negative/out-of-schema timestamp, bad UUID or missing required name is not simply a permitted timing warning.

Publication reviews every stored schedule with `validateSlots`, even if it is unused, outside the year or targets inactive rooms; invalid template timings are blocking errors. It also resolves active-date applicability across the full year to detect schedule conflicts/invalid days. A missing schedule produces a warning instead of a timing-error block. Therefore “no schedules at all” can publish incomplete, whereas “an existing but invalid schedule” is blocked.

There is no overnight bell-template model, fractional-minute durations or automated timetable/subject allocator in this module.

## 12. Advanced Bell Scheduling

**Sources:** CAL Advanced Scheduling; SCOPE `ScopeRule`; WIZ; WS `EventEditor`; D `targetRank`, `ranked`, `applicableRules`, `matches`, `resolve`, `review`.

### 12.1 What an advanced rule changes

The table combines nondefault Schedule records and calendar events, with Rule name, Who, When, What happens, Status, Edit/Delete. Add rule choices: Different bell schedule, Half-day schedule, Full holiday, Special working day. These open the existing schedule wizard or event editor, prefilled with recurring second-Saturday defaults where appropriate.

A Schedule rule replaces the entire applicable day template: arrival, dispersal, dayType and full slots array. It does not override just one period, merge a different lunch into a base, or inherit unspecified fields at runtime. A Working event changes calendar-day eligibility; it does not supply a new bell template. A Half-day event requires an applicable half-day template under the conditions below.

### 12.2 Targets and inheritance

| Target scope | IDs/source | Rank contribution |
| --- | --- | --- |
| school | Entire school, no IDs required | 1 |
| board | Owner/current board | 2 |
| boards | Selected board logical IDs | 2 if current board selected |
| section / sections | Grade's current sectionId must be selected | 3 |
| grade / grades | Parent grade ID selected | 4 |
| classroom / classrooms | Classroom ID selected | 5 |

Current UI offers school, current board, selected boards, selected sections, selected grades and selected classrooms; it also preserves legacy singular section/grade/classroom modes when editing such records. Searchable checkbox lists permit multiple IDs. Plural group scopes may span different boards **inside the same school revision**. Singular legacy scopes are validated against the owner board. Empty non-school/non-board targets and foreign references are invalid.

`applicableRules` takes owner-board rules plus rules from other boards whose scope is in `{school,boards,sections,grades,classrooms}`. Shared rules are stored once on an owning board. `targetRank` then establishes actual applicability for a classroom. School-wide defaults can therefore apply across independently configured boards without duplication.

### 12.3 Date matching and precedence

The recurrence matcher supports:

- default: every date, subject to any bounds;
- weekly: selected UTC weekdays;
- recurring: selected weekdays, optional nth occurrence and interval weeks;
- date: one exact ISO date;
- optional inclusive startsOn/endsOn limits;
- nth = 1…5 via `ceil(dayOfMonth/7)`;
- intervalWeeks = 1…52, with required valid anchor for values >1.

A weekly/recurring rule must select at least one weekday. If an nth weekday does not exist in a month, no date matches; no replacement/nearest-day behavior occurs. Interval matching requires nonnegative day difference from anchor and `floor(dayDifference/7) % intervalWeeks == 0`. This is anchored seven-day blocks, not ISO week numbers. For interval 1, an anchor is not needed.

`rank = dateTypeRank × 10 + targetRank`, where default=0, weekly=1, recurring=2, date=3. **Date type wins before target specificity.** Thus a broad specific-date rule (31 for school) beats a classroom weekly rule (15), and recurring school (21) beats weekly classroom (15). An otherwise similar weekly rule is not treated as equal to a recurring rule with no nth restriction.

The top two applicable schedules with equal rank cause a conflict, even if their templates happen to contain identical times. Lower-ranked templates are not combined with the winner. There is no arbitrary manual priority field or separate last-edited-wins policy.

### 12.4 Worked overlapping-rule example

For CBSE / Grade 3 / classroom 3A on Monday **16 November 2026**:

| Rule | Temporal / target | Rank | Effect before holidays |
| --- | --- | --- | --- |
| School default | default / school | 1 | Base candidate |
| Board default | default / board | 2 | Beats school base |
| Section Mondays | weekly / section | 13 | Beats defaults |
| Classroom Mondays | weekly / classroom | 15 | Beats section weekly |
| Third Monday grade schedule | recurring nth 3 / grade | 24 | Beats classroom weekly |
| School special date | exact date / school | 31 | Final bell-template winner |

Now add a school recurring Monday full holiday: the date becomes a holiday and no teaching schedule is returned, even though the exact-date schedule has rank 31. Holiday suppression is a separate gate, not simply the schedule sort.

Add an explicit `working` event for the same date/current board, `overridesHoliday=true`: rank 32 is greater than the recurring school holiday's 21, so the date reopens and the rank-31 bell template can apply. The working event itself does not change that template.

If a specific-date classroom holiday (35) is present, it beats the reopening (32) and the date stays closed. A specific-date board holiday (32) tied with the board reopening (32) yields a conflict instead of reopening.

### 12.5 Holiday, working-day and half-day gates

`resolve` performs these operations in order:

1. Reject invalid ISO date or classroom not belonging to the supplied board.
2. If grade or classroom is inactive, return inactive with no schedule.
3. Collect ranked applicable events; choose the highest holiday and highest working event.
4. Equal-ranked holiday/working pair → conflict.
5. Any holiday wins unless the chosen working event is an explicit **specific-date** reopening and strictly outranks it.
6. Find highest half-day event and ranked bell templates.
7. A weekly nonworking day returns non-working unless there is a working event, half-day event, or highest-ranked **nondefault half-day schedule**.
8. No template → missing.
9. Top schedule rank tie → conflict.
10. Invalid selected template timings → invalid.
11. When a half-day event is not superseded by a more-specific working event, the selected template must be half-day and at least the event's rank; otherwise invalid.
12. Return working with the complete chosen template and descriptive reason; calendar presentation converts a working half template to “half-day.”

Consequences:

- A normal full-day bell exception alone does **not** reopen a weekly off-day.
- A nondefault half-day bell schedule can itself open that weekly off-day; a default half template alone cannot.
- A normal working event can open a weekly off-day, but cannot defeat a full holiday without explicit reopening authorization.
- The reopening checkbox requires a confirmation and `kind=working`, `rule.type=date`. This is an explicit operation by the authenticated administrator, not a separate Super Admin approval request.
- Two same-kind holiday/working events are not universally rejected as duplicates. The resolver chooses the first highest-ranked candidate; review additionally checks opposing event kinds. Tied same-kind working events with different reopening flags are not comprehensively tested.
- If a half-day event has no applicable template at all, the earlier missing-template return occurs before the half-day consistency check. It becomes a missing-schedule warning, not necessarily a blocking half-day error. If a full-day template exists instead, the mismatch is invalid and blocks publication.

## 13. Academic Calendar

**Sources:** CAL `BellCalendar`; WS `EventEditor`; SCOPE; D matcher/resolver/review; E `calendarDay`, `calendarSummary`; SVC `preview`, `calendarSummary`, `rulePreview`.

### 13.1 Calendar views and controls

Bell Time & Calendar has exactly three top-level internal views: Default Bell Schedule, Advanced Scheduling, Academic Calendar. Academic Calendar has Monthly calendar, Classroom date preview, Year summary.

- Target filter disclosure: academic section, grade, classroom, Clear target filters. Calendar filtering does not offer the classroom tab's explicit “Unassigned grades” option, although selecting those grades/rooms individually works.
- Weekly non-working days: seven buttons on the selected board; Sunday is initially selected. Changes affect the current board's working draft and autosave. There is no single separately persisted organization calendar.
- Month selector is bounded to year-start/end months. Grid includes offsets for Sunday-first layout; out-of-year dates are disabled. Resolved day list is the alternative table view.
- Clicking a date/list detail sets preview date and shows effective classroom schedules. Preview input is bounded to the year. Results paginate ten classrooms; a single-classroom preview expands by default and shows reason, full slot list, times, type and durations.
- Events & exceptions table includes name, kind, date-rule type/date, target-scope, Edit/Delete; a scope filter includes school, board/group and legacy scopes.
- Add calendar entry offers Holiday, Half-day, Special working day, opening the event editor with a specific date by default. Advanced Scheduling offers recurring versions.
- Event editor requires nonempty name (1–100), kind, scope/targets and a valid rule. Save goes to the working draft; name and reopening restrictions are schema-validated. Deletion uses impact plus exact-name confirmation.

### 13.2 Holidays, ranges and recurrence

A single-day holiday is an event with `kind=holiday`, `rule.type=date`, `date=YYYY-MM-DD`. Full holidays can target the school, owner board, selected boards, sections, grades or classrooms. Recurring holidays use the same matching function as schedules. Second/Fourth Saturday buttons prefill weekday 6 and nth 2/4. Fifth occurrences are skipped when absent.

There is no dedicated event `startDate/endDate` range model or “holiday from/to” form separate from recurrence. The implemented bounded recurring/weekly rule supports startsOn/endsOn. Selecting all seven weekdays with inclusive bounds represents every day in a continuous holiday interval. Selecting fewer weekdays represents only those weekday dates within that interval. This is a supported composition, not a separate holiday-range UI.

Pattern preview uses POST `/years/:id/rule-preview`, debounced 200ms, and displays matching dates in pages of 12. It validates the pattern and uses the stored year's range. It previews pattern matches, not full effective-classroom outcomes after conflicting rules or holidays.

`whenLabel`/event table summaries do not display all stored recurrence range/anchor details. The full editor retains them; reading only the compact table may not reveal the bounds.

### 13.3 Effective previews and working-day exceptions

The frontend posts the current unsaved config, selected board, target filters and the union of current-month dates plus selected preview date. The service accepts 1–32 dates, verifies real dates, within-year boundaries, registered board names and board presence, and uses the centralized `calendarDay` resolver. The monthly grid and individual preview therefore use the same domain engine as publication, rather than a separate frontend calendar calculation.

Preview requests debounce 200ms; summary requests debounce 350ms. Effects run for the BellCalendar component even when some subviews are not visible. They can therefore compute summaries before the user explicitly opens Year summary. UI cancellation ignores obsolete responses; it does not implement an AbortController for each network call.

A special working day is a working event. For weekly closures it removes the nonworking gate; a bell template must still be found. For a full holiday, only a higher-rank, explicitly authorized exact-date reopening can remove the holiday. Full holidays suppress half-day and ordinary bell schedules; equal-ranked opposing holiday/working rules conflict.

`calendarDay` returns per-classroom results and one aggregate status. It uses mixed when statuses differ, or explanatory multiple-schedule text when appropriate, instead of taking the first classroom as the school's answer. Inactive classrooms can appear as inactive in previews, whereas yearly summaries exclude inactive grade/classroom combinations.

### 13.4 Year summary and edge cases

Summary scope is either selected board plus section/grade/classroom filters, or entire school (which ignores those narrower target filters). It shows Working days, Full working days, Regular weekly working days, Holidays/nonworking, Half-days, observed Working days per week, Working weeks; per-classroom board/count/unresolved rows; provisional/mixed warnings. A full holiday list with reason is exposed in this UI only when exactly one classroom is summarized; otherwise it instructs selecting a classroom.

Edge cases:

- **Holiday on Sunday:** one date produces one closed result, not two deductions.
- **Duplicate holidays:** still one holiday date/count; one highest-ranked reason is selected rather than listing every overlapping cause.
- **Authorized reopened Sunday:** counts as working if no conflict/invalid schedule blocks it; if no schedule exists, it is provisional working/missing.
- **Different board calendars:** counts are computed per active classroom. Shared top-level counts appear only under the consensus conditions in section 14, rather than summing dates across boards.
- **No active classrooms:** common totals are null, rows empty, calendarDays remains known; no fabricated school working total is generated.
- **Half-day:** counts as one working date and one half-day, not 0.5 working date.
- **Invalid/conflicting day:** counted unresolved, not working or holiday.
- **Missing schedule:** counted working and unresolved; the UI warns that totals are provisional.

## 14. Mathematical Calculations & Rule Precedence

This section describes the exact implemented formulas. Time differences are in integer minutes; calendar loops use UTC dates and increments of 86,400,000 milliseconds.

### 14.1 Bell formulas

| Quantity | Implemented formula/source |
| --- | --- |
| School-day minutes | `dispersal - arrival`; WIZ, D `autoAssign` |
| Slot duration | `end - start`; WIZ/CAL/D |
| Planned uniform teaching | `periodCount * defaultDuration`; WIZ only |
| Planned variable teaching | Sum of comma-separated durations for display; generation parses each number and requires one duration per planned period |
| Routine minutes | Sum of positive fixed-routine end-start intervals |
| Exact aggregate residual | `dayMinutes - sum(periodDurations) - routineMinutes`; conceptually necessary, but actual algorithm validates each free gap sequentially |
| Overlap condition | Earlier interval start < later end and earlier end > later start; E diagnostics checks all previous slots, not just adjacent ones |
| Exact coverage | Sorted slots start at arrival; each next start equals running cursor; cursor ends at dispersal; D `validateSlots` |
| Effective schedule rank | `10*dateRank + targetRank`; D private `ranked` |

### 14.2 Recurrence formulas

```text
weekday = UTC day number, Sunday=0 ... Saturday=6
monthOccurrence = ceil(UTC day-of-month / 7)
dayDifference = floor((candidateUTC - anchorUTC) / 86,400,000)
intervalMatch = dayDifference >= 0
                and floor(dayDifference / 7) mod intervalWeeks == 0
boundsMatch = (no startsOn or date >= startsOn)
              and (no endsOn or date <= endsOn)
```

The nth number applies to each selected weekday's occurrence in its own month. For example, an nth=2 Saturday is any Saturday with day-of-month 8–14. Interval blocks are measured from the specified anchor, not Monday of that calendar week.

### 14.3 Calendar formulas, exactly as `E:calendarSummary`

For each active classroom whose grade is active, over inclusive date set D:

| Output | Exact computation |
| --- | --- |
| Calendar days N | `floor((Date.parse(end)-Date.parse(start))/86400000)+1` |
| Holidays H | Count dates whose `resolve.status` is holiday or non-working |
| Invalid/conflict dates I | Count dates whose status is invalid or conflict; contributes unresolved only |
| Missing dates M | Count dates with status missing; contributes both working and unresolved |
| Working days W | Count all remaining resolved dates, including ordinary working, half-template working and missing |
| Half-days F | Among working-counted dates, count `result.schedule?.dayType === "half"` |
| Full working days | `W - F`, including missing days as provisional full dates |
| Unresolved days | `I + M` |
| Regular weekly working days | `7 - size(new Set(board.nonWorkingDays))` |
| Working weeks | Number of Monday–Sunday week buckets with at least one working-counted date; partial year-boundary weeks included |
| Observed workingDaysPerWeek | For buckets containing all 7 in-range dates, return their common working-counted day count if at least one full week exists and all agree; otherwise null |
| Holiday list | Exactly one `{date, reason}` entry for each holiday/nonworking resolved date |

For valid active rows, `N = H + W + I`; unresolved is not an additional disjoint day category because M is already in W. Equivalently `W = N-H-I`. It is not always just N minus declared holidays, and the program does not subtract raw event counts.

Each date is iterated once and assigned one effective state. That is the deduplication mechanism; there is no independent Sunday-subtraction pass followed by holiday subtraction. A Sunday holiday is one closed date. Reopening causes the date to leave H and enter W, provided it does not become invalid/conflicting.

**Illustrative annual arithmetic (not a live database query):** 365 dates, 52 Sunday closures, 15 additional non-Sunday holidays, one accepted reopened Sunday, all remaining schedules valid → H=52+15−1=66, I=0, W=365−66=299. If five of those W dates use half-day templates, F=5 and fullWorkingDays=294. Equivalent full-day/working-week fractions are **not implemented**; F is not multiplied by 0.5.

### 14.4 Common totals versus mixed calendars

Top-level common workingDays/holidays/halfDays/workingWeeks/observed frequency/fullWorkingDays are returned only if all classroom rows have both the same requested numeric value **and the same JSON holidayDates list, including reasons**. Otherwise that field is null. The UI generally displays Varies (or a dash with no classrooms).

`regularWeeklyWorkingDays` has a separate numeric-only agreement check. `provisional` is true if any row has unresolvedDays >0. `mixed` is true only when there is more than one row and common workingDays is null. This is not an exhaustive comparison of every full-day/half-day pattern: equal W and equal holidayDates with different half-day counts can leave mixed=false while halfDays is null. Conversely different holiday reason text can make common totals null even when dates/counts agree. These are exact source semantics, not an assumed universal calendar equivalence test.

### 14.5 Dashboard and classroom licensing formulas

Let C(i,y,r) be the count of all Classroom rows in the publication/draft snapshot r of school i/year y, regardless of active flags.

```text
YearReservation(i,y) = max(PublishedCount(i,y), DraftCount(i,y))
SchoolReservation(i) = max(0, all YearReservation(i,y))
OrganizationUsage = sum over schools of SchoolReservation(i)
Remaining = max(0, ContractLimit - OrganizationUsage)
OverLimit = OrganizationUsage > ContractLimit
```

No historical revision outside current draft/publication pointers is counted. No full sum over academic years is used. This is a maximum-count model, not a union-of-ID model: if a 20-room publication and 20-room draft contain different IDs, reservation is still 20, not 40. Source: D `licensedUsage`, `organizationUtilization`; LIC `organizationUsage`.

### 14.6 Consolidated calculation and decision-rule inventory

This table separates implemented outputs from mathematically derivable values that are **not** dedicated persisted fields or UI metrics. A source reference to a validator does not imply that it returns every scalar formula listed.

| Calculation / Rule | Inputs | Formula / Logic | Source Function | Output | Edge Cases |
| --- | --- | --- | --- | --- | --- |
| Registered schools | Session organization and current identity statuses | Count own schools whose organization is ACTIVE and school not DELETION_PENDING | client-portal.ts:`schoolRows`, metrics SQL | integer total | Inactive schools included; no-year schools included |
| Configured/active structure metric | One represented year per school | Count non-null publication pointer | client-portal.ts metrics SQL | configured integer | INCOMPLETE_ACTIVE and pending drafts still have a publication |
| Setup required metric | Represented year/status | Count NOT_STARTED or DRAFT | client-portal.ts metrics SQL | inProgress integer | No publication; not every warning/pending state |
| Attention metric | Represented status | Count status other than ACTIVE | client-portal.ts metrics SQL | attention count / latest6 rows | Includes inactive school setup states, actions disabled |
| Pending changes label | Draft/publication pointers | Both present → DRAFT_CHANGES_PENDING | portal.ts:`structureStatus` | status string | Does not compare actual content; unchanged cloned draft still pending |
| Operational year | School years, selected ID, now | Own explicit year; else latest-starting current; else latest started; else earliest future | portal.ts:`operationalYear`; SQL lateral selector | one year or null | Overlapping current years allowed; foreign selected ID ignored |
| Grades per board | Board.grades | `grades.length` | client-portal.ts board projection; Structure grade table | integer | Includes inactive and empty grades |
| Sections per board | Board.sections | `sections.length` | client-portal.ts board projection | integer | Empty sections allowed; no section status flag |
| Grades per section | Current board and sectionId | Count grades with that sectionId | SectionAssignments picker | integer | One nullable section per grade |
| Unassigned grades | Current board grades | Count/filter `sectionId == null` | SectionAssignments; Classroom filters | rows/count | Warning on publication, not mandatory blocking assignment |
| Classroom count per grade | Grade.classrooms | `classrooms.length` | Structure; clientSchool projection | integer | Inactive classrooms included |
| Classrooms per section | Board grades and selected sectionId | Sum classroom lengths for matching grades | Structure summary strip | integer | Unassigned grades excluded from a named section sum |
| Classrooms per board | Board grades | Sum all grade classroom lengths | clientSchool projection; Structure rows | integer | Different boards may reuse names |
| Classrooms per school/config | All config boards/grades | Flat count of all classrooms | index.ts:`countClassrooms` | integer | No grade/room-active filter |
| Directory classroom count | Represented year pointers | Count rows under draft if present, else publication | client-portal.ts:`schoolRows` correlated count | classroomCount | Not organization reservation, not historical max |
| Classroom Setup active count | Filtered room rows | Count classroom.active true | Structure filter counts | integer | Does not additionally check grade.active |
| Details effective active count | Board grades and rooms | Include room only if grade.active and room.active | client-portal.ts:`clientSchool` | activeClassrooms | Inactive count is total minus this effective active count |
| Alphabetic classroom suffix | Increasing ordinal starting at1 | Excel-like A…Z,AA…; prepend exact grade name; skip existing lowercased board names | bulk.ts:`classroomPreview` | candidate names | Scans inactive names too; requested count still created per grade |
| Classroom naming uniqueness | Existing/current preview names | Trim, 1–100 chars, lowercased board-wide collision set | bulk.ts:`validateClassroomPreview`; index.ts:`review` | accept or error | SQL unique index alone is case-sensitive |
| Grade range | Integer from/to | Inclusive sequence from..to, constrained1–30 | bulk.ts:`gradeRange` | Grade N names | Not an affiliation-specific Year N prefix generator |
| Bulk grade acceptance | Existing names and candidates | Trim, skip blanks, skip seen lowercased values, max100 accepted | bulk.ts:`gradePreview` | accepted/skipped | Does not overwrite existing grade records |
| Preset matching/reuse | Board alias and selected suggestions | Case-insensitive alias lookup; reuse matching grade/section IDs; create missing | presets.ts:`presetsForBoard`, `applyAcademicPreset` | counts/proposed config | Existing assignment changes only with opt-in |
| School-day minutes | Dispersal and arrival | `dispersal-arrival` | ScheduleWizard; index.ts:`autoAssign` | integer minutes | Must be positive; no overnight template |
| Teaching minutes plan | Count/default or duration list | `count*duration` or sum parsed per-period durations | ScheduleWizard day timings/Auto Assign handler | displayed planned minutes | UI helper state, not a DB column |
| Routine minutes | Routine start/end intervals | Sum end-start for valid routines | index.ts:`autoAssign`, ScheduleWizard slots | derived total | No separate buffer kind/model |
| Allocated/remaining minutes | Persisted/planned period and routine slots | Derived `allocated=sum(period durations)+sum(routine durations)`; `remaining=dayMinutes-allocated` | Slot data and `autoAssign`/`validateSlots`; no dedicated allocation-total function | conceptual scalar, diagnostics | Buffers can only be represented as named routines; overlap can make raw sum misleading |
| Per-slot duration | Slot end/start | end-start | ScheduleWizard, BellCalendar | displayed minutes | Zero/negative rejected by timing validation |
| Free-gap packing | Cursor, next routine, ordered periods | Place next full duration only if end<=anchor.start; require cursor==anchor.start | index.ts:`autoAssign` | ordered slots or error | Total-fit equality insufficient; no split/reorder/resize |
| Overlap detection | Sorted intervals | Prior.start < current.end AND prior.end > current.start | enhancements.ts:`scheduleDiagnostics` | implicated IDs/messages | Checks all earlier slots, including nested overlap |
| Uncovered gap | Running max prior end and next start | If next.start>cursor, report difference | validateSlots / scheduleDiagnostics | error/diagnostic minutes | A routine is needed to cover intentional breaks |
| Exact-fit validation | Arrival/dispersal and all slots | Positive/in-bounds/chronological; no overlaps or gaps; final cursor==dispersal | index.ts:`validateSlots` | string error list | Also checks every stored schedule at publish, including unused |
| Full-template override | Applicable schedules | Choose one winning complete Schedule | index.ts:`resolve` | schedule object | No field-level merge from other templates |
| Scope specificity | Target and room's grade/section/board | school1, board(s)2, section(s)3, grade(s)4, classroom(s)5 | index.ts:`targetRank` | rank or0 | Section changes alter inheritance without changing grade IDs |
| Date priority | Rule.type | default0, weekly1, recurring2, date3 | index.ts:`dateRank`, `ranked` | numeric base | Recurring without nth still outranks weekly |
| Combined priority | Applicable date and target | `10*dateRank+targetRank` | index.ts:`ranked` | sorted candidates | Exact-date school31 beats weekly classroom15 |
| Equal schedule priority | Two top applicable templates | If equal rank, conflict instead of winner | index.ts:`resolve` | conflict/no schedule | Even identical timings do not resolve the ambiguity |
| Weekday matching | Candidate UTC date, weekdays | weekday included | index.ts:`matches` | boolean | Sunday0; multiple weekdays permitted |
| Nth occurrence | UTC day of month | `ceil(day/7)==nth` | index.ts:`matches` | boolean | Missing fifth weekday produces no match |
| N-week cycle | Date, anchor, N | Nonnegative day diff; `floor(diff/7) % N == 0` | index.ts:`matches` | boolean | Anchor-relative blocks, not ISO week numbers |
| Date bounds | ISO date and optional startsOn/endsOn | Inclusive lower/upper bounds | ruleSchema / matches | valid/matched dates | UI bounds under weekly/recurring; matcher applies stored bounds before rule type |
| Calendar-day span | Year start/end | `floor((end-start)/86400000)+1` | enhancements.ts:`calendarSummary` | calendarDays | Cross-year/leap dates handled by UTC enumeration; maximum accepted difference550 allows551 dates |
| Full holiday priority | Highest holiday/working events | Holiday wins unless authorized exact-date working strictly higher; tie conflicts | index.ts:`resolve` | holiday/working eligibility/conflict | A bell schedule's numeric rank alone never defeats a holiday |
| Weekly closure | Board.nonWorkingDays and date | Closed unless working event, half event or highest nondefault half template applies | index.ts:`resolve` | non-working or continued resolution | Full-day schedule override alone does not reopen |
| Explicit full-holiday reopening | Working kind, date type, overridesHoliday and rank | Require flag+specific date; strictly outrank holiday | eventSchema / resolve | reopened eligibility | Same-rank holiday remains conflict; template still required for valid schedule |
| Half-day match | Half event, working event, selected template | Unless higher working event supersedes, template must be half and rank>=half event | index.ts:`resolve` | working-half or invalid | Missing template returns missing before this check |
| Inactive classroom/grade | Active flags | Either false → inactive before schedule selection | index.ts:`resolve` | inactive/no schedule | Licensing continues to count it; year summaries exclude it |
| Group day status | Per-room resolved states/templates | One status if all agree, else mixed; label explains multiple schedules | enhancements.ts:`calendarDay` | status/label/results | Not the same algorithm as yearly mixed flag |
| Unique closed dates | Effective per-room/date outcomes | Count each date once when holiday/non-working | enhancements.ts:`calendarSummary` | holidays/list | Sunday+public holiday and duplicate holidays are not double-counted |
| Working dates | Date states | N minus closed dates minus invalid/conflict dates | calendarSummary | W | Missing counts working and unresolved |
| Half-days | Counted working outcomes | Count selected template.dayType==half | calendarSummary | F | Counts full dates, not0.5 equivalents |
| Full working days | W and F | W-F | calendarSummary | fullWorkingDays | Includes missing-template dates provisionally |
| Unresolved | Invalid/conflict plus missing | I+M | calendarSummary | unresolvedDays | Not disjoint from W because M is also counted working |
| Configured working weekdays | Board weekly closures | 7 minus unique closure weekday count | calendarSummary | regularWeeklyWorkingDays | Exceptions do not change this configured weekly baseline |
| Observed weekly frequency | Monday–Sunday buckets with7 in-year dates | Common working count if all complete buckets agree, else null | calendarSummary | workingDaysPerWeek | Partial buckets excluded for this frequency only |
| Working weeks | Monday–Sunday date buckets | Count buckets with >=1 counted working date | calendarSummary | workingWeeks | Partial boundary weeks included; not W/divisor |
| Common classroom totals | Numeric totals and holidayDates JSON | Same number AND same holiday date/reason list for all rooms, else null | calendarSummary private `same` | common total / null | Reason-text differences can suppress otherwise equal totals |
| Provisional totals | All row unresolved counts | Any unresolvedDays>0 | calendarSummary | boolean provisional | Missing and invalid/conflicting days all contribute |
| Yearly mixed flag | >1 row and common workingDays | mixed = rows>1 AND commonW==null | calendarSummary | boolean mixed | Reproduced half-only variation gives false |
| Year reservation | Draft/publication counts | max(P,D) | index.ts:`licensedUsage`; licensing.ts:`organizationUsage` | reserved count | Count maximum, not union of logical room IDs |
| School reservation | Current year reservations | max over years, with0 fallback | index.ts:`organizationUtilization` | school.used | Multiple historical/operational year counts not summed |
| Organization usage | All school reservations | Sum school.used | organizationUtilization / organizationUsage | organization.used | Inactive/pending-deletion schools included until purge |
| Contract remaining/overage | Limit and usage | max(0,limit-used); overLimit=used>limit | organizationUsage | remaining/overLimit | No unique current active contract gives effective limit0 |
| Frontend optimistic usage | Fetched O/S, other-year Y, publication P, local draft D | O-S+max(Y,max(P,D)) | Structure usage expressions | displayedUsage | Read-only publication view uses fetched O |
| Builder capacity | Limit L, fetched O/S, local draft D | max(0,L-(O-S)-D), only with unique valid nonconflicting non-over-limit contract | Structure `availableClassrooms` | editable-preview allowance | Authoritative backend check still required |
| New-room detection | Previous and proposed logical classroom IDs | Any proposed ID absent from previous → addition | licensing.ts:`assertClassroomChange` | addition gate | Name/status changes alone are not additions |
| Addition authorization | New IDs, active contract, proposed usage | Require one active contract and proposed used<=classroomLimit | assertClassroomChange / activeContract | permit or400/409 | Edits/reductions bypass new-room gate after expiry/reduction |
| Publication readiness | Schema, references, slots, effective dates, identity, contract | Blocking errors reject; warnings permit INCOMPLETE_ACTIVE | index.ts:`review`; AppService.review/publish | issues and active/incomplete status | Empty grades/sections/zero active rooms allowed; logo required |
| Already over-limit publication | Existing reserved usage versus reduced active contract | Add warning, allow if no other blocking errors | AppService.publish | incomplete-active warning | Not a universal reject-all-overage policy |
| Draft stale check | Current revision.lock and optional revisionId | Equal lock required; supplied revision ID must match current draft | AppService.saveConfig/publish/discard | success or409 | Old API callers may omit revisionId |
| Concurrent license write | Organization/year record lock | Serialize under Organization first, then relevant year/school locks | lockOrganization; service mutations | transaction ordering | Protects additions across different schools; no automatic merges |
| Change detection | Published/current config flattened by logical ID | Canonical object-key comparison; changed fields/added/removed records | enhancements.ts:`configurationChanges` | diff array | Independent record ordering ignored; meaningful arrays remain ordered |
| Dependency impact | Diff plus ancestors/descendants/scopes | Collect affected IDs and potentially inherited rules; count actual record changes separately | impact.ts:`configurationImpact` | impact object | Not a recomputation of changed dates; room deletion excludes siblings |
| Password complexity | New password string | Length12–128, ASCII upper/lower/digit and one character outside ASCII alphanumeric | service.ts:`passwordSchema` | accept/error | “Symbol” regex includes whitespace/non-ASCII characters; must differ from verified current password |
| Login attempt limiter | IP, failed/attempt counter and15-minute window | Reject when stored count>=10 before next attempt; success clears entry | main.ts:`login` | success/429 | Process-local, not a shared persistent rate service |
| School recovery | Delete timestamp | Due=now+60*86400000; restore only before due | deletionDue / institutionAction | pending/recovered/purged | legalHold stops purge; client cannot invoke lifecycle mutation |

### 14.7 Calendar edge-case checklist

| Case requested in attachment | Current result / source |
| --- | --- |
| Holiday falling on Sunday | One effective closed date, counted once; calendarSummary |
| Two holidays on same date | One closed count; selected reason from ranked event; same-kind duplicate events not universally rejected |
| Second Saturday also a public holiday | A full holiday suppresses its half template/event, one holiday count; resolve |
| Half-day on otherwise off date | Half event or nondefault half template can open weekly closure; matching template rules still apply; full holiday has separate priority |
| Special reopening | Exact-date working + explicit flag must outrank full holiday; ordinary working may reopen weekly off without full-holiday authorization |
| Different board calendars | Per-classroom rows, common totals only under consensus checks; no school-wide sum of overlapping dates |
| Different grade calendars | Grade target rank affects chosen full/half template/events independently per room |
| Missing fifth Saturday | No date match, no substitution; ceil(day/7) test |
| Holiday spanning dates | Bounded weekly/recurring rule with all desired weekdays; no separate from/to holiday form |
| Academic year crossing calendar years | Inclusive UTC date enumeration and actual monthly nth occurrences continue through New Year; no calendar-year reset of recurrence anchors |


## 15. Draft, Review, Publish & History

### 15.1 Actual lifecycle

1. Create a year: create AcademicYear, DRAFT Revision sequence 1 and normalized board/structure rows, set draftRevisionId.
2. Edit a draft: local `Structure.change` increments a client change sequence and marks unsaved.
3. Autosave: after 1 second without a reset from new config changes, `persist` submits the complete config plus revisionId/lock. Bulk builders, schedule/event editors and preset apply use immediate accepted-config commits. Editor typing is not all immediately persisted until committed to the parent.
4. Review: ensure pending changes saved; GET `/years/:id/review`; display field diff, counts, dependency impact, errors/warnings and publication summary form.
5. Validate/publish: POST `/years/:id/publish`; backend re-reads under locks and reruns full review. No persistent separate “review approved” token/model is required before calling publish.
6. Finalize revision status ACTIVE or INCOMPLETE_ACTIVE, save summary/warnings/publishedAt, change published pointer and clear draft pointer atomically.
7. Active configuration remains read-only until Edit configuration creates a new draft or returns to an existing one.
8. History lists non-DRAFT revisions. Restore creates a new sequence-numbered DRAFT, leaving source and active publication intact. It still needs ordinary validation/publication.

### 15.2 Draft storage and immutability

`STORE:writeConfig` first verifies DRAFT status, deletes that revision's board child snapshots, then reconstructs normalized board/section/grade/classroom/schedule/event rows in the caller's transaction. Cascade relationships clean old child rows. New physical row IDs are generated; permanent logical keys are retained in boardKey/entityKey.

Published records are never modified through this storage method. The academic year has separate publication/draft pointers, and reading a historical revision verifies it belongs to the authorized year. Identity is outside the revision: changing a school name/officer changes its current identity, not a historical identity snapshot.

### 15.3 Review comparison and impact

`configurationChanges` flattens records by entity kind and permanent ID. Compared values include board name/nonWorkingDays, section name/board, grade name/status/section name/board, classroom name/status/parent grade name+ID/board, complete bell fields/slots/rule/target, event kind/reopening/rule/target. Canonical object-key ordering avoids false changes from reordered object keys; order in semantic arrays such as slots/target IDs remains meaningful. Independent entity-list order is not itself a change.

`ChangeReview` filters All/Added/Updated/Deleted, shows before/after field values, resolves names for IDs and formats timing minutes. Some IDs are hidden in its visible field table for readability.

`configurationImpact` starts from the diff, expands directly changed grades to their classrooms/old+new sections, adds changed-room ancestors, and collects potentially affected school/board/group/section/grade/classroom rules. Single-room changes do not automatically add unaffected siblings. Counts of actual created/updated/removed records are separate from named dependencies “to review.” This is conservative dependency analysis, not a numerical recomputation of every affected timetable or a count of actual changed effective dates.

### 15.4 Validation: what is permitted and what blocks

| Condition | Draft save | Publication |
| --- | --- | --- |
| Schema/type/UUID/name/time numeric bounds invalid | Rejected | Rejected |
| Unregistered/missing affiliation names | Rejected by save | Existing stored configuration reviewed; ordinary edit paths already require registered set |
| Invalid section/target references or duplicate names/IDs | Rejected by reference validation/DB constraints | Blocking error |
| Grade unassigned to section | Accepted | Warning → INCOMPLETE_ACTIVE |
| Missing bell schedule on working dates | Accepted | Warning → INCOMPLETE_ACTIVE |
| No active classrooms / zero classroom setup | Accepted | No mandatory minimum-classroom error; other warnings may still apply |
| Empty valid-timestamp schedule, timing gap/overlap/order/outside day | Temporal draft allowed within schema bounds | Blocking error for any stored schedule |
| Equal-priority applicable bell schedules | Draft can persist | Blocking error on affected year dates |
| Opposing holiday/working conflict | Draft can persist | Blocking error |
| Half-day mismatch with an existing selected full/less-specific template | Draft can persist | Blocking invalid-day error |
| Missing school logo | Identity may exist before completion | Blocking error |
| No currently valid active organization subscription | Existing edits/removals permitted; additions rejected | Publication rejected |
| New classrooms beyond allowance | Rejected during additions | Cannot normally reach publication through valid save |
| Already over-limit after contract reduction | Existing edits/removals preserved | Warning, publication can continue with valid active contract |

The service's draft reference review deliberately runs a one-date review and filters errors by `/invalid section|invalid target|duplicate/i`; it is not a full timing-validity gate. Publication scans the full year and all stored templates. The UI checks review errors, but the API publication endpoint independently enforces them, so an outdated client cannot bypass the substantive validation merely by skipping the Review screen.

### 15.5 Optimistic locking, concurrency and discard

- `Revision.lock` increments on successful saves and missing-board draft synchronization.
- The web submits `revisionId` as well as lock. A replaced draft with the same lock value is therefore detected. The API makes revisionId optional for older clients; those clients have weaker replaced-draft protection.
- Config saves/publications lock Organization, Institution and AcademicYear in that order; draft/restore/discard lock Organization then AcademicYear. This serializes competing license-consuming writes across schools and stale writes in a year.
- Numeric mismatch or supplied wrong revision returns 409. There is no automatic client merge, conflict-resolution editor or realtime coediting.
- Parent `persist` serializes in-flight saves, tracks which local change sequence was saved and retains unsaved state on error. `ensureSaved` retries pending local changes before dependent actions.
- Navigation guard offers stay/save/discard and re-evaluates guards up to 30 rounds, allowing an editor save to dirty then save its parent draft. Browser unload is guarded while dirty.
- Navigation “discard unsaved edits” reloads the stored draft; it is different from DELETE `/draft`, which deletes all unpublished revision data.
- Whole-draft discard requires both draft and publication to exist, lock and optional revision ID checks; it clears draft pointer/deletes that draft transactionally. The initial unpublished draft cannot be discarded by this endpoint.
- Restoring is blocked while a working draft already exists. History metadata remains available, including prior warnings and summaries.

### 15.6 Required lifecycle scenarios: active, draft and history effects

| Scenario | Draft / current operation | Active publication before successful publish | Historical records | Validation / relevant code |
| --- | --- | --- | --- | --- |
| Grade deleted in draft | Remove grade and its rooms; prune scoped IDs, narrow shared rules or drop empty targets; draft autosaves | Unchanged, including old classroom reservation | Untouched | Typed confirmation/impact; removeFromConfig, saveConfig; publish revalidates |
| Classroom deactivated | Set room.active=false; room still exists/counts; effective preview returns inactive | Unchanged until draft publication | Untouched | patchClassroom / bulk action; resolve; countClassrooms has no active filter |
| Grade moved to another section | Replace nullable sectionId; assignment preview and optional Undo; inherited section rules resolve against new parent | Old assignment and operational publication unchanged | Untouched | assignGrades same-board checks; targetRank; numeric lock on save |
| Bell schedule modified | Complete template upserted under current board; immediate accepted-config save; invalid timing can remain a draft | Old complete template remains active | Untouched | commitConfiguration, scheduleSchema; publication validates all timing/templates |
| Holiday added | Event stored in draft; unsaved/saved preview can resolve it; does not immediately change active published calendar | Existing active calendar unchanged | Untouched | EventEditor, commitConfiguration, matches/resolve; typed deletion if removed later |
| Draft fails validation | Schema/ref/name/license error rejects transaction; valid-shape temporal defects may be saved but marked for correction | Publication pointer unchanged; failed publish does not partially activate | Untouched | saveConfig filtered refs; full publish review; exception rolls transaction back |
| Two conflicting edit sessions | First committed save increments lock; stale second lock/id rejected409; new-room changes also serialize on org row | Unchanged unless a separate valid publish succeeds | Untouched | lockOrganization, year locks, Revision.lock; V1 still one organization admin, but multiple sessions/platform actor can write concurrently |
| Published configuration restored | Copy chosen non-DRAFT same-year config into a new sequence DRAFT; block if another draft exists; capacity checked | Current active pointer stays as it was, even when restoring an older source | Source and other published rows stay immutable | AppService.draft(restoreRevisionId), writeConfig; must review/publish new draft |
| New academic year created | Create separate year and sequence1 draft; fresh or same-school copied configuration | Previous year's publication/pointers remain unchanged | Existing years/revisions untouched | createYear, copyYear; source publication preferred; fixed/date-bound rules excluded |
| Only one board changed | Whole-config draft save recreates physical child snapshots for that draft; unchanged boards retain equivalent data/logical IDs | Entire existing active snapshot remains unchanged until publication | Other publications untouched | updateBoard/applyAcademicPreset; writeConfig reserializes the draft, so unchanged boards need not retain the same physical row IDs |

These are source-traced operational effects. Tests cover many of the service paths as detailed in section 20, but the table is not a claim that ten browser scenarios were successfully executed. In V1 “two administrators” should be understood as conflicting authenticated edit sessions or a platform administrator plus the single organization administrator, not a client multi-user role feature.


## 16. Database Schema & Relationships

### 16.1 Actual database inventory and relationships


| Model | Ownership / fields / constraints relevant to the client |
| --- | --- |
| Organization | Current identity/contact/address, status, onboarding steps, timestamps; parent of schools/users/subscriptions/requests; unique email |
| User | Email/name/passwordHash/role/mustChangePassword; nullable organizationId is unique, enforcing one organization-linked user per organization in this schema |
| Session | Hashed token ID, user FK, CSRF token, expiry; user deletion cascades sessions |
| Institution | Actual database name for School; organization FK, registration/identity/boards/logo/officer/contact/status/deletion fields; unique organizationId+registration |
| Subscription | Organization FK, reference, amount, validity/status/agreement/payment/exception fields, classroomLimit/userLimit; indexed organization/status/dates; unique reference |
| Entitlement | Legacy one-per-institution subscription allocation relation; retained in schema, not the authoritative current school/board cap |
| AcademicYear | School FK, label/start/end, unique draft/publication pointers; unique school+label; years and revisions cascade under school deletion |
| Revision | Year FK, sequence/status/lock/summary/warnings, createdAt/updatedAt/publishedAt; unique year+sequence; boards owned per snapshot |
| RevisionBoard | Physical ID plus persistent boardKey/name/nonWorkingDays; owns section/grade/classroom/schedule/event rows; unique revision+boardKey |
| Section | Snapshot board FK, entityKey, name; unique board+name and board+entityKey |
| Grade | Snapshot board FK, entityKey/name/active, nullable section FK; section delete sets null; unique board+name and board+entityKey |
| Classroom | Board FK and grade FK, entityKey/name/active; grade delete cascades; unique grade+entityKey and board+name |
| Schedule | Snapshot board FK, entityKey/name/day timings/dayType; JSON target/rule/slots |
| CalendarEvent | Snapshot board FK, entityKey/name/kind/overridesHoliday; JSON target/rule |
| ChangeRequest | Organization FK, institutionId string, proposed JSON, reason/status/resolution/timestamps. institutionId is **not** declared as a Prisma relation/FK; service checks ownership and purge deletes matching requests |
| AuditLog | Actor ID, optional organization ID, action/entityId/detail JSON/timestamp; actorId/entityId are strings, not entity FKs; index organizationId+createdAt |
| PlatformSetting | Singleton-style id, values JSON, lock, updatedAt; holds support settings, board catalogue and academic presets |

Required hierarchy is represented by Organization → Institution → AcademicYear/Revision → RevisionBoard → Grade → Classroom, with **optional** Section assignment between board and grade. Physical Grade.sectionId is a section FK; the service also validates same-board section ownership. There are no Teacher, Student, Subject, PhysicalRoom, Timetable or organization-side RBAC tables in the inspected schema.

### 16.2 Existing migrations (inventory only)


Five migration directories were found: `202611140001_initial`, `202611140002_workspace_improvements`, `202611140003_organization_licensing`, `202611150001_calendar_overrides`, `202611150002_revision_updated_at`. The last adds/backfills Revision.updatedAt. This audit did not deploy/check migrations against a live database; earlier successful deployment was observed before this read-only request.

## 17. API Inventory

### 17.1 API architecture and authority

Client actions are dispatched through the catch-all `ApiController.handle` in `apps/api/src/main.ts`, then `AppService` in `apps/api/src/service.ts` or the auth/asset branches. Prisma operations are in the service, `client-portal.ts`, `licensing.ts` and `store.ts`. Shared calculations live in `packages/domain/src`. The actual dispatch code, rather than the Swagger ROUTES display list alone, defines supported paths and method handling. The contracts below document both requests/responses and record effects without issuing requests during this audit revision.

### 17.2 Full client API contracts, grouped by module

All paths in the following table have the `/api` prefix. HTTP dates/timestamps are returned as JSON strings. Existing naming uses Institution for School. “Read” means the endpoint itself does not persist academic changes; POST previews still pass Origin/CSRF middleware.

Authorization shorthand:

- **Public**: no session required. Login writes still require exact trusted Origin.
- **Session**: a valid session; me/password/logout are allowed before mandatory password replacement is completed.
- **Client**: authenticated, password changed, ORG_ADMIN with organizationId; active parent organization.
- **School edit**: authenticated/password changed, active school in session organization, or platform admin; checked by `AppService.institution`.
- **Year**: School edit ownership followed through the AcademicYear, and any revision constrained to that year.
- **School inspect**: client-owned non-deleted school; inactive school identity permitted.
- **Platform**: PLATFORM_ADMIN enforced by `AppService.admin`.

For every non-GET/HEAD authenticated request, exact configured Origin and session CSRF header are required. Login precedes the session CSRF requirement but not Origin. API `authenticate` rejects inactive organizations globally. `ApiController.handle` in `apps/api/src/main.ts` is the dispatch reference for every row; the Service column names the additional actual handler.

| Group / HTTP endpoint | Request inputs | Response outputs | Validation / authorization | Database operations | Service / source |
| --- | --- | --- | --- | --- | --- |
| Health — GET `/health` | None | `{ok:true}` | Public; actual path handler is method-agnostic and returns before write-Origin checks | None | `ApiController.handle` |
| Auth — POST `/auth/login` | `{email,password,portal:platform or organization}` | `{csrf,user:{id,name,email,role,organizationId,mustChangePassword}}`, session cookie | Valid email, password <=128 chars, correct portal/role, password, active organization; process IP attempt limit | Read User/Organization; create Session; create login AuditLog | `login`, `createSession`, password.verify |
| Auth — GET `/auth/me` | Cookie | `{csrf,user:{id,name,email,role,organizationId,mustChangePassword,organizationName}}` | Session; actual path handler also responds to other methods after the relevant middleware checks | Read Session/User/Organization | `authenticate`, `ApiController.handle` |
| Auth — POST `/auth/password` | `{currentPassword,password}` | `{ok:true,csrf}` plus replacement cookie | Session; current password verifies, new 12–128 upper/lower/digit/symbol, must differ | Update User; delete old Sessions; update organization completion; audit; new Session | `passwordSchema`, auth/password branch |
| Auth — POST `/auth/logout` | Cookie and CSRF | `{ok:true}`, cleared cookie | Session; Origin/CSRF | Delete current Session | auth/logout branch |
| Portal — GET `/client-portal` | `search<=100`, `board<=100`, `schoolStatus`, `status`, `sort`, positive page, pageSize 1–50; optional schoolId/yearId UUIDs | `{contract,rows,total,page,pageSize,metrics,attention,boards,activity,license,subscriptions,basis}` | Client; querySchema; tenant from session, not query; optional selected year only preferred within its school | Read scoped school/year/revision/classroom projections, AuditLog, contracts and user/license counts | `AppService.clientPortal`; `clientDirectory`, `schoolRows` in client-portal.ts |
| School directory support — GET `/institutions` | No client query filters | Institution identity array, organization-name relation; client year include disabled | Authenticated/password changed; session organization, active org, excludes pending deletion; inactive schools included | Read Institution/Organization | `AppService.institutions` |
| Details — GET `/institutions/:id/portal` | School path ID; optional `yearId` string | `{school,year,status,boards,history,calendar,hasGrades,hasCalendar,basis}` | Client, School inspect; selected year must match one of that school's years or operational fallback is used | Read Institution/year metadata, selected config children, latest 50 publication metadata; compute summary in memory | `AppService.clientSchool`; `clientSchool` in client-portal.ts |
| Account — GET `/organization-profile` | None | Organization identity plus subscription reference/status/dates/allowances | Authenticated/password changed with organizationId; session organization | Read Organization/Subscription | `organizationProfile` |
| Account — GET `/usage` | None | Array of organization usage records: used/limit/remaining/overLimit/users/userLimit/contractId/contractConflict and school/year reservations | Authenticated/password changed; client only own org; platform sees all orgs | Read Institution/AcademicYear/revision pointers/classroom counts/Subscription/User | `usage` → `organizationUsage` |
| Shell — GET `/workspace-settings` | None | `{supportEmail,supportPhone,supportNotes,maintenanceNotice}` | Authenticated/password changed, despite `publicSettings` method name | Read PlatformSetting or validated defaults | `publicSettings` |
| Presets — GET `/academic-presets` | None | Array of validated `{id,name,boards,sections,grades}` | Authenticated/password changed; not limited to platform | Read PlatformSetting or defaults | `academicPresets` |
| Years — GET `/institutions/:id/years` | School UUID | Year array including dates/pointers, publication sequence/status/warnings, draft sequence/lock | School edit; school UUID parsing | Read AcademicYear/Revision metadata | `years` |
| Years — POST `/institutions/:id/years` | `{label,start,end,copyFrom?}` | Initial created AcademicYear object; clients reload years/config for the updated draft pointer | School edit; real ISO dates; end>start, difference<=550 days; unique school label; copy source same school; capacity check | Transaction: lock org/school; create AcademicYear/Revision/normalized config; set draft pointer; audit | `createYear`; `emptyConfig`, `copyYear`, `assertClassroomChange`, `writeConfig` |
| Config — GET `/years/:id/config` | Year UUID; optional revisionId UUID | `{year,revision,config,license,published}` | Year; requested revision must belong to that year; default draft first, publication next | Read year/revision/config children, active publication and usage | `config`, `readConfig` |
| Config — PUT `/years/:id/config` | `{config,lock,revisionId?}` | `{lock:old+1,savedAt,license}` | Year; configSchema; current draft; optional supplied revision match; numeric lock; affiliation set; stable ownership; structural refs/duplicates; new-room limit | Transaction: org/school/year locks; rewrite draft children; increment Revision.lock/update timestamp; structure.updated audit if changed | `saveConfig`, `assertStableOwnership`, `assertClassroomChange`, `review`, `writeConfig` |
| Draft — POST `/years/:id/draft` | `{restoreRevisionId?}` | New Revision row metadata; config fetched separately | Year; no existing draft; source same-year non-DRAFT; current publication or selected historic source; restored additions capacity | Transaction: org/year locks; new sequence; clone config; add missing registered boards; set draft pointer; audit | `draft`, `readConfig`, `writeConfig` |
| Draft — DELETE `/years/:id/draft` | JSON `{lock,revisionId?}` | `{ok:true}` | Year; publication and draft both exist; current lock/id | Transaction: org/year locks; clear draft pointer; delete draft and cascade children; audit | `discard` |
| Review — GET `/years/:id/review` | Year UUID | `{changes,impact,issues,classrooms,license}` | Year; review current saved config across dates; identity/logo warning/error checks | Read only; compute diffs/impact/review/usage | `review`, `configurationChanges`, `configurationImpact`, domain `review` |
| Publication — POST `/years/:id/publish` | `{lock,revisionId?,summary}`; summary 1–1000 trimmed | `{ok:true,issues}`; refreshed config/history needed for active metadata | Year; DRAFT/current lock/id; unique active valid contract; full review/logo; errors block, warnings permitted | Transaction: org/school/year locks; finalize Revision status/warnings/summary/publishedAt; set published pointer/clear draft; audit | `publish`, `activeContract`, domain `review` |
| History — GET `/years/:id/history` | Year UUID | Non-DRAFT array `{id,sequence,status,summary,publishedAt,warnings}`, descending sequence | Year | Read all publication metadata for year | `history` |
| Calendar — POST `/years/:id/preview` | `{board,config?,dates:[1..32],filter?:{sectionId?,gradeId?,classroomId?}}` | `[{date,status,label,results:[{classroomId,classroomName,status,reason,schedule?}]}]` | Year; boardSchema/configSchema; real within-year dates; registered board affiliation/presence. It is a supplied-draft simulation, not a full save validation | Read authorized year/config if omitted; no persistence; calculate effective days | `preview`, `selectedClassrooms`, `calendarDay` |
| Calendar — POST `/years/:id/calendar-summary` | `{config?,boardId?,filter?:{sectionId?,gradeId?,classroomId?}}` | CalendarDays/provisional/mixed/common counts/frequencies plus per-classroom rows/holiday dates | Year; supplied board names registered; selected board ID in config | Read config/year; compute existing calendar engine, no persistence | AppService `calendarSummary`; domain `calendarSummary` |
| Calendar — POST `/years/:id/rule-preview` | `{rule}` | `{dates,count,start,end}` | Year; ruleSchema; year-bounded pattern matching | Read authorized AcademicYear; no config mutation | `rulePreview`, `recurrenceDates` |
| Presets — POST `/years/:id/preset-preview` | `{boardId,selection,lock,revisionId?}` | `{createdGrades,reusedGrades,createdSections,impact,lock}` | Year; current DRAFT/lock/id; valid selected board/selection | Read saved config; in-memory plan/impact only | `presetPreview(apply=false)` |
| Presets — POST `/years/:id/preset-apply` | Same as preview | Save response plus `{createdGrades,reusedGrades,createdSections,impact}` | Preview checks, then ordinary save rechecks lock/ownership/license within transaction | Whole draft save and audit; unrelated boards preserved | `presetPreview(apply=true)` → `saveConfig` |
| Impact — POST `/years/:id/impact` | `{config,lock,revisionId?}` | `{created,updated,removed,boards,grades,sections,classrooms,schedules,calendarRules,byEntity,changes}` | Year; valid proposed shape; current draft/id/lock and stable ownership | Read saved config; compare only, no write | `impactPreview`, `configurationImpact` |
| Requests — GET `/requests` | None | ChangeRequest array with organization-name relation, newest first | Authenticated/password changed; client restricted to session org; platform all | Read ChangeRequest/Organization | `requests` |
| Requests — POST `/requests` | `{institutionId,proposed,reason}` | Created ChangeRequest row, PENDING | School edit; proposed allowed partial identity fields, strict; >=1 field; reason 5–2000 | Create ChangeRequest; Institution unchanged | `request`, partial institutionSchema |
| Assets — POST `/assets` | `{mime:PNG/JPEG/WebP MIME,base64}` | `{url}` | Authenticated/password changed; base64 string limit 2,800,000; decoded <=2MiB; basic magic-byte checks | Upload S3 object with random key; no Asset DB model | API assets branch, S3 PutObjectCommand |

### 17.2.1 Shared input/output shapes and restrictions

- **Config:** `{boards:Board[0..20]}`. Board: UUID id/name/nonWorkingDays/sections/grades/schedules/events. Section: id/name. Grade: id/name/active/nullable sectionId/classrooms. Classroom: id/name/active. Names are trimmed and generally 1–100 characters for these academic entities. Full nested shapes are `boardSchema`, `configSchema` in `packages/domain/src/index.ts`.
- **Schedule:** id/name/arrival/dispersal/optional dayType/target/rule/slots (max100). Slot: id/name/kind period or routine/start/end. Integer times have the bounds documented in section 11. There is no buffer kind or partial-field override shape.
- **Target:** scope enum school, board, boards, section, sections, grade, grades, classroom, classrooms; ids UUID array. Non-school/non-board scopes require at least one valid target at save/review. Plural shared IDs can span boards within a school, not foreign-school DB records.
- **Rule:** type default/weekly/recurring/date; optional date/nth/anchorDate/startsOn/endsOn; weekdays 0–6; intervalWeeks default1, max52; bounds inclusive. Weekday and real-date validation is in ruleSchema. At most a 550-day difference is enumerated by recurrenceDates, inclusive endpoints.
- **Preset:** id/name/boards aliases/sections/grades `{name,section|null}`. Selection: sections, grades, optional active=true/assignExisting=false. Definition IDs unique within platform catalogue; selected plan names case-insensitively unique.
- **License record:** organizationId, used, limit, remaining, overLimit, users, userLimit, contractId, contractConflict, school reservations and their year publication/draft counts. Directory row classroomCount is not this reservation value.
- **Issues:** `{severity:error or warning,message}`. Review and publication use the domain rules; the frontend's generic `api()` throws an Error message on HTTP failure rather than preserving every response field as a typed error object.
- **Identity proposal:** only name, registration, address, boards, logo, officer, phone, email. Institution requires nonempty name/registration, at least1/max20 case-insensitively unique boards, bounded strings/email formats; fields not proposed remain current on approval.
- A successful POST year returns the initially created object `y`; the handler subsequently updates draftRevisionId in the DB but does not refetch that return object. The UI correctly fetches the year/config again. A caller relying only on the returned pointer can see null even though a draft now exists.
- The UI has no direct `/grades`, `/sections`, `/classrooms`, `/schedules` or `/holidays` CRUD endpoint. Those actions commit the complete configuration through PUT config.

### 17.3 Validation and error handling inventory


- D schemas: structural shape/IDs, grade/section/classroom names, nonworking weekdays, schedule/slot limits, event kinds and reopening restriction.
- D `validDate`, `matches`, `validateSlots`, `review`: real dates, recurrence, exact bell coverage, references/uniqueness and effective full-year checks.
- B preview validators: batch limits, existing-name skip, classroom ownership/name collision.
- PR schemas: preset aliases/names/sections/grades, uniqueness, defaults and selected-plan shape.
- I `assertStableOwnership`: existing grade/section/classroom ID cannot move to another board/type, nor classroom to another grade. Section reassignment inside board is allowed.
- SVC identity/subscription schemas: 1–20 unique affiliations, email/contact input shapes, commercial validity/allowances, request reason and proposed fields.
- STORE: published storage-write rejection plus relational constraints/cascades.
- API filter: Zod →400 with field messages; HttpException preserves status; Prisma P2002 →409 duplicate; P2025 →404; otherwise generic 500. JSON request body limit is 3MB.
- Request logs contain method/path/status/duration and validation message for selected 400 cases, not password request bodies. There is no evidence of a dedicated client-side structured validation-code taxonomy beyond message strings.

### 17.4 Related platform-only endpoints that affect client behavior

These routes exist but are not additional organization-client permissions. They are listed because they create schools, change contracts, approve registration changes, configure presets/support or alter client access. Every mutation also passes Origin/CSRF after the session gate. Principal handler source is `apps/api/src/service.ts`; routing is `apps/api/src/main.ts`.

| HTTP endpoint | Inputs | Outputs | Validation and authorization | Records / effects | Handler |
| --- | --- | --- | --- | --- | --- |
| GET `/organizations` | None | Organization array with selected school/user/subscription metadata | Platform | Read Organization and included relations | `orgs` |
| POST `/organizations`; PUT `/organizations/:id` | orgSchema identity/contact/address/type/email/notes | Organization row | Platform; valid email/nonempty name; unique email | Create/update Organization and audit | `saveOrg` |
| POST `/organizations/:id/status` | `{status:INACTIVE,SUSPENDED,ACTIVE}` | `{ok:true}` | Platform; ACTIVE requires previous client activation | Organization status, invalidate org sessions, audit | `orgStatus` |
| POST `/organizations/bulk-status` | Unique 1–200 UUID ids, status ACTIVE/INACTIVE/SUSPENDED | `{updated:count}` | Platform; all records exist; active requires prior activation | Ordered record locks; org updates; invalidate sessions; audit | `bulkStatus(kind=organizations)` |
| GET `/onboarding` | None | Organization checklist/current step/progress/blockers/updated metadata | Platform | Read org/schools/contracts; compute seven-step readiness | `onboardingOverview`, `onboardingChecklist` |
| POST `/organizations/:id/onboarding` | `{step:1..5}` | Updated Organization row | Platform; prior step complete and current blockers absent | Completed steps/state update and audit | `onboarding` |
| POST `/organizations/:id/activate` | No substantive payload | `{email,temporaryPassword,loginUrl}` | Platform; steps1–5, current identity/contract/commercial checks; initial activation only | Upsert one ORG_ADMIN, hash password, invalidate sessions, active org, audit | `activate(regenerate=false)` |
| POST `/organizations/:id/regenerate` | No substantive payload | Same one-time credential response | Platform; same activation prerequisites | Replace admin credential, require password change, invalidate sessions | `activate(regenerate=true)` |
| POST `/institutions`; PUT `/institutions/:id` | `{organizationId,...institutionSchema}` | Institution row | Platform; ownership immutable; no edit pending deletion; no board removal after any year history | School create/update; missing-board draft sync and lock increment; audit | `saveInstitution` |
| POST `/institutions/:id/action` | `{action:deactivate,reactivate,delete,restore,confirmation?}` | Institution row | Platform; delete exact name; restore before due time; pending-state checks | Identity status / 60-day recovery metadata and audit | `institutionAction` |
| POST `/institutions/bulk-status` | Unique 1–200 UUID ids, ACTIVE/INACTIVE | `{updated:count}` | Platform; rejects SUSPENDED and pending-deletion schools | School status updates/audit under ordered locks | `bulkStatus(kind=institutions)` |
| GET `/subscriptions` | None | Contract array with organization name | Platform | Read Subscription/Organization | `subscriptions` |
| POST `/subscriptions`; PUT `/subscriptions/:id` | Organization/reference/amount/dates/status/agreement/payment/exception data/classroomLimit/userLimit | Subscription row | Platform; owner immutable, dates ordered, limits bounded, exception reason required; ACTIVE ranges cannot overlap | Lock Organization, create/update contract, audit | `saveSubscription` |
| GET `/settings` | None | `{values,lock,updatedAt}` | Platform | Read PlatformSetting/validated defaults | `settings` |
| PUT `/settings` | `{values,lock}`; validated support/maintenance/catalogue/presets settings | `{values,lock:old+1}` | Platform; strict settings schema; optimistic lock | Upsert/update PlatformSetting, audit | `saveSettings` |
| POST `/requests/:id/resolve` | `{approve:boolean,resolution:1..2000 chars}` | Resolved ChangeRequest row | Platform; request PENDING; approved identity validated; board removal after history rejected | Lock request; optional Institution update; request resolution/audit | `resolveRequest` |
| GET `/audit` | None | Newest 200 AuditLog rows | Platform | Read AuditLog | `audits` |
| GET `/dashboard` | None | Organization-category counts and up to8 recent organizations | Platform | Read organization/onboarding projections | `dashboard` |
| GET `/api/docs` (full path) | None | Swagger UI/schema generated from ROUTES metadata | Documentation surface, not a new data permission | No business-record mutation | `bootstrap`, SwaggerModule.setup |

There is no client entitlement-allocation, payment, user-role-management or school-delete endpoint. The server's background purge is a scheduled function, not a separate public client route.



## 18. Security & Licensing

### 18.1 Session/authentication implementation

- Super Admin and Organization login portals enforce exact role PLATFORM_ADMIN versus ORG_ADMIN. A valid password for the wrong portal is rejected.
- Login lowercases email and verifies Argon2id; inactive/suspended organization accounts are unavailable. Unknown users take a dummy-hash verification path.
- Built-in Node Argon2id parameters: 64 MiB, 3 passes, parallelism 4, 16-byte salt, 32-byte digest; stored PHC format. Verification validates format/length and uses timingSafeEqual.
- Session: random 32-byte token; only SHA-256 token digest in DB. Cookie is HttpOnly, SameSite Strict, path `/`, Secure with `__Host-plan_session` in production, otherwise `plan_session`; lifetime eight hours. There is no rolling-expiry update in authenticate.
- CSRF: random 24-byte token stored per Session; non-GET/HEAD requests require exact `x-csrf-token`. All writes, including login, also require exact configured WEB_ORIGIN.
- Login failure limiting is an in-process IP map, 10 attempts per 15-minute window. It is not shared across servers and is not a separate persistent rate-limit service.
- Temporary-password accounts can access me/password/logout but are blocked from other portal endpoints until replacement. New password: 12–128 characters, upper/lower/digit/symbol, different from current. Current password must verify. Replacement invalidates all old sessions, creates a new one and marks organization onboarding complete.
- No self-service forgot-password, email reset, MFA, organization multi-user management or role editor was found. Local admin-provision/reset scripts exist but are operational scripts, not client portal account actions; none was executed during the audit.

### 18.2 Organization/school/year isolation

`authenticate` rejects expired sessions and organizations not ACTIVE. SVC `institution` restricts client configuration to active school in the session organization and active parent organization. `year` checks its school; `config` limits explicit revisionId to that year. `organizationProfile`, usage and directory derive organization from session rather than trusting a query-supplied tenant.

School Details deliberately allows inactive school identity within the same active organization; editing APIs retain stronger active-school guards. Directory/detail SQL uses session organization and parameterized Prisma SQL, excludes pending deletions and has no caller-provided arbitrary organization selector. Client-side routes/IDs do not grant permissions.

The inspected migrations/schema do not define a separate database row-level security policy or per-tenant database. Isolation is service/query-based with relational validation. Schedule scopes can cross boards within one config, not schools/organizations. Preview accepts client-supplied unsaved config for the authorized year and validates structure/affiliation presence; it is a read-only simulation and not a way to save foreign database records.

### 18.3 Exact subscription behavior

`activeContract`: status ACTIVE, start <= now, end >= now; more than one match →409 conflict; none →null. Super Admin subscription saves block inclusive overlapping ACTIVE date ranges for the same organization. Contractual user allowance is returned alongside classroom allowance; V1 is still physically one organization-linked user per schema.

`organizationUsage` counts schools in all account states, including inactive and pending-deletion until their actual records disappear. It considers current draft/publication pointers only and applies the maximum formulas in section 14. Multiple-board classrooms count together; there are no independent board/grade/section limits. Legacy Entitlement records are not the enforcement source.

`assertClassroomChange` detects **new logical classroom IDs** versus the previous config. If none are added, it permits edits/reductions, even after expiry/reduction. If IDs are added, it requires one active contract and projected usage <= classroomLimit. Organization row locking serializes concurrent additions across different schools.

Publication separately requires an active contract. If a valid contract was reduced below existing usage, review/publication raises an over-limit warning and allows non-blocking publication; additional classrooms remain blocked. It does not automatically delete/deactivate existing records. This precise exception is part of current behavior.

### 18.4 Registration changes, assets and deletion recovery

Clients can propose name, registration, address, board affiliations, logo, officer, phone and email. The form submits only changed values and a reason >=5 characters (server max 2000); at least one proposed field required. Proposal schema is strict and based on partial institution identity, not arbitrary JSON fields. A proposal creates ChangeRequest/PENDING and does not immediately change identity.

Super Admin resolution locks the request; already resolved requests conflict; approve merges/validates current identity and proposal, then updates school; reject leaves identity unchanged. Removal of boards with any academic-year history is blocked. Resolution text/timestamp/status are persisted and audited. There is no client cancel/edit-request action.

Logo replacement permits PNG/JPEG/WebP, <=2MiB decoded, checks selected magic bytes and uploads a random-key object via `/assets`. The school identity changes only after request approval. Uploading can occur before approval; an uploaded object is not rolled back merely because a request is abandoned/rejected. The local MinIO bucket setup grants public download for logos, not authenticated academic-record access.

Super Admin school deletion requires exact school-name confirmation, sets DELETION_PENDING and `deletionDueAt = now + 60×86400000`, retaining prior status. Restore works strictly before due time and restores prior state. A periodic server reconciliation (startup and every minute) purges due non-held schools, cascades academic data, deletes matching requests and eligible logo object, and cleans expired sessions. Clients have no school-delete/recovery buttons. This audit did not start that reconciliation or touch deletion state.

## 19. Complete Feature Status Matrix

Status meanings are restricted to the requested vocabulary:

- **Implemented** — source implementation and supporting code/test or observed evidence exist. Browser success is not implied.
- **Partial** — an implemented subset or explicit path/edge-case limitation exists.
- **Missing** — no implementation found in the inspected portal/schema.
- **Broken** — a concrete contradictory result/control path is evidenced; provenance is stated.
- **Unverified** — implementation exists, but the particular runtime/visual claim has not been established.

References use the actual-file key in section 2.3 followed by the implementing symbol/view. `tests/` references identify coverage, not a new audit execution. For observed test provenance, see section 20.


The frontend column names the component/control source; the API/service column identifies the relevant module integration and preserves the original function/test evidence. Some UI-only controls do not make an API call themselves; data operations are delegated through the described parent module. The database column lists involved records or explicitly says no dedicated implementation, rather than inventing a model for a missing feature. Source aliases still resolve through section 2.3.

| Module/Page | Feature | Actual Current Behavior | Frontend File | API/Service | Database Model | Implementation Status |
| --- | --- | --- | --- | --- | --- | --- |
| Shell | Five client sidebar entries | Overview, Schools, Structure, Review/History, Account | `apps/web/app/page.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: APP:`clientNav` | No direct DB operation; sessionStorage where stated | Implemented |
| Shell | Academic Years removed from sidebar | Still accessible inside school workspace | `apps/web/app/page.tsx`; `apps/web/features/structure/workspace.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: APP:`clientNav`; WS:`yearView` | No direct DB operation; sessionStorage where stated | Implemented |
| Shell | Separate detail/editor components | `ClientSchoolDetails` versus `Structure` | `apps/web/app/page.tsx`; `apps/web/features/client/portal.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: APP render branches; CP | No direct DB operation; sessionStorage where stated | Implemented |
| Shell | Separate query routes | `schoolDetails` / `schoolWorkspace` and validated intent | `apps/web/app/page.tsx`; `apps/web/lib/workspace-location.ts` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: APP route restore; NAV:`useWorkspaceLocation` | No direct DB operation; sessionStorage where stated | Implemented |
| Shell | Dedicated path routes for each school | No separate Next.js path route files; query-state navigation instead | No client implementation found; inspected `apps/web/lib/workspace-location.ts` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: `apps/web/app/page.tsx`; NAV | No direct DB operation; sessionStorage where stated | Missing |
| Shell | Browser back/forward handling | Popstate is guarded; state restored from URL | `apps/web/lib/workspace-location.ts` | GET /auth/me; GET /institutions; navigation state is frontend-owned; evidence: NAV:`useWorkspaceLocation` | Session, User, Institution | Implemented |
| Shell | Browser navigation acceptance | Seven scenario sources; no successful Chromium execution | `apps/web/app/page.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: `e2e/workspace.spec.ts`; section 20 | No direct DB operation; sessionStorage where stated | Unverified |
| Shell | Persist selected school/year/board/tab | Session keys scoped to school; directory key scoped to user | `apps/web/app/page.tsx`; `apps/web/features/client/portal.tsx`; `apps/web/features/structure/workspace.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: APP; WS:`load`, tab/board effects; CP | No direct DB operation; sessionStorage where stated | Implemented |
| Shell | Permanent cross-device preferences | No preference persistence model/API | No client implementation found; inspected `apps/web/features/client/portal.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: DB; CP storage effects | No direct DB operation; sessionStorage where stated | Missing |
| Shell | Header search | Sections/active schools, keyboard navigation, Cmd/Ctrl+K, eight results | `apps/web/app/page.tsx`; `apps/web/components/workspace/header.tsx` | Searches cached section/record metadata; initial GET /institutions; destination fetch follows selected route. HEAD:`WorkspaceHeader`; APP header handler | Institution (initial metadata); search state in memory | Implemented |
| Shell | Mobile sidebar/collapse/scrim | Responsive CSS and state handlers exist | `apps/web/app/page.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: APP shell; `density.css`; `enterprise.css` | No direct DB operation; sessionStorage where stated | Implemented |
| Shell | Desktop/mobile visual acceptance | No rendered layout inspection succeeded | `apps/web/app/page.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: CSS; earlier browser launch failure | No direct DB operation; sessionStorage where stated | Unverified |
| Shell | Maintenance notice | Authenticated support-settings value displayed | `apps/web/app/page.tsx` | GET /workspace-settings → AppService.publicSettings; APP maintenance notice; SVC:`publicSettings` | PlatformSetting | Implemented |
| Shell | Unsaved navigation guard | Stay/save/discard; cascading child/parent guard settlement | `apps/web/lib/navigation.tsx`; `apps/web/lib/navigation-core.ts` | No independent guard endpoint; registered child/parent callbacks invoke their save/discard APIs. NAV:`settleNavigationGuards`; tests/enhancements.test.ts | No guard model; parent configuration may persist Revision/children | Implemented |
| Shell | Dirty browser unload | BeforeUnload prompts while relevant draft/editor dirty | `apps/web/features/structure/workspace.tsx`; `apps/web/lib/workspace-location.ts` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: NAV; WS dirty sequence | No direct DB operation; sessionStorage where stated | Implemented |
| Shell | Complex workflows as pages | Schedule, event, preset, year, review, history render page-style workflows | `apps/web/features/structure/workspace.tsx`; `apps/web/components/ui.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: UI:`Modal`; WS modal page condition | No direct DB operation; sessionStorage where stated | Implemented |
| Shell | Small edit/destructive dialogs | Grade/section/classroom and delete/discard dialogs | `apps/web/features/structure/workspace.tsx`; `apps/web/components/ui.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: UI:`Modal`; WS | No direct DB operation; sessionStorage where stated | Implemented |
| Overview | Registered school count | All eligible non-deleted schools, including inactive | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: PORTAL-API:`schoolRows`, metrics SQL | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Active structure metric | Publication pointer count, includes incomplete/pending-draft schools | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: PORTAL-API metrics; CP:`metricItems` | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Setup required metric | NOT_STARTED/DRAFT; not all warning states | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: PORTAL-API metrics; CP | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Classroom usage metric | Actual organization usage/limit; links Account | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: LIC:`organizationUsage`; CP | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Metrics navigate filtered Schools | Clears other filters and sets appropriate status | `apps/web/app/page.tsx`; `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: CP:`drillTo`; APP `onDirectory` | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | One status per school | Selected/current/latest-started/earliest-upcoming year | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: P:`operationalYear`, `structureStatus`; SQL lateral selection | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Status distribution links | Five mutually exclusive statuses with counts | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: CP status panel; PORTAL-API metrics | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Attention table | School/year/status/action, latest six, View all filter | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: CP attention table; PORTAL-API attention SQL | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Outstanding-warning interpretation | Uses publication status rather than rerunning every school's review | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: PORTAL-API status CASE; SVC:`review` | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Partial |
| Overview | Real recent activity | Latest eight allowed audit types joined to school/year | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: PORTAL-API activity SQL; CP:`activityTitle` | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Distinct grade/classroom/calendar event labels | Derived from save diff, priority determines one displayed label | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: CP:`activityTitle`; SVC:`saveConfig` audit | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Activity empty state/link | No fabricated events; links school details with event year | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: CP activity rendering | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Subscription snapshot | Active contract/validity/classrooms/users; conflict/no-contract states | `apps/web/features/client/portal.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: CP:`Subscription`; LIC; PORTAL-API | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Implemented |
| Overview | Consistent read snapshot during concurrent writes | Parallel SQL/API components are not one repeatable-read snapshot | `apps/web/app/page.tsx` | GET /client-portal → AppService.clientPortal → clientDirectory; evidence: PORTAL-API:`Promise.all`; APP refresh | Institution, AcademicYear, Revision, Classroom, AuditLog, Subscription, User | Partial |
| Schools | Existing onboarding school records | Uses Institution; no duplicate registration required | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: SVC:`institutions`; PORTAL-API | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | List view | Real identity/year/status/count/action columns | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: CP directory table | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | Card view | Logo/name/boards/registration/year/status/count/actions | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: CP school cards | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | List/Card preference | Session persisted; pressed state forwarded by Button | `apps/web/features/client/portal.tsx`; `apps/web/components/ui.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: CP view state; UI:`Button` | No direct DB operation; sessionStorage where stated | Implemented |
| Schools | Name search | SQL case-insensitive substring; wildcard escapes | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: PORTAL-API filter construction | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | Board filter | School affiliation membership | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: PORTAL-API `ANY(boards)` | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | School account-status filter | ACTIVE/INACTIVE; server-side and shared across views | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: PORTAL-API:`querySchema`, filter; tests/integration.test.ts | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | Structure-status filter | Five states and configured/in-progress/attention group filters | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: PORTAL-API status filter | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | Sort name/last update | Stable SQL ordering, persisted save timestamps | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: PORTAL-API order; DB Revision.updatedAt | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | Server pagination | UI 12; API up to 50; LIMIT/OFFSET | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: PORTAL-API querySchema/rows/count; CP pagination | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | Whole name/row/card inspection route | Schools context explicitly opens details | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: CP:`openSchoolEntry`, `rowClick`, `rowKey`; P route selector | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | Nested action click protection | Container ignores buttons/links/form controls | `apps/web/features/client/portal.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: CP:`rowClick`, `rowKey` | No direct DB operation; sessionStorage where stated | Implemented |
| Schools | Keyboard row/card activation | Enter/Space; focus styling | `apps/web/features/client/portal.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: CP row/card handlers; `density.css` | No direct DB operation; sessionStorage where stated | Implemented |
| Schools | Complete browser click verification | Source selector tested, actual rendered interactions blocked | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: tests/client-portal.test.ts; e2e/workspace.spec.ts | Institution, AcademicYear, Revision, Classroom | Unverified |
| Schools | Inactive-school visibility | Included, read-only identity, editor actions disabled | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: PORTAL-API; CP; SVC:`institution` | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | Pending-deletion visibility | Hidden from client directories/details | `apps/web/features/client/portal.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: PORTAL-API predicates; tests/integration.test.ts | Institution, AcademicYear, Revision, Classroom | Implemented |
| Schools | Lightweight initial shell loading | Client omits year include, but still loads all identity records | `apps/web/app/page.tsx` | GET /client-portal → clientDirectory; GET /institutions for shell options; evidence: SVC:`institutions`; APP:`refresh` | Institution, AcademicYear, Revision, Classroom | Partial |
| Details | Dedicated informational page | Separate component and workflow query state | `apps/web/app/page.tsx`; `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: CP:`ClientSchoolDetails`; APP | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Read-only identity | Name/registration/address/logo/boards/officer/contact | `apps/web/features/client/portal.tsx`; `apps/web/features/platform/requests.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: CP School Overview; REQ | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Four sub-tabs | Overview, Academic Structure, Bell/Calendar, Config/History | `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: CP details navigation | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Selected-year context | Authorized year selection and session retention | `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: PORTAL-API:`clientSchool`; CP fetch effect | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Structure counts and grade lists | Per-board counts; expandable section/grade/classroom read model | `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: PORTAL-API board projection; CP DataTable | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Effective active-room counts | Room and parent grade must both be active | `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: PORTAL-API board projection | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Schedule/rule counts | Counts physical owner-board records, not inherited applications | `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: PORTAL-API defaultSchedules/advancedSchedules | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Calendar totals | Existing summary engine, common totals and provisional notices | `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: PORTAL-API:`clientSchool`; E:`calendarSummary` | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Calendar completion indicator | Any schedule plus nonprovisional summary; not comprehensive checklist | `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: PORTAL-API:`hasCalendar` | Institution, AcademicYear, Revision and revision children | Partial |
| Details | History metadata | Latest 50 published records with summaries/warnings | `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: PORTAL-API history query; CP | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | All older history access | Full year history through workspace API | `apps/web/features/structure/workspace.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: SVC:`history`; WS history workflow | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Manage Structure action | Explicit workspace navigation, retains school/year | `apps/web/app/page.tsx`; `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: CP Academic Structure action; APP:`openClientSchool` | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Manage Bell Time action | Bell intent opens default view | `apps/web/features/client/portal.tsx`; `apps/web/features/structure/workspace.tsx`; `apps/web/features/structure/calendar.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: CP; WS `initialIntent`; CAL | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Open Calendar action | Calendar intent opens monthly calendar | `apps/web/features/client/portal.tsx`; `apps/web/features/structure/workspace.tsx`; `apps/web/features/structure/calendar.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: CP; WS; CAL initialView | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Open History action | History intent fetches history workflow directly | `apps/web/features/client/portal.tsx`; `apps/web/features/structure/workspace.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: CP; WS `historyIntentHandled` | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Calendar/bell/history refresh destination | Intent serialized and allowlisted in URL | `apps/web/app/page.tsx`; `apps/web/lib/workspace-location.ts` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: APP route state; NAV location keys | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Identity Request Changes | Proposal form; no immediate identity mutation | `apps/web/app/page.tsx`; `apps/web/features/client/portal.tsx`; `apps/web/features/platform/requests.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: CP; APP schoolRequest; REQ | Institution, AcademicYear, Revision and revision children | Implemented |
| Details | Inactive edit/request controls | Disabled; backend config guard remains active | `apps/web/features/client/portal.tsx` | GET /institutions/:id/portal → AppService.clientSchool → clientSchool; actions delegate to workspace; evidence: CP editable checks; SVC:`institution` | Institution, AcademicYear, Revision and revision children | Implemented |
| Structure dashboard | Separate landing page | Sidebar does not auto-open retained editor | `apps/web/app/page.tsx`; `apps/web/features/client/portal.tsx` | GET /client-portal; GET /institutions/:id/years; GET /years/:id/config; evidence: APP sidebar resets clientView; CP | Institution, AcademicYear, Revision | Implemented |
| Structure dashboard | Four real summary metrics | Total, publication, no publication, pending draft | `apps/web/features/client/portal.tsx` | GET /client-portal; GET /institutions/:id/years; GET /years/:id/config; evidence: CP metrics; PORTAL-API | Institution, AcademicYear, Revision | Implemented |
| Structure dashboard | Select school opens workspace | Entry-specific selector; inactive falls back to details | `apps/web/features/client/portal.tsx` | GET /client-portal; GET /institutions/:id/years; GET /years/:id/config; evidence: P:`schoolEntryDestination`; CP | Institution, AcademicYear, Revision | Implemented |
| Structure dashboard | State-based actions | Start, continue, complete/edit, open, review/pending | `apps/web/features/client/portal.tsx` | GET /client-portal; GET /institutions/:id/years; GET /years/:id/config; evidence: P:`structureAction`; CP | Institution, AcademicYear, Revision | Implemented |
| Structure dashboard | Open School remains inspection | Explicit details button differs from config selection | `apps/web/features/client/portal.tsx` | GET /client-portal; GET /institutions/:id/years; GET /years/:id/config; evidence: CP action handlers | Institution, AcademicYear, Revision | Implemented |
| Structure dashboard | No-year empty state | Create first academic year | `apps/web/features/structure/workspace.tsx` | GET /client-portal; GET /institutions/:id/years; GET /years/:id/config; evidence: WS empty-state branch | Institution, AcademicYear, Revision | Implemented |
| Academic years | Existing-year selector | Fetch list, retain valid selection, operational fallback | `apps/web/features/structure/workspace.tsx` | GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: WS:`loadYears`; P:`operationalYear` | Institution, AcademicYear, Revision and revision children | Implemented |
| Academic years | In-school year list | Manage academic years and Open year | `apps/web/features/structure/workspace.tsx` | GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: WS:`yearView` table | Institution, AcademicYear, Revision and revision children | Implemented |
| Academic years | Start fresh | Registered boards, empty sections/grades/rooms/rules, Sunday off | `apps/web/features/structure/academic-year.tsx` | GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: SVC:`createYear`; D:`emptyConfig` | Institution, AcademicYear, Revision and revision children | Implemented |
| Academic years | Copy previous year | Same-school publication preferred, otherwise draft | `apps/web/features/structure/academic-year.tsx` | GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: YEAR; SVC:`createYear` | Institution, AcademicYear, Revision and revision children | Implemented |
| Academic years | Copy preview | Counts preserved/excluded records before create | `apps/web/features/structure/academic-year.tsx` | GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: YEAR:`AcademicYearForm` | Institution, AcademicYear, Revision and revision children | Implemented |
| Academic years | Fixed/date-bound exception exclusions | Date rules and bounded recurrences omitted | `apps/web/features/structure/academic-year.tsx` | GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: D:`copyYear`; tests/structure-enhancements.test.ts | Institution, AcademicYear, Revision and revision children | Implemented |
| Academic years | Recurrence anchor adjustment | Anchor is copied unchanged; only review notice | `apps/web/features/structure/academic-year.tsx` | GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: D:`copyYear`; YEAR helper text | Institution, AcademicYear, Revision and revision children | Partial |
| Academic years | Date/label validation | Valid ISO, end>start, difference<=550 days; unique school label | `apps/web/features/structure/academic-year.tsx` | GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: SVC:`createYear`; DB AcademicYear | Institution, AcademicYear, Revision and revision children | Implemented |
| Academic years | Overlap prohibition | Overlapping years are not rejected | No client implementation found; inspected `apps/web/features/structure/academic-year.tsx` | No client implementation; related module path: GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: SVC:`createYear`; DB constraints | No dedicated implementation; related schema: Institution, AcademicYear, Revision and revision children | Missing |
| Academic years | Year rename/delete/date editing | No client implementation or route found | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: WS; API year route dispatch | No dedicated implementation; related schema: Institution, AcademicYear, Revision and revision children | Missing |
| Academic years | Cross-year independence | New physical snapshots, deep-copy structure, stable logical keys | `apps/web/features/structure/academic-year.tsx` | GET/POST /institutions/:id/years → years/createYear; GET /years/:id/config; evidence: D:`copyYear`; STORE; tests/domain.test.ts | Institution, AcademicYear, Revision and revision children | Implemented |
| Registration | Read-only identity versus editable grades | Separate identity card, request action and grade table | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: WS School Registration | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Officer change requests | Protected officer string included in request proposal | `apps/web/features/platform/requests.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: REQ key list; SVC:`request`, `resolveRequest` | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Multiple boards | 1–20 affiliations and separate board contexts | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: SVC institutionSchema; WS board pills | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Direct client affiliation editing | Request workflow only; no direct identity save permission | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: SVC:`saveInstitution` admin guard | No dedicated implementation; related schema: Institution, RevisionBoard, Grade, Section, Classroom | Missing |
| Registration | Add grade | Name/status; unassigned; no initial classrooms | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: WS grade form | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Inline/modal grade rename | Board-scoped name validation and draft persistence | `apps/web/features/structure/workspace.tsx`; `apps/web/components/ui.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: WS:`patchGrade`; UI InlineCell | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Grade activate/deactivate | Per-record plus selected bulk actions | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: WS grade table/actions | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Bulk numeric grade range | 1–30 inclusive, one accepted batch up to 100 | `apps/web/features/structure/bulk-builders.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: B:`gradeRange`, `gradePreview`; BUILD | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Bulk selected suggested names | Board-oriented name list | `apps/web/features/structure/bulk-builders.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: B:`gradePresets`; BUILD | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Bulk custom names | Newline list, trim/deduplicate/skip existing | `apps/web/features/structure/bulk-builders.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: B:`gradePreview`; BUILD | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Grade count/assignment display | Classrooms, section or Unassigned | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: WS grade columns | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Grade unique names | Case-insensitive per board, 1–100 characters | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: D:`review`, boardSchema; WS | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Registration | Delete grade/dependencies | Removes rooms, prunes scoped references, typed confirmation | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config → config/saveConfig; protected identity → POST /requests; evidence: D:`removeFromConfig`; WS delete; I impact | Institution, RevisionBoard, Grade, Section, Classroom | Implemented |
| Presets | Configurable global definitions | Platform JSON catalogue, schema-validated | `apps/web/features/platform/academic-preset-catalogue.tsx`; `apps/web/features/structure/preset-preview.tsx` | Platform GET/PUT /settings → settings/saveSettings; authenticated GET /academic-presets for consumption; PR; E settings schema; SVC:`academicPresets` | PlatformSetting.values JSON | Implemented |
| Presets | Board families | CBSE, ICSE/CISCE, ISC, IB, Cambridge, SSC/state, HSC | `apps/web/features/structure/preset-preview.tsx` | GET /academic-presets; POST /years/:id/preset-preview or preset-apply → presetPreview; evidence: PR:`defaultAcademicPresets` | PlatformSetting; RevisionBoard, Section, Grade, Classroom | Implemented |
| Presets | Selected board only | Plan replaces one board and preserves other boards | `apps/web/features/structure/preset-preview.tsx` | GET /academic-presets; POST /years/:id/preset-preview or preset-apply → presetPreview; evidence: PR:`applyAcademicPreset`; tests/structure-enhancements.test.ts | PlatformSetting; RevisionBoard, Section, Grade, Classroom | Implemented |
| Presets | Existing record reuse | Case-insensitive section/grade matching; preserve IDs/rooms/status | `apps/web/features/structure/preset-preview.tsx` | GET /academic-presets; POST /years/:id/preset-preview or preset-apply → presetPreview; evidence: PR:`applyAcademicPreset` | PlatformSetting; RevisionBoard, Section, Grade, Classroom | Implemented |
| Presets | Editable/removable suggestions | Rename/remove/add sections/grades; unassigned supported | `apps/web/features/structure/preset-preview.tsx` | GET /academic-presets; POST /years/:id/preset-preview or preset-apply → presetPreview; evidence: PRESET-UI:`PresetPreview` | PlatformSetting; RevisionBoard, Section, Grade, Classroom | Implemented |
| Presets | Explicit reassignment of reused grades | Default false; opt-in assignExisting | `apps/web/features/structure/preset-preview.tsx` | GET /academic-presets; POST /years/:id/preset-preview or preset-apply → presetPreview; evidence: PR selection schema and apply | PlatformSetting; RevisionBoard, Section, Grade, Classroom | Implemented |
| Presets | Preview before confirmation | Counts/impact then accepted apply under draft lock | `apps/web/features/structure/preset-preview.tsx` | GET /academic-presets; POST /years/:id/preset-preview or preset-apply → presetPreview; evidence: PRESET-UI; SVC:`presetPreview` | PlatformSetting; RevisionBoard, Section, Grade, Classroom | Implemented |
| Presets | Mandatory board structures | Presets are optional, unknown board can be configured manually | `apps/web/features/structure/preset-preview.tsx` | GET /academic-presets; POST /years/:id/preset-preview or preset-apply → presetPreview; evidence: PRESET-UI no-preset/manual state | PlatformSetting; RevisionBoard, Section, Grade, Classroom | Implemented |
| Sections | Board-scoped selector | Common board pills and section picker | `apps/web/features/structure/workspace.tsx`; `apps/web/features/structure/section-assignments.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: WS; SEC | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Add/rename sections | Unique board-local trimmed 1–100 name | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: WS section form; D:`review` | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Suggested sections | Shared grade/section preset workflow | `apps/web/features/structure/preset-preview.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: PRESET-UI; PR | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Assigned/unassigned lists | Picker counts and grade table | `apps/web/features/structure/section-assignments.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: SEC rows/picker | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Single grade assignment | Per-row section select with impact confirmation | `apps/web/features/structure/section-assignments.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: SEC:`assign`, `confirmAssignment` | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Bulk assign/move/unassign | Filtered selected grade IDs, destination/null | `apps/web/features/structure/section-assignments.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: SEC; I:`assignGrades` | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Cross-board prevention | IDs and destination validated against current board | `apps/web/features/structure/section-assignments.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: I:`assignGrades`; SVC references | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Assignment impact/stale preview | Before/after impacts; serialized-board stale check | `apps/web/features/structure/section-assignments.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: SEC pending/base check; I | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Undo last assignment | One local snapshot, surviving IDs only | `apps/web/features/structure/section-assignments.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: SEC Undo assignment handler | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Delete without deleting grades/rooms | Null assignments; prune section scopes | `apps/web/features/structure/section-assignments.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: D:`removeFromBoard`, `removeFromConfig` | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Inherited rule change on move | New sectionId used at resolution; not field-by-field rewrite | `apps/web/features/structure/section-assignments.tsx` | PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: D:`targetRank`; SEC | Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Implemented |
| Sections | Section active/inactive lifecycle | Section has no active flag/actions | No client implementation found; inspected `apps/web/features/structure/section-assignments.tsx` | No client implementation; related module path: PUT /years/:id/config → saveConfig; assignGrades / configurationImpact domain helpers; evidence: DB Section; D boardSchema | No dedicated implementation; related schema: Revision, RevisionBoard, Section, Grade, Schedule, CalendarEvent | Missing |
| Classrooms | Board/section/grade filters | All, unassigned, or selected hierarchy | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: WS classroom filters/rows | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Single creation | One-grade editable preview, custom name/status | `apps/web/features/structure/bulk-builders.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: BUILD:`ClassroomBuilder` single mode | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Bulk per-grade creation | Same count for chosen/all grades, 1–100 per grade | `apps/web/features/structure/bulk-builders.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: B:`classroomPreview`; BUILD | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Default suffixes | A–Z, AA/AB; skip all existing board names | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: B:`classroomPreview` | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Custom preview names | Trim, 1–100, validate duplicates/existing names | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: B:`validateClassroomPreview` | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Inline/modal rename | Board-wide collision validation | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: WS:`patchClassroom`; classroom form | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Status management | Per-record and explicit bulk activate/deactivate | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: WS classroom table | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Active/inactive display definitions | Workspace flag-only versus details effective grade+room count | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: WS counts; PORTAL-API projection | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Partial |
| Classrooms | Grade/section/board/school totals | Table/summary strips/details/review counts | `apps/web/features/client/portal.tsx`; `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: WS; CP; D:`countClassrooms` | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Organization allowance display | Used/reserved/allowed/remaining with optimistic draft projection | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: WS usage calculation; LIC | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Inactive consumption | All rooms count regardless of flags | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: LIC; D count helpers; tests/organization-licensing.test.ts | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Backend addition cap | Detect new IDs, valid contract, projected organization usage | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: LIC:`assertClassroomChange` | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Delete and dependent-rule impact | Parent/context shown; prune selected IDs, preserve siblings/history | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: I:`configurationImpact`; D removal; tests/structure-enhancements.test.ts | Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Implemented |
| Classrooms | Immediate license release on draft deletion | Published/other-year maxima continue reserving rooms | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: D utilization; LIC | No dedicated implementation; related schema: Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Missing |
| Classrooms | Physical room management | No physical room model or client workflow | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: PUT /years/:id/config → saveConfig → assertClassroomChange; license from config response; evidence: DB; WS | No dedicated implementation; related schema: Classroom, Grade, RevisionBoard, Revision, AcademicYear, Institution, Subscription | Missing |
| Bells | Five-step guided editor | Scope, timings, routines, periods, preview/save | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WIZ:`ScheduleWizard` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Arrival/dispersal/day duration | Integer minute inputs; day difference displayed | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WIZ; D schema | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Uniform planned periods | Count/default duration generator inputs | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WIZ state and Auto Assign | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Variable period duration plan | Comma durations, length must match planned count | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WIZ Auto Assign handler | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Persist generator count/duration fields | Only generated slots persist, not those helper inputs | No client implementation found; inspected `apps/web/features/structure/schedule-wizard.tsx` | No client implementation; related module path: PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: DB Schedule; WIZ state | No dedicated implementation; related schema: Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Missing |
| Bells | Add/edit/delete routines | Named type/time rows, common labels, anchored confirmations | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WIZ:`slotRows`, `updateSlot` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Auto Assign fixed-gap packing | Sequential periods around unchanged routines | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`autoAssign`; tests/domain.test.ts | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Automatic split/reorder/rescale | Not performed; impossible arrangement rejected | No client implementation found; inspected `apps/web/features/structure/schedule-wizard.tsx` | No client implementation; related module path: PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`autoAssign` | No dedicated implementation; related schema: Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Missing |
| Bells | Manual period creation/editing | Editable name/type/start/end and add/remove | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WIZ step 3/slotRows | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Overlap/gap diagnostics | Implicated IDs, uncovered minutes, corrective text | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: E:`scheduleDiagnostics` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Exact-fit publication | Full arrival-to-dispersal coverage, chronology and positive times | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`validateSlots`, `review` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Incomplete temporal draft save | Allowed within schema, warning notice | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WIZ save; SVC:`saveConfig` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Invalid stored template publication block | Every stored template checked, even unused | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`review`; SVC:`publish` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Generator-only dirty navigation tracking | Count/duration/plan inputs are outside schedule JSON guard | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WIZ baseline/current versus separate state | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Partial |
| Bells | Timeline and template pagination | Five default cards/page; duration-proportional timeline | `apps/web/features/structure/calendar.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: CAL default view | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Nondefault rule table/actions | Combined schedules/events; who/when/what/status | `apps/web/features/structure/calendar.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: CAL Advanced Scheduling | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Full-template override | One chosen Schedule supplies complete day | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`resolve`; Schedule schema | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Individual-field override merge | No merge model/engine | No client implementation found; inspected `apps/web/features/structure/schedule-wizard.tsx` | No client implementation; related module path: PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`resolve`; DB Schedule | No dedicated implementation; related schema: Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Missing |
| Bells | School/board/section/grade/classroom scope | Hierarchical target ranks 1–5 | `apps/web/features/structure/scope-rule.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`targetRank`; SCOPE | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Multi-target / cross-board group scope | Selected boards/sections/grades/rooms inside school config | `apps/web/features/structure/scope-rule.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: SCOPE; D sharedScopes/review | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Searchable target selection | Filtered checkbox options, selected count | `apps/web/features/structure/scope-rule.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: SCOPE:`ScopeRule` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Temporal precedence before target | default < weekly < recurring < date | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`ranked`, `dateRank`; tests/domain.test.ts | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Equal-rank template conflict | Blocking instead of silently choosing | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`resolve`, `review` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Weekday and nth 1–5 recurrence | Selected weekdays; missing fifth skipped | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`matches`; tests/domain.test.ts | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | N-week recurring intervals | Anchor-relative seven-day blocks, 1–52 | `apps/web/features/structure/scope-rule.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`matches`, `ruleSchema`; SCOPE | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Specific dates and inclusive limits | date plus startsOn/endsOn matching | `apps/web/features/structure/scope-rule.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`ruleSchema`, `matches`; SCOPE | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Matching-date preview | Authorized year, pages of 12; pattern not effective calendar | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: SVC:`rulePreview`; RecurrencePreview | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Half-day template | Explicit flag with independently defined complete slots | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WIZ dayType; D:`resolve` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Full holiday suppression | Returns holiday with no active schedule unless valid reopening | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`resolve`; tests/refinement.test.ts | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Weekly closure reopening | Working event/half-event or nondefault half-template required | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`resolve`; tests/refinement.test.ts | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Authorized full-holiday reopening | Exact-date working event, explicit flag, strictly greater rank | `apps/web/features/structure/workspace.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D eventSchema/resolve; WS EventEditor | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Separate approval workflow for reopening | No Super Admin approval step; authenticated editor confirmation only | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: WS EventEditor; API/SVC | No dedicated implementation; related schema: Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Missing |
| Bells | Half-day consistency with present template | Full/less-specific template mismatch invalid | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`resolve`; tests/organization-licensing.test.ts | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Implemented |
| Bells | Half-day consistency with no template | Missing warning can publish incomplete instead of mandatory half error | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`resolve` ordering; audit in-memory check | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Partial |
| Bells | Identical/same-kind event duplicate policy | Not all duplicates rejected; tied working flags may be order-sensitive | `apps/web/features/structure/schedule-wizard.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: D:`resolve`, `review`; DB CalendarEvent | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Partial |
| Bells | Filtered list equals applicable current-board rules | Unfiltered shared-rule list can include targets outside that board | `apps/web/features/structure/calendar.tsx` | PUT /years/:id/config; POST /years/:id/rule-preview or preview; GET review; POST publish; evidence: CAL `applies` early true; D:`applicableRules` | Schedule (target/rule/slots JSON), CalendarEvent, RevisionBoard, Grade, Classroom | Partial |
| Calendar | Year-bound monthly grid/list | Date limits, resolved status, empty/error states | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: CAL monthRows/grid/list | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Board weekly off-days | Seven toggles in current draft, initially Sunday | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: CAL nonWorkingDays; D:`emptyConfig` | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Specific-date holiday CRUD | Event editor; typed/impact deletion | `apps/web/features/structure/workspace.tsx`; `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: WS EventEditor/delete; CAL | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Direct from/to holiday form | No dedicated continuous-range event form | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: WS EventEditor; DB CalendarEvent | No dedicated implementation; related schema: AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Missing |
| Calendar | Bounded recurring range | Weekdays plus inclusive startsOn/endsOn; all-seven represents continuous range | `apps/web/features/structure/scope-rule.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: SCOPE; D:`matches` | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Second/fourth Saturday presets | Recurring weekday 6 nth2/4 buttons | `apps/web/features/structure/scope-rule.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: SCOPE quick setup | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Fifth occurrence skip | No matching date if absent | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: D:`matches`, `recurrenceDates` | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Special working and half-day events | Distinct kinds, same scope/recurrence editor | `apps/web/features/structure/workspace.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: D eventSchema; WS EventEditor | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Conflict and holiday priority | Shared centralized resolver, used by preview/publication | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: D:`resolve`, `review`; E:`calendarDay` | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Effective classroom/date schedule | Scope/date filters, reason, complete slots; pages of ten | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: CAL Effective preview; SVC:`preview` | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Group day labels | Per-room resolution; mixed status where appropriate | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E:`calendarDay`; tests/enhancements.test.ts | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Summary school/board/section/grade/classroom | Entire-school or board/filter summary | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: CAL summaryScope; E:`calendarSummary` | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Total calendar days | Inclusive UTC date difference +1 | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E:`calendarSummary` | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Holiday deduplication | One resolved outcome/date, including Sunday overlap | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E:`calendarSummary`; tests/refinement.test.ts; audit check | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Reopened-Sunday arithmetic | Date leaves closed set and enters working set | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: D/E; audit 365-day example | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Working/full/half/unresolved counts | Exact status buckets; missing days provisional | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E:`calendarSummary` | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | True instructional-day total without schedules | Cannot establish; missing days counted working with warning | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E working/unresolved branch | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Partial |
| Calendar | Configured weekly working days | 7 minus unique weekly closure weekdays | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E:`calendarSummary` | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Observed weekly frequency | Only common count across complete 7-date weeks, else null | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E fullWeekCounts | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Working-week count | Monday–Sunday buckets containing any working date, partials included | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E weeks map | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Equivalent full working weeks / 0.5-day arithmetic | Not computed or shown | No client implementation found; inspected `apps/web/features/structure/calendar.tsx` | No client implementation; related module path: POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E summary outputs | No dedicated implementation; related schema: AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Missing |
| Calendar | Holiday list | Per-room reason/date list; UI requires one room for full list | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E holidayDates; CAL summary | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Common totals across differing dates/reasons | Returns null rather than summing room-days | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E:`same`; tests/refinement.test.ts | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Implemented |
| Calendar | Mixed flag detects half-only variation | Returns mixed=false for equal working/holiday dates despite differing halves; reproduced in memory | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: E mixed assignment; section 20 audit check | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Broken |
| Calendar | Unassigned-only calendar filter | No explicit unassigned option in this tab | No client implementation found; inspected `apps/web/features/structure/workspace.tsx`; `apps/web/features/structure/calendar.tsx` | No client implementation; related module path: POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: CAL section filter versus WS classroom filter | No dedicated implementation; related schema: AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Missing |
| Calendar | Compact rule labels expose every bound | Date bounds/anchor not fully shown in table labels | `apps/web/features/structure/calendar.tsx` | POST /years/:id/preview, calendar-summary, rule-preview; PUT config; GET review; POST publish; evidence: CAL:`whenLabel`, events columns | AcademicYear, RevisionBoard, CalendarEvent, Schedule, Grade, Classroom | Partial |
| Drafts | Database autosave | Whole draft after one-second parent debounce | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: WS:`persist`; SVC:`saveConfig`; STORE | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Immediate accepted batch/template save | Bulk/classroom/bell/event/preset commits before closing | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: WS commit handlers; SVC preset apply | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Resume draft after refresh/restart | Revision records persist; default config selects draft first | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: SVC:`config`; prior integration/HTTP evidence | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Version immutability | STORE refuses non-DRAFT writes | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: STORE:`writeConfig`; tests/integration.test.ts | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Logical versus physical IDs | Physical snapshot rows recreated; stable logical keys retained | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: STORE read/write; DB | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Stable grade/classroom ownership | Cross-board/type/parent moves rejected | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: I:`assertStableOwnership`; tests/structure-enhancements.test.ts | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Review field differences | Adds/updates/deletes, before/after values | `apps/web/features/structure/change-review.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: E:`configurationChanges`; DIFF-UI | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Dependency impact | Descendants/ancestors/rules with actual change counts | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: I:`configurationImpact`; tests/structure-enhancements.test.ts | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Impact is exact changed-date simulation | It is dependency collection, not effective-date recalculation | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: I:`configurationImpact` | No dedicated implementation; related schema: AcademicYear, Revision, all normalized revision children, AuditLog | Missing |
| Drafts | Delete/move/preset/publish impact surfaces | Explicit confirmation paths in source | `apps/web/features/structure/workspace.tsx`; `apps/web/features/structure/section-assignments.tsx`; `apps/web/features/structure/preset-preview.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: WS; SEC; PRESET-UI; DIFF-UI | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Revision lock plus web revision ID | Stale counter and replaced draft detection | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: WS refs; SVC save/publish/discard | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Revision ID universally required by API | Optional for compatibility | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: SVC input schemas | AcademicYear, Revision, all normalized revision children, AuditLog | Partial |
| Drafts | Concurrent cross-school cap enforcement | Shared organization row lock, projected usage | `apps/web/features/structure/workspace.tsx` | GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: LIC; tests/integration.test.ts | AcademicYear, Revision, all normalized revision children, AuditLog | Implemented |
| Drafts | Automatic edit merging/realtime collaboration | No merge/coediting implementation | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: GET/PUT /years/:id/config; POST/DELETE /years/:id/draft; GET review; evidence: WS/SVC conflict behavior | No dedicated implementation; related schema: AcademicYear, Revision, all normalized revision children, AuditLog | Missing |
| Publish | Full-year revalidation | Every date/classroom plus template/reference checks | `apps/web/features/structure/workspace.tsx` | GET /years/:id/review → review; POST /years/:id/publish → publish; evidence: D:`review`; SVC:`publish` | AcademicYear, Revision, Subscription, revision children, AuditLog | Implemented |
| Publish | Atomic active-pointer switch | Finalize draft and update year in transaction | `apps/web/features/structure/workspace.tsx` | GET /years/:id/review → review; POST /years/:id/publish → publish; evidence: SVC:`publish` | AcademicYear, Revision, Subscription, revision children, AuditLog | Implemented |
| Publish | Allow warnings/incomplete activation | Status INCOMPLETE_ACTIVE when nonblocking issues exist | `apps/web/features/structure/workspace.tsx` | GET /years/:id/review → review; POST /years/:id/publish → publish; evidence: SVC publish issues/status | AcademicYear, Revision, Subscription, revision children, AuditLog | Implemented |
| Publish | Require active subscription | No valid active contract rejects publication | `apps/web/features/structure/workspace.tsx` | GET /years/:id/review → review; POST /years/:id/publish → publish; evidence: LIC:`activeContract`; SVC:`publish` | AcademicYear, Revision, Subscription, revision children, AuditLog | Implemented |
| Publish | Always block all existing over-limit organizations | Existing overage is warning, not unconditional block | `apps/web/features/structure/workspace.tsx` | GET /years/:id/review → review; POST /years/:id/publish → publish; evidence: SVC publish usage warning; LIC additions rule | AcademicYear, Revision, Subscription, revision children, AuditLog | Partial |
| Publish | Persistent reviewed/approved state before publish | No separate Review model/token; publish revalidates directly | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: GET /years/:id/review → review; POST /years/:id/publish → publish; evidence: DB; SVC review/publish | No dedicated implementation; related schema: AcademicYear, Revision, Subscription, revision children, AuditLog | Missing |
| History | Published-version list | All non-DRAFT year revisions, summaries/status/date/warnings | `apps/web/features/structure/workspace.tsx` | GET /years/:id/history; GET config?revisionId; POST draft; DELETE draft; evidence: SVC:`history`; WS history table | AcademicYear, Revision, revision children | Implemented |
| History | View historical config API | Explicit revision constrained to authorized year | `apps/web/features/structure/workspace.tsx` | GET /years/:id/history; GET config?revisionId; POST draft; DELETE draft; evidence: SVC:`config` | AcademicYear, Revision, revision children | Implemented |
| History | Historical View from all UI entry paths | Review/history-intent key reset can remount after historical load | `apps/web/app/page.tsx`; `apps/web/features/structure/workspace.tsx` | GET /years/:id/history; GET config?revisionId; POST draft; DELETE draft; evidence: WS history View; APP key/onOpenStructure; section 21 | AcademicYear, Revision, revision children | Partial |
| History | Restore as new draft | New sequence/physical rows; active/source remain unchanged | `apps/web/features/structure/workspace.tsx` | GET /years/:id/history; GET config?revisionId; POST draft; DELETE draft; evidence: SVC:`draft`; tests/integration.test.ts | AcademicYear, Revision, revision children | Implemented |
| History | Restore with existing draft | Disabled and backend 409 | `apps/web/features/structure/workspace.tsx` | GET /years/:id/history; GET config?revisionId; POST draft; DELETE draft; evidence: WS Restore button; SVC:`draft` | AcademicYear, Revision, revision children | Implemented |
| History | Restored license capacity check | Normal addition projection enforced | `apps/web/features/structure/workspace.tsx` | GET /years/:id/history; GET config?revisionId; POST draft; DELETE draft; evidence: SVC:`draft`; LIC; tests/integration.test.ts | AcademicYear, Revision, revision children | Implemented |
| History | Discard full unpublished revision | Publication required; lock/id guard; transactional delete | `apps/web/features/structure/workspace.tsx` | GET /years/:id/history; GET config?revisionId; POST draft; DELETE draft; evidence: SVC:`discard`; WS | AcademicYear, Revision, revision children | Implemented |
| History | Discard first unpublished setup via endpoint | Not permitted | No client implementation found; inspected `apps/web/features/structure/workspace.tsx` | No client implementation; related module path: GET /years/:id/history; GET config?revisionId; POST draft; DELETE draft; evidence: SVC:`discard` publication precondition | No dedicated implementation; related schema: AcademicYear, Revision, revision children | Missing |
| Account | Organization identity | Read-only registered identity/contact/address | `apps/web/app/page.tsx` | GET /organization-profile, /usage; POST /auth/password or /auth/logout; evidence: APP Account; SVC:`organizationProfile` | Organization, Subscription, User, Session | Implemented |
| Account | Subscription table | Reference/status/allowances/validity, no client commercial edit | `apps/web/app/page.tsx` | GET /organization-profile, /usage; POST /auth/password or /auth/logout; evidence: APP Account; SVC profile projection | Organization, Subscription, User, Session | Implemented |
| Account | Used/limit user and classroom values | Organization usage response | `apps/web/app/page.tsx` | GET /organization-profile, /usage; POST /auth/password or /auth/logout; evidence: APP Account; LIC | Organization, Subscription, User, Session | Implemented |
| Account | Change password | Current verification, policy, session rotation | `apps/web/app/page.tsx` | GET /organization-profile, /usage; POST /auth/password or /auth/logout; evidence: APP account form; API password handler | Organization, Subscription, User, Session | Implemented |
| Account | Sign out | Deletes active session and clears cookie | `apps/web/app/page.tsx` | GET /organization-profile, /usage; POST /auth/password or /auth/logout; evidence: APP logout; API | Organization, Subscription, User, Session | Implemented |
| Account | Forgot-password/email reset/MFA | No client workflow/endpoints found | No client implementation found; inspected `apps/web/app/page.tsx` | No client implementation; related module path: GET /organization-profile, /usage; POST /auth/password or /auth/logout; evidence: Login; API dispatch; DB | No dedicated implementation; related schema: Organization, Subscription, User, Session | Missing |
| Requests | Client request list | Reason/status/submitted/resolution/View request | `apps/web/app/page.tsx` | GET/POST /requests; POST /assets; platform-only POST /requests/:id/resolve; evidence: APP Change requests branch; SVC:`requests` | ChangeRequest, Institution, Organization; logos in S3 | Implemented |
| Requests | Protected school proposal | Changed allowed fields only; reason; PENDING record | `apps/web/features/platform/requests.tsx` | GET/POST /requests; POST /assets; platform-only POST /requests/:id/resolve; evidence: REQ; SVC:`request` | ChangeRequest, Institution, Organization; logos in S3 | Implemented |
| Requests | Logo replacement proposal | Asset upload then proposal URL; approval changes identity | `apps/web/features/platform/requests.tsx` | GET/POST /requests; POST /assets; platform-only POST /requests/:id/resolve; evidence: REQ upload; API assets | ChangeRequest, Institution, Organization; logos in S3 | Implemented |
| Requests | Client approve/reject/cancel/edit existing | Resolution is platform-only; no cancel/edit client action | No client implementation found; inspected `apps/web/app/page.tsx` | No client implementation; related module path: GET/POST /requests; POST /assets; platform-only POST /requests/:id/resolve; evidence: SVC:`resolveRequest`; APP request view | No dedicated implementation; related schema: ChangeRequest, Institution, Organization; logos in S3 | Missing |
| Requests | Change requests URL persistence | Page not allowlisted on restore; reload falls back Overview | `apps/web/app/page.tsx` | GET/POST /requests; POST /assets; platform-only POST /requests/:id/resolve; evidence: APP clientNav/restore versus `setPage("Change requests")` | ChangeRequest, Institution, Organization; logos in S3 | Broken |
| Requests | Approval adds boards directly to every draft | Approval changes identity; draft loader repairs missing boards later | `apps/web/features/structure/workspace.tsx` | GET/POST /requests; POST /assets; platform-only POST /requests/:id/resolve; evidence: SVC:`resolveRequest` versus `saveInstitution`; WS:`load` | ChangeRequest, Institution, Organization; logos in S3 | Partial |
| Licensing | Organization-wide shared pool | Sum school maxima, no board/grade caps | `apps/web/features/structure/workspace.tsx` | AppService.usage / config / saveConfig / publish → organizationUsage / assertClassroomChange; evidence: LIC; D:`organizationUtilization` | Subscription, Institution, AcademicYear, Revision, RevisionBoard, Classroom, User | Implemented |
| Licensing | Draft/publication duplicate avoidance | Maximum count, not sum/union | `apps/web/features/structure/workspace.tsx` | AppService.usage / config / saveConfig / publish → organizationUsage / assertClassroomChange; evidence: D/LIC; tests/organization-licensing.test.ts | Subscription, Institution, AcademicYear, Revision, RevisionBoard, Classroom, User | Implemented |
| Licensing | Historical-year duplicate avoidance | Maximum across each school's current years | `apps/web/features/structure/workspace.tsx` | AppService.usage / config / saveConfig / publish → organizationUsage / assertClassroomChange; evidence: LIC; D utilization | Subscription, Institution, AcademicYear, Revision, RevisionBoard, Classroom, User | Implemented |
| Licensing | Inactive/pending schools retain capacity | Counted until records purge | `apps/web/features/structure/workspace.tsx` | AppService.usage / config / saveConfig / publish → organizationUsage / assertClassroomChange; evidence: LIC school query; API reconciliation | Subscription, Institution, AcademicYear, Revision, RevisionBoard, Classroom, User | Implemented |
| Licensing | One organization admin | Unique User.organizationId; ORG_ADMIN role | `apps/web/features/structure/workspace.tsx` | AppService.usage / config / saveConfig / publish → organizationUsage / assertClassroomChange; evidence: DB User; SVC activation | Subscription, Institution, AcademicYear, Revision, RevisionBoard, Classroom, User | Implemented |
| Licensing | Multiple client users/RBAC | No client creation/role editor or RBAC tables | No client implementation found; inspected `apps/web/app/page.tsx` | No client implementation; related module path: AppService.usage / config / saveConfig / publish → organizationUsage / assertClassroomChange; evidence: DB; APP; API | No dedicated implementation; related schema: Subscription, Institution, AcademicYear, Revision, RevisionBoard, Classroom, User | Missing |
| Security | Correct portal role on login | Exact PLATFORM_ADMIN/ORG_ADMIN check | `apps/web/app/page.tsx` | ApiController.handle / authenticate / login; AppService ownership guards; see security section; evidence: API:`login` | User, Session, Organization, Institution and authorized child records | Implemented |
| Security | Argon2id password protection | Node 24 built-in, fixed parameters, salted PHC | `apps/web/app/page.tsx` | ApiController.handle / authenticate / login; AppService ownership guards; see security section; evidence: `apps/api/src/password.ts`; tests/domain.test.ts | User, Session, Organization, Institution and authorized child records | Implemented |
| Security | Cookie session expiry/isolation | Hashed token lookup; org status; 8h expiry | `apps/web/app/page.tsx` | ApiController.handle / authenticate / login; AppService ownership guards; see security section; evidence: API:`createSession`, `authenticate` | User, Session, Organization, Institution and authorized child records | Implemented |
| Security | Origin plus CSRF mutation checks | Exact Origin, per-session header token | `apps/web/app/page.tsx` | ApiController.handle / authenticate / login; AppService ownership guards; see security section; evidence: API handler/authenticate; prior HTTP flow | User, Session, Organization, Institution and authorized child records | Implemented |
| Security | Shared/persistent rate limiter | Only process-local IP map exists | `apps/web/app/page.tsx` | ApiController.handle / authenticate / login; AppService ownership guards; see security section; evidence: API `attempts`, `login` | User, Session, Organization, Institution and authorized child records | Partial |
| Security | Tenant/year/revision boundaries | Session-derived owner and record checks | `apps/web/app/page.tsx` | ApiController.handle / authenticate / login; AppService ownership guards; see security section; evidence: SVC institution/year/config; PORTAL-API; integration tests | User, Session, Organization, Institution and authorized child records | Implemented |
| Security | Database RLS tenant enforcement | Not defined in inspected schema/migrations | No client implementation found; inspected `apps/web/app/page.tsx` | No client implementation; related module path: ApiController.handle / authenticate / login; AppService ownership guards; see security section; evidence: DB; service-based guard implementation | No dedicated implementation; related schema: User, Session, Organization, Institution and authorized child records | Missing |
| Security | 60-day school recovery | Platform-only pending/restore/purge lifecycle | `apps/web/app/page.tsx` | ApiController.handle / authenticate / login; AppService ownership guards; see security section; evidence: SVC:`institutionAction`; D:`deletionDue`; API reconciliation | User, Session, Organization, Institution and authorized child records | Implemented |
| Security | Logo content/size checks | MIME enum, <=2MiB, basic magic checks | `apps/web/features/platform/requests.tsx` | ApiController.handle / authenticate / login; AppService ownership guards; see security section; evidence: API `/assets`; REQ | User, Session, Organization, Institution and authorized child records | Implemented |
| Security | Full visual/accessibility certification | Responsive/focus/ARIA source exists; no full audit/browser pass | `apps/web/app/page.tsx` | No standalone API; frontend view/navigation/control behavior. Destination pages load their documented APIs. Evidence: UI/CSS; browser limitation | No direct DB operation; sessionStorage where stated | Unverified |
| Registration | Board activation/deactivation | Affiliations are board-name strings and revision boards have no active flag; school/grade/classroom flags are separate. | `apps/web/features/structure/workspace.tsx` | No board lifecycle endpoint; inspected institutionSchema / boardSchema | Institution.boards, RevisionBoard (no active property) | Missing |
| Registration | Empty grade allowed | A grade can have zero classrooms; there is no minimum classroom publication error. | `apps/web/features/structure/workspace.tsx` | AppService.saveConfig / publish; domain review | Grade, Classroom | Implemented |
| Sections | Empty section allowed | Sections can exist without assigned grades; section assignment is optional. | `apps/web/features/structure/section-assignments.tsx` | AppService.saveConfig; domain review / boardSchema | Section, Grade.sectionId | Implemented |
| Bells | Separate buffer interval model | Slot kinds are period/routine only; a named routine may represent a buffer, but there is no buffer kind or allocation field. | `apps/web/features/structure/schedule-wizard.tsx` | domain slotSchema / validateSlots | Schedule.slots JSON | Missing |
| Academic years | Creation response pointer refresh | POST returns the initial year object; draft pointer is set in the transaction afterward, and UI reloads current years/config. | `apps/web/features/structure/workspace.tsx`; `apps/web/features/structure/academic-year.tsx` | AppService.createYear then years/config refresh; source returns initial y, not refetched year | AcademicYear, Revision | Partial |

## 20. Existing Test Coverage

### 20.1 What was and was not executed for this report

**Read-only audit work (initial report and this report-format revision):** source reads/searches, an in-memory calculation check, report writing and report-integrity/source-fingerprint checks only. No application/database test runner, migration, seed, reset, build, browser launch or application startup was executed. This avoids runners that modify schemas, records, build directories, caches, generated types or traces.

**Earlier in this same working session, before the read-only request:** tool outputs established 181 passing unit/domain/security cases, five passing isolated PostgreSQL integration cases, one passing authenticated HTTP journey, application/test-source TypeScript success, optimized API/Next.js build success, and seven Playwright scenarios discovered. These are historical observed results for the immediately preceding source changes, not fresh production acceptance or newly rerun audit results.

The earlier normal unit run reported `181 passed | 5 skipped` across eight test files: the five database cases are skipped by default and were separately run successfully with the isolated database runner. The total is not “186 unit tests plus five more independent database cases”; the skipped five are the same integration cases executed separately.

### 20.2 Test inventory inspected

| File / configuration | What it actually covers |
| --- | --- |
| `vitest.config.mts` | Includes `tests/**/*.test.ts`, 30-second test timeout, no file parallelism, threads pool |
| `tests/domain.test.ts` | Auto Assign fixed routines/impossible layouts/durations; gaps/overlaps/out-of-day; recurrence/date/target precedence; holidays/off-day reopening/inactive; count/review/name/target validation; copying; 60-day deletion; salted password verification; deletion target pruning |
| `tests/enhancements.test.ts` | Field diffs/independent entity order; slot diagnostics including nested overlap; classroom filters/group-day results; settings/onboarding; navigation child-parent save ordering/failure/discard/loop guard |
| `tests/organization-licensing.test.ts` | Maximum-count utilization across revisions/years/schools; inactive/empty cases; contract category; bell/half-day priorities, matching-template requirement, overlaps, chronology/inactive grade |
| `tests/refinement.test.ts` | Shared school/multi-board/group scopes; legacy board defaults; date priority; equal-priority conflict; full-holiday reopening gate; section/grade pruning; mixed calendar dates; zero active rooms; exceptional half-day/working-week counts |
| `tests/bulk-workflows.test.ts` | Numeric grade ranges; board name options; duplicate/custom names; classroom suffixes beyond Z; inactive collisions; every-grade counts; custom/stale preview validation; editable board catalogue |
| `tests/structure-enhancements.test.ts` | Seven default presets/custom alias/no-section presets; record preservation/reuse/selected-board isolation; assignment; parent/inherited deletion impacts; stable ownership; date bounds/fifth occurrence/copy exclusions; dedup/reopened Sunday totals |
| `tests/client-portal.test.ts` | Current/selected/historical/future year selector; status/action mappings; separate Schools/Overview/details versus Structure/review entry selectors; inactive inspection |
| `tests/integration.test.ts` | Five gated service/database cases listed below; actual transactions/Prisma/SQL, not merely mocks |
| `tests/http.e2e.mjs` | Node test runner; authenticated platform onboarding → temporary org login/password replacement → schools/directory/details → draft/publish/history/tenant boundary → delete/restore; new status/board filters and metrics assertions |
| `e2e/workspace.spec.ts` | Seven browser scenario sources; credentials required, otherwise beforeEach skips |
| `playwright.config.ts` | Desktop Chromium, one worker, 90-second timeout, CI retry, trace/screenshot on failure; no configured mobile browser project |
| `scripts/test-isolated-db.cjs` | Creates random test schema, deploys migrations, mutates synthetic data, runs service/HTTP/browser checks, removes test schema; browser mode builds/starts a separate web/API pair and cleans artifacts/config include |

Five integration case names:

1. Persists shared calendars, explicit reopening, scoped summaries and tenant profile.
2. Scopes paginated client directories, selected years and school details to the organization, including active/inactive filters and deleted visibility.
3. Persists presets atomically and rejects stale/foreign draft edits.
4. Serializes classroom creation across schools and preserves over-limit records after reduction.
5. Completes onboarding, protects tenants, enforces entitlements and versions drafts, including publication immutability, restore and stale discard.

### 20.3 Browser sources and actual results

The seven source-defined scenarios cover: platform record read-only editing; settings save/discard; a long client bell-conflict/publication/multi-year workflow; header search/collapse; record details/onboarding views; multi-board registration; and separate client inspection/configuration entry points including account-status filter, whole-row/card keyboard click, metric count, academic-year fresh/copy, all four tabs and calendar refresh intent.

Earlier six scenarios were attempted in an isolated production-built application. All failed **before a page could open** because Chromium's macOS MachPortRendezvousServer bootstrap was denied. That is an environment browser-launch failure, not six demonstrated app regressions or six successful tests. The seventh scenario was added later and only source-discovered/compiled. The earlier dev-mode test app also encountered a watcher limit before the runner was switched to a production build. None of these failed launches establishes desktop or mobile visual quality.

No browser retry was performed during this audit. No persistent real user's login, school selection or browser session was operated.

### 20.4 Pure-function checks from the initial read-only audit

A one-off Node command read the TypeScript domain files, transpiled them **in process memory** and loaded domain modules without saving generated files or connecting to the database. It used synthetic configs and assertions; no application/server bootstrap was imported.

| Check | Actual result |
| --- | --- |
| Auto Assign fixture, 08:00–12:30/four 60-minute periods/10:00 lunch | Starts `[480,540,600,630,690]`, assertion passed |
| 365 days, Sunday closure plus overlapping Sunday event, 15 non-Sunday holidays, one explicit reopened Sunday | calendarDays=365, workingDays=299, holidays=66, provisional=false |
| Two rooms with same 6 working dates/one Sunday holiday, but one full and one half-day template | common workingDays=6, common halfDays=null, **mixed=false** |
| Half-day event with no applicable template | resolve status=missing, review blocking-error count=0 |

These are real outputs from the initial read-only audit and were not rerun for this revision. They validate the formulas and demonstrate the stated edge cases; they do not verify database persistence, UI rendering or the current tenant's actual calendar.

### 20.5 Coverage gaps and limits

No successful browser evidence was found for school row/card click handling, details sub-tab/actions, navigation refresh/back of intent-specific paths, generation-input dirty guards, mobile layout, all account-status/filter/sort combinations or history View after a parent component key change. Some have browser source assertions, but those were not executed successfully.

No successful exhaustive test was found for half-only yearly mixed detection, tied same-kind working events with different reopening flags, a nonexistent half-day template blocking policy, very large school/configuration performance, portal parallel-query snapshot consistency, simultaneous registration approval versus config publication, copying/rebasing anchors into a different calendar year, or uploaded-but-abandoned asset cleanup. The in-memory checks above establish two mathematical edge outcomes, not comprehensive coverage of those categories.

Existing unit/API tests do not establish Canva compliance, production infrastructure state, live customer data correctness, accessibility certification or successful mobile/browser journeys. Those claims are intentionally absent.

## 21. Technical and Functional Gaps

No fixes are proposed or implemented here. The following are current observations with evidence and scope.

| ID | Observation | Evidence / consequence |
| --- | --- | --- |
| L01 | Yearly `mixed` flag misses half-only calendar variation | Audit in-memory result: W=6 for both rooms, halfDays differ, mixed=false. E computes mixed only from common workingDays/holidayDates. Individual halfDays still returns null, so the warning and numeric outputs can disagree about variation |
| L02 | Missing schedules inflate provisional working/full counts | E counts missing as working+unresolved; `fullWorkingDays=W-halfDays`. Counts are labeled provisional but are not guaranteed actual teaching dates |
| L03 | Half-day event without template can publish incomplete | Audit check returns missing and zero blocking errors. With a present full template it is invalid, so two “missing half-day setup” situations have different enforcement |
| L04 | Change requests list does not restore as its own page | APP sets page Change requests from Account, but clientNav/page restore allowlist excludes it; reload resolves to Overview. Existing request data/API remain intact |
| L05 | Historical View has an entry-dependent remount path | WS history View calls `load(yearId,historicalId)`, then APP `onOpenStructure` resets schoolIntent to default; Structure is keyed by `institution.id + schoolIntent`. When entered via review/history intent, that key changes and can discard the loaded historical selection on remount. Normal default-intent workspace history does not necessarily take that path. This is a source-traced limitation; not browser-reproduced |
| L06 | Discard/undo are not general multistep history | Assignment Undo is one local snapshot; initial draft cannot be whole-discarded through API; editor unsaved discard differs from deleting a saved working draft |
| L07 | Generator helper inputs are not fully guarded/persisted | WIZ dirty baseline compares schedule JSON; planned count/default minutes/comma plan are separate state. Editing only these inputs can be lost without appearing as a schedule change until generation/slot changes occur |
| L08 | No direct continuous holiday-range UI | Range fields apply to weekly/recurring rules with selected weekdays; representing every range date requires all seven weekdays, not a dedicated holiday date-range editor |
| L09 | Not every date is classified as W or H during conflicts | Invalid/conflict dates belong to unresolved only; N=H+W+I. A simple displayed W+H comparison can leave an expected unresolved remainder |
| L10 | Common totals use holiday reason text as well as dates | Same dates/counts but different reason strings can yield null/Varies; half-only differences may not set mixed. This is not a complete calendar-pattern equivalence test |
| L11 | Table recurrence labels omit some stored detail | startsOn/endsOn/anchor are not fully visible in `whenLabel`/calendar event date-rule column. Editor/pattern preview contains more detail |
| L12 | Unfiltered shared-rule lists are broader than current applicability | CAL `applies` returns true when no narrow filters are active; `applicableRules` includes shared group scopes from other boards. A listed shared rule can target another board only even though the effective resolver correctly excludes it |
| L13 | Status reflects pointer existence, not content difference | A just-created unchanged draft is Draft Changes Pending if a publication exists; no diff test is used in the selector. “Active structures” includes incomplete/pending states with a publication |
| L14 | Details calendar completion is heuristic | hasCalendar checks some schedule exists and no provisional summary. Zero active classrooms can evade coverage demonstration; it is not an explicit complete-setup review |
| L15 | Details schedule counts are owner-record counts | A board inheriting a school default can show zero own defaults; this does not mean no effective schedule exists |
| L16 | Historical identity is not versioned with structure | Institution identity is current shared data, so historical academic snapshots do not preserve earlier school name/officer/address as independent identity snapshots |
| L17 | Year copies retain recurrence anchors | Date-bound rules are excluded, but reusable interval anchorDate is not shifted. Copy notice requires review; no automatic calendar-year remapping |
| L18 | Maximum-year span wording versus inclusive enumeration | End-start <=550 days allows 551 counted dates. No year-overlap prohibition exists |
| L19 | Registration approval and direct admin update sync differ | `saveInstitution` appends boards to drafts and bumps locks; `resolveRequest` updates identity without that same loop. Workspace reload can repair missing boards. Concurrent approval/config behavior is not exhaustively verified |
| L20 | Licensed usage is a maximum reservation model | It can differ from displayed-year count or the union of old/new logical room IDs; inactive/pending schools still reserve until actual removal |
| L21 | Over-limit is not always a publication block | Existing excess after a valid contract reduction becomes warning; additions blocked. Expired-contract edits can be saved, but publication still requires a valid contract |
| L22 | Revision ID optional at API boundary | Updated web sends ID+lock; older API callers can omit ID, leaving only numeric stale checking |
| L23 | Directory metrics/read models are not one transaction snapshot | Parallel rows/count/metrics/activity/license queries may observe different commits during active writes. No realtime synchronization/automatic merge is implemented |
| L24 | Initial shell still fetches all identity rows | The SQL school directory paginates, but initial `/institutions` does not. Large-organization loading/performance was not measured |
| L25 | No generalized multi-user client RBAC | Contract user limits exist, but schema/account workflows implement one organization administrator |
| L26 | Same-kind calendar ties are not fully conflict-defined | Equal opposing holiday/working events conflict; same-kind duplicates may coexist. Different reopening flags at equal working rank are not covered comprehensively |
| L27 | Native browser verification blocked | Earlier sandbox prevented Chromium bootstrap; no current responsive visual or interaction pass can be claimed. Seven browser sources are not seven passing UI tests |
| L28 | Some page-style workflows have internal state only | Query state preserves main page/school/intent, not every open structure modal, preview page, section selection or unsaved helper control. Refresh can return to parent workspace rather than that internal editor |
| L29 | Asset lifecycle is broader than approved identity lifecycle | Logo upload happens before request approval; no abandoned/rejected-upload cleanup was identified. MinIO logo bucket is publicly readable by configured URL |
| L30 | Security controls have deployment limits | Login limiter is process-local; no database RLS, MFA or client password-recovery flow found. Actual production proxy/cookie/Origin configuration was not inspected |
| L31 | Generic table UI and persisted status can differ temporarily | Inline local commit can finish before parent one-second autosave; parent save-state/error remains the persistence authority. There is no automatic merge on 409 |
| L32 | No live tenant data audit performed | Report establishes source functionality and earlier tests, not the exact counts/settings/migration state of a currently deployed customer database |
| L33 | Year creation response can carry the pre-update draft pointer | createYear returns the initial y object after updating the stored year pointer separately. Existing UI refreshes years/config; direct consumers must not infer draft absence from that initial response alone |

## 22. Final Current-State Summary

The current Organization Client Portal implements three separate source-level experiences: organization overview, school inspection, and academic structure configuration. It has real backend directory metrics, List/Card schools with SQL filters/pagination, read-only school details, protected registration proposals, state-aware actions, an in-school academic-year workflow, shared board presets, bulk grade/section/classroom management, a guided exact-fit bell editor, targeted recurring/day-specific overrides, effective calendars and calculated totals, database-backed drafts, review diffs/impact, transactional publications and historical restoration.

The application is not a full school ERP or timetable solver. In the inspected client/schema it does not implement subjects/teacher/student administration, physical room management, field-by-field schedule overrides, a universal completion checklist, arbitrary multi-user RBAC, equivalent full working-week calculations, or the missing workflows explicitly identified above.

The strongest verification evidence is the prior 181-case unit run, five isolated PostgreSQL cases, authenticated HTTP lifecycle, TypeScript/build success and the audit's isolated in-memory formula checks. Browser navigation and visual acceptance remain unverified. Current source behavior, actual mathematical outputs and source-traced limits have been separated from historic test results throughout this report.

**Inspection completeness:** all principal organization-client components, shared structure/domain rules, portal/auth/API dispatch and services, Prisma schema, licensing/store logic and test sources were available for inspection. Generated dependency/build internals were not treated as first-party feature evidence. Secrets, production infrastructure, live customer record contents, actual S3 objects and successful rendered browser screens were not inspected. These are verification boundaries, not assertions that those features/data are absent.

**Read-only delivery:** the only intentionally written file for this audit is `CLIENT_PORTAL_CURRENT_STATE_AUDIT.md` at the project root. No improvements, configuration edits, migration/seed/reset, database mutation or application UI change was performed.
