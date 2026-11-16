# PLAN EDU SUITE platform design system

## Scope and page audit plan

The UI redesign covers the existing React/Next application, not a new product or a scheduling revision. Existing business rules, API calls, field validation, routes, stored state, approvals, drafts and immutable publications remain authoritative.

| Existing surface | User task | Redesign pattern |
|---|---|---|
| Super Admin / organization sign-in, first-password replacement | Enter the correct workspace securely | Clear portal selector, focused form, practical product context |
| Platform dashboard | Find organizations needing action | Compact meaningful metrics, operational queue, recent records |
| Organizations list, creation, editing, status, detail tabs | Register/manage a client and inspect related records | Directory toolbar, grouped form sections, record identity + relationship tabs |
| Schools list, registration, edit, lifecycle, detail tabs | Maintain identity, boards and account state | Teal identity accents, readable forms/logo upload, safe lifecycle dialogs |
| Subscriptions list, creation/edit and agreement details | Manage contracts and organization allowances | Commercial summary, aligned numeric data, explicit agreement/payment status |
| Onboarding directory list/cards and seven saved stages | Complete registration through activation and first login | Journey summary, accessible stepper, focused stage content and next action |
| Credentials, administrator information and account password | Inspect/copy activation credentials and maintain account | Focused secure dialog/page with clear state and actions |
| Requests, registration-change composer, review/resolution | Propose and approve identity changes | Request context, grouped fields, visible approval states |
| Platform settings, activity, board catalogue, academic presets | Maintain supported settings and inspect changes | Sectioned settings workspace, editable catalogue, activity table |
| Client overview | Understand schools and pending setup | Real-data summary, attention list, current agreement and activity |
| Client school directory, configuration directory, review/history directory | Choose school/year and continue work | Searchable directory, restrained list/card switch, consistent status chips |
| Client school detail: overview, structure, bell/calendar, history | Inspect identity and current configuration | School context bar and scoped detail tabs |
| Account/subscription and organization profile | Inspect contract and shared limits | Definition lists and agreement table |
| Structure: registration, sections, classrooms, bell/calendar | Configure an academic year | Four contextual steps, shared school/year/state header, efficient tables |
| Default Bell Timing, Holidays, Advanced Scheduling, effective previews/year totals | Edit and understand scheduling rules | Normal/holiday/advanced semantic accents, clear timelines and readable outcomes |
| Structure review, publication, history and restore | Validate and publish a draft safely | Readiness colors, effective totals, staged publication controls |
| Academic-year, presets, bulk grade/classroom, schedule and rule editors | Complete substantial configuration tasks | Dedicated workflow page, grouped fields, one vertical scroll owner |
| Deletion, discard, lifecycle and navigation confirmations | Make a reversible or destructive decision deliberately | Radix focus-managed dialog, explicit consequence + cancel/confirm hierarchy |

## Foundation

Use one neutral surface system with purposeful accents: indigo primary, teal school/calendar, emerald success, amber attention, red destructive, sky information and violet advanced configuration. Avoid decorative gradients, invented metrics or repeated nested card grids. Existing Radix/shadcn-compatible primitives and TanStack tables are retained.

21st.dev references reviewed: Origin UI Button, Origin UI Dialog, shadcn Sidebar and the MCP/CLI setup. Authenticated source retrieval is not available in this session. Adapt public interaction patterns through original project-owned components instead of claiming a registry installation or adding unaudited dependencies.

Implementation tokens, component usage, scrolling contracts and actual verification are documented below as the redesign is implemented.

## Implemented tokens and usage

`app/design-tokens.css` is authoritative and loads after legacy geometry styles. `app/platform.css` owns the new visual layer. Use `data-tone="brand|teal|success|warning|danger|info|advanced|neutral"` for semantic identities. Use `statusTone` for stored state labels; negative states must be matched before positive substrings. Use explicit `PageHead` tones for entity names, since a user-supplied name should not determine workflow meaning.

| Purpose | Foreground | Soft surface |
|---|---|---|
| Primary action | #4f46e5 | #eef2ff |
| School / calendar | #0f766e | #effaf7 |
| Valid / published | #166534 | #f0fdf4 |
| Attention / draft | #92400e | #fffbeb |
| Error / destructive | #b42318 | #fff1f2 |
| Information | #0369a1 | #f0f9ff |
| Advanced configuration | #6d28d9 | #f5f3ff |
| Neutral / inactive | #475569 | #f1f5f9 |

Text #172b45; secondary text #5b6b80; page #f7f8fb; surface #ffffff; border #e2e7ef. Spacing uses 4/8/12/16/20/24/32/40px; controls start at 38px (42px mobile); radii 6/9/12px. Inter falls back to system UI fonts. No remote font request was added.

Use the shared Button, Badge, Form, PageHead, DetailGrid, DataTable and WorkspaceTabs before introducing local variants. Preserve handlers and accessible names. Substantial editors use WorkflowPage; confirmations use the existing focus-managed Radix dialog. Optional field markers are visual guidance; required and error state remain programmatically exposed.

## Scroll and responsive contract

Document scrolling owns normal pages. WorkflowPage owns long editor scrolling; it does not nest another vertically scrolling form or table. Wide tables retain a focusable horizontal region and pagination. At phone widths, action groups wrap, forms become one column and structure steps become a two-column grid. Preserve visible focus and reduced-motion preferences.

## Source references and verification

Public interaction references: https://21st.dev/@originui/components/button , https://21st.dev/@originui/components/dialog , https://21st.dev/@shadcn/components/sidebar , https://21st.dev/mcp . Full registry retrieval was authentication-gated; original React adaptations reuse the project's existing Radix/CVA stack.

The complete page inventory, exact files, tests, screenshots and environment limitations are recorded in `PLAN_EDU_SUITE_COMPLETE_PLATFORM_UI_UX_REDESIGN_REPORT.md`. Six UI regression tests validate semantics/rendering and AA token contrast. Manual browser checks cover desktop, tablet and phone, plus form validation, unsaved guards, step keyboard navigation and client-to-structure handoff. Database and HTTP checks pass on disposable schemas. Standalone Playwright Chromium is blocked by macOS launch permissions.
