# Examples

`conductor-phase1-run/` is a real Vulcan session, input and output together:

| File | What it is |
|---|---|
| `feature.md` | The feature spec the run was given (input) |
| `plan.md` | The Architect's implementation plan (Phase 1) |
| `messages.jsonl` | The append-only audit trail: `FEATURE_PLAN`, 7 `IMPLEMENTATION_DONE`, 5 `REVIEW_RESULT` |
| `review-{api,backend,db,frontend}.md` | Per-domain reviewer findings (Phase 4) |
| `state.md` | Final state: every reviewer approved, status `SHIP_READY`, shipper running |

The run had `requires_security_review: false`, so there is no `SECURITY_RESULT`, and it was captured
before `SHIP_DONE`. CI checks the trail against the protocol:

```bash
npm run validate:messages
```

Live runs write to `workspace/`, which is git-ignored. `features/` is where your own specs go.
