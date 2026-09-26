# Vulcan - Feature Shipping Orchestrator

Vulcan transforme une spec feature en code shippe, avec un pipeline multi-agents strict, auditable, et rapide.

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

## Contributing

Contributions are welcome! Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.
