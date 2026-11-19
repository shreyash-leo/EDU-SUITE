# PLAN EDU SUITE V1

An integrated Next.js + NestJS + PostgreSQL application for platform onboarding and institution Structure Management. The interface uses a light data workspace, persistent navy app bar, compact collapsible navigation, charcoal action accents, compact record tables and guided workflows. The interface follows Salesforce Lightning record layouts and Microsoft Teams/Fluent spacing and typography patterns.

## Organization client portal

See `CLIENT_PORTAL_2026-11-15.md` for the five-section navigation, organization Overview, server-paginated Schools List/Card directory, read-only School Details and Structure Management landing dashboard. Academic-year management now lives inside each school workspace. Apply additive migration `202611150002_revision_updated_at` and generate Prisma Client on other installations; existing data and credentials remain intact. Use isolated database/HTTP test scripts for safe verification.

## Academic structure enhancements

See `STRUCTURE_ENHANCEMENTS_2026-11-15.md` for configurable board grade/section presets, assignment impact previews, date-limited recurrence previews, calendar totals and draft protection. Super Admin manages presets under Requests & Settings → Platform settings → Edit academic presets. School users choose Apply Suggested Structure in School Registration or Academic Sections, customize, preview impact, then confirm for the selected board. No additional migration or reset is required for these enhancements; earlier pending migrations still apply.

## Latest UI/UX workflow update

See `UI_WORKFLOWS_2026-11-15.md` for the new multi-board selector/catalogue, bulk grades, section assignment, editable classroom previews, guided bell setup and simplified calendar/rule navigation. Source checks and the production build passed; authenticated database/browser acceptance remains unexecuted in this session. Existing data, credentials and business rules are preserved.

## Current refinement update

See `IMPLEMENTATION_2026-11-15.md` for the requirement audit, changes and verification limits. The interface now uses School terminology, dedicated workflow pages, six client navigation sections, shared school-wide scheduling and scoped calendar totals. Apply migration `202611150001_calendar_overrides` before running this version against an existing database. Keep the current `.env` and database volumes.

```sh
export PATH="/usr/local/bin:$PATH"
docker compose stop api web
docker compose up -d --wait postgres minio
docker compose up -d bucket
npm run db:migrate && npm run db:generate && npm run dev
```

No reseed, password reset or volume deletion is required for this update.

## Updated workspace features

See `REFINEMENT.md` for the architecture-alignment audit and verification limits. See `CHANGES.md` for prior workspace improvements: inline editing and bulk lifecycle actions, detailed bell conflict feedback, calendar target filters and aggregate day lists, complete registration-change forms, publication diffs, live onboarding blockers, editable platform settings and shared save/discard navigation protection.

Existing installations must preserve their `.env` and data volumes and apply all migration directories. `docker compose up --build -d` runs pending migrations before the API starts; it does not reset existing credentials.

## Start locally with Docker

Requires Docker Desktop with Compose. This project uses Node **24.11 or newer**, including its built-in Argon2id implementation.

MinIO and its setup client are built from their official GitHub source using `docker/minio.Dockerfile`, because the former prebuilt registry images are unavailable. The first build requires internet access and takes longer while compiling Go dependencies; Go is installed inside Docker, not on your computer. If an older checkout reports `pull access denied for minio/mc`, use the updated Compose file and Dockerfile, then rerun `docker compose up --build -d`.

1. Copy `.env.example` to `.env`.
2. Set `SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` in `.env`.
3. Run `docker compose up --build -d` from this folder.
4. Open **http://localhost:3000** and choose **Super Admin**.
5. Sign in with those seed credentials. Replace the password at first login.

Compose starts PostgreSQL, MinIO logo storage, the API, the frontend and daily database backups. Migrations run before the API starts. Development seeding never changes existing passwords and refuses to run in production. Fictional sample organization/institution drafts are enabled by `DEV_SEED_SAMPLE_DATA=true`; their logos and commercial setup are deliberately incomplete so the registration checks remain real.

To inspect startup: `docker compose logs -f api web`. To stop while preserving data: `docker compose down`. Volumes retain records across application restarts. Do not use `down -v` unless you intend to erase the local database, assets and backups.

## Developer setup

Use Node **24.11 or newer** and npm **11 or newer**. Check `node --version` and `npm --version` in the same terminal you use to start the application. Node 22 cannot run the built-in Argon2 password hashing used by this project. If you use nvm, run `nvm install` and `nvm use` in this folder (`.nvmrc` selects Node 24).

```sh
cp .env.example .env
npm ci && npm run db:generate
docker compose stop api web
docker compose up -d postgres minio bucket
npm run db:migrate && npm run db:seed && npm run dev
```

