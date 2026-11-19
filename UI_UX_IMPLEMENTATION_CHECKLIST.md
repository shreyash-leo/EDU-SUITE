# UI/UX implementation checklist

Status applies to this redesign increment, not to whether a feature exists.

| Area | Status | Remaining work |
| --- | --- | --- |
| Global shell and desktop navigation | In progress | Compare populated states and long labels, keyboard/zoom, all roles and page overlays; review sticky height. |
| Shared tokens, buttons, forms and tables | In progress | Verify contrast, focused/disabled/error states and module-specific CSS overrides. |
| Super Admin directories and dashboard | In progress | Shell screenshots captured for empty states; verify populated, long data, forms, dialogs and all viewports. |
| Onboarding and commercial workflows | In progress | Inspect completed and validation/error states, interaction and mobile widths. |
| Client portal and school details | In progress | Capture current populated and empty states and validate all tabs and actions. |
| Structure, years, boards, sections and classrooms | In progress | Test current structure actions and save feedback; inspect populated, draft, published, validation and keyboard states at required sizes. |
| Bell schedules, calendar, review and publication | In progress | Complete isolated end-to-end scenario, inspect controls, conflicts, overlays and long data. |
| Subjects, workload, timetable generation | Not started | Not implemented in V1; no new domain features inferred. |
| Full accessibility review | Not started | Contrast, keyboard, screen reader, zoom, reduced motion and target sizes. |
| Campaign reference image | Blocked | Image is not available in the supplied attachment or identified project files. |

The requested full page scorecards and matched before/after captures for every major page remain outstanding. See `UI_UX_VALIDATION_REPORT.md` for actual evidence and test outcomes.

## Continuation — 17 November

- Implemented and visually inspected populated school-directory action wrapping and keyboard-focusable table region at 1280; test smaller and long-data states.
- Implemented a visible academic-year label, classroom-first column order, descriptive grade/classroom action labels and a contextual empty state for section assignments; inspect all validation states.
- Implemented calendar day names and higher-contrast labels, and checked a populated 1280 calendar. A 390px month-grid scroll check passed; screen-reader and other mobile states remain.
- Fixed untouched account-dialog dismissal and focus return while retaining the dirty guard; isolated browser regression covers both.
- The main 11 workspace directories were checked for document overflow at 1440, 1366, 1280, 1024 and 390 using a synthetic preview. This is not visual verification of every page at each size.
- `UI_UX_PAGE_SCORECARD.md` records provisional page-level visual scores and explicit missing evidence. No module is fully verified.
