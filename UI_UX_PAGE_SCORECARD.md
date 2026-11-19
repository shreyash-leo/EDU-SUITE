# Page-by-page UI/UX scorecard

Updated 17 November 2026. Scores are provisional review aids, not usability research or WCAG certification. The requested dimensions are visual hierarchy, layout, space use, typography, component consistency, navigation, workflow efficiency, interaction, accessibility and functional correctness. A dash means insufficient evidence; scores below 4 identify a correction or further investigation below. A screenshot or a passing test does not establish every dimension. Synthetic preview records are not customer records.

| Page / view | Visual review (1–5) | Function evidence | Remaining correction / investigation |
| --- | --- | --- | --- |
| Sign in / first password | — | Previous isolated workflow includes organization sign-in and password setup | Inspect validation, keyboard order, zoom, errors and narrow states. |
| Account dialog | 4 (1280) | Clean Escape, focus return and dirty-discard protected by browser test | Screen-reader and error/success states still need review. |
| Super Admin dashboard | 4 (1280 populated) | Navigation and dashboard rendering tested | Long data, loading, zoom and alternate widths require visual inspection. |
| Organizations directory | 4 (1280 populated) | Edit/save and navigation tested | Long names, filters and errors across viewports need review. |
| Organization registration / details | — | Edit/save and read-only details tested | Inspect full forms, invalid values, dialogs and narrow viewports. |
| Schools directory | 4 (1280 populated) | Board registration and navigation tested | Long names, action and lifecycle states across viewports need review. |
| School registration / details | — | Board registration tested | Inspect complete forms, logo errors and access controls. |
| Onboarding directory and step 4 | 4 (1280 populated) | Record details, tabs and onboarding entry tested | Inspect every stage, validation, completion and narrow states. |
| Subscriptions directory | 4 (1280 populated) | Directory navigation tested | Inspect edit, commercial states, numeric alignment and long text. |
| Subscription / commercial forms | — | Part of historical workflow only | Inspect full input, validation and save/failure states. |
| Requests & settings | 4 (1280 populated list) | Settings save/discard tested | Inspect request review, activity and settings controls at all sizes. |
| Academic presets / board affiliations | — | School board registration tested | Inspect all editors, focus and error states. |
| Client overview | 4 (1280 populated) | Client portal entry tested | Verify long names, empty/error states and remaining sizes. |
| Client school directory | 4 (1280 populated after action wrapping) | Directory and school/configuration entry tested | Confirm long names, large dataset and horizontal-table keyboard behavior at smaller widths. |
| Client school details and four views | 4 (1280 school overview) | Entry, configuration and calendar paths tested | Inspect all tabs and empty/error states at all widths. |
| Account & subscription | 4 (1280 populated) | Navigation tested | Inspect long values, keyboard and other viewport widths. |
| School structure registration / grades | 4 (1280 populated) | Grade creation and accessible action names tested | Audit inline validation, long content and 200% browser zoom. |
| Academic sections | 4 (1280 populated and empty selection) | Assignment/confirmation tested | Inspect conflict recovery and multi-board large datasets. |
| Classroom setup | 4 (1280 populated) | Bulk creation/deletion and labeled actions tested | Inspect large tables, individual editing, validation and zoom. |
| Bell schedules | 4 (1280 populated) | Conflict, correction and publication tested | Inspect all wizard steps, keyboard and long schedules. |
| Holidays / advanced rules | — | Holiday override and timing rules tested | Manually inspect long labels, errors and all viewport sizes. |
| Calendar / preview | 4 (1280 populated after label contrast fix) | Date accessible-name and calendar navigation tested | Verify mobile dates, screen reader, conflicts and all states. |
| Review / publication / history | — | Conflict blocking, publish and history tested | Inspect all warning, error, empty and historical states visually. |
| Subjects / workload / timetable generation | — | Not implemented in V1 | No new functionality authorized. |

Across the application, the nine non-visual dimensions remain unscored where evidence is insufficient. Priority corrections include real browser zoom and assistive-technology testing, full state coverage, responsive visual inspection, and reviewing compact 10–11px legacy text. No module is marked fully verified on this scorecard.
