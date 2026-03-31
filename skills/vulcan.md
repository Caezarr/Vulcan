# Vulcan — Feature Shipping Skill

Trigger this skill when the user wants to ship a feature, implement a spec, or run the Vulcan forge pipeline.

Use when asked to: "ship this feature", "implement the spec", "run vulcan", "/vulcan", "multi-agent ship", "implement from spec", "forge this feature".

---

## What this skill does

**Vulcan** is a multi-agent feature forge: a crew of specialized agents takes a feature spec (`.md` file) from description to shipped PR.

**The crew:**
- **Architect** — reads the spec, explores the project, divides work, writes `plan.md`
- **Expert agents** — backend, frontend, api, db — implement their domain in parallel
- **Reviewer agents** — one per expert, check work against the spec's success criteria
- **Security reviewer** — OWASP scan of the changed files only
- **Shipper** — creates branch, commits, pushes, opens PR

**The gate:** all reviewers must approve before anything ships. One `blocked` verdict halts the ship and produces a `block-report.md` with exact fixes needed.

---

## How to invoke

The vulcanDir is `/Users/gabriel/Desktop/vulcan`.

### Step 1 — Get inputs

Ask the user for (if not already provided):
1. **Feature spec path** (required) — absolute path to a `.md` spec file, or relative to `vulcanDir/features/`
2. **Target project path** (required if not in spec frontmatter's `target_dir`)
3. **Create PR?** (default: yes)

If the user has no spec yet, offer to create one:
> "No spec file? I can create one from the template at `vulcan/templates/feature.md`. What's the feature?"

### Step 2 — Parse flags

- `--no-pr` → set `createPR: false`
- `--skip-security` → set `requireSecurityReview: false`
- `--skip-agents <list>` → e.g. `--skip-agents db,frontend` → set `skipAgents: ["db","frontend"]`

### Step 3 — Build config

```json
{
  "sessionId": "vulcan-{YYYYMMDD}-{NNN}",
  "vulcanDir": "/Users/gabriel/Desktop/vulcan",
  "workspaceDir": "/Users/gabriel/Desktop/vulcan/workspace",
  "featureFile": "<absolute path to the .md spec file>",
  "targetDir": "<from spec frontmatter target_dir, or user input>",
  "gitBranch": "feat/<feature-slug-from-spec>",
  "createPR": true,
  "skipAgents": [],
  "requireSecurityReview": true
}
```

Generate `sessionId` as `vulcan-YYYYMMDD-001` (increment NNN if a session for today already exists in workspace/).

### Step 4 — Run the protocol

Read `/Users/gabriel/Desktop/vulcan/CLAUDE.md` and follow the Vulcan orchestration protocol exactly, using the config you built.

---

## Examples

```
/vulcan features/user-auth.md
/vulcan /Users/me/project/specs/dark-mode.md --no-pr
/vulcan features/payments.md --skip-agents db
/vulcan features/api-refactor.md --skip-security --skip-agents frontend,db
```

---

## Output

All artifacts go to `vulcan/workspace/`:
- `plan.md` — architect's implementation plan
- `review-{agent}.md` — per-expert review findings
- `review-security.md` — security findings
- `block-report.md` — blocking issues (if ship was halted)
- `api-contract.md` — final implemented API contract (if api agent ran)
- `schema-diff.md` — schema changes summary (if db agent ran)
- `messages.jsonl` — full agent message log
- `state.md` — live session status

---

## Re-running after a block

Fix the issues in `block-report.md`, then re-run with `--skip-agents` to bypass experts that already passed:

```
/vulcan features/my-feature.md --skip-agents frontend,api
```
