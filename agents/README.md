# Agents

This directory contains the agent role prompt files for the Vulcan forge pipeline. Each agent has a specific responsibility in the feature shipping process.

## Agent Roles

- **[architect.md](architect.md)** — Reads spec, explores project, writes implementation plan
- **[api.md](api.md)** — Implements HTTP/GraphQL endpoints and integration layer
- **[backend.md](backend.md)** — Implements server logic, services, and business rules
- **[db.md](db.md)** — Writes schema migrations and query layer updates
- **[frontend.md](frontend.md)** — Implements UI components, pages, and client-side interactions
- **[reviewer.md](reviewer.md)** — Reviews expert work against spec success criteria
- **[security.md](security.md)** — Scans changed files for security vulnerabilities
- **[shipper.md](shipper.md)** — Creates branch, commits, pushes, opens PR

## Pipeline Flow

1. **Architect** analyzes the spec and creates the plan
2. **Expert agents** (api, backend, db, frontend) implement in parallel
3. **Reviewers** check each expert's work against success criteria
4. **Security** scans for vulnerabilities
5. **Shipper** commits and pushes the approved changes
