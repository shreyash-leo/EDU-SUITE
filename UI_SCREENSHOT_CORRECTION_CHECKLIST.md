# Original screenshot correction checklist

Images identified from the supplied Library items. Page identification below uses the extracted screen text; individual visual comparison is still pending where marked. Screenshots of the real application contain private data and are retained locally in `artifacts/ui-actual`.

| Original screenshot | Defect / requested correction | React source | Styles | Implementation / actual visual status |
|---|---|---|---|---|
| 2:41:41 | Onboarding stepper, excess space, completion hierarchy | `features/platform/forms.tsx`, `components/workspace/tabs.tsx` | `app/platform.css`, `app/density.css` | Existing compact progress/stepper; actual page captured, detailed original comparison pending |
| 2:41:59 | Schools table distribution, licensing text, actions | `app/page.tsx`, `components/data-table.tsx` | `app/platform.css` table rules | Actual screen captured; column-by-column comparison pending |
| 2:43:26 | Platform settings form grouping and excessive height | `app/page.tsx`, `components/ui.tsx` | `app/platform.css`, `app/density.css` | Actual screen captured; grouping/height comparison pending |
| 2:43:53 | Overview duplicate classroom metrics, clipped attention actions | `features/client/portal.tsx` | `app/platform.css` `.portal-overview-columns` | Secondary counts collapsed; attention column widened. Real client verification blocked |
| 2:45:51 | Account identity/contact/address organization and contract | `app/page.tsx` | `app/platform.css` `.account-information` | Sections grouped; real client verification blocked |
| 2:46:40 | Overview attention and activity / subscription alignment | `features/client/portal.tsx` | `app/platform.css` `.portal-columns` | Responsive column widths adjusted; real client verification blocked |
| 2:47:20 | School Details back control, header, actions, horizontal tabs | `features/client/portal.tsx` | `app/platform.css` `.school-back`, `.portal-detail-tabs` | Explicit back class, intrinsic width, flex tabs; real client verification blocked |
| 2:47:26 | School identity and academic statistics grid | `features/client/portal.tsx`, `components/ui.tsx` | `app/platform.css` `.detail-grid`, `.portal-facts` | Grouped identity and contact; academic statistics separated; corrected classroom label. Real client verification blocked |
| 2:47:36 | Review & History toolbar, change filters and rows | `features/structure/workspace.tsx`, `change-review.tsx` | `app/platform.css` `.change-review` | Filter group semantics and compact horizontal layout; real client verification blocked |
| 2:57:12 | Bell and Calendar board table, metrics and warnings | `features/client/portal.tsx`, `features/structure/calendar.tsx` | `app/platform.css` `.portal-table-wrap`, `.portal-facts` | Existing layout retained; actual review and correction pending |

Client onboarding directory (`features/platform/onboarding-catalog.tsx`, `.catalog-toolbar`): real localhost:3000 layout and no-match search checked at 1280px; other viewports and screenshot comparisons pending. Authentication: Super Admin local login works. Organization login requires existing organization's password; seed contains none, and regeneration would replace credentials and invalidate sessions. Existing customer accounts have not been changed.

## Isolated real-application verification (16 November)

A separate disposable PostgreSQL schema, real API, and production build of this repository's Next frontend were used at `127.0.0.1:3388`. The organization was created through normal onboarding and activation; no existing account was changed. Both disposable UI schemas were removed after testing.

- School Details: **partially verified** at 1440×900 and 1536×960. Back button measured 136px and all four tab top positions matched; no page overflow at 1440. Captures `artifacts/ui-isolated/school-1440.jpg` and `school-1536.jpg`. Test school has no classrooms, so populated and long-content states remain unverified.
- Client overview and Account & Subscription: **partially verified** with real API data; captures `overview.jpg` and `account.jpg`. The empty school setup does not reproduce the original populated attention table.
- Bell summary, default timing, holidays, advanced rules, calendar and publication review: **partially inspected** on real frontend; captures `bell-summary.jpg`, `bell.jpg`, `holidays.jpg`, `advanced.jpg`, `calendar.jpg`, `review.jpg`. No populated schedule or history was exercised. Review empty state was subsequently corrected in source and requires a fresh browser capture.
- Structure steps: **partially inspected**; `sections.jpg`, `classrooms.jpg`, and `structure-phone.jpg`. At 390×844 document width measured 390px.
- Onboarding directory: captures `onboarding-1440.jpg`, `onboarding-1536.jpg`. Other original Super Admin page comparisons and populated edge cases remain pending.

These are after screenshots, not before/after pairs. Detailed visual comparisons with the ten original image pixels, full viewport coverage on every page, and populated client workflows remain outstanding.

