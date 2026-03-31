# DB Review — conductor-phase1
Session: vulcan-20260331-001
Reviewer: reviewer-db
Verdict: approved

## Files Reviewed
- `sidecar/pyproject.toml`
- `sidecar/db.py`

## Criteria Checklist

| # | Criterion | Result |
|---|-----------|--------|
| 1 | pyproject.toml has fastapi, uvicorn[standard], aiosqlite, litellm, python-multipart | PASS |
| 2 | init_db() creates all 6 tables: tasks, xp_events, badges, streaks, agent_stats, skills | PASS |
| 3 | agent_stats seeded from data/agents.json (9 agents, INSERT OR IGNORE) | PASS |
| 4 | skills seeded from data/skills.json (10 skills, variables_json=json.dumps) | PASS |
| 5 | streaks seeded with gabriel row | PASS |
| 6 | get_db() sets row_factory = aiosqlite.Row | PASS |
| 7 | DB_PATH = Path.home() / ".wonka" / "conductor.db" | PASS |
| 8 | DATA_DIR resolved via Path(__file__).parent.parent / "data" | PASS |
| 9 | No sqlite3 imports (must use aiosqlite only) | PASS |

## Findings

### Minor — Redundant row_factory assignment
- **File**: `sidecar/db.py`
- **Lines**: 109 (init_db) and 187 (get_db)
- **Description**: `_db.row_factory = aiosqlite.Row` is set on the connection object in both `init_db()` and again on every call to `get_db()`. This is harmless — assigning the same value twice has no side effects — but is slightly redundant.
- **Required fix**: None. Setting it in `init_db()` alone is sufficient, but the current implementation is correct and safe.

## Summary

The db expert's implementation is clean and fully spec-compliant. All 6 tables match the spec schema exactly, seed logic correctly reads from both data files using INSERT OR IGNORE with the right field mappings (including `json.dumps` for `variables_json`), the gabriel streak row is inserted, paths are resolved correctly, and no forbidden sqlite3 import is present. The one observation is a harmless double-assignment of `row_factory` in `get_db()` that is already set during `init_db()` — this does not affect correctness.
