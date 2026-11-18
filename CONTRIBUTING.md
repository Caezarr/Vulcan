# Contributing to Vulcan

## Setup

1. Clone the repo and read `CLAUDE.md` (orchestration contract).
2. Put feature specs under `features/` using `templates/feature.md`.
3. Runtime state lives in `workspace/` — treat it as ephemeral/local.

## Pull requests

- Keep changes focused (one agent role, one template, or one docs fix).
- Prefer clear conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Do not commit secrets, API keys, or real workspace session dumps.
- Update `CHANGELOG.md` under `## Unreleased` for user-visible changes.
- Run `npm run check` before pushing (Node 20+, no install needed). It is exactly what CI runs.
- New agent or skill: add frontmatter (copy an existing file), list it in `docs/INDEX.md`, and make its output contract show every message type it `emits`.
- Changing a message in `CLAUDE.md`: the validators read the protocol from there, so update agents and `examples/` in the same PR.

## Security

Follow `SECURITY.md` for vulnerability reports — no public issues for security findings.