For an existing installation, keep your current `.env`; do not copy over it.

If installation reports `Cannot read properties of null (reading 'edgesOut')`, npm has crashed during dependency resolution. Switch to the supported Node/npm versions first, then retry `npm install`. A subsequent `prisma: command not found` means the installation never completed; Prisma is installed by the root `npm install`, and does not need a global install. Run database commands only after installation succeeds.

Frontend: `http://localhost:3000`. API: `http://localhost:4000/api`. Interactive API documentation: `http://localhost:4000/api/docs`.

PostgreSQL is exposed on `localhost:55432` to avoid conflicts with existing local databases. Docker services connect internally to `postgres:5432`. For developer commands running on your computer, use port `55432` in `.env`'s `DATABASE_URL`.

`npm run dev` checks Node compatibility before starting. The API also verifies database connectivity before announcing startup. `crypto.argon2 is not a function` indicates an unsupported Node executable; switch to Node 24.11+ in the terminal that launches the app. `Cannot connect to PostgreSQL` means Docker/PostgreSQL must be started or DATABASE_URL corrected. After a computer restart, open Docker Desktop and run `docker compose up -d --wait postgres minio`, then `docker compose up -d bucket` before starting development.

Development uses `apps/web/.next-dev`; production build/start use `apps/web/.next`. Keeping these generated directories separate prevents production build checks from overwriting a running development server's chunks. After updating Next.js configuration, restart `npm run dev` if it does not restart automatically. If an old mixed-cache error persists, stop development, remove only these generated directories, and start development again; application data remains in PostgreSQL/MinIO.

The frontend proxies `/api` to NestJS so browser authentication remains same-origin. For a local development API, the default upstream is localhost:4000. Docker builds use `API_INTERNAL_URL=http://api:4000` because the proxy rewrite is compiled into the Next.js build.

## Walk through the application

1. Register an organization, saving an incomplete draft if needed.
2. Open Onboarding and select that organization.
3. Register its institutions, multiple boards and school logos.
4. Configure a quotation-based subscription with organization-wide classroom and user allowances.
5. Record agreement/payment status, or explicitly document a commercial exception.
6. Complete administrator details and activate the client.
7. Copy the one-time credentials and manually share them with the client.
8. Sign out. Choose Organization, log in and replace the temporary password.
9. Select an institution, create an academic year and configure its four Structure Management tabs.
10. Review and publish. Warnings allow incomplete activation; blocking errors prevent publication.
11. Create a working draft to edit an active structure. Published versions stay unchanged until the draft passes validation and is published.

The Super Admin has exactly six navigation sections. Organization administrators see only their own active institutions. V1 intentionally excludes email sending, payments integration, staff accounts, permission matrices, Subjects, WDM and timetable generation.

## Tests and checks

```sh
npm run typecheck
npm test
npm run build
```

`npm test` runs the domain/security unit suite. The PostgreSQL suite is explicitly skipped unless enabled. To run it, use a **disposable** PostgreSQL database, set its `DATABASE_URL` in `.env`, apply migrations, then run:

```sh
npm run test:db
```

The database integration test covers organization/institution creation, multi-board onboarding, activation and temporary credentials, tenant isolation, entitlement enforcement, immutable publication, optimistic locking, academic-year copying and institution deletion/restoration. It cleans up its own fictional records.

The HTTP end-to-end test exercises the running backend through the frontend proxy, including cookie/CSRF authentication, the mandatory first password replacement and the client publication flow:

```sh
E2E_BASE_URL=http://localhost:3000/api E2E_ADMIN_EMAIL=your-admin-email E2E_ADMIN_PASSWORD=your-current-password npm run test:e2e
```

Use a disposable instance. The HTTP test creates fictional organization records and preserves them for inspection. It requires an activated platform administrator. Change the temporary password first, or provide `E2E_ADMIN_NEW_PASSWORD` for a disposable test instance. It does not print generated client credentials. An included GitHub Actions workflow provisions disposable PostgreSQL, runs the suites, builds both applications and executes the real HTTP journey; that workflow has not run in this session.

Browser regression tests are also included. With the application running on a disposable instance and the administrator password already changed:

```sh
npx playwright install chromium
E2E_WEB_URL=http://localhost:3000 E2E_ADMIN_EMAIL=your-admin-email E2E_ADMIN_PASSWORD=your-current-password npm run test:browser
```

These tests create fictional records. Use current administrator credentials; if the HTTP suite just changed a temporary password, use that new password for the browser suite. The three browser scenarios cover inline edits/navigation/refresh, settings discard/save and overlap-blocked schedule publication.

