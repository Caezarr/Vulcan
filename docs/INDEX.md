# Vulcan Skills & Agents Reference

This index provides a complete reference of all Vulcan skills and agent roles.

**New to Vulcan?** Start with [QUICKSTART.md](QUICKSTART.md) for a practical five-step guide.

For overviews, see [skills/README.md](../skills/README.md) and [agents/README.md](../agents/README.md).

## Skills

Skills are reusable capabilities that can be invoked directly by users or agents.

| Name | Purpose | Path | How to Invoke |
|------|---------|------|---------------|
| **vulcan** | Multi-agent feature forge orchestrator that ships features from spec to PR | [skills/vulcan.md](../skills/vulcan.md) | Read the skill file and follow its protocol; typically invoked via `/vulcan <feature-spec.md>` |

## Agents

Agents are specialized roles in the Vulcan pipeline. They are spawned automatically by the orchestrator based on the feature spec and are not invoked directly by users.

| Name | Purpose | Path | Invoked By |
|------|---------|------|------------|
| **architect** | Reads spec, explores project, writes implementation plan | [agents/architect.md](../agents/architect.md) | Orchestrator (Phase 1) |
| **api** | Implements HTTP/GraphQL endpoints and integration layer | [agents/api.md](../agents/api.md) | Orchestrator (Phase 2, parallel) |
| **backend** | Implements server logic, services, and business rules | [agents/backend.md](../agents/backend.md) | Orchestrator (Phase 2, parallel) |
| **db** | Writes schema migrations and query layer updates | [agents/db.md](../agents/db.md) | Orchestrator (Phase 2, parallel) |
| **frontend** | Implements UI components, pages, and client-side interactions | [agents/frontend.md](../agents/frontend.md) | Orchestrator (Phase 2, parallel) |
| **reviewer** | Reviews expert work against spec success criteria | [agents/reviewer.md](../agents/reviewer.md) | Orchestrator (Phase 4, parallel) |
| **security** | Scans changed files for security vulnerabilities | [agents/security.md](../agents/security.md) | Orchestrator (Phase 4, parallel, optional) |
| **shipper** | Creates branch, commits, pushes, opens PR | [agents/shipper.md](../agents/shipper.md) | Orchestrator (Phase 6) |

---

**Note:** This index is kept in sync with the actual files in `skills/` and `agents/` directories. A validation script ensures completeness.
