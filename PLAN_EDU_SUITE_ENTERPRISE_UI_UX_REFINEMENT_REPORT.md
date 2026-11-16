# UI refinement checklist

The earlier redesign was reviewed against the actual source and the user's follow-up requirements. Prior fixture-only screenshots do not verify localhost:3000. The server listening on port 3000 has its working directory in this repository's apps/web, but its build freshness remains unverified.

| Original defect | Source and cause | Fix | Visual status |
|---|---|---|---|
| School Details back button stretches | `features/client/portal.tsx`, grid in `app/density.css` lacked self-alignment | Explicit intrinsic width and start alignment in `app/platform.css` | Unverified |
| School Details tabs vertical / sparse | `.portal-detail-tabs` layout depended on legacy stylesheet cascade | Explicit nonwrapping flex row, intrinsic button widths and contained horizontal overflow | Unverified |
| School Details header and actions alignment | `portal.tsx` and `.school-detail-bar` / `.school-quick-actions` competing layout rules | Explicit flexible wrapping and grid minimum widths | Unverified |
| Onboarding directory controls and table alignment | `features/platform/onboarding-catalog.tsx`, legacy `.catalog-toolbar` and table styles | Explicit responsive toolbar layout, intrinsic action alignment and organization hierarchy | Unverified |
| Other screenshot-specific defects and platform-wide audit | Original screenshots and actual authenticated pages require further inspection | Pending | Unverified |

No database or domain code was changed in this refinement. This is an initial correction, not a completed visual audit. Screenshots must be captured from the authenticated application on localhost:3000 before marking issues resolved.

## Continued verification on localhost:3000

The existing `.env` development administrator credentials authenticated successfully through the normal UI, without changing records, permissions, or passwords. Port 3000 runs the repository's Next development server; computed styles on the real onboarding toolbar confirmed `display:flex`, wrapping enabled, and no document horizontal overflow at 1280px. Search, filter and table rendered against actual existing data. An unmatched search exposed incorrect empty-state wording; `components/data-table.tsx` now accepts contextual empty text and `features/platform/onboarding-catalog.tsx` uses it to distinguish no matching organizations. The corrected message was verified in the actual browser.

Actual authenticated after-captures: `artifacts/ui-actual/onboarding-after.png`, `onboarding-journey-after.png`, `schools-after.png`, and `settings-after.png`. These contain real account information and should be treated accordingly. No comparable pre-fix screenshots were captured during this session.

School Details computed styles and visual outcome: **blocked/unverified**. The existing `.env` exposes Super Admin credentials only; the client portal requires an organization-admin account. No password reset or permission change was attempted. School Details CSS matches the React DOM source (`.client-school-details > button:first-child` and `.portal-detail-tabs > button`), and `platform.css` is imported after legacy CSS, but computed styles cannot be confirmed without a client session. Structure Management and other client pages remain unverified. All ten original screenshots have not yet been individually inspected and the platform-wide audit is incomplete. The four Super Admin captures are evidence of observed current state, not an assertion that every defect there is resolved.

## Client layout follow-up

The development seed creates only a platform administrator and optional draft sample records; it does not supply an organization-admin login. Activation creates a random temporary password, and credential regeneration overwrites the current password and deletes sessions. Neither action was performed on an existing organization. Native Chrome session inspection was unavailable because computer-use permissions were not granted. Client Portal and Structure Management therefore remain blocked for actual authenticated browser verification.

Source changes in `features/client/portal.tsx`: assigned the school back control an explicit class and ghost variant, placed secondary classroom statistics in an expandable details section, and corrected the school classroom count label. In `app/platform.css`, updated the existing overview grid so the attention table receives the larger column and moved the back alignment to its explicit class. These fixes have not been visually verified in the real client portal. No before/after client screenshots are available. The original screenshot-by-screenshot and remaining platform audits remain incomplete.

## Ten-screen source audit continuation

