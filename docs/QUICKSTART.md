# Vulcan Quickstart

Get a feature shipped in five steps.

## 1. Clone and understand the layout

```bash
git clone <your-vulcan-fork>
cd vulcan
```

Key directories:
- `features/` — your feature specs (create one per feature)
- `templates/feature.md` — starter template for specs
- `agents/` — role prompts (architect, backend, frontend, api, db, reviewer, security, shipper)
- `workspace/` — ephemeral runtime state (never commit this)

## 2. Write a feature spec

Copy the template and fill in your feature:

```bash
cp templates/feature.md features/my-feature.md
```

Essential frontmatter:
- `feature: my-feature` — slug for branch names and tracking
- `title: "My Feature Name"` — human-readable title
- `target_dir: /absolute/path/to/your/project` — the codebase to modify
- `stack: { backend, frontend, api, db }` — which domains are involved (use `none` to skip)
- `skip_agents: []` — skip agents not needed for this feature

Essential sections:
- **Problem** — what user pain or business need does this solve?
- **Success Criteria** — measurable outcomes (reviewers check these)
- **Scope** — what's in, what's out (prevents scope creep)
- **Technical Context** — existing code paths, APIs, or constraints agents must respect

See [templates/README.md](../templates/README.md) for more guidance.

## 3. Pick your agents

Vulcan uses specialized domain experts:

| Agent | Use when your feature touches... |
|-------|----------------------------------|
| **backend** | Server logic, services, business rules |
| **frontend** | UI components, pages, client interactions |
| **api** | HTTP/GraphQL endpoints, integration layer |
| **db** | Schema migrations, query layer changes |

The **architect** always runs first (reads spec, explores project, writes plan). Reviewers run after implementation. Set `skip_agents: ["db"]` in frontmatter if you don't need schema changes, for example.

## 4. Run Vulcan

Invoke the orchestrator with your feature spec:

```bash
/vulcan features/my-feature.md
```

The orchestrator follows a strict pipeline:
1. **Initialize** — loads config and creates `workspace/state.md`
2. **Architect** — produces `workspace/plan.md` with agent assignments
3. **Implement** — experts run in parallel, write code, report done
4. **Review** — reviewers run in parallel, verify success criteria
5. **Gate** — blocks on critical issues or ships if all gates pass
6. **Ship** — commits, pushes branch, optionally opens PR
7. **Summary** — prints recap with PR link and file counts

## 5. Monitor workspace state

While Vulcan runs, check `workspace/state.md` for live agent status:

```markdown
| Agent | Status | Files Changed | Verdict | Notes |
|-------|--------|---------------|---------|-------|
| architect | DONE | - | - | - |
| backend | RUNNING | - | - | - |
| frontend | PENDING | - | - | - |
```

All messages are logged to `workspace/messages.jsonl` (append-only audit trail).

If blocked, see `workspace/block-report.md` for required fixes. Re-run with `--skip-agents` to bypass agents that already passed.

## What's next

- **[OPERATOR.md](OPERATOR.md)** — day-to-day runbook, ship gates, sandbox rules
- **[INDEX.md](INDEX.md)** — full reference of all agents and skills
- **[CLAUDE.md](../CLAUDE.md)** — complete orchestrator contract (phases, message protocol, rules)
- **[templates/README.md](../templates/README.md)** — template details and best practices
