> Superseded for current implementation status by `IMPLEMENTATION_2026-11-15.md`. The audit and verification below describe the earlier 14 November snapshot.

# PLAN EDU SUITE — architecture alignment and corporate workspace

14 November 2026. Changes applied to the existing local project. No rebuild from scratch, deployment, credential reset or database reset was performed.

## Initial audit and resulting changes

| Area | Existing implementation | Gap found | Result |
|---|---|---|---|
| Super Admin | Six sections, editable tables, lifecycle controls | Drafts excluded from metrics; recent table lacked required metadata | Counters partition all statuses, card filters match, recent table includes progress/counts/update date/action |
| Onboarding | Seven saved steps, blocking issues, temporary credential rotation | Commercial checks depended on per-school entitlements; activation could trust stale completed steps | One current organization contract; activation rechecks current fields and commercial blockers |
| Subscription licensing | Institution Entitlement rows, institution locking | Shared classroom cap and user allowance missing | Contract-level classroom/user limits; organization lock for all increasing operations and contract edits |
| Organization portal | Tenant-scoped institutions and academic-year selection | Cards repeated school-specific allowances; inactive institution statuses hidden | Compact institution table, organization identity/shared utilization, inactive status visibility with editing access blocked |
| Structure | Four tabs, inline/bulk edits, autosave, versioned drafts, review/history | Copy/restore could bypass shared licensing; no copy-count preview | Shared checks for saves/copies/restores, record-count copy preview, new affiliations included in new drafts |
| Bell & Calendar | Target/date priorities, recurrence, generation, diagnostics | Half-day mismatch was only a warning; browser resolved previews locally | Explicit half-day schedule type, invalid half-days block publication, backend preview endpoint reused by calendar views |
| Database/security | Prisma relations, tenant checks, cookie/CSRF, Argon2id, scheduled deletion | Institution-level entitlement enforcement; board-edit/year-create race | Additive migration, shared transactional locks, board registration edits checked inside transaction |
| UI/UX | Shared Radix/shadcn components, TanStack tables, responsive layout | Orange styling, decorative sidebar card, small/light text | Neutral/charcoal palette, Inter, clearer tables/forms, compact cards, collapsible sidebar, restrained surfaces |

The existing onboarding, authentication, approval requests, safe grade/section deletion, publication history, first-login password replacement and 60-day institution recovery infrastructure were preserved. WDM, subjects, allocation, timetable generation, client RBAC, email and payment gateway integrations were not added.

## License rules implemented

1. Count every classroom in each current year configuration, including inactive classrooms and every board.
2. For each year, take max(current published count, current draft count).
3. For each institution, take the maximum year reservation across all stored years.
4. Sum institution maxima across the organization. Inactive and pending-deletion institutions still count.
5. Compare this total to the single currently valid ACTIVE contract's classroom allowance.

Example: institution A reserves 45 classrooms, B 25 and C 20. Organization usage is 90; a 100-classroom contract has 10 remaining. A copied year with the same 45 classrooms does not add another 45.

Historical revisions are never added. Draft/published classroom IDs are not unioned. All stored years participate through their current pointers, so an older year can determine an institution's maximum reservation. This is the explicit V1 counting policy; it is not a count of every distinct classroom ever created.

All operations that can increase consumption lock the organization before institution/year locks. Count checks and writes occur in one transaction; contract changes use the same lock. Both bulk creation and simultaneous changes in different institutions use this path. After a reduction, records are preserved, existing edits/removals can be published with a warning, and added classrooms are blocked while over limit.

V1 keeps one organization administrator. The contractual user limit is stored for future expansion; no additional account-management functionality was added.

## Database migration

`prisma/migrations/202611140003_organization_licensing/migration.sql` adds:

- `Subscription.classroomLimit`, backfilled by summing that subscription's existing legacy allocation rows.
- `Subscription.userLimit`, default one, with a minimum-one constraint.
- A nonnegative classroom allowance constraint and organization/contract-date index.
- An institution/academic-year index.
- `Schedule.dayType`, default `full`, allowing explicit half-day classification.

Existing allocation rows remain archival and are no longer used for enforcement. No published structure, institution, password or contract status is deleted/reset. If legacy ACTIVE contracts overlap, the app reports a contract conflict and blocks new classrooms/publication until Super Admin resolves it. It does not silently merge contracts or change their commercial terms.

Existing schedules intended for half-days need `Half day` selected in their editor when updating that configuration. Older published snapshots remain preserved. The new resolver will identify an inappropriate schedule when previewed/reviewed.

## Verification completed

- Prisma client generation: passed.
- Application TypeScript checks: passed.
- Test-source TypeScript checks, including integration/browser sources: passed.
- Unit/security tests: **86 passed**, two PostgreSQL tests explicitly skipped.
- NestJS production compilation: passed.
- Next.js optimized production build: passed.
- Playwright test discovery: three scenarios discovered.

## Runtime acceptance still required

No database-backed, HTTP or browser execution is claimed. `npm run db:migrate` returned P1001 for localhost:55432 in this execution environment. Docker access was unavailable. An isolated PostgreSQL initialization was also rejected by the environment's shared-memory restriction. The reference screenshot was not available as a separate image, so visual matching and browser interaction remain unverified.

The included database tests cover cross-institution concurrent classroom creation (one succeeds when one slot remains), contract overlap rejection, allowance reductions, over-limit edits/publication, multi-board creation, copied years, blocked historical restoration, tenant preview isolation, credential rotation without duplicate users, institution access/lifecycle, legal holds and deadline-based deletion. They need execution on disposable PostgreSQL.

The HTTP suite covers two institutions sharing one contract, temporary login/password replacement, tenant isolation, shared-limit rejection, backend calendar previews, publication history and deletion/restoration. The browser suite covers inline validation/refresh, settings navigation decisions and overlap-blocked publication. Source compilation/discovery is not evidence that these journeys ran.

## Start the updated existing installation

Keep the existing `.env`. Stop the previous local `npm run dev` with Ctrl+C, then run from the project root:

```sh
export PATH="/usr/local/bin:$PATH"
rehash
npm ci && npm run db:generate &&
docker compose stop api web &&
docker compose up -d postgres minio bucket &&
npm run db:migrate &&
npm run dev
```

The PATH line selects the verified Node 24/npm 11 installation on this Mac. Other machines should use Node 24.11+ and npm 11+. Open http://localhost:3000. Existing passwords stay unchanged; seeding is not needed for an existing installation. Docker builds and CI now use the lockfile with `npm ci`.

For an existing Docker-only installation, run `docker compose up --build -d`; the API applies pending migrations before starting. Preserve volumes and the current `.env`.

Run acceptance tests against a disposable instance, using the environment-variable examples in README.md. Do not run the database integration suite against real school data. Refresh/restart persistence, real uploads, the complete browser journey and live concurrent behavior remain part of that acceptance run.
