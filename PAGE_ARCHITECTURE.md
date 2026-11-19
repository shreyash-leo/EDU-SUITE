# Page architecture

The Next.js app exposes `/` and uses role-aware workspace state and deep-link context rather than a separate file route per page. Existing navigation and guarded transitions remain intact. This is a source-based inventory; it is not a full page-by-page usability validation.

| Role | Workspace / views | User goal and layout decision |
| --- | --- | --- |
| Both | Sign in, account and password | Focused authentication and account forms; short account actions use dialogs. |
| Super Admin | Dashboard | Review real organization counts and onboarding queue, then open a management area. |
| Super Admin | Organizations and details | Search/filter records and inspect related school and onboarding information; creation/editing uses a substantial workflow. |
| Super Admin | Schools and details | Manage registered institutions, board affiliations and contacts; structured directory plus detailed workflow. |
| Super Admin | Onboarding | Complete dependent organization, school, subscription, commercial, administrator and activation steps; retain the wizard because steps depend on earlier information. |
| Super Admin | Subscriptions | Review and manage commercial records and organization-wide allowances. |
| Super Admin | Requests & Settings | Review requests and configure platform settings, affiliations and academic presets. |
| Organization admin | Overview | Understand institutional status and next setup actions. |
| Organization admin | Schools and school details | Search directory and inspect identity, academic structure, calendar and history in contextual views. |
| Organization admin | Structure Management | Select school, year and board; configure grades, sections, classrooms, bell time and calendar, then review and publish. Related configuration steps remain together to preserve context. |
| Organization admin | Review & History | Inspect draft changes and published versions. |
| Organization admin | Account & Subscription | Inspect organization details and shared allowance. |

Desktop now uses global horizontal navigation and a contextual breadcrumb. Existing contextual tabs, dedicated complex workflows and focused dialogs remain; no URLs or business contracts were changed. Subjects, workload and timetable generation are not present in V1. Further page architecture decisions require review of actual populated and error states.
