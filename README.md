# Vulcan: feature-shipping orchestrator for Claude Code

[![validate](https://github.com/Caezarr/Vulcan/actions/workflows/validate-index.yml/badge.svg)](https://github.com/Caezarr/Vulcan/actions/workflows/validate-index.yml)

Vulcan turns a feature spec into a reviewed pull request with a strict, auditable multi-agent pipeline.

## The problem

Letting one coding agent take a multi-layer feature from spec to PR goes wrong in familiar ways:

- **One context does everything.** Schema, API, server logic and UI are built serially by the same context, which loses track of the spec as it goes.
- **Nobody checks the work before it lands.** The agent that wrote the code also decides it is done, then commits it.
- **There is no record.** When something breaks you cannot tell who decided what, or why a file changed.

## What Vulcan does

- **Plans first.** An Architect reads the spec and the target project, then writes `plan.md` with a concrete task and file hints for each domain.
- **Builds in parallel.** Backend, frontend, API and DB experts run at the same time, each confined to its task.
- **Gates before shipping.** One reviewer per expert checks the work against the spec's success criteria, plus an optional security review of the changed files. A single `blocked` verdict, or a security risk score of 7/10 or more, halts the ship and writes `block-report.md` with the required fixes.
- **Ships only what was reviewed.** The Shipper stages exactly the files the experts reported, commits, pushes and opens a PR. No `git add -A`, no force push.
- **Keeps an audit trail.** Every agent message is appended to `workspace/messages.jsonl`, and a validator checks that trail against the protocol.

```
spec → architect → [backend | frontend | api | db] → [reviewers + security] → gate → shipper → PR
```

The full design (roles, phases, messages, gates, failure handling, diagram) is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Run it

Requirements: [Claude Code](https://claude.ai/code) with agent teams enabled, `git`, and `gh` if you want the PR opened for you.

```bash
git clone https://github.com/Caezarr/Vulcan ~/vulcan   # or anywhere, then export VULCAN_DIR=<path>
cd ~/vulcan
cp skills/vulcan.md ~/.claude/skills/          # installs the /vulcan skill
cp templates/feature.md features/my-feature.md # then fill it in
```

Write the spec: `feature`, `title`, `target_dir`, `stack`, `skip_agents`, `requires_security_review` in the frontmatter, then Problem, Success Criteria, Scope and Technical Context. Reviewers check the success criteria literally, so make them measurable. See [templates/README.md](templates/README.md).

Then, from Claude Code:

```
/vulcan features/my-feature.md
/vulcan features/my-feature.md --no-pr
/vulcan features/my-feature.md --skip-agents db
/vulcan features/my-feature.md --skip-security --skip-agents frontend,db
```

Watch `workspace/state.md` while it runs. If the gate blocks, fix what `workspace/block-report.md` lists and re-run with `--skip-agents` for the experts that already passed.

[docs/QUICKSTART.md](docs/QUICKSTART.md) walks through a first run step by step; [docs/OPERATOR.md](docs/OPERATOR.md) is the day-to-day runbook.

## How to verify

The repository is markdown plus small validators, no dependencies. Everything CI runs is one command:

```bash
npm run check
```

| Check | What it proves |
|---|---|
| `npm run validate:index` | every agent and skill file is listed, by path, in [docs/INDEX.md](docs/INDEX.md) |
| `npm run validate:definitions` | agent/skill frontmatter (`name`, `kind`, `description`, `phase`, `emits`) and every feature spec are consistent with the message protocol parsed from `CLAUDE.md` |
| `npm run validate:messages` | the sample run's `messages.jsonl` follows the protocol: schemas, one session, plan first, every expert reports before review, `SHIP_DONE` only after a passed gate |
| `npm test` | 25 `node:test` cases for the parser, the lint rules, the gate decision and the audit-trail invariants |

The same audit-trail check works on your own runs:

```bash
node scripts/validate-messages.mjs workspace/messages.jsonl
```

[examples/conductor-phase1-run/](examples/conductor-phase1-run/) is a real session (spec, plan, four domain reviews, final state and audit trail) if you want to see what a run leaves behind before starting one.

## Repository layout

```text
vulcan/
├── CLAUDE.md        orchestration protocol: phases, gate, message protocol, rules
├── agents/          one role prompt per agent (frontmatter: phase, emitted messages)
├── skills/          /vulcan entry point
├── templates/       feature spec template
├── features/        your feature specs
├── examples/        a real run, input and output
├── scripts/         validators (index, definitions, audit trail)
├── tests/           node:test suite for the validators
├── docs/            ARCHITECTURE, QUICKSTART, OPERATOR, INDEX
└── workspace/       runtime state, git-ignored
```

## Design principles

- **Gate first.** Phase 5 must complete before Phase 6. There is no bypass.
- **Parallel by default.** Experts, then reviewers, are all spawned at once.
- **Append-only audit trail.** `messages.jsonl` is never rewritten.
- **Workspace isolation.** The orchestrator never writes to the target project; only experts and the Shipper do, within their mandate.

## Contributing, support, security

- [CONTRIBUTING.md](CONTRIBUTING.md): PR guidelines; run `npm run check` before pushing
- [SUPPORT.md](SUPPORT.md): questions and bug reports
- [SECURITY.md](SECURITY.md): report vulnerabilities privately
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
