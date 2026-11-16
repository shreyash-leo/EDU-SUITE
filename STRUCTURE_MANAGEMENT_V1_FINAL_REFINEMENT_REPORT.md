# PLAN EDU SUITE — Structure Management V1 Final Refinement

Implementation report · 15 November 2026

## 1. Executive summary

The application code has been refined across the four requested phases. This is an implementation report, not another current-state audit. Existing multi-school/multi-board structures, organization-wide licensing, drafts, incomplete publication, immutable publications and history have been retained.

The main changes correct calendar classification, prevent schedules from reopening closed dates, synchronize approved affiliations into working drafts, preserve historical navigation, add assisted bell arrangement and holiday ranges, improve year copying and overlap safeguards, distinguish unchanged drafts, strengthen readiness/impact information, and expose a versioned read-only published configuration contract.

No database migration was required. No existing application data, accounts, Docker volumes, academic years or published configurations were reset, seeded, replaced or deleted during this work. Database/HTTP/browser test mutations used disposable schemas; those schemas were removed afterward. The application database was queried read-only to check existing academic-year overlaps: **0 overlapping pairs** were found.

Automated source, database and HTTP checks passed as detailed below. Authenticated browser/visual acceptance remains **blocked by macOS Chromium launch permissions**. This report does not claim those screens have passed live visual testing.

## 2. Phase 1 — Critical logic corrections

### Calendar calculations and mixed calendars

`calendarSummary` now separates:

- Calendar working dates (`workingDays`, retained for API compatibility).
- Validated instructional dates (`validatedWorkingDays`).
- Provisional working dates with missing schedules (`provisionalWorkingDays`).
- Invalid/conflicting dates (`conflictingDays`).
- All unresolved dates (`unresolvedDays`).
- Full validated instructional days, validated half-days, closed dates, calendar days and working weeks.

Missing schedules no longer inflate full validated instructional days. Effective daily classifications are compared across classrooms. Equal annual working totals, equal half-day totals on different dates, and full-day versus half-day calendars are distinguished. Holiday descriptions are excluded from equivalence comparisons: different wording for the same closed dates does not create a false mixed-calendar result.

Common totals become null when effective classifications differ; per-classroom results remain available. The calendar UI exposes validated, provisional and conflicting counts separately.

### Eligibility, half-days and precedence

`resolve` retains the existing date-type/scope precedence and full-template override model. It now prevents a half-day bell schedule alone from reopening a weekly off-day. An applicable calendar event is required. Full holidays still suppress schedules; reopening a full holiday still requires an explicitly authorized, higher-priority specific-date working exception.

A missing half-day schedule returns an explicit unresolved half-day reason and expected day type. A higher-priority full working exception supersedes a lower half-day expectation. Invalid schedules and equal-priority schedule collisions remain blocking errors; missing schedules remain permitted incomplete-publication warnings. Equal-priority full-day and half-day events now conflict.

Resolution also exposes winning schedule identity/type/scope/priority, calendar event identity where applicable, and conflict/warning information. New/changed explicitly authorized reopenings produce `calendar.reopening-authorized` audit records with revision, event, owner-board, targets and date.

Identical bell-template groups can be identified in Advanced Scheduling for review/consolidation. They are not automatically deleted, and equal-priority collisions remain blocking even when templates look identical.

### Approved registration changes

`AppService.resolveRequest` now locks the organization and school and synchronizes missing affiliations into every affected working draft inside the approval transaction. It preserves existing logical board/academic entities, adds only missing boards and increments affected revision locks. Published revisions are untouched. Existing board-removal-with-history safeguards and case-insensitive affiliation uniqueness remain enforced. A stale editor receives a conflict rather than overwriting the synchronized draft.

### Historical navigation

Selected academic year and historical revision now participate in URL restoration and browser navigation state. Viewing history no longer remounts the workspace solely because its intent changes. Loading is guarded against superseded responses. Historical snapshots are read-only; returning to an editable draft clears the historical revision selection. Restoration still creates a new draft and preserves the published snapshot.

### Phase 1 verification gate

