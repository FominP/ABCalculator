# Contributing to ABCalculator

1. **Start with an issue.** Use the [new issue forms](https://github.com/FominP/ABCalculator/issues/new/choose): choose **Feature / task** for planned work or **Bug report** for defects. State acceptance criteria and how the change will be verified; keep unrelated work out of scope.
2. **One issue → one branch → one pull request.** Branch from `main` using a clear name such as `feat/issue-123-short-name`, `fix/issue-123-short-name`, or `docs/issue-123-short-name`.
3. **Make a focused change.** Follow [AGENTS.md](AGENTS.md) for application invariants, server-side calculation rules, and checks. See [README.md](README.md) for installation, local run, and Render deployment details.
4. **Verify and show evidence.** Run checks relevant to the change. Use the fast Flask smoke suite for routes and calculation examples, and add focused coverage for changed behavior. Record manual checks without implying an unrun suite passed. Include screenshots for visible UI changes.
5. **Open a PR against `main`.** Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md), use `Closes #123` to link the issue, and describe risk, deployment impact, and rollback. A draft is fine until it is ready for review.
6. **Review before merging.** Address feedback and confirm acceptance criteria. Merging into the Render deployment branch can trigger a production deployment; do not merge unreviewed work or change Render configuration without an explicit issue.

If a task reveals new work, open a separate issue rather than expanding its PR.
