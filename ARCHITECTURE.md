# Architecture and business decisions

## Boundaries

The monorepo contains one Next.js frontend, one NestJS modular backend, one PostgreSQL database and a shared TypeScript domain package. A single organization administrator manages all institutions in that organization. Super Admin authorization is enforced on every platform mutation. Client institution lookup always constrains the institution to the authenticated organization and requires both an active organization and an active institution.

User-controlled organization IDs never establish client authorization. Academic-year and revision lookups recheck their owning institution. Historic revision reads are constrained to the authorized year. Platform routes require the `PLATFORM_ADMIN` role independently of the current UI.

## Authentication

Session tokens are generated with cryptographic randomness. Only their SHA-256 digests are stored in PostgreSQL; raw tokens live in HttpOnly cookies. Sessions expire after eight hours. Writes require an exact trusted Origin and a session-bound CSRF token. Login is limited to ten failed attempts per IP per 15-minute process-local window; production load-balanced installations should enforce an additional shared rate limit at the ingress.

Passwords use Node 24's Argon2id: 64 MiB, three passes, parallelism four, a random 16-byte salt and a 32-byte digest, stored in PHC format. Temporary passwords are generated with 24 random bytes plus complexity characters. Only the activation/regeneration response contains the raw temporary password. Password replacement invalidates every session and issues a new session; regeneration invalidates existing sessions and old credentials.

Onboarding progresses through seven tracked steps. Steps 1–5 validate required records. Activation locks the organization row, rechecks all organization/institution information and the single organization contract and upserts one organization administrator. Repeated activation is rejected; regeneration is a separate explicit operation. Step seven completes after the administrator replaces the temporary password.

## Revision model

An academic year points separately to its published revision and optional draft revision. Revisions own normalized board, section, grade and classroom rows. Every logical entity retains an immutable `entityKey`; each snapshot receives fresh physical row IDs. Thus a logical classroom remains identifiable across copied revisions without sharing mutable database rows.

Saving a draft rewrites that revision's normalized child rows inside one transaction. A monotonically increasing lock number detects stale writers. Publication locks the organization, institution and year, revalidates configuration and subscription limits, finalizes the revision and atomically changes the published pointer. Previously published rows are never edited. Discard deletes only the unpublished revision. Restoring creates a new draft from a historical revision and uses the ordinary review/publication path.

Bell slots, scope metadata and recurrence definitions are typed JSON within relational schedule/event rows. The shared Zod and domain validators verify their complete shape and logical target references. Database foreign keys protect physical board/section/grade/classroom ownership. Naming and cross-board rules are also checked server-side before drafts are stored. Invalid temporal drafts are permitted; contradictory/overlapping publications are rejected.

## Bell engine

Time values are integer minutes after local midnight, independent of UTC dates. Overnight schedules are unsupported. Academic dates are `YYYY-MM-DD` values; UTC date arithmetic determines the weekday without converting school arrival times into a timezone. Deletion/session deadlines are absolute timestamps.

Auto Assign sorts fixed routines and fills the remaining spans with the ordered requested period durations. It requires exact daily coverage and fails with a corrective explanation when a period cannot fit an anchored span, routines overlap, periods exceed the day or time remains uncovered. Manual editing permits draft errors. Review detects positive duration, school-hour bounds, overlap and uncovered gaps.

Resolution first checks whether the target grade/classroom is inactive. It evaluates full holidays and authorized working-day exceptions before choosing a schedule. A higher-priority specific-date working exception with `overridesHoliday: true` can deliberately reopen a broader holiday; ordinary working exceptions do not reopen full holidays; equal-priority opposing holiday/working exceptions are blocking review errors. Full holidays always prevent half-day bell schedules from activating for their applicable targets. Weekly non-working days require an explicit working exception.

Applicable schedules are ordered by date specificity: specific date, recurring special rule, weekly rule, default. Within the same date specificity: classroom, grade, section, board, school. Grouped targets expand to the same effective scope as their individual members. Two matching schedules with the same rank produce a visible conflict; the engine never arbitrarily selects one.

Recurrence supports weekdays, an nth weekday within a month and an interval of N weeks anchored to a date. Custom patterns are represented by multiple explicit rules. Arbitrary RRULE strings and overnight/cross-timezone schedules are outside this implementation.