Before moving to Phase 2: 184 unit/domain tests passed, 5 isolated PostgreSQL integration tests passed and application TypeScript checks passed. One older test that expected a bell schedule to reopen a weekly closure was changed to require the calendar exception specified by the new prompt.

## 3. Phase 2 — Bell Time, Calendar and academic years

### Assisted arrangement

Sequential Auto Assign remains the default. A separate **Suggest arrangement** action performs deterministic bounded search, with a maximum of 50,000 explored states and the existing UI maximum of 30 periods.

The assisted engine fills the intervals between fixed routines using complete periods. It preserves period IDs, names and durations and does not move routine positions, resize/split periods or change their number. Applying a suggestion requires explicit confirmation that the changed order does not violate a fixed pedagogical sequence. Exhausting the bound is reported as a search limit, not as proof that no solution exists.

Example: arrival 08:00, dispersal 10:10, fixed break 09:00–09:10, periods of 40, 60 and 20 minutes. Sequential placement fails after the first 40-minute period. The assisted result is 40 + 20 minutes before the break and 60 minutes afterward. Every original period identity/duration and the break remain intact.

Auto Assign now confirms before replacing an existing manual period arrangement. Generator inputs participate in the unsaved-edit guard; when changed generator inputs have not been applied, saving the current arranged slots requires deliberate confirmation. Existing individual durations populate the editor when reopening a schedule.

### Override creation and diagnostics

The bell wizard can start an independent override from an existing school/board template. It clones timings, slots and routines, creates a new schedule identity and lets the administrator select targets and recurrence before validating/saving. It does not introduce field merging.

Existing timing diagnostics remain in use for missing/excess coverage, invalid durations, routines, overlaps and out-of-bounds intervals. Pattern Preview and Effective Calendar Preview are separate. The effective preview can inspect each board, resolves the first 12 matching dates, includes unsaved proposed rule/template changes, and shows actual classroom statuses and winning reasons. Inputs invalidate earlier preview results.

### Inclusive holiday ranges and recurring rules

Calendar event creation now offers a direct inclusive holiday range action and explicit start/end controls. The range is stored using the existing bounded recurring rule with all seven weekdays; no new model is needed. The event editor checks academic-year boundaries. Single dates, first–fifth occurrences, interval recurrence, bounds, multiple targets and absent-fifth-occurrence skipping remain available.

Rule rows now display boundaries and interval anchors alongside their pattern. The UI explains precedence and distinguishes pattern matching from effective operational results.

### Copy Previous Year

The preview classifies source rules as safe recurring, interval/anchor review, fixed-date or date-bounded. Fixed-date and bounded rules remain excluded from automatic copying. Interval options are:

- **Keep** existing anchors, with review required.
- **Drop** interval recurrences.
- **Rebase** interval anchors to the new year start.

Preview counts respond to anchor choices. Logical academic IDs remain stable; copied configurations and old publications remain independent. Rebasing deliberately changes the cycle origin to the entered start date, rather than guessing a similar weekday in the new year.

### Academic-year overlaps

New ranges are checked against the same school's existing years under the school lock, with inclusive endpoints. Accidental overlaps are rejected. A legitimate overlap can be created with a recorded 10–1000-character exception reason; the UI exposes that compatibility path. Existing years are never rewritten or invalidated. The read-only check of existing data found no overlaps.

### Phase 2 verification gate

189 unit/domain tests, all 5 then-existing isolated database cases and TypeScript checks passed before Phase 3. These included alternate arrangement, impossible fit/search bounds, inclusive year-boundary holiday dates and recurrence anchor options.

## 4. Phase 3 — Reliability, navigation and UI/UX

### Classroom counts and licensing

A shared domain count helper distinguishes Total Classrooms, Active Classroom Flags, Operationally Active Classrooms, Inactive Classrooms and Licensed Classrooms in a configuration. Operationally active requires both parent grade and classroom to be active. Overview, School Details and Classroom Setup expose the distinctions. Overview and Account/Subscription also show organization reservation/usage and Remaining Organization Allowance.

Overview structural counts use the selected operational year per school; contractual usage remains the existing organization-wide maximum-reservation calculation across current draft/publication/year pointers. These are deliberately different bases. Inactive classrooms still consume allowance. History does not add license usage. Existing over-limit data remains editable/removable, while added classroom identities remain blocked by the existing transaction-protected licensing checks.

