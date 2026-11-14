# PLAN EDU SUITE — final refinement implementation

Applied to the existing Next.js/NestJS/Prisma project on 15 November 2026. The source prompt was the PLAN EDU SUITE final refinement and implementation prompt. Existing records, API paths, revision history and organization licensing were retained. No database reset, reseed, password change or destructive migration was run.

## Audit and implementation

| Requirement | Result |
|---|---|
| Organization → School → Board → Section → Grade → Classroom | Existing multi-board model retained. School terminology applied to both portals and user-facing validation. Permanent entity keys, nullable grade section assignments and board-scoped name validation retained. |
| Super Admin | Six main sections retained; Institutions renamed Schools. School table includes structure status. Dashboard remains compact with organization metrics and recent records. |
| School onboarding synchronization | Existing single school registration record continues to power Super Admin, organization details and the tenant School Workspace. Client registration identity stays read-only; changes use requests. |
| Activation | Manual activation, one-time credential display and client first-login password replacement retained. The separate local Super Admin recovery command still uses `.env` credentials as requested earlier. |
| Organization licensing | Existing organization lock, shared classroom and user limits, inactive classroom counting, cross-school/year reservation calculation and over-limit preservation retained. |
| Workflow pages | Registration, detailed editing, record details, requests, academic year creation, bulk classroom creation, schedule/event configuration, review and history now use dedicated page surfaces with back controls and breadcrumbs. |
| Dialogs | Small confirmations, credentials, lifecycle warnings, account password changes and simple grade/section/classroom edits remain dialogs. |
| Browser navigation | Platform page/record/workflow identifiers are in URL query parameters and restored on refresh/back/forward. Unsaved-change guards remain. Structure school/year/board context is retained; a schedule editor's unsaved form is not a deep link. |
| Client navigation | Overview, Schools, Structure Management, Academic Years, Review & History, Account & Subscription. Selected school is preserved across relevant sections; year and board selection are retained per school. |
| Four Structure tabs | School Registration, Academic Sections, Classroom Setup, Bell Time & Calendar retained with existing CRUD/bulk actions/autosave. No subject assignment added. |
| School-wide default bell time | New school scope applies one stored default across every board, including a later-synced board. Existing board-local rules stay compatible. |
| Scoped overrides | Single/multiple boards, sections, grades and classrooms supported. Shared plural target references are validated against the same school revision. |
| Default/advanced scheduling | Separate Default Bell Time and Advanced Scheduling views. Advanced schedules and calendar actions support date, weekly, nth weekday and interval recurrence rules. |
| Auto Assign | Existing anchored routine generator and exact coverage validation retained. Manual fixed routine movement/type changes and deletion now require confirmation. |
| Holidays | Full holidays suppress teaching/half-day schedules. Ordinary higher-priority working events cannot silently reopen a full holiday. Explicit specific-date reopening requires a confirmation and the new boolean flag. Equal-priority opposing events remain conflicts. |
| Effective previews | Backend preview receives the complete unsaved school configuration so shared rules resolve consistently across boards. Reason, day type, arrival/dispersal, periods and routines remain visible. |
| Academic calendar totals | New scoped summary endpoint derives working days, holidays, half-days, unresolved days, working weeks and observed days per week per active classroom. Differing calendars show varies/mixed rather than an incorrect common total. Selecting a single classroom shows its holiday list. |
| Academic year copying | Existing Start Fresh/Copy flow and included/excluded counts retained; school-wide recurring rules copy once, fixed-date events/schedules are excluded, source years remain independent. |
| Draft/review/publication/history | Existing optimistic locks, published/draft separation, transactional publication and historical restoration retained. History lists are paginated; review uses centralized shared-rule resolution. |
| Deletion | Existing deactivation, 60-day scheduled deletion, restoration, legal holds, reconciliation and audit retained. |
| Boundaries | No WDM, Subject Allocation, timetable generation, additional client accounts/RBAC, email or payment gateway integration added. |

## Database update

Apply additive migration `202611150001_calendar_overrides` before starting this version. It adds `CalendarEvent.overridesHoliday BOOLEAN NOT NULL DEFAULT false`; no rows are removed or rewritten. The target-scope additions use existing JSON fields. Physical schedule/event rows remain owned by one revision board; shared rules are stored once and evaluated across that revision.

## Calendar definitions

- Dates are counted once per classroom; overlapping holidays are not double-counted.
- Half-days are included in working days and reported separately.
- Missing bell schedules retain the calendar's working-day status and are also reported as unresolved; invalid/conflicting dates are unresolved.
- Working weeks count Monday–Sunday weeks with at least one working date, including partial boundary weeks.
- Working days per week is derived from complete weeks. It shows varies when weekly counts differ; no complete week means it is unavailable.
- Group totals are common values only when applicable calendars agree. Use classroom rows for distinct results.

## Verification and remaining acceptance

| Check | Result |
|---|---|
| Prisma client generation | Passed |
| TypeScript application checks | Passed |
| Test source compilation | Passed, including PostgreSQL and browser test sources |
| Unit/domain/security suite | 109 passed |
| PostgreSQL service integration | 3 explicitly skipped without disposable database opt-in |
| API production compilation | Passed |
| Next.js optimized production build | Passed |
| Prisma schema validation | Passed |
| Browser suite discovery | 5 scenarios discovered; source updated for page workflows and client navigation |
| Live migration | Attempted; failed P1001 reaching localhost:55432 from this execution session |
| Real HTTP / browser acceptance | Not executed; requires a reachable migrated disposable instance and supplied credentials |

New regression cases cover school defaults, scope/date priorities, multiple-board targeting, cross-board grade/section/classroom selections, invalid references, equal-priority conflicts, full-holiday protection, explicit reopening validation, copy exclusions, draft deletion/reference pruning, mixed/deduplicated calendar totals, zero active classrooms and exceptional half-days opening normal weekly closures. Existing licensing/deletion/publication tests remain.

The browser suite now expects dedicated regions rather than oversized dialogs and covers detail-page URL restoration. Its client journey additionally checks calendar totals, Academic Years, Review & History, Account & Subscription and preserved school/year selection. Database integration adds actual shared-rule/explicit-reopening persistence, summary resolution and tenant authorization. Test inclusion/discovery is not evidence that database/browser journeys ran.

Complete the 22 requested acceptance journeys against a disposable instance after migrating. Visual layout at desktop/mobile sizes, uploads/refresh persistence, real concurrent database writes and the full first-login/publication journey still require live verification. Do not interpret this implementation record as certification that those unexecuted checks passed.

## Run the updated existing project

Open Docker Desktop. Stop any previous local dev server with Control+C. Keep `.env` and existing volumes.

```sh
cd /Users/shreyash/Documents/Codex/plan-edu-suite
export PATH="/usr/local/bin:$PATH"
docker compose stop api web
docker compose up -d --wait postgres minio
docker compose up -d bucket
npm run db:migrate && npm run db:generate && npm run dev
```

Open http://localhost:3000. Existing account passwords remain unchanged. No seed/reset command is needed. The Docker API/web services remain stopped while host development uses ports 3000/4000.

For database/browser acceptance use the disposable-instance commands in README.md. `npm run typecheck`, `npm test` and `npm run build` validate source without modifying school data.