Half-day calendar events require a schedule explicitly marked `dayType: "half"` at the same or higher rule/target priority. A higher-priority explicit working-day event can override a recurring half-day. A missing/inappropriate half-day schedule is an invalid result and blocks publication. Legacy schedules default to `full`; existing intended half-day schedules need explicit classification when editing. Published snapshots are preserved. Temporal validity is checked by the resolver, so overlapping/out-of-bounds schedules show as invalid in previews too.

Review evaluates the academic-year dates for every active classroom so conflicts are detected even when they occur outside the current preview date. Year length is bounded at 550 days. Classrooms without applicable schedules and unassigned grades produce warnings. Invalid references, duplicate names, entitlement violations, invalid bell schedules and contradictory applicable rules block publication.

## Calendar and year copies

Calendar month/list views and the effective preview request `/years/:id/preview`, which resolves the unsaved board using the backend engine. The authenticated year and registered board are checked before evaluation. Publication uses the same resolver; frontend editors only provide immediate diagnostics and input assistance. A copied year deep-copies the academic structure, weekly non-working days and recurring rules. Date-specific events and date-specific schedules are omitted. The year starts as an independent draft, with a reminder to review dates, recurrence anchors and movable holidays.

## School lifecycle

Deactivation only changes access status. Scheduling deletion records its timestamp and a deadline exactly 60 days later, preserves the prior status and immediately makes the institution inaccessible to clients. Restore is permitted strictly before the deadline and returns it to its previous status.

The deletion reconciler locks each due institution before rechecking eligibility, skips legal holds, deletes its owned asset, removes institution change requests and cascades institutional academic data. Minimal audit records remain. Failed operations retry on the next reconciliation pass. The deadline remains durable across restarts; an external queue is not the source of truth.

## UI and draft saving

Tables use TanStack Table for sorting, filtering, selection and pagination. Forms use React Hook Form and server-side Zod validation. The shared source component layer follows shadcn patterns: Radix Dialog/Slot, variant-driven buttons, reusable inputs/textareas and a standard `cn` helper. Components are kept in the repository and styled to the established workspace design. Logo uploads validate MIME signatures and size and store bytes in S3-compatible storage; localStorage is never used as a database.

Draft edits are debounced, serialized and optimistic-lock protected. The interface displays Saving/Saved/Save failed, preserves unsaved state after an error, and warns on browser navigation with unsaved changes. Switching academic years, viewing history and returning to the institution list waits for the latest save. Review and publish wait for pending saves and then ask the server to revalidate the stored revision.

## Workspace-completion update

`packages/domain/src/enhancements.ts` supplies publication diffs, editor diagnostics, target-filtered aggregate calendar output, live onboarding checklists and the settings schema. `apps/web/lib/navigation-core.ts` serializes guard tasks and re-evaluates them after every operation so committing an editor cannot strand an unsaved parent draft.

Editable table cells keep stable component identity across data refreshes, preserve failed values and register navigation guards. Platform bulk status changes are transactional; structure-table bulk changes remain part of the versioned draft and are subject to ordinary publication validation.

`PlatformSetting` stores validated support/notice/default values with an optimistic lock. Its mutation is platform-only and audited; `/workspace-settings` returns a restricted projection to authenticated clients. Institution/subscription timestamps support the live onboarding overview. Migration `202611140002_workspace_improvements` must be applied after the initial migration.

## Organization licensing (supersedes institution entitlements)

For institution i and academic year y, let P(i,y) and D(i,y) be the counts of all classrooms (active and inactive) across every board in the year’s current published and draft pointers. Missing pointers count as zero.

- Year reservation R(i,y) = max(P(i,y), D(i,y)). Draft/published logical IDs are not unioned or summed.
- Institution usage U(i) = max(0, R(i,y) for every stored year y). A year’s historical revisions are excluded; independent/copy years are not added together.
- Organization usage U = sum(U(i) for every institution belonging to the organization), including inactive institutions and institutions in the recovery period.
- Allowance L is `Subscription.classroomLimit` on the single ACTIVE contract whose dates include now. `userLimit` is stored on the same contract; V1 creates at most one organization administrator using the existing unique organization relation.

The relevant year configurations are the current published/draft pointers of all stored academic years, including past years. This deliberately conservative maximum interpretation means reducing a later year alone does not release capacity while an older year still has a higher current reservation. Boards are summed within each year before the maximum is taken; separate board maxima are not added across years.

