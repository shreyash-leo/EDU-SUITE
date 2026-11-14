# API contract

All routes are prefixed by `/api`. JSON is used throughout. The Next.js application proxies these requests to NestJS. OpenAPI is served at `/api/docs`.

Writes require `Origin: <WEB_ORIGIN>` and, after authentication, `x-csrf-token: <csrf>`. Browser requests include the session cookie automatically. Login and `/auth/me` return the current CSRF token. Responses never cache authenticated data. Validation errors use HTTP 400, unauthorized sessions 401, forbidden platform actions 403, inaccessible entities 404 and duplicate/stale updates 409.

## Authentication

| Method | Route            | Body                                                        |
| ------ | ---------------- | ----------------------------------------------------------- |
| POST   | `/auth/login`    | `{ email, password, portal: "platform" or "organization" }` |
| GET    | `/auth/me`       | None; returns user and CSRF token                           |
| POST   | `/auth/password` | `{ currentPassword, password }`                             |
| POST   | `/auth/logout`   | `{}`                                                        |

Until the temporary password is replaced, protected business endpoints return 403. The password must have 12–128 characters, uppercase, lowercase, a number and a symbol.

## Platform

| Method     | Route                           | Behavior                                                                                                      |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET        | `/dashboard`                    | Real database lifecycle counts                                                                                |
| GET / POST | `/organizations`                | List / register                                                                                               |
| PUT        | `/organizations/:id`            | Update registration                                                                                           |
| POST       | `/organizations/:id/status`     | `{ status: "ACTIVE", "INACTIVE" or "SUSPENDED" }`; only previously activated organizations can be reactivated |
| POST       | `/organizations/:id/onboarding` | `{ step: 1..5 }`; validates sequential completion                                                             |
| POST       | `/organizations/:id/activate`   | Complete onboarding; one-time temporary credentials                                                           |
| POST       | `/organizations/:id/regenerate` | Explicitly replace credentials and invalidate sessions                                                        |
| GET / POST | `/institutions`                 | List / register                                                                                               |
| PUT        | `/institutions/:id`             | Update registered institution identity                                                                        |
| POST       | `/institutions/:id/action`      | `{ action: "deactivate", "reactivate", "delete" or "restore", confirmation?: institutionName }`               |
| GET / POST | `/subscriptions`                | List / create custom agreement                                                                                |
| PUT        | `/subscriptions/:id`            | Update agreement and entitlements                                                                             |
| GET        | `/audit`                        | Latest 200 administrative audit entries                                                                       |
| GET        | `/usage`                        | Organization usage, shared allowances, per-institution reservations and over-limit status                                                            |

Organization fields: `name`, `email` (mandatory even for a draft), `legalName`, `type`, `registration`, `address`, `city`, `state`, `postalCode`, `contactName`, `phone`, `notes`. Final onboarding requires complete identity/address/contact information.

Institution fields: `organizationId`, `name`, `registration`, `boards: string[]`, `logo`, `address`, `officer`, `phone`, `email`. Organization ownership is immutable. The logo and contacts are mandatory before final onboarding. Board removal is blocked if academic years exist.

Subscription fields: `organizationId`, unique `reference`, nonnegative `amount`, ISO `startsAt` / `endsAt`, `status` (DRAFT/ACTIVE/EXPIRED/SUSPENDED), `agreementStatus` (PENDING/SIGNED/EXCEPTION), `paymentStatus` (PENDING/PAID/PARTIAL/EXCEPTION), `paymentReference`, `notes`, `exceptionReason`, `renewalNotes`, `classroomLimit` (integer 0–100000), `userLimit` (integer 1–100000). These allowances belong to the organization. Exceptions need a reason. ACTIVE contract date ranges cannot overlap for the same organization. Legacy institution allocations are archival only.

## Organization workspace and structure

