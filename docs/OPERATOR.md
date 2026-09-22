# Vulcan operator runbook

Day-to-day ship gates for the multi-agent feature harness. Complements `CONTRIBUTING.md` and `CLAUDE.md` (issue #6).

## Layout that matters

- `features/` — specs to ship (use `templates/feature.md`)
- `agents/` / `skills/` — role prompts and reusable skills
- `workspace/` — **ephemeral** runtime state; do not commit session dumps
- `templates/` — scaffolding only

## Before starting a ship session

1. Read `CLAUDE.md` for the orchestration contract.
2. Confirm the feature spec under `features/` has clear acceptance criteria.
3. Clear or ignore stale `workspace/` artifacts from prior runs.
4. No secrets in specs, skills, or workspace notes.

## Ship gates (pass/fail)

| Gate | Pass means |
|---|---|
| Spec | Problem, constraints, and done-when are written |
| Sandbox | Changes stay in allowed paths; no drive-by refactors |
| Review | Diff matches the spec; no unexplained files |
| Docs | User-visible change listed under `CHANGELOG.md` Unreleased |
| Security | No keys, tokens, or customer data in the tree |

## Sandbox rules

- Prefer one agent role or one template change per PR.
- Do not treat `workspace/` as source of truth.
- Do not open public issues for security findings — use `SECURITY.md`.

## When something fails

- Spec incomplete → stop and rewrite the feature doc before re-running agents.
- Agent loops / thrash → capture the last useful state note locally, then reset workspace.
- Suspected secret leak → rotate immediately and follow `SECURITY.md`.
