# Academic structure enhancements — 15 November 2026

Implemented against the existing Structure Management module, without replacing its bell engine, licensing, authentication or onboarding flows.

| Requirement | Result |
| --- | --- |
| Board grade and section presets | Editable Super Admin catalogue; CBSE, ICSE/CISCE, ISC, IB, IGCSE/CAIE and state-board starting points; school-side preview/customization; existing records reused and preserved; selected board only |
| Bulk section assignment | Select, assign, move or unassign grades; counts, current assignment, impact confirmation and Undo; same-board validation; section deletion leaves grades unassigned |
| Recurring calendar rules | First–fifth selected weekdays, intervals, specific dates, inclusive date ranges; matching dates preview; nonexistent fifth occurrences skipped; existing holiday/conflict precedence retained |
| Effective working totals | Working/holiday/half-day/full-day totals, weekly pattern, observed complete-week frequency, effective working weeks, holiday list, mixed-calendar and unresolved/provisional indicators |
| Dependency impact previews | Delete section/grade/classroom, move assignments, apply presets and publish; stable-ID record changes, affected classrooms, scopes, bell schedules and calendar rules |
| Version safety | Draft ID plus optimistic lock, storage rejection of published edits, guarded discard, existing immutable history and separate restored drafts |

## User flow

Super Admin: Requests & Settings → Platform settings → Edit academic presets. Edit board aliases, sections and grade assignments, then save. Existing school configurations are unaffected.

School: School Registration or Academic Sections → Apply Suggested Structure. Select a board preset, rename/remove suggestions, choose optional assignment changes for reused grades, preview impact, confirm. Customize Manually retains the existing bulk/manual tools. Other boards and existing classrooms remain intact.

Assignments and deletions display consequences before confirmation. Review draft changes shows publication impact and existing validation; publish remains the only operation changing the published pointer. Opening history does not make it editable. Restore creates a working draft for normal review/publication.

Calendar rules show matching dates before save, including optional inclusive range bounds. These are pattern matches; effective classroom calendars still enforce holiday overrides, specificity and conflicts. Weekly nonworking dates overlapping a holiday count once. Explicit date reopening must outrank a holiday; equal-priority contradictory exceptions remain a conflict.

## Main files

- Domain: `packages/domain/src/presets.ts`, `impact.ts`, `index.ts`, `enhancements.ts`.
- API: `apps/api/src/service.ts`, `main.ts`, `store.ts`.
- UI: `apps/web/features/platform/academic-preset-catalogue.tsx`; Structure Management preset, impact, assignment, scope, recurrence, calendar and workspace components; `apps/web/app/density.css`.
- Tests: `tests/structure-enhancements.test.ts`, `tests/integration.test.ts`, assignment confirmation in `e2e/workspace.spec.ts`.
- Contracts: `API.md`, `ARCHITECTURE.md`.

## Data and compatibility

No new migration for this enhancement. Presets persist in existing platform settings JSON; range fields use existing recurrence JSON. Existing settings load defaults. Existing data and credentials are preserved. Apply earlier pending migrations, including `202611150001_calendar_overrides`, if not already applied. Never delete volumes or reseed to install this update.

The web client now sends `revisionId` and `lock`. Existing save/publication clients may omit revisionId; discard requires a lock body. Use the updated web and API together. Organization-wide classroom accounting and inactive classroom counting are unchanged.

## Verification

156 unit/domain/security tests pass, including 30 enhancement tests covering default/custom presets, preservation/reuse, board isolation, ownership, assignment, dependency counts, bounded recurrence, missing fifth weekdays and calendar deduplication/reopening. Four PostgreSQL integration cases are explicitly skipped unless a disposable database is configured; their source includes persistence, stale lock/revision rejection, immutable publications, restore and discard protection. Application and test-source TypeScript checks pass. API and Next.js optimized production builds pass. Six Playwright scenarios are discovered; discovery is not browser execution.

Live database and authenticated visual acceptance remain pending. This session cannot access the Docker socket, and native computer-use permission is unavailable. No live login, mobile layout or end-to-end database success is claimed.


## Follow-up attachment audit

Rechecked Pasted text(9), which repeats the six-feature specification. Corrected classroom-deletion impact to include the parent grade, academic section and their inherited calendar/bell rules. Unaffected sibling classrooms are excluded. A regression test verifies ancestor/dependency lists and exact removal counts. No further schema or migration changes were needed.