### Accurate statuses and readiness

A draft identical to its publication is now `EDITING_DRAFT_NO_CHANGES` rather than Pending Changes. Directory SQL, filters, counters, School Details and workspace badges use the distinction. Only actual differences are unpublished changes. Existing Not Started, Draft, Active and Incomplete Active behavior is retained. A new Review Required lifecycle was not invented: validation warnings/errors already communicate that requirement.

Bell/Calendar readiness in School Details is Configured, Incomplete or Requires Attention. It uses full validation, effective classroom coverage and unresolved dates; an empty operational population or one isolated schedule record cannot make the calendar complete.

### Impact information

Stable-ID dependency previews remain. Rule edits additionally collect potentially affected classrooms/ancestors across explicit shared scopes. Potential dependency lists are distinct from record creation/update/removal counts.

Exact before/after calculation is available for section assignment and deletion previews, preset previews, review and publication. It compares effective statuses, selected schedule identities, day types, timing and period intervals over the academic year. Publication metadata contains exact changed dates/classroom combinations. Rename-only changes can have zero effective date changes. These calculations do not claim that every potential dependency necessarily changes on every date.

### Draft safeguards and navigation

Discard Unsaved Changes is labeled separately from Discard Working Draft. No reset-initial-draft operation was added. Existing safeguards prevent discarding an initial draft through the published-draft discard path, protect publication/history and require optimistic locks. The current frontend sends revision identity on draft mutation requests. Optional revision IDs remain accepted for compatible older clients, as existing API/test consumers use that form; lock checks remain mandatory.

Change requests refresh restoration accepts the actual page name. School Details remains separate from the editor. Historical revision/year, direct Bell/Calendar intent and browser navigation state are preserved. Working-draft return clears the old historical selection. Existing unsaved-navigation guards remain in place. The four primary Structure Management tabs and the absence of Academic Years from the main sidebar are unchanged.

### UI refinements

Compact wrapping summaries, additional calendar status metrics, rule explanations, bounded preview tables, responsive overflow, clearer count labels, explicit date range controls and structured preview actions were added to the existing corporate design. Complex schedule/event/year workflows continue to use dedicated workspace pages; short confirmations remain compact. No broad visual redesign was performed or claimed as visually verified.

## 5. Phase 4 — Integration readiness

### Read-only published contract

`GET /api/years/{academicYearId}/published-output` exposes contract version 1. It is authenticated and scoped to the organization/school/year. It reads only the active published revision and returns 404 if none exists. Draft changes never leak into this read model.

The output includes stable organization, school, year, revision, board, section, grade, classroom and schedule identities; operational classroom status; effective daily working/closed/half-day/provisional statuses; winning rules; complete published schedules; teaching-period intervals and available instructional minutes. It includes both requested-window totals and complete academic-year totals, with per-classroom results for mixed calendars.

Date output is bounded to 31 inclusive dates per request, with optional classroom selection. Consumers page dates and cache by published revision identity. Relationships use stable IDs; period identity is interpreted within its schedule. `API.md` documents fields, calculation semantics, parameters and error behavior. No WDM, Subject Allocation or Timetable module was implemented.

### Publication change information

The existing publication audit record now includes previous/new published revision IDs, affected stable board/grade/classroom identities, changed bell/calendar rules and calculated changed dates. Dependent modules can compare publication IDs, invalidate their caches and refresh through the published contract. This adds no broker, webhook or external audit API. Older audit entries retain their historical shape.

## 6. Calculation definitions

For each operationally active classroom, each inclusive UTC date is resolved exactly once:

- `N = floor((end − start) / 86,400,000) + 1` calendar dates.
- `H` = holiday or weekly non-working dates; overlapping closures deduct once.
- `V` = working dates with a valid resolved bell template.
- `P` = provisional eligible dates with no applicable template.
- `C` = invalid/conflicting dates; these are not validated instructional dates.
- Calendar working dates `W = V + P`.
- Unresolved dates `U = P + C`.
- Valid half-days `F` are the subset of `V` whose selected template has half-day type.
- Full validated instructional days `= V − F`.
- For active classroom summaries, `N = H + W + C`.
- Regular weekly working days `= 7 − distinct weekly-off weekday count`.
- Working days per week is the common observed count across complete Monday–Sunday buckets, or null if they differ/no full bucket exists.
- Working weeks counts Monday-based buckets containing at least one calendar working date, including partial boundary weeks. It is not a fractional week-equivalent calculation.

