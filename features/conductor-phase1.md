---
feature: conductor-phase1
title: "Conductor — Phase 1 Core MVP"
status: ready
priority: high
target_dir: /Users/gabriel/Desktop/Wonka/code/agent-manager
stack:
  backend: python
  frontend: react
  api: rest
  db: sqlite
skip_agents: []
requires_security_review: false
---

## Problem

Conductor is a greenfield desktop application (Tauri + React + Python FastAPI sidecar) that unifies management of multiple AI coding agents (Claude Code, Codex CLI, Aider, GPT-4, etc.) into a single cockpit. All documentation is complete and approved — ARCHITECTURE.md, DESIGN.md, PLAN.md, TODOS.md, data/agents.json, data/skills.json — but zero source code exists yet. Phase 1 must scaffold the entire working application from these docs.

Read these files in `target_dir` before doing anything:
- `CLAUDE.md` — architecture overview and conventions
- `ARCHITECTURE.md` — full technical spec
- `DESIGN.md` — UI/UX design system (colors, typography, layout)
- `TODOS.md` — 14 Phase 1 tasks to complete
- `data/agents.json` — 9 agent definitions (cli/api/stub types)
- `data/skills.json` — 10 skill templates

## Success Criteria

- [ ] Tauri app scaffolded: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`
- [ ] Python sidecar starts: `sidecar/pyproject.toml` with fastapi, uvicorn, litellm, aiosqlite deps; `sidecar/main.py` with FastAPI app + lifespan + CORS
- [ ] `sidecar/db.py` initializes SQLite at `~/.wonka/conductor.db` with all 6 tables and seeds from `data/agents.json` + `data/skills.json`
- [ ] `sidecar/agents.py` implements CLIAgent (asyncio subprocess, stdin close pattern, ANSI strip) and APIAgent (LiteLLM acompletion streaming)
- [ ] `sidecar/tasks.py` implements CRUD + status machine (queued→running→done/error/cancelled)
- [ ] `sidecar/gamification.py` implements XP formula (base × quality × speed × streak), badge triggers, streak logic
- [ ] FastAPI exposes all 13 endpoints: POST/GET/PATCH/DELETE /tasks, GET /tasks/{id}/output (SSE), GET /agents, GET /agents/{id}/stats, GET /skills, GET /gamification
- [ ] `src/App.tsx` renders 3-panel layout: AgentRoster (left, 240px) | TaskBoard (center) | OutputPanel (right)
- [ ] `src/components/GamificationHUD.tsx` shows streak, total XP, tasks done count in header
- [ ] `src/components/AgentRoster.tsx` renders agent cards from GET /agents with status dot, name, level badge, XP bar
- [ ] `src/components/TaskBoard.tsx` renders Kanban (Backlog | Active | Done) from GET /tasks with task cards
- [ ] `src/components/OutputPanel.tsx` connects to GET /tasks/{id}/output SSE and renders token events progressively
- [ ] `src/components/SkillsLibrary.tsx` renders 3-column grid from GET /skills with skill cards (emoji + name + category)
- [ ] Tauri IPC commands implemented in `src-tauri/src/main.rs`: `create_task`, `list_agents`, `list_tasks` (proxy to sidecar HTTP)

## Scope

### In scope
- Full Tauri project scaffold (React + TypeScript + Vite frontend)
- Python FastAPI sidecar with all Phase 1 endpoints
- SQLite schema with 6 tables + seed data from data/agents.json and data/skills.json
- CLIAgent subprocess execution (asyncio, streaming stdout)
- APIAgent via LiteLLM acompletion (streaming)
- All 5 React components + App.tsx layout
- Tauri IPC commands bridging frontend to sidecar
- SSE streaming from sidecar to frontend

### Out of scope
- Git worktree isolation (Phase 2)
- Diff parser / diff renderer (Phase 2)
- Skills UI keyboard navigation (Phase 2)
- Multi-agent parallel dispatch (Phase 3)
- VS Code extension / MCP server (Phase 4)
- PR creation (no remote git configured)

## Technical Context

Architecture:
```
[React frontend (TypeScript)] ←IPC→ [Tauri shell (Rust)] ←HTTP→ [Python FastAPI sidecar :8765] → [subprocess: claude, codex, aider…]
```

**CRITICAL sidecar patterns** (must use exactly):
```python
# CLIAgent — stdin close is mandatory or subprocess hangs
process.stdin.write(prompt.encode())
process.stdin.close()

# ANSI strip — CLI tools emit escape codes
ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[mGKHFJ]")
clean = ANSI_ESCAPE.sub("", chunk.decode(errors="replace"))

# CancelledError — graceful termination
try:
    async for chunk in process.stdout:
        yield chunk
except asyncio.CancelledError:
    pass
finally:
    if process.returncode is None:
        process.terminate()
```

Agent type handling:
- `type: "cli"` → asyncio subprocess, command from agents.json `command` field
- `type: "api"` → `litellm.acompletion(model=agent["litellm_id"], stream=True)`
- `type: "stub"` → return error event `{"type": "error", "code": "stub", "message": "Coming soon"}`

Availability check at startup: `shutil.which(command)` → set `local_available: bool` on each CLI agent response.

Environment variables:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
CONDUCTOR_PORT=8765
WONKA_HOME=~/.wonka
```

Sidecar bound to `127.0.0.1:8765` only (never 0.0.0.0).

## Design / UX Notes