`UI_SCREENSHOT_CORRECTION_CHECKLIST.md` maps the ten supplied screen files to the relevant page, components, styles and current status, using their extracted screen text. This does not constitute a completed visual comparison. Additional source work groups Account & Subscription identity/contact/address fields, groups School Overview identity/contact and academic facts, and makes publication change filters an explicitly labeled horizontal button group with an accurate empty-filter message. No user, licensing, scheduling or persistence rules were changed. Client views remain unverified at localhost:3000; an existing organization-admin session is required. Original before-and-after comparison, Bell Time & Calendar refinement, and the wider audit remain pending.

## Isolated authenticated verification

A local disposable schema and real API/Next build on port 3388 enabled legitimate organization activation and login. No customer accounts or application records were modified. School Details, overview, account, structure steps, calendar sections and review were inspected and captured; the ten-screen checklist records measured results and limitations. Review Calendar now uses a contextual empty state instead of instructing users to create a generic record. Both disposable UI schemas were removed. Automated Playwright remains blocked before assertions by the macOS Chromium MachPortRendezvous permission error (1 failed at launch, 6 not run). Populated scheduling and history, comparison against all original image pixels, and the full requested viewport/page matrix remain pending.

## Follow-up implementation — 16 November

The implementation remains **incomplete**. This follow-up changed `apps/web/features/client/portal.tsx`, `apps/web/features/structure/calendar.tsx`, and `apps/web/app/platform.css`. It groups the school calendar overview into board schedules and calendar metrics, positions calendar warnings before the data, adds an empty state and keyboard-focusable table region, improves wrapping for long review and attention values, and names three icon-only scheduling actions. Existing scheduling calculations and licensing logic were not intentionally changed.

Source inspection focused on School Details, the client attention table, publication changes and scheduling views. This was not a page-by-page audit, and the ten original images were not available in the workspace for comparison. No new browser screenshots were captured; earlier captures remain in `artifacts/ui-isolated/` and `artifacts/ui-actual/` and do not verify the follow-up edits. No viewport or keyboard checks of the new changes were completed.

Validation: `npm run typecheck` passed; `npm run build` passed; `npm test` passed 232 tests with 7 skipped; `npx vitest run tests/structure-rendering.test.ts` passed 6 tests. The isolated database suite did not run: PostgreSQL was unreachable, Docker access was denied, and a separate local PostgreSQL initialization failed due to restricted shared memory. No existing data or credentials were modified. Populated scheduling, attention and history, the nine requested viewports, original screenshot comparisons, and the remaining platform audit still require a working isolated database and browser verification. See `UI_SCREENSHOT_CORRECTION_CHECKLIST.md` for item status.

## Verification-environment follow-up — 16 November

All ten original screenshot filenames have now been located in the conversation files. Text extraction was available, but image transfer failed with a DNS error, so no pixel comparison was made. The previous claim that the files were not found is superseded. The earlier real-app screenshot `artifacts/ui-isolated/bell-summary.jpg` showed a broken school logo and an academic-year label wrapping. The current code adds an image-load fallback and adjusts the label; neither change has been visually verified.

Additional changes: `apps/web/features/structure/calendar.tsx` gives populated rule and holiday actions record-specific accessible names and calendar view buttons a selected state; `apps/web/features/client/portal.tsx` gives the attention-table scrolling region keyboard focus; `apps/web/app/platform.css` adjusts year selector spacing. The populated scheduling render tests assert action names.

Environment diagnosis: the configured local PostgreSQL endpoint does not respond; Docker socket access is denied; the previous separate PostgreSQL initialization was denied shared-memory allocation. A frontend-only start in this session also failed to bind 127.0.0.1:3388 with EPERM. Cloud environment discovery returned a tool error, so no separate runnable environment was established. No customer database, credential or published configuration was modified.

Results: typecheck, production build and `git diff --check` passed; the regression suite passed 232 tests with 7 database cases skipped; the six targeted scheduling render tests passed. No new browser or database integration tests ran. The populated scenarios, all requested viewports, original screenshot comparison and remaining platform-wide audit are outstanding. The overall task remains incomplete.