Calendar signatures compare daily closed/full/half/missing-full/missing-half/invalid/conflict classifications, excluding holiday description wording. Common totals are suppressed for differing signatures. Inactive grades/classrooms are excluded from operational calendar totals but remain in structural/license counts.

Instructional minutes for a valid operational date `= Σ(period.end − period.start)` over teaching slots only. Routines are excluded. Missing, closed, invalid, conflicting and inactive dates expose no usable instructional intervals.

## 7. Database changes and preservation

No Prisma model change, migration or application-data conversion was necessary. Existing JSON rules store date ranges, anchors and reopening flags; existing AuditLog detail stores publication/reopening metadata.

Integration runners deploy existing migrations only inside fresh randomly named `portal_test_…` schemas. Only those temporary schemas are dropped. No application migration, seed, admin reset, volume deletion or project rebuild/reset was run. Production **compilation** was run; that does not rebuild application data.

The pre-existing changes to `CLIENT_PORTAL_CURRENT_STATE_AUDIT.md` were left alone. This implementation did not edit that audit again.

## 8. Tests and verification

See final recorded results below. A skipped case in the ordinary unit invocation is not counted as passed; database cases are executed separately using the isolated runner.

| Check | Result |
| --- | --- |
| Unit/domain/security/navigation calculation suite | **195 passed**; 6 database cases intentionally skipped here and executed separately |
| PostgreSQL service integration | **6 passed** in a disposable schema |
| Real HTTP authentication/onboarding/structure/tenant lifecycle | **1 passed**, 0 skipped, in a disposable schema |
| Application TypeScript | **Passed** (API and web) |
| Strict test and Playwright source TypeScript | **Passed** |
| API + Next.js production compilation | **Passed** |
| Authenticated Playwright acceptance | Blocked before page creation; 1 launch failed, 6 scenarios did not run |
| `git diff --check` | **Passed**, no whitespace errors |

Commands use Node 24.11.1 (`export PATH="/usr/local/bin:$PATH"`), `npm test`, `npm run typecheck`, `npm run test:db:isolated`, `npm run test:http:isolated`, strict `tsc --noEmit` for tests/e2e sources, `npm run build` and `npm run test:browser:isolated`.

### Mandatory scenario evidence

| Requested scenario | Executed automated evidence / limit |
| --- | --- |
| CBSE and ICSE within a school | Shared-scope domain tests and PostgreSQL calendar/publication tests |
| Board-specific grade presets | Existing structure-enhancements/bulk-workflows tests and isolated preset service test |
| Bulk section assignment | Existing assignment/ownership tests; browser scenario retained but blocked |
| Licensing across schools | Organization licensing tests, PostgreSQL and HTTP lifecycle |
| Grade moves / inherited rules | Stable-ID assignment, target resolution and dependency tests; exact effective comparison added |
| Auto Assign around routines | Existing sequential tests plus alternate-order bounded-search tests |
| Advanced conflicts | Domain collision/precedence tests; publication blocking tests |
| Second/fourth Saturday | Existing recurrence and scoped service preview tests |
| Missing fifth occurrence | Existing recurrence tests and PostgreSQL rule-preview assertions |
| Inclusive holiday ranges | New cross-year endpoint tests plus existing bounded recurrence tests |
| Half-day without matching schedule | Domain explicit missing/invalid classification and existing review validation tests |
| Authorized reopening | Existing resolver/service tests plus dedicated authorization audit writing |
| Holiday deduplication | Existing effective calendar tests; classification comparisons ignore duplicate descriptions |
| Mixed calendars | Equal working totals/different half-day types and equal half totals/different half dates tests |
| Provisional totals | New separated-count assertions and real HTTP published-output assertions |
| Copy recurrence anchors | New keep/drop/rebase classification tests and existing isolated year copying |
| Review/publish | PostgreSQL and real HTTP lifecycle |
| Historical snapshot refresh | Snapshot API immutability verified; browser URL/reload scenario added but blocked |
| Restore publication into draft | Existing PostgreSQL restore/discard lifecycle |
| Concurrent/stale updates | Existing and new PostgreSQL stale lock/replaced revision checks |
| Approved board affiliations | Extended PostgreSQL approval/synchronization/stale-editor test |
| Existing overage / additional rooms | Existing organization licensing and service integration tests |
| Tenant isolation | Existing and new PostgreSQL plus HTTP output/access assertions |
| Schools → School Details | Pure destination tests; browser acceptance blocked |
| Structure dashboard → workspace | Pure destination tests; browser acceptance blocked |

