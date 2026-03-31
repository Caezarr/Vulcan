# Review — API Agent
Session: vulcan-20260331-001
Feature: Conductor Phase 1 Core MVP (conductor-phase1)
Reviewer: reviewer-api
Files reviewed:
  - sidecar/main.py (created)
  - sidecar/tasks.py (created)

---

## Verdict: approved_with_notes

---

## Criteria Checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | main.py: FastAPI with asynccontextmanager lifespan calling init_db() | PASS |
| 2 | main.py: CORSMiddleware with allow_origins=["*"] | PASS |
| 3 | main.py: uvicorn bound to 127.0.0.1:8765 (never 0.0.0.0) | PASS |
| 4 | tasks.py: POST /tasks — returns 201, validates agent_id | PASS |
| 5 | tasks.py: GET /tasks — returns list ordered by created_at DESC | PASS |
| 6 | tasks.py: GET /tasks/{id} — 404 if not found | PASS |
| 7 | tasks.py: PATCH /tasks/{id} — partial update | PASS |
| 8 | tasks.py: DELETE /tasks/{id} — 204 | PASS (minor issue noted) |
| 9 | tasks.py: GET /tasks/{id}/output — StreamingResponse with media_type="text/event-stream", Cache-Control: no-cache | PASS |
| 10 | SSE: handles stub agents (returns error event, code="stub") | PASS |
| 11 | SSE: handles not-found tasks | PASS |
| 12 | SSE: emits xp event after task completion | PASS |
| 13 | SSE: emits badge events for earned badges | PASS |
| 14 | SSE: emits done event with exit_code and elapsed_s | PASS |
| 15 | tasks.py: POST /tasks/{id}/cancel — returns {"cancelled": true} | PASS (minor casing note) |
| 16 | tasks.py: GET /agents — returns AGENTS dict as list | PASS |
| 17 | tasks.py: GET /agents/{id}/stats — includes level computed from total_xp | PASS |
| 18 | tasks.py: GET /skills — parses variables_json | PASS |
| 19 | tasks.py: GET /gamification — composite response | PASS |
| 20 | Import paths are bare module names (db, agents, gamification) — no package prefix | PASS |

---

## Issues Found

### Issue 1 — Minor: DELETE /tasks/{id} returns JSONResponse(status_code=204) instead of Response()
**Severity:** minor
**File:** sidecar/tasks.py
**Line:** 186
**Description:** The DELETE handler is decorated with `status_code=204` and on success returns `JSONResponse(status_code=204, content=None)`. FastAPI's `JSONResponse` with `content=None` serializes to the string `"null"` in the body, which technically violates HTTP 204 (no content). The correct approach is to return `Response(status_code=204)` with no body. This is a spec compliance nit — some clients may reject a 204 with a body.
**Required fix:** Replace `return JSONResponse(status_code=204, content=None)` with `from fastapi.responses import Response` and `return Response(status_code=204)`.

### Issue 2 — Minor: POST /tasks/{id}/cancel response key casing
**Severity:** minor
**File:** sidecar/tasks.py
**Line:** 343
**Description:** The cancel endpoint returns `{"cancelled": True}` (Python boolean `True`, uppercase T). FastAPI will serialize this correctly to JSON `true`, so this is not a functional bug — just noting the implementation matches the spec output `{"cancelled": true}` correctly via FastAPI's JSON serialization.
**Required fix:** None — this is fine as-is.

### Issue 3 — Minor: Already-completed task SSE emits exit_code=0 regardless of actual outcome
**Severity:** minor
**File:** sidecar/tasks.py
**Lines:** 232–236
**Description:** When a task already has status "done", "error", or "cancelled", the SSE endpoint immediately emits `{"type": "done", "exit_code": 0, "elapsed_s": 0}`. For tasks that ended in "error" or "cancelled", emitting exit_code=0 is misleading. The `elapsed_s: 0` is also hardcoded rather than derived from `completed_at - started_at`. This is a minor correctness issue that does not block Phase 1 functionality.
**Required fix (recommended):** Check the stored status — emit `exit_code: 1` if status is "error" or "cancelled", and derive `elapsed_s` from `completed_at` and `started_at` if both are populated.

### Issue 4 — Minor: `json` import present in main.py but unused
**Severity:** minor
**File:** sidecar/main.py
**Line:** 8
**Description:** `import json` and `from pathlib import Path` are imported at the top of main.py but never referenced anywhere in the file. These are dead imports left over from a template.
**Required fix:** Remove `import json` and `from pathlib import Path` from main.py.

---

## Summary

Both files are well-structured and satisfy the API contract from the spec and plan. `main.py` correctly wires lifespan, CORS, and uvicorn binding. `tasks.py` implements all 13 endpoints with proper SSE streaming, gamification events (xp, badge, done), stub agent handling, and bare-module import paths. The four issues found are all minor: a technically incorrect 204 response body, dead imports in main.py, and a cosmetic accuracy gap when replaying already-completed tasks. None of these are blocking — Phase 1 will function correctly. The 204 fix is the most important to address before Phase 2 since strict HTTP clients may reject it.
