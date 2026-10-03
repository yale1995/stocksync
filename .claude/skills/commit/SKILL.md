---
name: commit
description: Create reviewable Conventional Commits. Use when the user asks to commit changes.
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

# Create commits

## Context

- Staged changes: !`git diff --cached --stat`
- Unstaged changes: !`git diff --stat`
- Recent commits for style reference: !`git log --oneline -5 2>/dev/null || echo "(no commits yet)"`

Create reviewable commits without mixing independent changes or including files outside the approved scope.

## Boundaries

- Work only in the current repository.
- Honor `--no-verify` only when the user explicitly provides it. Never bypass hooks on your own initiative.
- Before running `git add`, changing the index, or creating a commit, present the complete plan and wait for explicit approval.
- Do not change file contents, amend, rebase, push, or discard changes unless the user explicitly requests it.
- Preserve pre-existing and unrelated changes. Never add an AI signature, authorship, or co-authorship.
- Do not stage files that appear to contain secrets, credentials, or sensitive data; stop and warn the user.

## Inspect the changes

1. Confirm that the current directory belongs to a Git repository.
2. Inspect at least:
   - `git status --short`
   - `git diff --cached --stat` and `git diff --stat`
   - the complete staged and unstaged diffs
   - the relevant contents of untracked files
   - `git log --oneline -5` to match the recent style
3. If there are no changes, report that and stop without modifying the repository.
4. Clearly distinguish what is already staged from what is not.

## Plan the commits

Group changes using these criteria, in order:

1. Changes from different contexts, modules, or purposes belong in separate commits.
2. Code and the tests or documentation required for it to work and be reverted safely belong in the same commit.
3. A commit may depend on earlier commits, never later ones; order dependencies first.

Use `docs` or `test` only for exclusively documentation or test changes. Tests for a new feature belong in its `feat` commit; regression tests belong in the corresponding `fix` commit.

Format each message as:

```text
<type>[(<scope>)]: <description>
```

Common types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, and `revert`. Use `ci` for pipelines and `chore` for dependencies, configuration, and local tooling.

Prefer an imperative subject, lowercase after the colon, without a trailing period, and under 72 characters. Use backticks for code identifiers when they improve readability.

Present a plan that includes, for every commit:

- the proposed message;
- the exact file list;
- the reason for the grouping;
- ordering dependencies, when applicable;
- any required adjustment to the existing index.

Ask the user to approve, edit, merge, or cancel the plan.

## Execute the approved plan

1. Read `git status --short` again. If the material changes differ from the approved plan, stop, update the plan, and request approval again.
2. For each commit, leave only that group's files staged. If previously staged files require adjustment, make only the index change described in the approved plan and do not alter the working tree.
3. Review `git diff --cached --check`, `git diff --cached --stat`, and the complete staged diff before committing. Confirm that it matches the approved group exactly.
4. Run `git commit` with the approved message. Add `--no-verify` only when explicitly requested.
5. Verify the created commit and the remaining status before continuing.
6. If a hook or commit fails, stop and report the error. Do not bypass the failure automatically, and clearly state whether earlier commits from the plan were already created.

At the end, report the hashes and messages created and list any changes that remain uncommitted.