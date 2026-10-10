# Vulcan - Feature Shipping Orchestrator

Vulcan transforme une spec feature en code shippe, avec un pipeline multi-agents strict, auditable, et rapide.

## Quickstart

**New to Vulcan?** See [`docs/QUICKSTART.md`](docs/QUICKSTART.md) for a practical five-step guide from feature spec to shipped PR.

**Already familiar?**
1. **Read the orchestrator contract**: [`CLAUDE.md`](CLAUDE.md) defines the full pipeline, phases, and message protocol.
2. **Pick a feature template**: [`templates/`](templates/) contains starter specs for different types of features.
3. **Run the orchestrator**: invoke it with your feature spec, and Vulcan handles planning, implementation, review, and shipping.

See [`templates/README.md`](templates/README.md) for template details and workflow.

## Ce que Vulcan fait

- Lit une spec markdown avec frontmatter structure.
- Genere un plan via un architecte.
- Lance les experts domaine en parallele (backend, frontend, api, db).
- Lance les reviewers en parallele + security review.
- Bloque automatiquement si la qualite ou la securite ne passe pas.
- Ship uniquement si tous les gates sont valides.

## Pipeline (la Forge)

1. **Initialize** - charge config + spec, cree `workspace/state.md`.
2. **Architect** - produit `workspace/plan.md`.
3. **Implement** - experts en parallele, rapport `IMPLEMENTATION_DONE`.
4. **Review** - reviewers en parallele, verdicts traces.
5. **Gate** - `blocked` ou `ship_ready`.
6. **Ship** - commit, push, PR optionnelle.
7. **Summary** - recap complet et traçable.

## Structure du repo

```text
vulcan/
├─ agents/        # prompts des roles (architect, backend, frontend, api, db, reviewer, security, shipper)
├─ templates/     # templates de spec feature
├─ features/      # specs feature utilisateur
├─ workspace/     # etat runtime (state, reviews, messages)
├─ skills/        # skill(s) utilitaires
└─ CLAUDE.md      # contrat d'orchestration complet
```

## Ecrire une feature spec

Base-toi sur `templates/feature.md`:

- `feature`, `title`, `target_dir`
- `stack` (backend/frontend/api/db)
- `skip_agents` si un domaine n'est pas concerne
- `requires_security_review`
- criteres de succes mesurables

See [`templates/README.md`](templates/README.md) for template details and agent handoff workflow.

## Philosophie de qualite

- **Gate first**: pas de bypass du gate.
- **Parallel by default**: implementation et review en parallele.
- **Append-only audit trail**: `workspace/messages.jsonl`.
- **Workspace isolation**: l'orchestrateur n'ecrit pas direct dans le projet cible.

## Skills & agents

See the [full skills & agents index](docs/INDEX.md) for a complete reference of all available roles.

- **[Skills](skills/README.md)** — Reusable skill files for Vulcan agents
- **[Agents](agents/README.md)** — Agent role prompts and pipeline flow

## Contributing

Contributions are welcome! Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Community

- **[Code of Conduct](CODE_OF_CONDUCT.md)** — Community standards and expected behavior
- **[Security Policy](SECURITY.md)** — How to report vulnerabilities responsibly
- **[Support](SUPPORT.md)** — Where to ask questions and get help