Every operation capable of increasing usage acquires an organization row lock before institution/year locks, then reads current counts inside the same READ COMMITTED transaction. Contract edits acquire the same organization lock. This serializes cross-institution creation and allowance reductions. Saves still use revision lock numbers to reject stale clients. Restoration and year copying also validate their proposed counts before writing. Removing/discarding data only reduces reservations. UI usage is advisory and cannot authorize a write.

Once an allowance is reduced below existing usage, edits/removals remain valid and publication emits an over-limit warning. Any added classroom IDs trigger the shared checker, including replacements at the same count while already over limit. Adding classrooms requires a currently valid contract. All publication requires a currently valid, unambiguous contract.

New ACTIVE contracts cannot overlap another ACTIVE contract’s date interval for the same organization. Legacy overlaps are preserved by migration and surfaced as `contractConflict`; creation/publication fail closed until Super Admin resolves them. Historical and future contracts remain stored. Agreement/payment exceptions require a reason.

Migration 003 adds `classroomLimit`, `userLimit`, schedule `dayType`, nonnegative/minimum constraints and contract/year lookup indexes. Each contract’s classroom cap is backfilled from its legacy allocation rows. Existing `Entitlement` rows remain archival and are not returned or used by the application. No records, credentials, publication pointers or contract statuses are reset.

## Dashboard categories

ACTIVE maps to Active. DRAFT and ONBOARDING map to In Onboarding. INACTIVE, SUSPENDED, DELETION_PENDING and unknown non-active states map to Inactive. The three lifecycle categories partition the total and their cards use the same filter mapping. Institution pending deletion does not change its organization’s status. Recent organizations are ordered by the latest organization/institution/subscription timestamp and include real onboarding progress, institution counts, status and an Open action.


## School-wide rules and scoped calendar totals (15 November 2026)

The user-facing hierarchy is Organization → School → Board → Academic Section → Grade → Classroom. Internal `Institution` models and `/institutions` routes remain stable. Academic sections may be removed while their grades/classrooms remain; cross-board grouped rule references are pruned in the same draft mutation.

A school-wide or cross-board rule is stored exactly once in an owning revision board's schedules/events. Its target is `school`, `boards`, `sections`, `grades` or `classrooms`. `applicableRules` gathers shared rules from the authorized school/year configuration. Legacy singular `board`, `section`, `grade` and `classroom` rules remain local to their owner board. Plural target UUIDs are checked against all boards of that school revision; unrelated school/revision references fail backend validation. School-wide defaults also apply to boards added later to a working draft. Rule edits keep their permanent entity ID; physical ownership may move to the board where the rule is edited.

`CalendarEvent.overridesHoliday` is a non-null boolean added by migration `202611150001_calendar_overrides`, default false. It cannot be enabled except on a specific-date working event. The editor requires confirmation. Full holidays suppress teaching schedules; equal-priority holiday/working disagreements remain blocking conflicts. An explicitly scoped recurring half-day action/schedule can open a weekly non-working day, but cannot silently reopen a full holiday.

`POST /years/:id/calendar-summary` derives results for active classrooms within that authorized academic year. Each date counts once per classroom; half-days count as working days. Missing schedules retain calendar working status and are separately marked unresolved. Conflicting/invalid days are unresolved. Working weeks count Monday–Sunday weeks containing a working day, including partial weeks. Working days per week is the observed count for complete weeks, or varies when these differ (and unknown if no complete week is present). Calendar summaries do not sum classrooms into a misleading school day total: differing dates/reasons produce mixed/varies output, with individual classroom rows and holiday lists available.

## Workspace navigation

Six client sections are Overview, Schools, Structure Management, Academic Years, Review & History, Account & Subscription. The selected school is retained across these views, and year/board selection is retained in session storage. The current school and year appear in the workspace header/toolbar. School registration identity comes from onboarding; the client uses change requests for restricted edits.

Major platform and structure workflows render a dedicated page surface with a back button and breadcrumb, rather than an oversized dialog. Platform page/record/workflow context is reflected in query parameters and restored on refresh and browser history navigation; identifiers are checked against the authenticated data set. Form values and credentials are never put in URLs. Structure year/board context is retained per school; structure editor state is not encoded in a deep link. Navigation guards continue to offer save/discard/stay for unsaved changes. Confirmations, credentials, lifecycle warnings, account password changes and small grade/section/classroom edits remain dialogs.

`GET /organization-profile` returns only the current organization registration and contractual subscription metadata, without user secrets or other organizations. It powers Account & Subscription. User-management and additional organization roles remain out of scope.
