# UI/UX master audit

Updated 17 November 2026. This is an active correction register, not a complete certification. Existing detailed source and historical browser inventory: `PLAN_EDU_SUITE_COMPLETE_PLATFORM_UI_UX_REDESIGN_REPORT.md`; historical screenshot issues: `UI_SCREENSHOT_CORRECTION_CHECKLIST.md`.

| Priority | Finding and evidence | Action / status |
| --- | --- | --- |
| Foundation | Persistent left navigation consumed horizontal workspace; baseline `artifacts/ui-redesign/before/dashboard-1440.png`. | Desktop navigation moved above content using existing destinations and guards; mobile menu retained. Isolated shell check passed at five desktop widths and 390px. |
| Foundation | Colored navigation and metric icons competed with ordinary information; baseline dashboard. | Shared brand accent is muted blue and dashboard metric icons neutralized. Other historical tone-specific components require review. |
| Readability | Shared table cells, labels and buttons used 10–12px text in main workflows (`app/platform.css`). | Increased shared table headings/cells, labels and standard buttons. Check individual legacy overrides and data-heavy views for wrapping. |
| Accessibility | Narrow-screen navigation was translated offscreen without being hidden from keyboard focus; structure board selection had no pressed state. | Closed mobile menu is hidden, Escape closes it and returns focus; selected board has pressed state and draft save text announces status. Screen-reader and zoom testing remain outstanding. |
| Cross-product | Five stylesheets contain overlapping rules; some pages retain small text, colored decorative elements and nested containers. | In progress: consolidate or refine after each page is inspected; avoid broad changes without populated-state evidence. |
| Workflow verification | Scheduling and client-portal regression flows previously timed out at steps requiring current state or validation. | The isolated browser suite now passes its scheduling and client-portal scenarios; broader states and viewport coverage remain unverified. |
| Reference | Requested campaigns benchmark image was not present in this attachment or identified among project files. | Blocked for visual comparison; written direction used instead. |

See `UI_UX_IMPLEMENTATION_CHECKLIST.md` and `UI_UX_VALIDATION_REPORT.md` for scope and evidence. Per-page 10-point scorecards, populated/long-data states, full accessibility checks and all requested viewport comparisons remain to be completed.

## Continuation findings

| Finding | Status / evidence |
| --- | --- |
| Populated structure-directory actions overflowed the visible table at 1280. | Action group wraps; scroll region is keyboard focusable. Matched captures in `artifacts/ui-redesign/continuation-before/structure-directory.png` and `continuation-after/structure-directory.png`. |
| Classroom capacity preceded its identifying name; icon-only grade/classroom actions had no names. | Name/grade/section now precede capacity; actions have record-specific accessible names. Browser assertions added. |
| Empty unassigned section incorrectly instructed users to create a record. | Context-specific empty text now explains the current selection. |
| Opening then dismissing an untouched account form triggered a dirty warning; focus did not return. | Empty password defaults and focus restoration added; clean Escape and dirty discard tested. |
| Calendar day labels were low contrast and did not include a complete date in accessible names. | Darker, larger labels and full-date accessible names added; populated calendar captured. |
| At 200% CSS text enlargement the global navigation could clip its last destination. | Navigation can scroll when constrained and keyboard focus scrolls the destination into view; this is a CSS enlargement check, not full browser zoom certification. |

| Mobile calendar labels broke words in narrow columns. | Month grid now scrolls in a keyboard-focusable region with a visible hint and list alternative; 390px synthetic capture recorded. |