See `VERIFICATION.md` for the exact checks completed in the authoring session and the checks still requiring an unrestricted runtime. An included test is not evidence that it has passed.

## Important data rules

- One active organization contract provides a shared classroom allowance and user allowance. No institution, board or grade has a separate quota. V1 provisions one organization administrator only.
- Count inactive classrooms and inactive/pending-deletion institutions until records are permanently removed.
- For each academic year, reserve the greater of the classroom counts in its current publication and working draft. For each institution, take the maximum reservation across its years. Sum these institution maxima for organization usage. Historical revisions are never counted separately. See `ARCHITECTURE.md` for the exact algorithm.
- Classroom creation, copying/restoration that adds classrooms and contract mutations lock the same organization row. Bulk additions use the same backend check.
- Lowering an allowance preserves all records. Existing edits/removals and their publication remain permitted, with an over-limit warning. New classroom creation is blocked while the resulting organization usage exceeds the allowance. A valid contract is required to publish.
- Migration `202611140003_organization_licensing` backfills each contract cap by summing its legacy institution allocations and sets the user allowance to one. Legacy allocations remain for audit only. Overlapping active contracts are flagged; Super Admin must resolve them before classroom creation or publication.
- Organization registration email is unique. Institution registration is unique within its organization. Names are not used as relationship identifiers.
- Registered identity and board affiliations are managed by Super Admin. Client changes go through requests. Boards with existing academic-year history cannot be removed through a registration edit. Newly registered boards can be added to a working draft using **Sync newly registered boards**.
- Deleting a section leaves its grades unassigned. Deleting a grade removes its dependent classrooms only from the editable revision.
- Institution deactivation preserves data indefinitely. Explicit deletion locks client access and schedules permanent deletion exactly 60 × 24 hours later. Restoring before the deadline cancels deletion. A database legal hold defers destruction.

## Deployment

This deliverable is the requested PostgreSQL/NestJS project. It has not been published to a substitute static hosting platform.

For a production VPS deployment with automatic HTTPS, private database/object storage, health-gated startup, pinned service versions, backups, and update commands, follow [`DEPLOYMENT.md`](DEPLOYMENT.md). Use `compose.production.yaml`; the default `compose.yaml` remains the local development stack.

Before production, use HTTPS; set `NODE_ENV=production`, `WEB_ORIGIN` to the exact public origin, production database/storage credentials and an accessible `S3_PUBLIC_URL`. Keep NestJS and PostgreSQL private behind the frontend/reverse proxy. Production cookies use `__Host-` naming, Secure, HttpOnly and SameSite=Strict. Development cookies support localhost HTTP.

Production never runs the development seed. Provision the initial administrator once using `npm run admin:provision` with `PROVISION_ADMIN_EMAIL`, `PROVISION_ADMIN_NAME` and `PROVISION_ADMIN_PASSWORD` supplied securely in the process environment. Existing administrator credentials are never overwritten by this command. The password must be replaced on first login.

The API reconciles overdue deletions every minute using database deadlines and row locks. Multiple API processes can safely reconcile the same deadline. Keep at least one API instance running. If it is offline, overdue deletions are processed on restart. A failed storage or database operation remains retryable. Redis/BullMQ is unnecessary for this small deadline reconciler and is deliberately omitted.

The Compose backup service creates daily PostgreSQL custom-format dumps and retains 14 days in a dedicated volume. Production operators must additionally configure encrypted off-host copies, storage lifecycle rules, retention/legal holds, monitoring and restore drills. Restore a selected dump with `pg_restore` into a new empty database and point a staging instance at it before replacing production data.

## Source map

| Location                                                   | Responsibility                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/web/app`, `apps/web/features`, `apps/web/components` | Both portals and the shared interface                             |
| `apps/api/src/main.ts`                                     | REST routing, sessions, CSRF, uploads and deletion reconciliation |
| `apps/api/src/service.ts`                                  | Tenant-scoped transactional business workflows                    |
| `apps/api/src/store.ts`                                    | Normalized revision persistence and audit helpers                 |
| `apps/api/src/password.ts`                                 | Salted Argon2id password storage                                  |
| `packages/domain/src`                                      | Validation, licensing, recurrence and schedule resolution         |
| `prisma`                                                   | Relational schema, executable migration and development seed      |
| `tests`                                                    | Domain, database integration and real HTTP tests                  |

`ARCHITECTURE.md` explains versioning and scheduling. `API.md` documents request shapes. `VERIFICATION.md` records execution evidence and runtime limitations.
