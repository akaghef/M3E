# Implementation Plan

## Task Format Template

Use whichever pattern fits the work breakdown.

### Major task only

- [ ] {{NUMBER}}. {{TASK_DESCRIPTION}}{{PARALLEL_MARK}}
  - {{OBSERVABLE_COMPLETION_ITEM}}
  - _Requirements: {{REQUIREMENT_IDS}}_
  - _Allowed write scope: {{FILES_OR_DIRECTORIES_THIS_TASK_MAY_TOUCH}}_
  - _Verification: {{NARROW_CHECKS_OR_COMMANDS_REQUIRED}}_

### Major + Sub-task structure

- [ ] {{MAJOR_NUMBER}}. {{MAJOR_TASK_SUMMARY}}
- [ ] {{MAJOR_NUMBER}}.{{SUB_NUMBER}} {{SUB_TASK_DESCRIPTION}}{{SUB_PARALLEL_MARK}}
  - {{DETAIL_ITEM_1}}
  - {{DETAIL_ITEM_2}}
  - {{OBSERVABLE_COMPLETION_ITEM}}
  - _Requirements: {{REQUIREMENT_IDS}}_
  - _Boundary: {{COMPONENT_NAMES}}_
  - _Depends: {{TASK_IDS}}_
  - _Allowed write scope: {{FILES_OR_DIRECTORIES_THIS_TASK_MAY_TOUCH}}_
  - _Verification: {{NARROW_CHECKS_OR_COMMANDS_REQUIRED}}_
  - _Browser verification: {{REQUIRED_IF_VIEWER_VISIBLE_OR_NA}}_
  - _Data safety note: {{REQUIRED_FOR_PERSISTENCE_SYNC_OR_NA}}_

> **Parallel marker**: Append ` (P)` only to tasks that can execute independently.
>
> **Optional test coverage**: When a sub-task is deferrable test work tied to already-covered acceptance criteria, mark the checkbox as `- [ ]*`.
>
> **M3E rule**: every executable task needs bounded write scope and a concrete verification method. Viewer-visible behavior requires browser-visible verification. Persistence/sync behavior requires data-safety verification.
