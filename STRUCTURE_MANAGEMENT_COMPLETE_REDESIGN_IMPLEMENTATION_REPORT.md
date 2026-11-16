# Structure Management — three-part scheduling implementation

16 November 2026. Implemented in the existing PLAN EDU SUITE repository. Status: application/domain implementation and local compilation checks complete; database migration execution, live integration and browser acceptance remain blocked by this environment.

## 1. Executive summary

The existing application now supports Default Bell Timing, Default Holidays, Advanced Scheduling, and Review & Publish. The implementation extends the current revision workflow rather than rebuilding it. School/board/section/grade/classroom targeting, full-template inheritance, stable identifiers, existing licensing, autosave, optimistic concurrency, publication history and downstream output remain in use.

The central change is a versioned scheduling resolver. Version 2 resolves linked holiday families before advanced exceptions, then inherited normal timing. Shortening a targeted vacation removes that vacation's closure only; independent holidays remain closed. Advanced rules cannot reopen effective Default Holidays. Ambiguous ties, invalid relationships, invalid timing and missing operational schedules block version-2 publication.

UI changes cover registration guidance and configuration status, section-assignment summaries, optional classroom capacity, clearer scheduling navigation, inherited default coverage, linked holiday overrides, unified advanced event/template authoring, and effective calendar review before publication. No visual acceptance or responsive-browser success is claimed.

## 2. Existing architecture and dependencies analyzed before edits

| Area | Source and controlling behavior | Dependency / reuse decision |
|---|---|---|
| Tenant, school and affiliation ownership | `apps/api/src/service.ts`: institution/year access, saveInstitution, createYear, config, draft, saveConfig, publish | Preserve access checks, school ownership, registered-board matching, revision locks and transaction boundaries |
| Licensing | `apps/api/src/licensing.ts`; domain countClassrooms, organizationUtilization; organization contract | Preserve organization-wide allowances and existing maximum-reservation policy; capacity and schedule changes do not change classroom counts |
| School identity and registration | `apps/web/features/structure/workspace.tsx`, platform institution forms | Preserve Super Admin-owned identity/change requests and grade editing; clarify administrator guidance |
| Sections and grade relationships | `section-assignments.tsx`, `packages/domain/src/impact.ts`: assignGrades, configurationImpact | Reuse assignment previews, confirmations and undo; schedule inheritance re-resolves against current section IDs |
| Classroom operations | workspace.tsx, bulk-builders.tsx, domain bulk.ts, removeFromConfig | Preserve bulk generation, status flags, IDs, inline editing and license checks; add optional capacity |
| Bell authoring | schedule-wizard.tsx, index.ts: autoAssign/validateSlots, refinement.ts: assistedAssign, enhancements.ts: scheduleDiagnostics | Reuse complete-template authoring, fixed routines, individual durations, exact coverage, diagnostics and cloning |
| Targets and recurrence | scope-rule.tsx; index.ts: targetRank/matches/applicableRules/recurrenceDates | Reuse five specificity levels, plural scopes across boards, bounded inclusive dates, nth weekdays, anchored N-week patterns and absent-fifth skipping |
| Calendar interpretation | index.ts: resolve/review; enhancements.ts: calendarDay/calendarSummary | Retain legacy resolver; dispatch version-2 configurations to a new resolver; previews and publication share it |
| Persistence | Prisma Revision → RevisionBoard → Section/Grade/Classroom/Schedule/CalendarEvent; store.ts readConfig/writeConfig | Extend metadata additively; retain draft-only writes and permanent entity keys |
| Historical output and impact | published-output.ts, refinement.ts: effectiveImpact, enhancements.ts: configurationChanges | Persist resolver choice, preserve previous results, include new metadata in changes/audits and effective comparison |
| Navigation and reusable UI | workspace.tsx, academic-year.tsx, navigation guards, density.css, shared forms/tables | Preserve top-level conventions and existing sidebar; add no new permanent sidebar |
| Tests | Vitest domain/security suites, PostgreSQL service integration, HTTP suite, Playwright workspace scenarios | Add new resolver regression coverage and persistence scenario; extend browser scenario; report unavailable runtime checks separately |

### Before implementation: what worked, conflicted or was missing

