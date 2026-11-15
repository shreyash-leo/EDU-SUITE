# PLAN EDU SUITE — UI/UX workflow redesign

Implemented from the attached “PLAN EDU SUITE — COMPLETE UI/UX IMPROVEMENT PROMPT” in Pasted text(7).txt. This update changes real workflows in the existing application; it does not replace the backend or create a disconnected prototype.

## Implemented workflows

| Area | Result |
|---|---|
| Global layout | Shared compact design system remains in density.css: full-width workspace pages, consistent controls/tables/panels, restrained colors and responsive layouts. |
| Organization details | Added Administrator Details and Activity History to existing overview/schools/subscription/onboarding tabs. Administrator metadata excludes password hashes. Activity is scoped to the organization's records within the latest platform audit entries. |
| School management | Explicit parent-organization column, existing boards/status/configuration information, dedicated details and registration pages. |
| Board affiliations | Searchable supported-board input, Add Board, removable selected chips, duplicate detection and academic-year dependency notice. Affiliations already protected by academic history cannot be removed. Unsaved newly added selections can be removed. |
| Editable board catalogue | Super Admin edits supported names in Requests & Settings → Platform settings → Board catalogue. Stored with existing version-checked platform settings JSON; older records receive defaults. Removing a catalogue option does not delete existing school affiliations. |
| Automatic board sync | School registration edits extend every editable academic draft under organization/school/year locks. Permanent entity keys are retained, draft locks increment, and published snapshots remain unchanged. Legacy incomplete drafts are extended automatically on load and saved through the existing API. New publications still require a working draft. |
| School workspace | Existing six client sections and selected school/year context retained; school lists now include academic-year information. |
| Single grades | Short name/status form, Save/Cancel, existing rename/status/delete controls and classroom-dependency confirmation. |
| Multiple grades | Range, board-specific presets and custom one-name-per-line entry. Preview, removable candidates, duplicate/existing-name detection, Active/Inactive choice and created/skipped result. The accepted set is persisted through one existing transactional config write. |
| Academic sections | Left section list with grade counts, right grade table, Unassigned view, searchable checkbox selection, multiple-grade assignment, moving/unassigning and assignment Undo. Section deletion preserves grades/classrooms. |
| Classroom setup | Section/grade filters, total/active/inactive counts, shared license usage and separate single/multiple creation. Generated names are editable/removable in a paginated preview. Existing inactive names are reserved; suffixes progress A–Z, AA, AB. Backend licensing remains authoritative and concurrency-safe. |
| Bell navigation | Three primary views: Default Bell Schedule, Advanced Scheduling, Academic Calendar. Calendar/date previews/year totals are secondary calendar views. |
| Bell schedule wizard | Five steps: scope, day timings, routines, configure periods, preview/save. Auto Assign and manual editing remain. Existing schedules open directly at period editing. Fixed routine changes/deletion require confirmation once anchored. Invalid timing can be saved as a draft but cannot be published. |
| Advanced scheduling | One searchable rule table showing Who / When / What happens / Status / actions. New rule action chooser supports a different schedule, half-day, holiday and special working day. Scope selection uses searchable checkboxes; recurrence presets include second/fourth Saturday. |
| Calendar | Monthly/list views, calendar entry action chooser, collapsible target filters, classroom/date preview and year summaries. Half-days are explicitly labelled. Full-holiday precedence and deliberate reopening rules remain. |
| Requests & Settings | Separate Change Requests, Platform Settings and Activity History views replace one long combined screen. |
| Feedback | Required form errors appear on blur and revalidate while editing. Schedule/event/bulk creation waits for API persistence before closing. Single-action table selections expose the action directly rather than requiring another dropdown choice. |

## Preserved business rules

Organization → School → Board → Academic Section → Grade → Classroom; optional unassigned grades; multiple boards; independent academic years; organization-wide classroom/user contracts; inactive classroom counting; immutable publications and editable drafts; review/activation with warnings; version history; tenant isolation; controlled deletion and 60-day school recovery. No WDM, subject allocation, timetable, email, payment or extra user/RBAC modules were added.

## Verification

- Application TypeScript checks: passed.
- Test-source TypeScript checks, including integration/browser sources: passed.
- Unit/domain/security suite: 126 passed.
- PostgreSQL integration cases: three explicitly skipped without a disposable database opt-in.
- API production compilation: passed.
- Next.js production build: passed.
- Browser suite: six scenarios discovered. Source includes multiple-board registration, duplicate handling and refresh, bulk grades, section assignment, editable classroom previews, fixed-routine confirmation, guided schedule generation, recurring holidays and draft/publication separation.
- Live authenticated visual/browser acceptance was not run. Native computer access was denied in this session. Discovery and source compilation are not proof those browser flows passed.

New unit tests exercise range validation, board-aware presets, custom-name preservation, duplicate detection, inactive classroom name reservation, suffix generation, stale grade references, catalogue defaults and explicit half-day calendar labels. Integration source additionally checks atomic bulk-grade persistence/duplicate rollback, automatic draft-board synchronization and unchanged publications; these database-backed cases still require execution.

## Run locally

Keep current data and credentials. Stop the current dev server with Control+C, then run from the project root:

```sh
export PATH="/usr/local/bin:$PATH"
npm run db:migrate && npm run dev
```

No additional migration was introduced by this workflow update. The migrate command applies any pending earlier migrations, including calendar override support, without resetting data. Docker PostgreSQL/MinIO must already be running as described in README.md.
