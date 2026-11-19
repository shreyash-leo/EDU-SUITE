# Design system

The current semantic tokens live in `apps/web/app/design-tokens.css`. Existing brand indigo was shifted to a restrained blue (`#345478`; hover `#263f5c`) with neutral white and gray surfaces. Semantic success, warning, error and information colors remain for states. Shared spacing uses a 4px base, controls use the existing 38px baseline, and ordinary containers use restrained borders and radii.

Shared styles live in `apps/web/app/platform.css`; existing React primitives, tables, tabs and Radix dialogs remain in `apps/web/components`. The desktop shell places global navigation above the workspace, while the mobile menu retains labeled destinations. Focus outlines, reduced motion and form error patterns must remain visible and keyboard-operable. The shared table, label and button text was increased for legibility; individual module overrides still need review. Validate contrast and all states before claiming accessibility compliance.