Existing functionality already provided multi-board scopes, full-template inheritance, recurrence, timeline diagnostics, cloning, automatic/manual arrangement, impact previews, academic years and immutable publication history. These were reused.

The old resolver ranked date specificity then target scope, and permitted explicitly authorized specific-date holiday reopening. The old calendar combined holidays and working events, had no holiday-family identity, and could not express a shortened vacation as replacement of only one broader vacation. Missing bell coverage could publish with warnings. These behaviors remain available only to legacy revisions; version 2 follows the new requirements.

The implementation plan was: add versioned metadata; implement holiday-family and advanced resolution; wire persistence and publication validation; add the three-part editor and review UI; extend changes/output/copy handling; run regression, compilation, migration and acceptance checks; document precise limits. Existing uncommitted changes found at task start were preserved.

## 3. Original versus new behavior

| Concern | Original | New version-2 behavior |
|---|---|---|
| Configuration flow | Default schedules, advanced rules, combined calendar | Default Bell Timing → Default Holidays → Advanced Scheduling → Review & Publish; calendar/preview remains available |
| Normal inheritance | Complete templates selected by target/date rank | Same complete-template model, with classroom → grade → section → board → school defaults and explicit coverage/source display |
| Vacation override | Independent holiday events accumulate | Linked permanent parent IDs define a holiday family; choose its most-specific target before matching dates |
| Independent holidays | Combined closures | Still combine; shortening one family never removes a different holiday or weekly closure |
| Default holiday vs advanced working | Explicit date reopening could win | Effective Default Holidays always close the date |
| Advanced parent exception | No explicit parent relationship | A valid applicable child suppresses its intended parent; remaining rules use date and scope specificity |
| Special template | Independently selected dated schedule | Existing schedules remain available; an advanced event may select an existing complete template or atomically save a newly cloned/custom template |
| Ambiguity | Existing schedule conflicts | Family/advanced/schedule ties and invalid references are blocking, with identities/reasons |
| Missing operational timing | Publication warning | Blocking error for version 2; legacy behavior preserved |
| Historical evaluation | One resolver | Persisted resolver version per revision; old publications remain version 1 |
| Capacity | No capacity field | Optional classroom student capacity, positive integer 1–10,000, independent of license consumption |

## 4. Files changed or created for this implementation

Other changes already existed in this working tree; the table below describes this task's contributions.

| File | Contribution |
|---|---|
| `packages/domain/src/scheduling.ts` — new | Version-2 resolver, holiday-family traversal, explicit advanced parent handling, relationship validation, adoption helper |
| `packages/domain/src/index.ts` | Extended schemas, resolver dispatch, version-2 publication checks, resolver-safe academic-year copying and dependency pruning |
| `packages/domain/src/enhancements.ts` | Resolver/relationship/template/capacity change tracking; validated annual teaching-minute totals |
| `packages/domain/src/published-output.ts` | Expose resolverVersion while retaining existing contract version and IDs |
| `prisma/schema.prisma` | Add revision version, event scheduling metadata, template-only flag and optional classroom capacity |
| `prisma/migrations/202611160001_three_part_scheduling/migration.sql` — new | Additive columns, defaults and value constraints |
| `apps/api/src/store.ts` | Read/write all new fields under existing draft persistence |
| `apps/api/src/service.ts` | Optional new-year version, version downgrade guard, resolver-aware change audit |
| `apps/web/features/structure/calendar.tsx` | Three-part navigation, adoption action, linked holiday actions, source/coverage table, cloning action, review entry, minute totals, remembered scheduling view |
| `apps/web/features/structure/workspace.tsx` | Draft adoption, event/template authoring and atomic save, parent selector, old reopening correction, deletion dependency guidance, review integration, capacity controls and workspace summary |
| `apps/web/features/structure/schedule-wizard.tsx` | Version-aware effective preview and correct cloning of normal defaults/library templates |
| `apps/web/features/structure/effective-rule-preview.tsx` | Pass resolver version in preview configuration |
| `apps/web/features/structure/review-calendar.tsx` — new | Effective per-classroom annual totals and classroom/date inspection before publication |
| `apps/web/features/structure/section-assignments.tsx` | Assigned/unassigned counts, inherited-rule impact and navigation guard for unconfirmed assignment previews |
| `apps/web/features/structure/bulk-builders.tsx` | Optional capacity during single/bulk creation and validation |
| `vitest.config.mts` | Automatic JSX transformation for React rendering tests |
| `tests/structure-rendering.test.ts` — new | Six checks of actual scheduling UI output, read-only controls and template scope reuse |
| `scripts/test-isolated-db.cjs` | Concise cleanup failure handling when the disposable database is unreachable |
| `apps/web/features/structure/academic-year.tsx` | Fresh UI-created years select version 2; copied years preserve source semantics |
| `apps/web/app/density.css` | Consistent configuration overview, tabs, wrapping actions, coverage panels, timing timeline and responsive layout rules |
| `tests/three-part-scheduling.test.ts` — new | 25 focused domain scenarios |
| `tests/integration.test.ts` | New persistence/publication/version/isolation scenario, including capacity and template metadata |
| `e2e/workspace.spec.ts` | Updated navigation label and extended holiday adoption/override/persistence/viewport scenario |
| `API.md` | Resolver version, new metadata, priority, compatibility and copying contract |
| This report — new | Architecture, implementation, safety, verification and remaining acceptance work |

