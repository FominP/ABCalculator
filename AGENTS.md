# Repository agent instructions

Whenever you create, split, or triage a GitHub Issue/task in this repository, follow [the GitHub issue triage skill](.agents/skills/github-issue-triage/SKILL.md).

**Every newly created issue must have actual GitHub metadata for all three fields:**
- **Size** — native issue single-select field.
- **Area** — native issue multi-select field.
- **Iteration** — GitHub Projects iteration for the linked project item.

Never substitute labels, body text, or checkboxes for actual field values. Read metadata back after writing it. If a project, iteration, field option, or write capability is unavailable, describe the issue as **not fully triaged**, leave the missing field visible in the report, and provide the precise blocker. Do not overwrite existing fields during an audit without a reason.

For bulk cleanup/backfill, apply the same rules to every issue in the requested scope.
