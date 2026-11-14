---
name: github-issue-triage
description: Create, classify, and organize GitHub Issues for this repository. Use whenever creating a task/issue, splitting work into issues, or auditing/backfilling issue metadata. Every issue must receive native Size and Area issue fields and an Iteration in a linked GitHub Project when available.
---

# GitHub issue triage

Use for **every issue** created or triaged in this repository. The issue is not fully triaged until the actual GitHub metadata has been set and read back. Text in an issue body, labels, or a checklist **does not** replace field values.

## Workflow

1. Identify the correct repository and check for duplicate/overlapping issues before creating a new one.
2. Write a small, actionable issue: objective; context; testable acceptance criteria; verification plan; dependencies if any. Avoid unnecessary scope expansion.
3. Classify **Size** and **Area** using the *existing* options (see below); do not create new options or invent field IDs.
4. Create the issue, then set its **native issue fields** `Size` (single select) and `Area` (multi select) using the GitHub REST API. Preserve other existing field values.
5. Identify its linked GitHub Project, add the issue if needed, and set the project's **Iteration** field to a real existing iteration (see below). Do not confuse GitHub Projects fields with issue fields.
6. Read back both issue fields and project-item fields. Report the URL, actual Size, Area, and Iteration. If any cannot be populated, state precisely which one and why; never claim that all fields were set.

## Size

Estimate *implementation effort*, not perceived importance. Prefer the repository's established option names. Existing ABCalculator issues use `S`, `M`, and `L`.

- `S`: localized change, roughly up to one focused working day; minimal dependencies.
- `M`: a few related changes or moderate investigation/testing, roughly 1–3 focused days.
- `L`: broader work or significant integration/testing, roughly 4–7 focused days.
- If larger than `L`, split into independently verifiable issues instead of understating size.
- Always inspect real option names before setting one; do not assume a particular option exists in every repository.

## Area

Use the *native* `Area` multi-select field (not a label). Multiple areas are appropriate when the implementation really crosses boundaries.

Known options observed in ABCalculator: `Web`, `CI/CD`, `Documentation`. Discover the full set from GitHub at execution time. Examples:
- `Web`: Flask UI and application behavior, frontend, browser functionality.
- `CI/CD`: tests and automation, deployment, release infrastructure, logs/operational checks.
- `Documentation`: README, setup/usage guides, policy text, portfolio documentation.

Choose from existing options only. If the available options don't fit, flag the ambiguity rather than silently inventing a new one.

## Native issue fields (GitHub REST)

**Discover** the owner's fields using `gh api -H 'X-GitHub-Api-Version: 2026-03-10' user/issue-fields` for a personal repository (or `orgs/OWNER/issue-fields` for an organization). Use the returned `id`, `data_type`, and option names. ABCalculator's observed IDs on 2026-11-14: `Size=49852825` and `Area=49852878`; they are examples, not universal constants.

After issue creation, prefer the **additive POST** endpoint so unrelated fields such as Priority are preserved:

```sh
gh api -X POST \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  "repos/OWNER/REPO/issues/NUMBER/issue-field-values" \
  --input - <<'JSON'
{"issue_field_values":[{"field_id":49852825,"value":"M"},{"field_id":49852878,"value":["Web","CI/CD"]}]}
JSON

gh api -H 'X-GitHub-Api-Version: 2026-03-10' \
  "repos/OWNER/REPO/issues/NUMBER/issue-field-values"
```

Replace the example IDs and values with discovered real ones. `POST` adds/updates specified fields; **do not** use `PUT` unless intentionally replacing every issue field. Where available, the native issue creation API can set `issue_field_values` in the initial create request; still read back afterward.

If the connected GitHub tool cannot write native issue fields, use an authenticated environment with `gh api`, or explicitly report the limitation. Never replace fields with free-text tags and declare success.

## Iteration (GitHub Projects)

Iteration belongs to a **project item**, not the repository issue's native fields. Use the actual project connected to the repository; if several projects qualify, prefer the one explicitly indicated by the user or uniquely linked to the repository, otherwise ask before setting a possibly wrong iteration.

```sh
gh project list --owner OWNER --format json
gh project field-list PROJECT_NUMBER --owner OWNER --format json
gh project item-add PROJECT_NUMBER --owner OWNER --url ISSUE_URL
```

Find the `Iteration` field and its configured iteration IDs (through `field-list` or the GitHub GraphQL `ProjectV2IterationField.configuration`). Choose an iteration that **actually exists**:
- honor a user-specified sprint/iteration;
- otherwise assign the current active iteration covering today's date;
- if the issue is explicitly planned for later, use the matching future iteration;
- if no currently active iteration exists, select the next upcoming one;
- if there is no iteration field or no valid iteration, report this as unconfigured—**do not invent a sprint**.

Example after resolving actual project/item/field/iteration IDs:

```sh
gh project item-edit \
  --project-id PROJECT_NODE_ID \
  --id ITEM_NODE_ID \
  --field-id ITERATION_FIELD_NODE_ID \
  --iteration-id EXISTING_ITERATION_ID
```

Read back with `gh project item-list PROJECT_NUMBER --owner OWNER --format json` (or GraphQL if the CLI output omits iteration). Do not confuse project Number with its GraphQL node ID. `gh project` may require additional `project` authorization scopes; do not claim success if the API fails.

## Backfill and reporting

When asked to tidy **all issues**, enumerate open and closed issues in scope and read their existing Size, Area, and project Iteration. Fill missing fields only; avoid overwriting user-specified values, especially historical issues. Explain any changes to existing classifications. Report a compact summary: processed, populated, skipped, blocked with reasons.

For every newly created issue, final output should show a brief verification line:

`#NUMBER — Size: M · Area: Web, CI/CD · Iteration: <real iteration label> · <issue URL>`

Never call a task fully classified if Iteration was not actually set.
