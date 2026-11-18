# Vulcan

[![validate](https://github.com/Caezarr/Vulcan/actions/workflows/validate-index.yml/badge.svg)](https://github.com/Caezarr/Vulcan/actions/workflows/validate-index.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A feature-shipping orchestrator for Claude Code: spec, then an architect's plan, then parallel domain builders, then a review gate, then a pull request, with every hand-off recorded in an append-only audit trail that a validator can check.

## The problem

When a single coding agent takes a multi-layer feature (schema, API, server logic, UI) from spec to PR, three things go wrong. One context builds every layer in sequence and drifts from the spec as it goes. The agent that wrote the code also decides it is done and commits it, so nothing independent checks the work against the success criteria before it lands. And there is no record: when something breaks, you cannot tell which agent decided what, or why a file changed. Engineering leads who want to let agents ship real features need a plan, a gate and a trail they can audit, not a longer prompt.

## How it solves it

- **Plan first.** An Architect reads the spec and the target project and writes `plan.md` with a concrete task and file hints per domain. Its `FEATURE_PLAN` message decides which experts run.
- **Build in parallel, in narrow lanes.** Backend, frontend, API and DB experts are spawned at once, each confined to its task.
- **Gate before shipping, with no bypass.** One reviewer per expert checks the work against the spec's success criteria, plus an optional security reviewer. Any `blocked` verdict, or a security risk score of 7/10 or more, stops the run and writes `block-report.md` with required fixes. Nothing is committed.
- **Ship only what was reviewed.** The Shipper stages exactly the files the experts reported. No `git add -A`, no workspace files, no force push.
- **Audit trail as a contract.** Every message is appended to `workspace/messages.jsonl`. `scripts/validate-messages.mjs` checks a trail against the protocol parsed from `CLAUDE.md`, so the rules live in one place.

```text
spec -> architect -> [backend | frontend | api | db] -> [reviewer per expert (+ security)] -> gate -> shipper -> PR
                                                                                               \-> blocked: block-report.md
```

Roles, phases, message schemas, gates and failure handling: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Try it

Requires Node.js 20+ for the validators. Nothing to install: the repository is markdown plus dependency-free scripts.

### Offline: inspect and validate a real run (about 1 minute)

[examples/conductor-phase1-run/](examples/conductor-phase1-run/) is a real session: the input spec, the Architect's plan, four domain reviews, the final `state.md` and the 13-message audit trail.

```bash
git clone https://github.com/Caezarr/Vulcan && cd Vulcan
npm run check
```

Expected output (excerpt):

```text
✅ SUCCESS: All skills and agents are indexed in docs/INDEX.md
✓ 8 agents, 1 skill(s), 2 feature spec(s) valid against 5 protocol message types
✓ examples/conductor-phase1-run/messages.jsonl: 13 messages conform to the protocol
# tests 25
# pass 25
# fail 0
```

Then read the run in order: `feature.md` (input), `plan.md`, `review-*.md`, `state.md`. To see the gate's audit invariant fail, append a premature `SHIP_DONE` to a copy of the trail (macOS/Linux):

```bash
T=$(mktemp -d)
head -3 examples/conductor-phase1-run/messages.jsonl > $T/m.jsonl
echo '{"type":"SHIP_DONE","session":"vulcan-20260331-001","feature":"conductor-phase1","branch":"x","commit_sha":"abc","pr_url":null}' >> $T/m.jsonl
node scripts/validate-messages.mjs $T/m.jsonl
```

```text
✗ .../m.jsonl: line 4: SHIP_DONE is missing "pr_number"
✗ .../m.jsonl: line 4: SHIP_DONE is missing "files_shipped"
✗ .../m.jsonl: line 4: SHIP_DONE is missing "summary"
✗ .../m.jsonl: line 4: SHIP_DONE before review of: backend, frontend, api, db
```

The validator exits 1.

### Live run (launches Claude Code agents and uses your Claude plan)

Requires [Claude Code](https://claude.ai/code) with agent teams enabled, `git`, and `gh` if you want the PR opened for you.

```bash
git clone https://github.com/Caezarr/Vulcan ~/vulcan    # elsewhere: export VULCAN_DIR=<path>
cd ~/vulcan
cp skills/vulcan.md ~/.claude/skills/                   # installs /vulcan
cp templates/feature.md features/my-feature.md          # fill in frontmatter + success criteria
```

Then, in Claude Code:

```text
/vulcan features/my-feature.md
/vulcan features/my-feature.md --no-pr
/vulcan features/my-feature.md --skip-security --skip-agents frontend,db
```

Reviewers check success criteria literally, so make them measurable ([templates/README.md](templates/README.md)). Watch `workspace/state.md` during the run, and validate the trail afterwards with `node scripts/validate-messages.mjs workspace/messages.jsonl`. Step-by-step first run: [docs/QUICKSTART.md](docs/QUICKSTART.md). Runbook: [docs/OPERATOR.md](docs/OPERATOR.md).

## How it works

1. `/vulcan <spec>` (`skills/vulcan.md`) parses flags, builds the session config and hands off to the protocol in `CLAUDE.md` (phases 0 to 7).
2. Phase 1: the Architect emits `FEATURE_PLAN` (`agents_needed`, `tasks`, `file_hints`, API contract, data model, risk flags).
3. Phase 2: every needed expert is spawned before any is awaited; each reports `IMPLEMENTATION_DONE` with the files it created or modified and a self-assessment.
4. Phase 4: one reviewer per expert, plus the security reviewer if the spec asks for it, all in parallel. They emit `REVIEW_RESULT` and `SECURITY_RESULT`.
5. Phase 5 gate: any `blocked`, or `risk_score >= 7`, ends the run with `block-report.md`. Minor issues give `approved_with_notes`, which ships.
6. Phase 6: the Shipper creates the branch, commits only the reported files, pushes and opens the PR, then emits `SHIP_DONE`.

The orchestrator never edits the target project; it writes only `state.md`, `messages.jsonl` and `block-report.md`. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Proof

| Check | What it proves |
|---|---|
| `npm run validate:index` | every agent and skill file is listed by path in [docs/INDEX.md](docs/INDEX.md) |
| `npm run validate:definitions` | agent, skill and feature-spec frontmatter is consistent with the 5 message types parsed from `CLAUDE.md`; every type has an emitter and appears in that agent's output contract |
| `npm run validate:messages` | the sample trail follows the protocol: schema per type, one session, `FEATURE_PLAN` first, only assigned agents report or are reviewed, every expert reports before review, `SHIP_DONE` only after a passed gate |
| `npm test` | 25 `node:test` cases for the parser, lint rules, gate decision and audit-trail invariants |
| [CI](.github/workflows/validate-index.yml) | runs all of the above on every pull request |

## Limits and status

- There is no application code to unit-test: the system is the protocol, the role prompts and the validators. Whether an expert writes correct code or a reviewer catches a real issue depends on the model and the spec, constrained by the gate, not proven by the tests.
- The sample run was captured before `SHIP_DONE` (status `SHIP_READY`, shipper still running), had no security review, and contains repeated `IMPLEMENTATION_DONE` messages from three experts and two `REVIEW_RESULT`s for backend. All reviewers approved, with minor notes.
- Depends on Claude Code agent teams, which can change between Claude Code releases.
- The audit validator checks structure and ordering, not whether the content of a message is true.
- A blocked run is resumed manually: fix what `block-report.md` lists, then re-run with `--skip-agents` for experts that already passed.

## Development

```bash
npm run validate:index
npm run validate:definitions
npm run validate:messages
npm test
npm run check        # all of the above, what CI runs
```

Layout: `CLAUDE.md` (protocol), `agents/` (one role prompt each), `skills/` (`/vulcan`), `templates/` (spec template), `features/` (your specs), `examples/` (a real run), `scripts/` (validators), `tests/`, `docs/`, `workspace/` (runtime, git-ignored).

See [CONTRIBUTING.md](CONTRIBUTING.md), [SUPPORT.md](SUPPORT.md), [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
