# Backend Review — conductor-phase1
Session: vulcan-20260331-001
Reviewer: reviewer-backend
Expert: backend
Verdict: approved_with_notes

---

## Files Reviewed

- `sidecar/agents.py` (created)
- `sidecar/gamification.py` (created)
- `data/agents.json` (reference, not modified)

---

## Criteria Checklist

| # | Criterion | Result |
|---|-----------|--------|
| 1 | CLIAgent uses `asyncio.create_subprocess_exec` | PASS |
| 2 | CLIAgent writes prompt to stdin AND closes stdin | PASS |
| 3 | CLIAgent strips ANSI codes using ANSI_ESCAPE regex | PASS |
| 4 | CLIAgent handles `asyncio.CancelledError` gracefully | PASS |
| 5 | CLIAgent terminates process in finally block if returncode is None | PASS |
| 6 | APIAgent uses `litellm.acompletion` with `stream=True` | PASS |
| 7 | APIAgent sanitizes error messages — never echoes API keys | PASS |
| 8 | AGENTS loaded at module level via `_load_agents()` | PASS |
| 9 | `local_available` set via `shutil.which` for CLI, True for API, False for stub | PASS |
| 10 | `DATA_DIR` resolved via `Path(__file__).parent.parent / "data"` | PASS |
| 11 | `compute_xp` formula correct (base*complexity, speed_mult, streak_mult) | PASS |
| 12 | `check_badges` checks `first_run`, `speedrunner`, `on_fire` | PASS |
| 13 | `award_xp` inserts to `xp_events` + updates `agent_stats` | PASS |
| 14 | `update_streak` handles today/yesterday/reset cases | PASS |

---

## Issues

### Issue 1 — Minor: stub agents return None instead of emitting the specified error event

**File:** `sidecar/agents.py`, line 98
**Severity:** minor

`get_agent_executor()` returns `None` for stub-type agents. The spec (Technical Context) states stub agents must return:

```json
{"type": "error", "code": "stub", "message": "Coming soon"}
```

The current return of `None` means any caller that does not explicitly check for `None` before calling `.stream()` will raise an `AttributeError` at runtime rather than emitting a well-formed SSE error event to the frontend. The spec's stub behavior is a first-class response, not a "no executor" state.

**Required fix (in tasks.py or agents.py):** Either create a `StubAgent` class whose `stream()` yields the error event, or handle `None` from `get_agent_executor()` explicitly in the task runner and emit the stub error event there.

### Issue 2 — Minor: `check_badges` `first_run` logic has implicit call-order dependency

**File:** `sidecar/gamification.py`, lines 45-52
**Severity:** minor

`check_badges` determines `first_run` eligibility by counting rows in `xp_events` where `reason='task_done'` and checking `count == 1`. This only works correctly if `award_xp` (which inserts the `xp_events` row) is called **before** `check_badges` in the task completion flow. This ordering dependency is invisible in the function signatures and creates a subtle integration trap for `tasks.py`.

**Required fix:** Document the required call order with a comment on `check_badges`, or restructure so the count check is `<= 1` with a separate guard against double-awarding (the existing badge duplication check already handles idempotence, so `count >= 1` would be safer and equivalent in effect once the badge row exists).

---

## Positive Notes

- The `stdin.close()` critical pattern is implemented correctly and even has an explanatory comment — exactly what the spec requires.
- `CLIAgent.stream()` goes above the spec by adding a `wait_for(process.wait(), timeout=5)` with a `process.kill()` fallback after `terminate()` — this is a good defensive addition that prevents zombie subprocess accumulation.
- ANSI regex pattern matches the spec exactly: `r"\x1b\[[0-9;]*[mGKHFJ]"`.
- API key sanitization checks `"key"`, `"sk-"`, and additionally `"token"` — the extra check is safe and beneficial.
- `compute_xp` formula is a byte-for-byte match to the spec's Python pseudocode.
- `update_streak` correctly handles all three cases (today = no-op, yesterday = increment, else = reset) and maintains `longest_streak`.
- `check_badges` correctly gates `on_fire` with a per-day idempotency check (not just a global one), preventing repeated awards on subsequent tasks the same day.
- `award_xp` correctly increments both `total_xp` and `tasks_done` for `reason='task_done'`, but only `total_xp` for other reasons — matches the data model intent.

---

## Summary

The backend implementation is high quality. All 14 success criteria pass. The two minor issues are integration concerns — stub agents silently returning `None` rather than emitting the specified SSE error event is the more actionable one, as it will surface as a runtime crash in `tasks.py` the first time a user selects a stub agent. Neither issue warrants blocking; both should be addressed by the API agent when wiring the task runner.
