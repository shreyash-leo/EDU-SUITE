# Organization client portal refinement — 15 November 2026

## Implemented pages

| Page | Behavior |
| --- | --- |
| Overview | Four linked metrics, exclusive per-school status groups, schools requiring attention, real audit events and subscription snapshot |
| Schools | All registered non-deleted schools; persistent List/Card mode, school-name search, board/status filters, name/last-update sort and server pagination |
| School details | Dedicated page with read-only identity; School Overview, Academic Structure, Bell Time & Calendar, Configuration & History tabs; school/year context and state-aware actions |
| Structure Management | School-selection dashboard instead of opening an arbitrary school; contextual start/continue/edit/review actions |
| Review & History | School-selection directory leading to the existing selected-year draft review and published-version tools |
| Account & Subscription | Existing organization identity, contractual allowances, subscription validity and registration requests retained |

The primary client navigation now has five entries. Academic Years is removed from the sidebar; Manage academic years, creation, fresh/copy setup, selection and history remain inside the school workspace. Existing four Structure Management tabs and three Bell/Calendar views remain intact. Identity changes use the existing protected change-request workflow.

## Status and data rules

Each school contributes one row and one status. Its represented academic year is the explicit retained selection for that school; otherwise the current year, latest started year, or earliest upcoming year. An unrelated future draft does not override the operational current year. The year label is visible in directories, attention items, activity and school details. All historical years remain selectable.

Statuses: Not Started; Draft; Incomplete Active; Active; Draft Changes Pending. Configured/active-structure metrics count schools with a published revision. Setup-in-progress counts schools without a publication (Not Started/Draft), so these primary metrics do not count the same school twice. Attention additionally includes incomplete publications and pending draft changes. Status-group totals are mutually exclusive. Classroom counts in each directory row represent its displayed year/configuration, not the separate organization-wide licensing reservation.

Inactive registered schools remain visible with read-only details. Editing is disabled and remains denied by the existing backend. Schools pending deletion remain hidden from the client as before, preserving the 60-day recovery policy.

## Backend and performance

- `GET /api/client-portal`: authenticated organization-only directory, metrics, first six attention items, eight recent audit events, board options, license snapshot and contracts.
- Search, board/status filters, sorting and pagination execute on PostgreSQL. Page size defaults to 12, maximum 50. Queries use parameterized SQL and organization-scoped joins.
- One academic year is selected per school before computing status/counts. No per-row browser requests or duplicate school/configuration records.
- `GET /api/institutions/:id/portal?yearId=...`: authorized read-only school identity, year options, board/grade/classroom summaries, inherited calendar summary and published history.
- Legacy `/institutions` retains its response identity fields but avoids loading every year's revision metadata for organization clients. Platform behavior is retained.
- Actual draft saves produce audit change records. Activity labels derive from those records and existing academic-year/publication history.
- `Revision.updatedAt` records saves/publication for accurate directory ordering. Migration backfills existing snapshots from publication/creation timestamps.
- Shared button primitives now forward accessibility attributes; List/Card toggles announce their pressed state.

## Main files

- `apps/web/features/client/portal.tsx`: overview, directory, school details and contextual navigation.
- `apps/web/app/page.tsx`: five-item navigation and dedicated page routing.
- `apps/web/features/structure/workspace.tsx`, `calendar.tsx`: in-school academic-year management and direct calendar/edit actions.
- `apps/web/app/density.css`, `apps/web/components/ui.tsx`: compact responsive styles and accessible controls.
- `apps/api/src/client-portal.ts`, `service.ts`, `main.ts`: directory/detail queries, tenant access, audit events and routing.
- `packages/domain/src/portal.ts`: operational year/status/action selectors.
- `prisma/schema.prisma`, `prisma/migrations/202611150002_revision_updated_at/migration.sql`: additive save timestamp.
- `tests/client-portal.test.ts`, `tests/integration.test.ts`, `tests/http.e2e.mjs`, `e2e/workspace.spec.ts`: selectors, database isolation/pagination, authenticated HTTP and updated browser journeys.
- `scripts/test-isolated-db.cjs`: disposable-schema integration, HTTP and browser runners. Synthetic credentials are generated only in the test schema and never replace real users.

## Verification and limits

174 unit/domain/security tests pass. All five PostgreSQL integration tests pass in an isolated temporary schema, including real directory SQL, pagination/filtering, school/year selection, inactive/deleted visibility, organization isolation and immutable versions. The authenticated HTTP onboarding → password replacement → school directory/details → draft/publication/history → deletion/recovery journey passes against a separate temporary schema. Test schemas and test servers are cleaned up.

Application and test-source TypeScript checks and optimized API/Next.js builds pass. Prisma client generation and the additive migration succeeded. Existing school records and credentials were preserved.

Six Playwright scenarios are updated and discovered, but browser interaction/visual acceptance remains unverified: macOS sandbox blocks Chromium launch (`MachPortRendezvousServer: Permission denied`). The production test app started successfully; six browser launch failures are environment failures, not passing UI tests. Desktop/mobile appearance is not claimed as visually validated.

Reproduce database/HTTP checks safely with `npm run test:db:isolated` and `npm run test:http:isolated`. Run `npm run test:browser:isolated` in a local terminal with browser-launch permission for visual acceptance.

## Run the update

The migration has been applied in this workspace. Restart API/web with Node 24.11 or newer:

```sh
export PATH="/usr/local/bin:$PATH"
npm run dev
```

For another checkout/database, apply `npm run db:migrate && npm run db:generate` first. Do not reset volumes, reseed or reset credentials for this update.

## Follow-up routing correction

The latest client portal restructuring specification adds stricter whole-row/card navigation and a school-account filter. These are implemented:

| Entry/action | Destination |
| --- | --- |
| Overview school name / activity school | Dedicated School Details |
| Schools name, row, card, Open School | Dedicated School Details; never the editor |
| Structure Management sidebar | School-selection dashboard |
| Structure dashboard school name, row or card | Selected school's configuration workspace; inactive schools remain read-only details |
| Explicit Open School on any directory | School Details |
| School Details → Manage Structure | Selected school's configuration workspace |
| School Details → Manage Bell Time | Bell Time & Calendar → Default Bell Schedule |
| School Details → Open Calendar | Bell Time & Calendar → Academic Calendar |
| School Details → Open History | Published version history in the school's Review & History workspace |

Row/card activation supports Enter/Space and does not intercept nested buttons/links. School status (Active/Inactive) is filtered server-side alongside boards and structure status in both display modes. Card registration numbers are now visible. Overview attention items use a compact School/Academic Year/Current Status/Required Action table. Setup metrics and structure dashboard labels now match the explicit requested terminology.

Workspace URLs distinguish `workflow=schoolDetails` and `workflow=schoolWorkspace`. A validated `intent` query parameter preserves calendar, bell, review and history destinations through refresh/back navigation. School/year selection remains scoped to the school. The editor back button explicitly returns to the Structure Management dashboard.

No additional database migration is needed for this follow-up. The new shared route selector has seven regression cases. The browser test source now includes the seven requested acceptance areas: details vs editor routing, dashboard entry, quick actions, academic-year creation/copy, List/Card and status filtering, real metrics and four-tab regression. Browser execution remains blocked by the previously observed macOS Chromium-launch sandbox restriction; source discovery/compilation is not a browser pass.