## 5. Database and migration changes

The migration adds:

- `Revision.resolverVersion INTEGER NOT NULL DEFAULT 1`, restricted to 1 or 2.
- `CalendarEvent.scheduling JSONB NOT NULL DEFAULT '{}'`, storing configurationPart, parentId and scheduleId.
- `Schedule.templateOnly BOOLEAN NOT NULL DEFAULT false`.
- Nullable `Classroom.capacity`, restricted to positive integers no greater than 10,000 when set.

No existing revision, school, year, schedule, event, classroom or identifier is deleted or reset by the migration. Parent/template references use permanent keys inside a configuration revision; application review enforces their relationships. A database foreign key to physical row IDs would be incorrect because the current writer recreates draft rows while preserving entity keys.

Prisma validation and client generation passed. Deployment of the migration has **not** succeeded because PostgreSQL is unavailable. Do not start the updated API against an unmigrated database.

## 6. Default Bell Timing

School/board/section/grade/classroom and selected multi-board targets remain supported. A classroom uses the nearest complete applicable default; fields from competing templates are never merged. Existing arrival/dispersal, uniform or individual periods, routines, auto arrangement, assisted arrangement and manual editing remain.

The UI adds live remaining/excess teaching-minute feedback and a coverage table showing classroom, inherited schedule, source and coverage status, plus per-schedule board usage counts and Clone / create override. Missing, invalid and tied defaults are visible. A clone gets a new permanent schedule identity and a narrower target selection; cloning a library template into a normal default clears templateOnly.

## 7. Default Holidays

This page contains holidays only, including specific dates, inclusive ranges, weekly/monthly and interval recurrence. Board-wide weekly toggles remain available; school/group/classroom weekly patterns can be represented as ordinary holiday-family rules.

An override references the parent event's permanent ID. The resolver groups related holidays, chooses the most-specific applicable target independently of the date, and then evaluates that selected holiday's pattern/range. This is what allows both a shorter and a longer vacation. A separate Sunday, public holiday or unrelated vacation still applies normally. Multiple independent holidays count as one closed classroom/date.

Parent names are shown in the holiday list. Effective previews include ancestor dates and both boundaries of long ranges, making reopened vacation dates visible. Preview results are invalidated when the entry, resolver or supporting rules/templates change. Add targeted override prefills the relationship and timing pattern but requires a narrower classroom/group selection. Cyclic, dangling, cross-part and out-of-parent targets block publication. Deleting a parent warns about dependents; dependent records are retained as unresolved drafts rather than silently discarded.

Adoption converts each legacy weekly closure into a board holiday-family rule, preserving the original closed weekday while making it directly overridable. Fresh version-2 years and subsequently registered boards use these linked rules. A targeted override can change its weekday pattern without affecting other holiday families. Any unconverted version-2 draft offers a conversion action. Legacy published board toggles keep their original semantics. Advanced Scheduling cannot reopen an effective weekly Default Holiday.

## 8. Advanced Scheduling