## Follow-up implementation — 16 November

Status here applies to the changes in this follow-up, not the earlier screenshots. The original screenshots have not been visually compared in this execution.

| Area | Status | Evidence / remaining work |
|---|---|---|
| School Details: Bell Time & Calendar summary | IMPLEMENTED BUT NOT VISUALLY VERIFIED | `features/client/portal.tsx` groups board schedules and calendar totals, places warnings before the data and provides a keyboard-focusable table region and an empty state. `app/platform.css` adds a responsive metric grid. Verify populated and empty states in the real application. |
| Populated change-review and attention rows | IMPLEMENTED BUT NOT VISUALLY VERIFIED | `app/platform.css` permits long values to wrap and reserves space for attention actions. Verify with long real rendered values and at all required viewport widths. |
| Scheduling icon-only actions | IMPLEMENTED BUT NOT VISUALLY VERIFIED | `features/structure/calendar.tsx` supplies accessible names for the schedule delete and calendar rule edit/delete icons. Verify keyboard and screen-reader behavior in the application. |
| All ten original screenshot comparisons and remaining platform views | BLOCKED — all ten original files were located in Library on the follow-up below, but visual image transfer failed and the actual application cannot be served in this restricted environment. Existing captures above remain historical evidence, not verification of current changes. |
| Populated scheduling, attention, version history and nine viewports | BLOCKED — no PostgreSQL server was reachable at the configured local address; Docker socket access was denied; separate PostgreSQL initialization failed because shared memory creation was not permitted. No customer data or credentials were changed. |

Typecheck and production build passed. Full regression suite: 232 passed, 7 skipped; the isolated database suite failed before tests ran because the server was unreachable. Targeted structure rendering: 6 passed. Browser verification was not performed for the new changes.

## Verification-environment follow-up — 16 November

All ten original `Screenshot 2026-11-16 at … PM.png` files were located in the conversation files, at 2.41.41, 2.41.59, 2.43.26, 2.43.53, 2.45.51, 2.46.40, 2.47.20, 2.47.26, 2.47.36 and 2.57.12. Their text was readable, but image transfer for pixel inspection failed with a DNS error. No visual comparison is claimed.

| Item | Status | Evidence / remaining work |
|---|---|---|
| Broken logo fallback and academic-year label spacing | IMPLEMENTED BUT NOT VISUALLY VERIFIED | A historical `artifacts/ui-isolated/bell-summary.jpg` capture visibly showed a broken image and a wrapped academic-year label. `features/client/portal.tsx` now falls back to the school icon on image failure; `app/platform.css` adjusts the label. Verify the current application. |
| Scheduling actions, calendar selection and attention table | IMPLEMENTED BUT NOT VISUALLY VERIFIED | Added record-specific accessible names, selected state for calendar controls and keyboard access to the attention table. The populated scheduling render tests check record names; live keyboard and visual verification remains pending. |
| Isolated populated application, nine viewports, ten visual comparisons | BLOCKED | Configured PostgreSQL is not listening. Docker socket access is denied, PostgreSQL initialization failed creating shared memory in the prior attempt, and this session denied a frontend bind to 127.0.0.1:3388. Cloud environment discovery returned an error; no alternative runnable environment was identified. No customer records or credentials were touched. |

Current checks: production build and typecheck passed; 232 tests passed and 7 database tests skipped; 6 targeted scheduling render tests passed; `git diff --check` passed. Browser, populated integration and visual verification did not run.

## Local session follow-up — 16 November

- The existing project's API and frontend processes were confirmed on ports 4000 and 3000; `/api/health` returned `{"ok":true}`. Docker was reachable and the existing PostgreSQL container was healthy on port 55432. No running project service was restarted.
- The isolated database integration suite passed all 7 tests. A separate disposable schema and servers were used for browser checks, then removed by the test harness; existing application data and accounts were not changed.
- The browser run passed the organization editing and settings scenarios. It also verified a populated school details view, saving an overlapping schedule, blocking publication, correcting it, publishing, and viewing calendar totals and history. Capture: `artifacts/ui-isolated/school-populated-current.png` (1280px). This is not a comparison with an original screenshot.
- Updated browser selectors for exact password labels, the renamed calendar control, multiple conflict messages, and waiting for the save dialog to finish. The full browser suite remains incomplete: the third scenario timed out looking for the former `Add schedule` control after reopening configuration; four later scenarios did not run. Its remaining steps need to be reconciled with the current scheduling workflow.
- The ten original screenshot image files were not accessible in this local session. Comparisons, remaining viewport checks and the unverified checklist items above remain outstanding.