Dark cockpit theme:
- Background: `#0a0a0d`
- Surface: `#111115`
- Border: `#1e1e24`
- Accent violet: `#7c3aed`
- Success green: `#16a34a`
- Danger red: `#dc2626`
- XP indigo: `#6366f1`
- Text primary: `#f4f4f5`
- Text muted: `#71717a`

Typography: Geist Mono (code/numbers) + Geist (UI labels). Import from `@fontsource/geist` or Google Fonts.

Layout (fixed, no dynamic resize in Phase 1):
- Header: 40px — logo "CONDUCTOR" + streak badge + total XP
- Left panel: 240px fixed — AgentRoster
- Center: flex — TaskBoard
- Right panel: flex — OutputPanel (or SkillsLibrary when no task selected)

Agent card anatomy:
- Status dot: green pulsing (running) | amber (idle) | red (error) | gray (unavailable)
- Agent name + type badge (CLI / API / STUB)
- Level number + XP bar (indigo fill)
- Current task title if running

Task card anatomy:
- Skill emoji + title
- Assigned agent chip
- Status badge
- Progress bar (indigo)

## API Contract

All endpoints on `http://127.0.0.1:8765`:

```
POST /tasks
Body: { "title": string, "body": string, "agent_id": string, "skill_id": string | null, "complexity": 1|2|3 }
Response 201: { "id": string, "status": "queued", ... full task object }

GET /tasks
Response 200: [ ...task objects ]

GET /tasks/{id}
Response 200: task object
Response 404: { "error": "not found" }

PATCH /tasks/{id}
Body: { "status"?: string, "agent_id"?: string }
Response 200: updated task object

DELETE /tasks/{id}
Response 204

GET /tasks/{id}/output
Response: SSE stream (text/event-stream)
Events: token | diff | progress | xp | badge | done | error

POST /tasks/{id}/cancel
Response 200: { "cancelled": true }

GET /agents
Response 200: [ { "id", "name", "type", "skills", "local_available", "status": "idle"|"running"|"error", "current_task_id": string|null } ]

GET /agents/{id}/stats
Response 200: { "agent_id", "total_xp", "level": 1-10, "tasks_done", "badges": [...] }

GET /skills
Response 200: [ { "id", "name", "emoji", "category", "complexity", "template", "variables" } ]

GET /gamification
Response 200: { "streak": int, "last_active": string, "total_xp": int, "tasks_done": int, "badges": [...] }
```

SSE event schema:
```json
{"type": "token", "text": "..."}
{"type": "progress", "pct": 80, "elapsed_s": 83}
{"type": "xp", "agent_id": "claude-code", "delta": 50, "reason": "task_done", "new_total": 150}
{"type": "badge", "agent_id": "claude-code", "badge_id": "speedrunner", "badge_name": "Speedrunner", "emoji": "⚡"}
{"type": "done", "exit_code": 0, "elapsed_s": 97}
{"type": "error", "code": "subprocess_crash|timeout|auth|stub", "message": "..."}
```

## Data Model

SQLite at `~/.wonka/conductor.db`:

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    agent_id TEXT,
    skill_id TEXT,
    status TEXT DEFAULT 'queued',
    complexity INTEGER DEFAULT 1,
    worktree_path TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS xp_events (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    task_id TEXT,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    multiplier REAL DEFAULT 1.0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS streaks (
    user_id TEXT PRIMARY KEY DEFAULT 'gabriel',
    current_streak INTEGER DEFAULT 0,
    last_active_date TEXT,
    longest_streak INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_stats (
    agent_id TEXT PRIMARY KEY,
    total_xp INTEGER DEFAULT 0,
    tasks_done INTEGER DEFAULT 0,
    speed_record_s INTEGER,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT,
    category TEXT,
    complexity INTEGER DEFAULT 1,
    template TEXT NOT NULL,
    variables_json TEXT DEFAULT '[]'
);
```

Seed `agent_stats` from `data/agents.json` at startup (insert if not exists).
Seed `skills` from `data/skills.json` at startup (insert if not exists).

XP level thresholds (level 1-10):
- 1 (Apprentice): 0
- 2 (Journeyman): 500
- 3 (Practitioner): 1200
- 4 (Craftsman): 2500
- 5 (Artisan): 4500
- 6 (Expert): 7500
- 7 (Master): 11500
- 8 (Grandmaster): 16000
- 9 (Legend): 19000
- 10 (Maestro): 22000

XP formula:
```python
base_xp = complexity * 50
quality_mult = 1.0  # Phase 1: always 1.0 (feedback loop is Phase 2+)
speed_mult = 1.3 if elapsed_s < 60 else (1.2 if elapsed_s < 300 else 1.0)
streak_mult = 1.2 if current_streak >= 5 else 1.0
delta = int(base_xp * quality_mult * speed_mult * streak_mult)
```

Badges (check after each task completion):
- `first_run`: first task ever completed by this agent
- `speedrunner`: task completed in < 60s
- `on_fire`: 3+ tasks done in the same day by this agent

## Acceptance Test Sketches

1. Given sidecar starts on :8765, when `GET /agents` is called, then returns 9 agents from data/agents.json with `local_available` populated
2. Given skills table seeded, when `GET /skills` is called, then returns 10 skills from data/skills.json
3. Given a task is created via `POST /tasks` with `agent_id: "claude-sonnet-4-6"`, when the task runs, then `GET /tasks/{id}/output` SSE emits at least one `token` event followed by `done`
4. Given a task completes, when `GET /agents/claude-sonnet-4-6/stats`, then `tasks_done >= 1` and `total_xp > 0`
5. Given the React app loads, when it renders, then AgentRoster shows agent cards and TaskBoard shows 3 Kanban columns
