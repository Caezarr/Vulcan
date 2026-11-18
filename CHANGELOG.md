# Changelog

All notable changes to Vulcan are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `docs/ARCHITECTURE.md`: roles, phases, messages, gates, failure handling, diagram.
- Frontmatter on every agent and skill; `scripts/validate-definitions.mjs` checks it and feature specs against the protocol in `CLAUDE.md`.
- `scripts/validate-messages.mjs`: checks a `messages.jsonl` audit trail (schemas, sequencing, gate respected).
- `node:test` suite and `npm run check`; CI runs the new validators and tests.

### Changed
- README rewritten in English, problem-first, with run and verify sections.
- `validate-index.sh` matches entries by file path instead of bare name.
- Sample spec moved to `examples/conductor-phase1-run/feature.md`, next to the run it produced.

### Removed
- Duplicate root `CODEOWNERS` and `.github/SUPPORT.md` (merged into root `SUPPORT.md`).

### Added (earlier)
- `SECURITY.md`, `CONTRIBUTING.md`, `.editorconfig`, and `.gitignore` for repo hygiene.
- Quickstart section in README pointing to `CLAUDE.md` and `templates/` for faster onboarding.