| Method | Route                              | Body / behavior                                                        |
| ------ | ---------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/institutions`                    | Tenant-scoped list for client accounts                                 |
| GET    | `/institutions/:id/years`          | Tenant-scoped academic years                                           |
| POST   | `/institutions/:id/years`          | `{ label, start: "YYYY-MM-DD", end: "YYYY-MM-DD", copyFrom?: yearId }` |
| GET    | `/years/:id/config`                | Draft if present, otherwise current publication                        |
| GET    | `/years/:id/config?revisionId=...` | A historical revision of the same authorized year                      |
| PUT    | `/years/:id/config`                | `{ config, lock }`; stores draft, returns incremented lock             |
| POST   | `/years/:id/draft`                 | `{ restoreRevisionId?: revisionId }`; creates new draft                |
| DELETE | `/years/:id/draft`                 | Discards draft when a publication exists                               |
| GET    | `/years/:id/review`                | `{ issues, classrooms, changes, license }`                                        |
| POST   | `/years/:id/publish`               | `{ lock, summary }`; transactional validation/publication              |
| GET    | `/years/:id/history`               | Published version metadata                                             |

`config` is `{ boards: [...] }`. The complete, authoritative machine-checked shape is `packages/domain/src/index.ts`:

- Board: `id`, `name`, `nonWorkingDays`, `sections`, `grades`, `schedules`, `events`.
- Section: UUID `id`, `name`.
- Grade: UUID `id`, `name`, `active`, nullable `sectionId`, `classrooms`.
- Classroom: UUID `id`, `name`, `active`.
- Target: `scope` (school/boards/sections/board/section/grade/classroom/grades/classrooms), UUID `ids[]`.
- Rule: `type` (default/weekly/date/recurring), optional `date`, `weekdays[]` (Sunday=0), optional `nth` (1–5), `intervalWeeks` (1–52), optional `anchorDate`.
- Schedule: UUID `id`, `name`, optional `dayType` (`full` or `half`; omitted means full), `arrival`, `dispersal` (integer local minutes), `target`, `rule`, `slots`.
- Slot: UUID `id`, `name`, `kind` (period/routine), `start`, `end` (integer local minutes).
- Event: UUID `id`, `name`, `kind` (holiday/working/half-day), `target`, `rule`.

Unfinished temporal drafts are accepted after structural/reference validation. Publication reruns the entire review against the current subscription inside the transaction. Stale lock values return 409. Permanent logical UUIDs must be retained when editing records.

## Requests and uploads

| Method     | Route                   | Body / behavior                                                                           |
| ---------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| GET / POST | `/requests`             | List tenant requests / `{ institutionId, proposed: partialInstitutionIdentity, reason }`  |
| POST       | `/requests/:id/resolve` | Super Admin only: `{ approve: boolean, resolution }`                                      |
| POST       | `/assets`               | `{ mime: "image/png", "image/jpeg" or "image/webp", base64 }`; maximum decoded size 2 MiB |

Uploads return an S3-backed logo URL. SVG and executable files are rejected. Approved change requests apply the validated registration update and the request resolution in one transaction. Restricted board removal with existing academic history remains blocked even through a request.

## Workspace-completion endpoints

| Method | Route                        | Body / response                                                                                      |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET    | `/onboarding`                | Super Admin only; organization progress, current step, last-updated time and live blocking checklist |
| GET    | `/settings`                  | Super Admin only; `{ values, lock, updatedAt }`                                                      |
| PUT    | `/settings`                  | Super Admin only; `{ values, lock }`; stale writes return 409                                        |
| GET    | `/workspace-settings`        | Authenticated; public support/notice projection only                                                 |
| POST   | `/organizations/bulk-status` | Super Admin only; `{ ids: UUID[1..200], status: ACTIVE/INACTIVE/SUSPENDED }`                         |
| POST   | `/institutions/bulk-status`  | Super Admin only; `{ ids: UUID[1..200], status: ACTIVE/INACTIVE }`                                   |

Settings values: `supportEmail`, `supportPhone`, `supportNotes`, `maintenanceNotice`, `defaultClassroomLimit`. Unrecognized settings are rejected. The deletion recovery duration is not editable.

Bulk selections must contain unique IDs. Every record is validated before mutation; a missing, unactivated or deletion-pending record causes the transaction to roll back. Existing users' organization sessions are invalidated when organization access changes.

The review response now includes `changes`, a list of entity/action/field comparisons against the current published revision. Publication recomputes the diff inside its transaction for the audit record.

Registration-change proposals are strict partial institution identity objects; at least one recognized field is required. Clients cannot propose organization ownership, account roles or institution access status.

## Organization allowance and centralized calendar responses

`GET /usage` returns an array of organizations (all for Super Admin; authenticated organization only for clients). Each row includes `organizationId`, `used`, `limit`, `remaining`, `overLimit`, `users`, `userLimit`, `contractId`, `contractConflict` and `institutions: [{ institutionId, used, years: [{ yearId, published, draft }] }]`. The institution `used` value is consumption, never a separate entitlement. Client institution lists include inactive records for status visibility, but opening their years/configurations remains forbidden. Pending-deletion institutions are hidden from client lists.

Configuration reads and draft-save responses include the same `license` organization snapshot. UI optimistic usage is recalculated from these year counts; backend enforcement always re-reads under the shared organization lock.

`POST /years/:id/preview` accepts `{ board, dates: ["YYYY-MM-DD"], filter?: { sectionId?, gradeId?, classroomId? } }`. `board` is a full validated board draft, enabling previews before autosave. At most 32 dates may be resolved, all within the authorized academic year. Board affiliation must be registered. The response is `[{ date, status, label, results: [{ classroomId, classroomName, status, reason, schedule? }] }]`. Preview writes no data; it uses the same resolver as publication validation.


## School refinement endpoints

- `GET /organization-profile`: authenticated organization registration and its subscription reference/status/validity/classroom/user limits; no arbitrary organization ID accepted.
- `POST /years/:id/preview`: `{ board, config?, dates: string[1..32], filter?: { sectionId?, gradeId?, classroomId? } }`. Optional complete draft config enables unsaved school-wide rules. Without it, shared rules are taken from the authorized saved configuration. Selected dates must lie within the academic year.
- `POST /years/:id/calendar-summary`: `{ config?, boardId?, filter?: { sectionId?, gradeId?, classroomId? } }`. Omit boardId for the school. Returns per-classroom workingDays/holidays/halfDays/unresolvedDays, workingWeeks, observed workingDaysPerWeek and holidayDates; top-level equal results or null/varies for mixed calendars.
- Events support optional `overridesHoliday: boolean`. True is accepted only with `kind: "working"` and a specific-date rule. It deliberately reopens a lower-priority full holiday. Equal-priority opposing events require correction.

Targets `school` and legacy singular `board` use no selected IDs. `boards`, `sections`, `grades` and `classrooms` accept one or multiple IDs in the same school revision, independently of which board owns the stored shared rule. Singular section/grade/classroom references remain local to their owner board.