### Browser evidence

The isolated API and production Next build started successfully. Chromium then terminated before any login/page interaction with:

`bootstrap_check_in … Chromium.MachPortRendezvousServer … Permission denied (1100)`

The test runner now stops after the first failure so an environment-wide launch failure is not repeated for every scenario. No OS security permissions were changed. Browser discovery/source compilation is not presented as execution success. Overview, directory/card views, School Details, four structure tabs, wizard, advanced rules, calendar, review/history, responsiveness and visual overflow still need authenticated browser acceptance in an environment permitting launch.

## 9. Remaining limitations and explicit compatibility decisions

1. Browser/visual acceptance is blocked as above; UI behavior is source/type checked and backed by domain/API tests, not live visually approved.
2. Assisted arrangement is intentionally bounded and needs explicit administrator confirmation before changing pedagogical order. No new persisted per-period ordering-constraint model was introduced.
3. Effective rule preview shows the first 12 matching dates for the selected preview board; select other boards to inspect shared targets. Publication validation still scans the complete year, and publication impact calculates complete-year differences.
4. Fixed-date and date-bounded rules do not automatically migrate into the next year. The copy preview identifies them; add reviewed new-year exceptions explicitly.
5. Revision IDs remain optional for compatible legacy API clients; current frontend requests include them and optimistic lock enforcement remains mandatory.
6. The published read contract has a 31-date response window and an academic-year summary. It is an internal authenticated contract, without a new external service-account/RBAC system.
7. Detailed publication metadata is available on new publications; old immutable audit records were not backfilled.
8. Directory unchanged-draft status compares logical snapshots for candidate school years. Large tenant-scale performance and worst-case assisted-search/effective-impact loads were not load-tested.
9. Review Required is not a new persisted workflow status. Existing validation/readiness states explain review requirements without altering finalized lifecycle decisions.

## 10. Preserved functionality

Multiple schools per organization; independent boards; permanent grade board ownership; optional academic sections; zero-classroom grades during incomplete setup; organization-wide licenses including inactive classrooms; no physical-room module; organization administrator publication; Super Admin protected registration approval; permitted incomplete publications; blocking invalid operational schedules; independent academic years; immutable historical publications; exactly four structure tabs; no Academic Years sidebar entry; distinct directory/details/editor entry points; no future academic module implementation.

## 11. Exact files changed

The following list describes this implementation's source/test/document changes. Generated ignored production build outputs, temporary test artifacts and incremental TypeScript build metadata are verification artifacts, not application-source changes. The previously modified audit is excluded because it was not edited in this task.