The rule editor configures who, when, what happens and an optional complete bell template, followed by effective preview and draft save. It supports holidays, working days, half-days, recurring/nth/N-week patterns, specific dates, bounded ranges and targeted child rules. Different bell timing now uses the same Who → When → What Happens → Schedule → Preview → Save event workflow. The event stores operation=timing; timing-only rules are evaluated separately from working/non-working conditions and cannot open an advanced holiday. Existing standalone dated schedules remain supported for compatibility.

An event can select an existing template or create/clone a special schedule. A newly authored linked template and its event are committed together. Template authoring does not ask for the target or recurrence again, and unused temporary templates are not persisted when the event selects another schedule. templateOnly keeps a custom template dormant on all other dates. Linking an ordinary default does not remove its normal coverage. Half-days require compatible exact-covered timing; a full-working exception cannot resolve to a half-day template.

A child advanced rule replaces only its explicit applicable parent. Other competing advanced rules resolve by date specificity then target specificity. More-specific working exceptions can supersede broader advanced non-working conditions, while compulsory Default Holidays remain closed. Bell timing alone never reopens a holiday.

## 9. Priority and conflict behavior

For an operational classroom/date:

1. The existing API enforces school, tenant and academic-year boundaries.
2. Version-2 holiday families resolve by Classroom > Grade > Section > Board > School.
3. Any effective Default Holiday, including the board weekly closure, closes the date.
4. Applicable advanced children replace their named ancestors; other advanced conditions rank specific date > monthly/date-bounded recurrence > weekly recurrence > default, then target specificity.
5. An advanced holiday closes the date. Working/half-day events may supply a complete template.
6. The highest applicable complete advanced/default timing is selected and validated. No field merging occurs.
7. The result exposes status, selected schedule, calendar event identity, explanation, and conflict IDs where applicable; published output derives exact teaching intervals/minutes.

Equal top-rank schedule or advanced-rule candidates conflict, even if their timing/action happens to match. Two same-specificity overrides in one holiday family also conflict. Distinct holiday families closing the same date combine normally. Missing schedule, invalid/overlapping/gapped timing, incompatible half-day/full-day timing, invalid relationships and out-of-year dates prevent version-2 publication.

## 10. UI/UX changes by page

- **School Registration:** shared configuration overview displays academic year, draft/publication state and structural counts; clearer identity/affiliation ownership and grade setup guidance; stronger active tab indication. Existing identity forms, logo validation and change requests remain.
- **Academic Sections:** assigned/unassigned totals and explicit inheritance impact guidance supplement the existing board picker, section selection, grade bulk assignments, impact confirmation and undo.
- **Classroom Setup:** optional capacity is editable inline and in the classroom form; consistent overview, active navigation, wrapping actions and mobile CSS supplement the existing grade/section filters, bulk creation and shared-license indicators. Capacity can be set for a single classroom or the whole creation batch, left unset, and edited per classroom afterward.
- **Default Bell Timing:** clearer flow, clone action, schedule usage counts and classroom coverage/source table.
- **Default Holidays:** dedicated list/editor, parent-child links, targeted override action and holiday-only scope. Existing calendar grid remains available as the effective preview.
- **Advanced Scheduling:** linked parent selector, complete schedule selection/creation, shared effective preview, cancellation, legacy reopening correction and explicit precedence guidance.
- **Review & Publish:** per-classroom working/closed/half-day/unresolved totals and teaching minutes, classroom/date inspection, correction links, existing change/impact review and publication form.
- **Across the workspace:** focus-visible styling, wrapping controls/tabs/timelines, no new permanent navigation sidebar, preserved existing unsaved-change guards/autosave and remembered scheduling subview. Step captions show live configuration counts; Previous and Save & Continue provide explicit, guarded progression.

These are actual source changes. Browser-based layout, interaction, keyboard and accessibility acceptance are still unverified.

## 11. Existing data and historical stability

Existing database revisions default to resolver 1. `resolve` retains its previous code path for those configurations. Adoption creates a changed working draft with resolver 2 and never rewrites the active publication. Existing unclassified holiday events are conservatively classified as Default Holidays and weekly toggles are converted into explicit holiday-family records during adoption; prior explicit reopenings remain flagged until the administrator removes/replaces their authorization through the new holiday-family workflow.

A version-2 draft cannot silently downgrade on ordinary save. To return to old behavior, discard/replace the working draft through the existing workflow and restore the intended historical revision as a separate draft. History remains intact. Copies retain their source resolver, stable keys and independence, omit existing fixed/date-bounded records as before, and recursively prune dependencies whose parents/templates were excluded.

