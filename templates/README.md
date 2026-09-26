# Templates

This directory contains templates for writing structured documents that Vulcan uses to drive feature development.

## Available Templates

### `feature.md`

A structured markdown template for defining feature specifications that Vulcan can execute.

**When to use it:**

- You want to ship a new feature or enhancement using the Vulcan pipeline
- You need a clear, auditable specification before implementation begins
- You're defining work that spans multiple domains (backend, frontend, API, database)
- You want automated review and quality gates before shipping

**What it captures:**

- Problem statement and success criteria
- Technical scope (what's in, what's out)
- Stack requirements (backend/frontend/api/db)
- API contracts and data model changes
- Acceptance test sketches

**Structure:**

The template uses YAML frontmatter for configuration:
- `feature`: slug-case identifier
- `title`: human-readable name
- `target_dir`: absolute path to the project to modify
- `stack`: which domains are involved (backend, frontend, api, db)
- `skip_agents`: domains to exclude from execution
- `requires_security_review`: whether security gate is required

## Handoff to Agents

Once your feature spec is complete:

1. **Place it** in the `features/` directory (sibling to this `templates/` folder)
2. **Trigger Vulcan** with the path to your feature file
3. **Agents take over**:
   - `architect` reads the spec and produces a detailed implementation plan
   - Domain experts (`backend`, `frontend`, `api`, `db`) implement in parallel
   - Reviewers (`reviewer-*`) verify each domain's work against your success criteria
   - `security` scans changed files for vulnerabilities
   - `shipper` commits, pushes, and optionally opens a PR

The agents are defined in the [`agents/`](../agents/) directory. Each agent has a specific role and follows the protocol defined in `CLAUDE.md`.

For the full pipeline and orchestration details, see the [root README](../README.md) and [`CLAUDE.md`](../CLAUDE.md).