| File | Change |
| --- | --- |
| `API.md` | Version-1 output, calculation semantics, publication metadata and year-copy/overlap compatibility contract. |
| `STRUCTURE_MANAGEMENT_V1_FINAL_REFINEMENT_REPORT.md` | This implementation/delivery report. |
| `apps/api/src/client-portal.ts` | Actual draft differences, structural counters and effective calendar readiness. |
| `apps/api/src/main.ts` | Published-output route and API metadata. |
| `apps/api/src/service.ts` | Approval synchronization, overlap/anchor controls, exact impact, reopening/publication metadata and published read model. |
| `apps/web/app/density.css` | Compact summaries, status grids and bounded responsive preview tables. |
| `apps/web/app/page.tsx` | Revision/year route state, change-request restoration, retained workspace and account allowance labels. |
| `apps/web/features/client/portal.tsx` | Consistent classroom counts, allowance labels and calendar readiness/validated totals. |
| `apps/web/features/structure/academic-year.tsx` | Rule classifications, anchor controls, copy preview and overlap exception input/guard. |
| `apps/web/features/structure/calendar.tsx` | Rule boundaries/anchors, precedence/duplicates, calendar metrics and intent view changes. |
| `apps/web/features/structure/effective-change-preview.tsx` | New exact before/after impact request and result display. |
| `apps/web/features/structure/effective-rule-preview.tsx` | New proposed-rule effective calendar preview with board selection and stale-response protection. |
| `apps/web/features/structure/impact-preview.tsx` | Calculated effective impact distinct from potential dependencies. |
| `apps/web/features/structure/recurrence-preview.tsx` | Explicit Pattern Preview naming. |
| `apps/web/features/structure/schedule-wizard.tsx` | Assisted arrangement, overwrite confirmation, generator input guard, existing-template overrides and effective preview. |
| `apps/web/features/structure/scope-rule.tsx` | Inclusive range selection and start/end controls. |
| `apps/web/features/structure/section-assignments.tsx` | Calculated section-move effective impact action. |
| `apps/web/features/structure/workspace.tsx` | Historical/year restoration, guarded loading, counters, holiday ranges, year-bound checks, impact and draft action labels. |
| `apps/web/lib/navigation.tsx` | Separate Discard Unsaved Changes wording. |
| `apps/web/lib/workspace-location.ts` | Revision/year URL serialization and restoration. |
| `e2e/workspace.spec.ts` | Updated discard label and historical snapshot URL/refresh/read-only acceptance assertions. |
| `packages/domain/src/enhancements.ts` | Separated effective counts and daily-classification mixed-calendar comparison. |
| `packages/domain/src/impact.ts` | Stable affected board IDs and cross-board potential rule dependencies. |
| `packages/domain/src/index.ts` | Calendar eligibility, missing-half/full classification, conflicts, resolution metadata and controlled copy anchors. |
| `packages/domain/src/portal.ts` | Editing-draft-with-no-changes status and action. |
| `packages/domain/src/published-output.ts` | New typed versioned published data projection and window/year totals. |
| `packages/domain/src/refinement.ts` | New bounded arrangement, rule classification, classroom counts, effective comparison and template duplicate helpers. |
| `scripts/test-isolated-db.cjs` | Stop browser execution after the first failure, preserving disposable-schema cleanup. |
| `tests/client-portal.test.ts` | Unchanged draft status assertion. |
| `tests/domain.test.ts` | Winning holiday identity assertion. |
| `tests/final-refinement.test.ts` | New assisted packing, range boundaries, copy anchors, classroom counts and exact/cross-board impact tests. |
| `tests/http.e2e.mjs` | Real HTTP CSRF/origin rejection and published output/tenant assertions. |
| `tests/integration.test.ts` | Approval synchronization, stale locks, overlap exceptions, unchanged status and publication-only output/metadata. |
| `tests/refinement.test.ts` | Calendar eligibility, provisional/validated counts, half-day expectations and classification equivalence. |

## 12. Final verification record

Final verification completed with Node 24.11.1:

- `npm test`: 195 passed; 6 database cases skipped in this invocation only.
- `npm run test:db:isolated`: all 6 database integration cases passed; disposable schema removed.
- `npm run test:http:isolated`: 1 HTTP lifecycle passed, 0 failures/skips; disposable schema removed.
- `npm run typecheck`: passed.
- Strict TypeScript check of `tests/*.test.ts` and `e2e/*.ts`: passed.
- `npm run build`: API and Next.js production compilation passed.
- `npm run test:browser:isolated`: blocked at Chromium launch before a page opened; 1 launch failure and 6 scenarios not run. Disposable schema/build directory cleaned up.
- `git diff --check`: passed.

No migration is needed to run the changes. Restart the development API/web processes to load the new code. The existing Node 24.11+ runtime requirement remains unchanged. The final refinement report and the published output contract documentation have been generated; the existing current-state audit was not updated in this implementation.