Organization-wide classroom licensing and all-created-classrooms counting were not changed. No real application data, password, subscription or published configuration was reset. No production migration or deployment was performed.

## 12. API and downstream impact

Existing routes continue to serve configuration, preview, review, publication and immutable published output. New optional JSON fields are documented in API.md. New UI-created fresh years explicitly request version 2; legacy API clients that omit the field keep version-1 behavior. Copies use source behavior.

Published output retains contractVersion 1 and adds resolverVersion. Stable organization/school/year/revision/board/section/grade/classroom/schedule identifiers, daily status, teaching intervals, instructional minutes and cache-by-publication behavior remain. Annual summaries now include validated instructionalMinutes. The regular weekly working-day baseline also resolves holiday-family inheritance rather than assuming a cleared legacy toggle means seven working days. Configuration change/audit metadata includes resolver and rule relationship changes, so adoption is visible even if effective dates happen to remain the same.

WDM, subject allocation, teacher workload and timetable generation were not implemented or altered. Their read contract remains the existing published-configuration output, extended with resolver identity.

## 13. Executed tests and real results

| Check | Result |
|---|---|
| `npm run db:generate` | Passed; Prisma Client 6.19.3 regenerated |
| `npm exec prisma validate` | Passed |
| `npm run typecheck` | Passed for API and web |
| Separate TypeScript compilation of tests/*.ts and e2e/*.ts | Passed |
| `npm test` | **226 passed, 7 skipped**, 10 test files passed, 1 integration file skipped |
| New domain scenarios | **25 passed**, included in the 226 total |
| New server-rendered UI checks | **6 passed**; actual components rendered with React, without claiming browser interaction/layout verification |
| `npm run build` | API compilation and optimized Next.js production build passed |
| `npm exec playwright test -- --list` | 7 existing/extended browser scenarios discovered; discovery is not execution |
| `git diff --check` | Passed |
| `npm run test:db:isolated` | Blocked before tests: P1001, PostgreSQL unreachable at localhost:55432 |
| Docker availability | Blocked: permission denied on Docker socket |
| Disposable local `initdb` fallback | Failed: shared-memory shmget operation not permitted; initdb removed the failed temporary cluster |
| Local web server on 127.0.0.1:3302 | Failed: listen EPERM |
| Direct Playwright Chromium launch | Failed: macOS MachPortRendezvous bootstrap_check_in permission denied |
| Live HTTP and browser acceptance | Not executed successfully; blocked by the database/server/browser restrictions above |

The domain scenarios cover five-level default inheritance, shorter/longer vacation chains, independent holidays and Sundays, advanced board/section/grade/classroom exceptions, Default Holiday priority, timing-only non-reopening, ambiguity, invalid/cyclic parents, absent fifth weekdays, specific dates, dormant library templates, linked existing defaults, section transfers, legacy output stability, missing and invalid timing, annual minutes, cross-board family overrides, copies and deleted parents.

The new PostgreSQL scenario checks metadata/capacity round-trip, resolver preservation, publication and old-history stability, downgrade rejection and tenant isolation. It is compiled but **not executed**. The extended Playwright scenario checks draft adoption, parent holiday creation, targeted override persistence, unified timing-only authoring, publication separation, refresh and viewport overflow. It is discovered but **not executed**.

## 14. Remaining limits and unverified areas

1. The additive migration remains unapplied to the configured database. Live CRUD, transactional persistence, locking, tenant isolation, publication, migration compatibility and HTTP integration require execution in an environment with PostgreSQL access.
2. All browser/visual/accessibility/responsive acceptance remains unverified because local port binding and Chromium launch are denied. No screenshot or mocked-browser pass is claimed.
3. Legacy drafts deliberately require explicit adoption. Legacy published revisions and old API callers are not silently converted.
4. Existing version-1 publications retain their weekly toggles. Adoption/new version-2 setup converts those toggles into directly editable holiday families; an unconverted version-2 draft exposes an explicit conversion action.
5. Invalid dependent rules can be retained as drafts after deletion, with publication blocked until repaired. There is no automatic destructive cascade through holiday families.
6. Classroom capacity is optional and descriptive. Enrollment validation and resource allocation belong to later modules.
7. Version-2 full-year review uses the existing per-classroom/date evaluation approach. No production-scale performance benchmark was run.
8. Examination-specific features and unrelated ERP modules remain outside scope.

## 15. Run and verify locally

Use the existing `.env` and Node 24.11+/npm 11+. Do not reset or seed an existing school database. Take the normal deployment backup before any live database upgrade. On the existing Mac installation, `/usr/local/bin` contains the supported Node runtime.

```sh
npm run db:generate
npm run db:migrate
npm run typecheck
npm test
npm run dev
```

`db:migrate` is required before the updated API uses the new columns. It applies pending migrations, so review any other pending project migrations first. Preserve existing database volumes and credentials.

For disposable database/browser verification in a permitted environment:

```sh
npm run test:db:isolated
npm run test:http:isolated
npm run test:browser:isolated
```

The existing isolated runner creates a generated schema instead of mutating application records. Browser/HTTP checks build/start their own isolated services. Review the test runner and ensure the configured database permits disposable schemas.

Manual acceptance sequence:

1. Inspect an existing published revision and confirm its resolver/version and effective dates remain unchanged.
2. Create a working draft; select **Use three-part scheduling in draft**. Fresh years created from the UI start with version 2 automatically.
3. Configure one school default and narrower board/section/grade/classroom timing; inspect coverage and source.
4. Create a broad vacation and shorter/longer targeted overrides; add an independent holiday on an excluded vacation date and verify it stays closed.
5. Configure advanced fourth-Saturday non-working/working/half-day exceptions with narrower children and complete special timing. Verify Default Holidays still win.
6. Test tie/missing/template errors, parent/template deletion warnings and blocked publication.
7. Inspect annual teaching minutes, classroom/date outcomes, section reassignment, capacity editing and copied-year independence.
8. Review and explicitly publish; verify downstream output uses version 2 while the earlier publication still uses version 1.
9. Verify all four Structure Management tabs, navigation guards, autosave/refresh, keyboard focus and layouts at desktop, laptop and narrow widths.

### Recovery

Keep backups and immutable publications. If rollout must be paused, retain the additive columns and existing published pointers. Restore the intended historical version as an independent working draft through the existing restore/discard workflow and explicitly review/publish it. Do not drop the new columns while version-2 revisions exist, because that would discard resolver/relationship metadata and change historical interpretation. Any schema rollback requires a verified backup and a dedicated migration plan; none was attempted here.


## 16. Follow-up completion audit

A second pass against the original prompt found and corrected these gaps in the first implementation:

| Gap | Correction and evidence |
|---|---|
| Different timing used a separate authoring path | Unified advanced event workflow with operation=timing, linked whole-day templates and explicit parent timing overrides; domain and rendering checks |
| Weekly closures required a manual conversion workaround | Adoption/new-year/new-board setup creates editable weekly holiday families; narrower weekly overrides tested, including annual baseline counts |
| A shorter vacation preview excluded reopened dates | Preview includes child and ancestor occurrences, sampling both boundaries for long ranges; invalidated when supporting data changes |
| Template authoring repeated scope/recurrence | Template mode configures timing only and returns to the advanced rule before the atomic save; rendering check verifies no duplicate scope selector |
| Registration/section/classroom progression was implicit | Counts in step headers and guarded Previous / Save & Continue actions across the structure workspace |
| Capacity required a separate edit after creation | Optional validated capacity is now available in single and bulk classroom creation |
| Unconfirmed section assignment could be lost on navigation | Added a navigation guard which requires confirming or deliberately discarding the pending preview |
| Broader half-day timing could defeat a specific full-working rule | Candidate selection now distinguishes ordinary defaults from timing-only linked templates; regression scenario passed |
| Review errors could remain stale | Independent summary/preview loading and error state with cancellation of stale responses |
| Database test cleanup obscured the original failure | Unreachable-database cleanup now reports a concise message; application schema is never the cleanup target |

The follow-up ran `npm run db:migrate` and `npm run test:db:isolated`; both remain blocked by PostgreSQL P1001 at localhost:55432. No successful migration, live CRUD/browser run or visual acceptance is claimed. Current code and the prepared migration are complete within the accessible workspace; runtime acceptance still requires database and browser permissions which this environment does not provide.
