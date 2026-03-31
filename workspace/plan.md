# Implementation Plan
Feature: conductor-phase1 — Conductor Phase 1 Core MVP
Session: vulcan-20260331-001
Target: /Users/gabriel/Desktop/Wonka/code/agent-manager
Date: 2026-03-31

## Agent Roster
Agents needed: backend, frontend, api, db
Skipped: none

---

## API Contract

All endpoints on `http://127.0.0.1:8765`. CORS must allow all origins (Tauri webview origin varies).

```
POST /tasks
  Body:     { "title": string, "body": string, "agent_id": string, "skill_id": string|null, "complexity": 1|2|3 }
  Response: 201 { "id": string, "title": string, "body": string, "agent_id": string, "skill_id": string|null,
                  "status": "queued", "complexity": integer, "worktree_path": null,
                  "created_at": ISO8601, "started_at": null, "completed_at": null }
  Errors:   400 if agent_id not found

GET /tasks
  Response: 200 [ ...task objects (same shape as above) ]

GET /tasks/{id}
  Response: 200 task object
  Error:    404 { "error": "not found" }

PATCH /tasks/{id}
  Body:     { "status"?: string, "agent_id"?: string }
  Response: 200 updated task object
  Error:    404 { "error": "not found" }

DELETE /tasks/{id}
  Response: 204 (no body)
  Error:    404

GET /tasks/{id}/output
  Response: SSE stream (Content-Type: text/event-stream, no buffering)
  Each SSE event: data: <JSON>\n\n
  JSON shapes:
    {"type": "token",    "text": "..."}
    {"type": "progress", "pct": 80, "elapsed_s": 83}
    {"type": "xp",       "agent_id": "...", "delta": 50, "reason": "task_done", "new_total": 150}
    {"type": "badge",    "agent_id": "...", "badge_id": "speedrunner", "badge_name": "Speedrunner", "emoji": "⚡"}
    {"type": "done",     "exit_code": 0, "elapsed_s": 97}
    {"type": "error",    "code": "subprocess_crash|timeout|auth|stub", "message": "..."}
  Behavior: streams task execution live; on connect for already-done task, immediately emits "done"

POST /tasks/{id}/cancel
  Response: 200 { "cancelled": true }
  Error:    404

GET /agents
  Response: 200 [
    {
      "id": string, "name": string, "type": "cli"|"api"|"stub",
      "skills": string[], "description": string,
      "local_available": bool,   // shutil.which result for cli type; true for api; false for stub
      "status": "idle"|"running"|"error",
      "current_task_id": string|null
    }
  ]

GET /agents/{id}/stats
  Response: 200 {
    "agent_id": string,
    "total_xp": integer,
    "level": 1-10,
    "level_name": string,
    "tasks_done": integer,
    "badges": [ {"badge_id": string, "earned_at": ISO8601} ]
  }
  Error: 404 { "error": "not found" }

GET /skills
  Response: 200 [
    {
      "id": string, "name": string, "emoji": string, "category": string,
      "complexity": integer, "template": string, "variables": string[]
    }
  ]

GET /gamification
  Response: 200 {
    "streak": integer,
    "last_active": string|null,
    "total_xp": integer,
    "tasks_done": integer,
    "badges": [ {"agent_id": string, "badge_id": string, "earned_at": string} ]
  }
```

---

## Data Model Changes

SQLite database at `~/.wonka/conductor.db`. Created fresh (greenfield). Path resolved via `os.path.expanduser("~/.wonka/conductor.db")`.

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    body          TEXT NOT NULL,
    agent_id      TEXT,
    skill_id      TEXT,
    status        TEXT DEFAULT 'queued',
    complexity    INTEGER DEFAULT 1,
    worktree_path TEXT,
    created_at    TEXT NOT NULL,
    started_at    TEXT,
    completed_at  TEXT
);

CREATE TABLE IF NOT EXISTS xp_events (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    task_id     TEXT,
    delta       INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    multiplier  REAL DEFAULT 1.0,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS badges (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    badge_id    TEXT NOT NULL,
    earned_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS streaks (
    user_id          TEXT PRIMARY KEY DEFAULT 'gabriel',
    current_streak   INTEGER DEFAULT 0,
    last_active_date TEXT,
    longest_streak   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_stats (
    agent_id       TEXT PRIMARY KEY,
    total_xp       INTEGER DEFAULT 0,
    tasks_done     INTEGER DEFAULT 0,
    speed_record_s INTEGER,
    created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    emoji          TEXT,
    category       TEXT,
    complexity     INTEGER DEFAULT 1,
    template       TEXT NOT NULL,
    variables_json TEXT DEFAULT '[]'
);
```

Seed on startup (INSERT OR IGNORE):
- `agent_stats`: one row per agent in data/agents.json (id, created_at=now, total_xp=0, tasks_done=0)
- `skills`: all 10 entries from data/skills.json (variables array serialized as JSON string)
- `streaks`: insert row for 'gabriel' if not exists

XP Level thresholds (from ARCHITECTURE.md spec):
```python
XP_LEVELS = [
    (1,  "Apprentice",   0),
    (2,  "Journeyman",   500),
    (3,  "Practitioner", 1200),
    (4,  "Craftsman",    2500),
    (5,  "Artisan",      4500),
    (6,  "Expert",       7500),
    (7,  "Master",       11500),
    (8,  "Grandmaster",  16000),
    (9,  "Legend",       19000),
    (10, "Maestro",      22000),
]
```

XP formula:
```python
base_xp = complexity * 50
quality_mult = 1.0  # Phase 1: always 1.0
speed_mult = 1.3 if elapsed_s < 60 else (1.2 if elapsed_s < 300 else 1.0)
streak_mult = 1.2 if current_streak >= 5 else 1.0
delta = int(base_xp * quality_mult * speed_mult * streak_mult)
```

---

## Risk Flags

- Greenfield project — no existing code to break, but all files must be created correctly from scratch
- CLIAgent stdin.close() pattern is critical — subprocess hangs forever without it
- SSE streaming must not buffer — FastAPI must use `StreamingResponse` with `media_type="text/event-stream"`, and CORS must allow the Tauri webview origin
- The `data/agents.json` and `data/skills.json` files must be read relative to the sidecar's working directory or via absolute path based on `__file__` — never assume cwd
- `~/.wonka/` directory must be created if it doesn't exist (`os.makedirs(path, exist_ok=True)`)
- Tauri requires `reqwest` feature enabled in Cargo.toml for HTTP calls from Rust
- LiteLLM `acompletion` exceptions must never echo API keys in SSE error payloads
- The `skills` table `variables_json` column stores a JSON string (list of variable names), not a JSON column — serialize with `json.dumps(variables)` on write, `json.loads(variables_json)` on read

---

## Per-Agent Tasks

---

### DB Agent

**Files to read first:** `data/agents.json`, `data/skills.json`, feature spec data model section

**Files to create:**
- `sidecar/db.py`
- `sidecar/pyproject.toml`

**Files to modify:** none

**Task:**

Create `sidecar/pyproject.toml` using `uv` format:

```toml
[project]
name = "conductor-sidecar"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.111.0",
    "uvicorn[standard]>=0.29.0",
    "aiosqlite>=0.20.0",
    "litellm>=1.40.0",
    "python-multipart>=0.0.9",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.uv]
dev-dependencies = [
    "httpx>=0.27.0",
]
```

Create `sidecar/db.py` with these responsibilities:

1. **Path resolution**: Resolve `data/agents.json` and `data/skills.json` relative to the sidecar directory using `Path(__file__).parent.parent / "data"`. DB path: `Path.home() / ".wonka" / "conductor.db"`.

2. **DB init function** `async def init_db()`:
   - Create `~/.wonka/` directory with `os.makedirs(..., exist_ok=True)`
   - Open aiosqlite connection to `conductor.db`
   - Execute all 6 `CREATE TABLE IF NOT EXISTS` statements (exact SQL from data model above)
   - Seed `agent_stats`: for each agent in `data/agents.json`, do `INSERT OR IGNORE INTO agent_stats (agent_id, total_xp, tasks_done, speed_record_s, created_at) VALUES (?, 0, 0, NULL, ?)`
   - Seed `skills`: for each skill in `data/skills.json`, do `INSERT OR IGNORE INTO skills (id, name, emoji, category, complexity, template, variables_json) VALUES (?, ?, ?, ?, ?, ?, ?)` where `variables_json = json.dumps(skill["variables"])`
   - Seed `streaks`: `INSERT OR IGNORE INTO streaks (user_id, current_streak, last_active_date, longest_streak) VALUES ('gabriel', 0, NULL, 0)`
   - `await db.commit()`

3. **Connection getter** `async def get_db() -> aiosqlite.Connection`:
   - Returns a module-level `_db` connection opened once at startup
   - Set `_db.row_factory = aiosqlite.Row` so rows are dict-like

4. **Module-level `_db`** variable, set by `init_db()` and stored for reuse.

5. Export: `init_db`, `get_db`, `DB_PATH`

**Constraints:**
- Use `aiosqlite` throughout — never `sqlite3` (blocks the event loop)
- All datetime values stored as ISO 8601 UTC strings: `datetime.utcnow().isoformat() + "Z"`
- UUIDs generated with `str(uuid.uuid4())`

---

### Backend Agent

**Files to read first:** `data/agents.json`, `ARCHITECTURE.md` (CLIAgent section), `CLAUDE.md` (CRITICAL patterns section)

**Files to create:**
- `sidecar/agents.py`
- `sidecar/gamification.py`

**Files to modify:** none

**Task:**

**`sidecar/agents.py`** — implement two agent execution classes plus the agent registry:

```python
# Top of file
import asyncio, re, json, shutil
from pathlib import Path
from typing import AsyncIterator
import litellm

ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[mGKHFJ]")
DATA_DIR = Path(__file__).parent.parent / "data"
```

1. **Load agents registry** at module level:
   ```python
   def _load_agents() -> dict:
       with open(DATA_DIR / "agents.json") as f:
           agents = json.load(f)
       result = {}
       for agent in agents:
           if agent["type"] == "cli":
               agent["local_available"] = shutil.which(agent["command"]) is not None
           elif agent["type"] == "api":
               agent["local_available"] = True
           else:
               agent["local_available"] = False
           agent["status"] = "idle"
           agent["current_task_id"] = None
           result[agent["id"]] = agent
       return result

   AGENTS: dict = _load_agents()
   ```

2. **CLIAgent class**:
   ```python
   class CLIAgent:
       def __init__(self, agent_def: dict):
           self.id = agent_def["id"]
           self.command = agent_def["command"]
           self.args = agent_def.get("args", [])
           self.timeout = agent_def.get("timeout", 120)

       async def stream(self, prompt: str, cwd: str = ".") -> AsyncIterator[dict]:
           process = await asyncio.create_subprocess_exec(
               self.command, *self.args,
               stdin=asyncio.subprocess.PIPE,
               stdout=asyncio.subprocess.PIPE,
               stderr=asyncio.subprocess.PIPE,
               cwd=cwd,
           )
           process.stdin.write(prompt.encode())
           process.stdin.close()  # CRITICAL — prevents subprocess hang

           try:
               async for chunk in process.stdout:
                   raw = ANSI_ESCAPE.sub("", chunk.decode(errors="replace"))
                   if raw.strip():
                       yield {"type": "token", "text": raw}
           except asyncio.CancelledError:
               pass
           finally:
               if process.returncode is None:
                   process.terminate()
                   try:
                       await asyncio.wait_for(process.wait(), timeout=5)
                   except asyncio.TimeoutError:
                       process.kill()
   ```

3. **APIAgent class**:
   ```python
   class APIAgent:
       def __init__(self, agent_def: dict):
           self.id = agent_def["id"]
           self.litellm_id = agent_def["litellm_id"]
           self.timeout = agent_def.get("timeout", 60)

       async def stream(self, prompt: str) -> AsyncIterator[dict]:
           try:
               response = await litellm.acompletion(
                   model=self.litellm_id,
                   messages=[{"role": "user", "content": prompt}],
                   stream=True,
                   timeout=self.timeout,
               )
               async for chunk in response:
                   text = chunk.choices[0].delta.content
                   if text:
                       yield {"type": "token", "text": text}
           except Exception as e:
               # Never echo API keys — sanitize error message
               msg = str(e)
               if "key" in msg.lower() or "token" in msg.lower() or "sk-" in msg:
                   msg = "API authentication error"
               yield {"type": "error", "code": "auth", "message": msg}
   ```

4. **Factory function**:
   ```python
   def get_agent_executor(agent_id: str):
       agent = AGENTS.get(agent_id)
       if not agent:
           return None
       if agent["type"] == "cli":
           return CLIAgent(agent)
       elif agent["type"] == "api":
           return APIAgent(agent)
       return None  # stub
   ```

**`sidecar/gamification.py`** — XP, badges, streak logic:

```python
import json
from datetime import datetime, date

XP_LEVELS = [
    (1,  "Apprentice",   0),
    (2,  "Journeyman",   500),
    (3,  "Practitioner", 1200),
    (4,  "Craftsman",    2500),
    (5,  "Artisan",      4500),
    (6,  "Expert",       7500),
    (7,  "Master",       11500),
    (8,  "Grandmaster",  16000),
    (9,  "Legend",       19000),
    (10, "Maestro",      22000),
]
```

1. **`def compute_xp(complexity: int, elapsed_s: float, current_streak: int) -> int`**:
   ```python
   base_xp = complexity * 50
   quality_mult = 1.0  # Phase 1: always 1.0
   speed_mult = 1.3 if elapsed_s < 60 else (1.2 if elapsed_s < 300 else 1.0)
   streak_mult = 1.2 if current_streak >= 5 else 1.0
   return int(base_xp * quality_mult * speed_mult * streak_mult)
   ```

2. **`def get_level(total_xp: int) -> tuple[int, str]`** — returns (level_number, level_name) by iterating XP_LEVELS in reverse.

3. **`async def check_badges(db, agent_id: str, task_id: str, elapsed_s: float) -> list[dict]`**:
   - Check `first_run`: `SELECT COUNT(*) FROM xp_events WHERE agent_id=? AND reason='task_done'` — if count == 1 (just earned), award badge.
   - Check `speedrunner`: if `elapsed_s < 60`, check if badge already earned, if not award it.
   - Check `on_fire`: `SELECT COUNT(*) FROM xp_events WHERE agent_id=? AND date(created_at)=date('now') AND reason='task_done'` — if count >= 3, check if badge already earned today, if not award.
   - For each new badge: `INSERT INTO badges (id, agent_id, badge_id, earned_at) VALUES (uuid, agent_id, badge_id, now)`
   - Return list of badge dicts: `{"badge_id": ..., "badge_name": ..., "emoji": ...}`

   Badge metadata:
   ```python
   BADGE_META = {
       "first_run":   {"name": "First Run",   "emoji": "🏁"},
       "speedrunner": {"name": "Speedrunner", "emoji": "⚡"},
       "on_fire":     {"name": "On Fire",     "emoji": "🔥"},
   }
   ```

4. **`async def update_streak(db) -> int`**:
   - Get current streak row for 'gabriel'
   - Get today's date as `date.today().isoformat()`
   - If `last_active_date == today`: no change, return current_streak
   - If `last_active_date == yesterday`: increment streak, update longest if needed
   - Otherwise: reset streak to 1
   - UPDATE row, commit, return new streak value

5. **`async def award_xp(db, agent_id: str, task_id: str, delta: int, reason: str, multiplier: float = 1.0)`**:
   - INSERT into xp_events
   - UPDATE agent_stats: `total_xp = total_xp + delta`, `tasks_done = tasks_done + 1` (only when reason='task_done')
   - await db.commit()

**Constraints:**
- `agents.py` must call `shutil.which()` at import time (startup), not per-request
- Never pass `agent["command"]` from user HTTP input — only from the loaded `AGENTS` dict
- `gamification.py` must use `aiosqlite` (async) — all DB calls are `await db.execute(...)`

---

### API Agent

**Files to read first:** `ARCHITECTURE.md` (endpoints + SSE schema), feature spec API Contract section, `data/agents.json`

**Files to create:**
- `sidecar/main.py`
- `sidecar/tasks.py`

**Files to modify:** none

**Task:**

**`sidecar/main.py`** — FastAPI app entry point:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import init_db
import tasks as tasks_router
import json
from pathlib import Path

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="Conductor Sidecar", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tauri webview origin varies per platform
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router.router)

# Also include agents and skills routes (defined below or in tasks.py)
```

All route handlers live in `sidecar/tasks.py` but are included via `app.include_router(router)`.

**`sidecar/tasks.py`** — All 13 endpoints:

Use `APIRouter()`. Import `db.get_db`, `agents.AGENTS`, `agents.get_agent_executor`, `gamification.*`.

Implement ALL of the following:

**Task CRUD:**

1. `POST /tasks` — Create task:
   - Validate `agent_id` exists in `AGENTS` (400 if not)
   - Generate `id = str(uuid.uuid4())`
   - `created_at = datetime.utcnow().isoformat() + "Z"`
   - INSERT into tasks table
   - Return 201 with full task object

2. `GET /tasks` — List all tasks:
   - `SELECT * FROM tasks ORDER BY created_at DESC`
   - Return list of task dicts

3. `GET /tasks/{id}` — Get single task:
   - Return 404 if not found

4. `PATCH /tasks/{id}` — Update task:
   - Accept partial body with optional `status` and/or `agent_id`
   - Build dynamic UPDATE SQL from provided fields
   - Return updated task

5. `DELETE /tasks/{id}` — Delete task:
   - Return 204
   - Return 404 if not found

**SSE endpoint — GET /tasks/{id}/output:**

This is the most complex endpoint. Use `StreamingResponse`:

```python
from fastapi.responses import StreamingResponse
import asyncio, json, time

@router.get("/tasks/{id}/output")
async def task_output(id: str):
    async def event_stream():
        db = await get_db()
        # Fetch task
        row = await db.execute("SELECT * FROM tasks WHERE id=?", (id,))
        task = await row.fetchone()
        if not task:
            yield f"data: {json.dumps({'type': 'error', 'code': 'not_found', 'message': 'Task not found'})}\n\n"
            return

        task = dict(task)
        agent_id = task["agent_id"]
        agent = AGENTS.get(agent_id)

        if not agent:
            yield f"data: {json.dumps({'type': 'error', 'code': 'stub', 'message': 'Agent not found'})}\n\n"
            return

        # Handle stub agents
        if agent["type"] == "stub":
            yield f"data: {json.dumps({'type': 'error', 'code': 'stub', 'message': 'Coming soon'})}\n\n"
            return

        # Update task status to running
        now = datetime.utcnow().isoformat() + "Z"
        await db.execute(
            "UPDATE tasks SET status='running', started_at=? WHERE id=?",
            (now, id)
        )
        await db.commit()

        # Update agent status
        agent["status"] = "running"
        agent["current_task_id"] = id

        executor = get_agent_executor(agent_id)
        start_time = time.time()
        complexity = task.get("complexity", 1)

        try:
            if agent["type"] == "cli":
                gen = executor.stream(task["body"], cwd=".")
            else:
                gen = executor.stream(task["body"])

            async for event in gen:
                elapsed = time.time() - start_time
                if event["type"] == "token":
                    event["elapsed_s"] = round(elapsed, 1)
                yield f"data: {json.dumps(event)}\n\n"

            # Task done
            elapsed_s = time.time() - start_time
            exit_code = 0

            await db.execute(
                "UPDATE tasks SET status='done', completed_at=? WHERE id=?",
                (datetime.utcnow().isoformat() + "Z", id)
            )
            await db.commit()

            # Gamification
            streak_row = await db.execute(
                "SELECT current_streak FROM streaks WHERE user_id='gabriel'"
            )
            streak_r = await streak_row.fetchone()
            current_streak = dict(streak_r)["current_streak"] if streak_r else 0

            delta = compute_xp(complexity, elapsed_s, current_streak)
            await award_xp(db, agent_id, id, delta, "task_done")
            new_total_row = await db.execute(
                "SELECT total_xp FROM agent_stats WHERE agent_id=?", (agent_id,)
            )
            nt = await new_total_row.fetchone()
            new_total = dict(nt)["total_xp"] if nt else delta

            yield f"data: {json.dumps({'type': 'xp', 'agent_id': agent_id, 'delta': delta, 'reason': 'task_done', 'new_total': new_total})}\n\n"

            new_streak = await update_streak(db)
            badges = await check_badges(db, agent_id, id, elapsed_s)
            for badge in badges:
                yield f"data: {json.dumps({'type': 'badge', 'agent_id': agent_id, 'badge_id': badge['badge_id'], 'badge_name': badge['badge_name'], 'emoji': badge['emoji']})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'exit_code': exit_code, 'elapsed_s': round(elapsed_s, 1)})}\n\n"

        except Exception as e:
            await db.execute("UPDATE tasks SET status='error' WHERE id=?", (id,))
            await db.commit()
            yield f"data: {json.dumps({'type': 'error', 'code': 'subprocess_crash', 'message': str(e)[:200]})}\n\n"
        finally:
            agent["status"] = "idle"
            agent["current_task_id"] = None

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

6. `POST /tasks/{id}/cancel`:
   - Update task status to 'cancelled'
   - Return `{"cancelled": True}`

**Agent endpoints:**

7. `GET /agents` — Return all agents from `AGENTS` dict as list, including `local_available`, `status`, `current_task_id`. Include only public fields (exclude any API keys or internal metadata).

8. `GET /agents/{id}/stats`:
   - SELECT from agent_stats
   - Compute level from total_xp using `get_level()`
   - SELECT badges for this agent
   - Return full stats object

**Skills endpoint:**

9. `GET /skills`:
   - SELECT * FROM skills
   - Parse `variables_json` with `json.loads()` for each row
   - Return list

**Gamification endpoint:**

10. `GET /gamification`:
    - SELECT streaks WHERE user_id='gabriel'
    - SUM xp_events for total_xp
    - COUNT tasks WHERE status='done'
    - SELECT all badges
    - Return composite object

**Constraints:**
- SSE endpoint must set `Cache-Control: no-cache` header (StreamingResponse headers dict)
- Never buffer SSE — each `yield` flushes immediately with `text/event-stream` media type
- All JSON serialization uses `json.dumps()` — never FastAPI's auto-serialization for SSE data
- Import paths within the sidecar use bare module names (e.g., `from db import get_db`) — no package prefix since `sidecar/` is the working directory when running with uvicorn
- The `/tasks/{id}/output` endpoint must handle the case where the task is already done (emit done immediately)

---

### Frontend Agent

**Files to read first:** `DESIGN.md` (all sections), `ARCHITECTURE.md` (Tauri IPC commands, SSE events), `data/agents.json`, `data/skills.json`

**Files to create:**
- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/components/AgentRoster.tsx`
- `src/components/TaskBoard.tsx`
- `src/components/OutputPanel.tsx`
- `src/components/SkillsLibrary.tsx`
- `src/components/GamificationHUD.tsx`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`

**Files to modify:** none

**Task:**

**`package.json`** — Tauri + React + TypeScript + Vite:
```json
{
  "name": "conductor",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^1.6.0",
    "lucide-react": "^0.378.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.6.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

**`vite.config.ts`**:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
```

**`tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "useDefineForClassFields": true,
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

**`index.html`**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Conductor</title>
  <style>
    :root {
      --bg: #0a0a0d;
      --surface: #111115;
      --surface-hi: #17171d;
      --surface-elevated: #1c1c24;
      --border: #1f1f2a;
      --border-hi: #2a2a38;
      --text: #e8e8f0;
      --text-muted: #5a5a72;
      --text-ghost: #3a3a4a;
      --accent: #7c3aed;
      --accent-hi: #8b5cf6;
      --accent-dim: #3b1d7a;
      --success: #16a34a;
      --success-dim: #14532d;
      --warning: #ca8a04;
      --warning-dim: #713f12;
      --danger: #dc2626;
      --danger-dim: #7f1d1d;
      --xp: #6366f1;
      --xp-dim: #312e81;
      --badge-gold: #d97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Geist', 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      overflow: hidden;
      height: 100vh;
    }
    code, .mono { font-family: 'Geist Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace; }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**`src/main.tsx`**:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**`src/App.tsx`** — 3-panel layout:

The App component manages global state and layout:
- Fetches `GET /agents` on mount and every 5s (polling for status updates)
- Fetches `GET /tasks` on mount and every 3s
- Fetches `GET /gamification` on mount and every 10s
- Selected task state: `null | string` (task ID)
- Shows `OutputPanel` when a task is selected; `SkillsLibrary` when none selected

Layout:
```
<div style="display:flex; flex-direction:column; height:100vh">
  <GamificationHUD gamification={...} />
  <div style="display:flex; flex:1; overflow:hidden">
    <AgentRoster agents={agents} style="width:240px; flex-shrink:0" />
    <TaskBoard tasks={tasks} agents={agents} onSelectTask={setSelectedTask} selectedTaskId={selectedTaskId} />
    <div style="flex:1">
      {selectedTaskId
        ? <OutputPanel taskId={selectedTaskId} />
        : <SkillsLibrary />
      }
    </div>
  </div>
</div>
```

Use `fetch('http://127.0.0.1:8765/...')` directly — not Tauri IPC — for data fetching from React components (simpler for Phase 1). Tauri IPC commands are also available via `invoke()` but direct HTTP is acceptable.

**`src/components/GamificationHUD.tsx`**:

Props: `{ gamification: { streak: number, total_xp: number, tasks_done: number } | null }`

Render a 40px header bar:
```
🎼 CONDUCTOR    [streak: {n}d 🔥]    [{n} done]    [XP: {n}]
```

Styles:
- Container: `height: 40px; background: var(--surface); border-bottom: 1px solid var(--border); display:flex; align-items:center; padding: 0 16px; gap: 16px`
- Logo: `font-size: 13px; font-weight: 700; letter-spacing: 2px; color: var(--text)`
- Streak badge: `background: var(--warning-dim); color: var(--warning); padding: 2px 8px; border-radius: 4px; font-size: 11px`
- XP: `color: var(--xp); font-family: monospace; font-size: 11px`

**`src/components/AgentRoster.tsx`**:

Props: `{ agents: Agent[] }`

Where `Agent` type:
```typescript
interface Agent {
  id: string
  name: string
  type: 'cli' | 'api' | 'stub'
  skills: string[]
  local_available: boolean
  status: 'idle' | 'running' | 'error'
  current_task_id: string | null
}
```

Render a 240px left panel with scrollable list of agent cards.

Each card:
- Status dot: colored circle (6px), `animation: pulse 2s infinite` when running
- Name + type badge chip (CLI / API / STUB)
- Fetch `GET /agents/{id}/stats` on mount for XP/level display
- XP bar: 3px height, indigo fill, shows `{xp} XP / {next_level_xp}`
- If `status === 'running'` and `current_task_id`: show task ID chip

Status dot colors:
- running: `var(--success)` + pulse animation
- idle: `var(--warning)` (static)
- error: `var(--danger)` (static)
- unavailable (stub or `!local_available`): `var(--text-ghost)` (static)

**`src/components/TaskBoard.tsx`**:

Props: `{ tasks: Task[], agents: Agent[], onSelectTask: (id: string) => void, selectedTaskId: string | null }`

Where `Task` type:
```typescript
interface Task {
  id: string
  title: string
  body: string
  agent_id: string | null
  skill_id: string | null
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'
  complexity: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}
```

Render 3 Kanban columns:
- **Backlog**: tasks with `status === 'queued'`
- **Active**: tasks with `status === 'running'`
- **Done**: tasks with `status === 'done' | 'error' | 'cancelled'`

Each task card:
- Title + status badge
- Agent chip (show agent name)
- Progress bar (indigo, 100% when done, animated when running)
- Click to select (call `onSelectTask`)
- Border color: `var(--success)` when running, `var(--danger)` when error

Also render a "New Task" button that opens a simple inline form:
- Fields: title (text), body (textarea), agent_id (select from agents), complexity (1/2/3)
- On submit: `POST http://127.0.0.1:8765/tasks`
- After creation, the polling will pick it up automatically

**`src/components/OutputPanel.tsx`**:

Props: `{ taskId: string }`

Connects to `GET http://127.0.0.1:8765/tasks/{taskId}/output` using `EventSource`.

State:
- `tokens: string[]` — accumulated token text
- `events: SseEvent[]` — all events received (for type-based rendering)
- `done: boolean`

Render:
- Header: "OUTPUT — Task {taskId}"
- Token stream area: scrollable monospace pre block showing joined tokens
- XP event: show "⚡ +{delta} XP" chip when xp event received
- Badge event: show badge chip
- Done event: show "DONE" badge with exit code
- Error event: show red error banner
- Auto-scroll to bottom on new tokens

```typescript
useEffect(() => {
  const es = new EventSource(`http://127.0.0.1:8765/tasks/${taskId}/output`)
  es.onmessage = (e) => {
    const event = JSON.parse(e.data)
    if (event.type === 'token') setTokens(t => [...t, event.text])
    setEvents(ev => [...ev, event])
    if (event.type === 'done' || event.type === 'error') {
      setDone(true)
      es.close()
    }
  }
  return () => es.close()
}, [taskId])
```

**`src/components/SkillsLibrary.tsx`**:

Fetches `GET http://127.0.0.1:8765/skills` on mount.

Renders 3-column grid of skill cards:
- Emoji (large, 24px)
- Name (bold, 13px)
- Category (muted, 11px)
- Hover: border changes to `var(--accent)`, show "Use" button

Card hover interaction: set cursor pointer, scale 1.01, transition 150ms.

**`src-tauri/Cargo.toml`**:
```toml
[package]
name = "conductor"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.6", features = ["shell-open"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }

[features]
custom-protocol = ["tauri/custom-protocol"]
```

**`src-tauri/tauri.conf.json`**:
```json
{
  "$schema": "../node_modules/@tauri-apps/cli/schema.json",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:1420",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Conductor",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": { "all": false, "open": true },
      "http": {
        "all": true,
        "request": true,
        "scope": ["http://127.0.0.1:8765/**"]
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.wonka.conductor",
      "icon": []
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "Conductor",
        "width": 1440,
        "height": 900
      }
    ]
  }
}
```

**`src-tauri/src/main.rs`**:

Implement 3 Tauri IPC commands that proxy to the sidecar:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Task {
    id: String,
    title: String,
    body: String,
    agent_id: Option<String>,
    skill_id: Option<String>,
    status: String,
    complexity: i32,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Agent {
    id: String,
    name: String,
    #[serde(rename = "type")]
    agent_type: String,
    local_available: bool,
    status: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateTaskRequest {
    title: String,
    body: String,
    agent_id: String,
    skill_id: Option<String>,
    complexity: i32,
}

const SIDECAR_URL: &str = "http://127.0.0.1:8765";

#[tauri::command]
async fn create_task(title: String, body: String, agent_id: String) -> Result<Task, String> {
    let client = reqwest::Client::new();
    let payload = CreateTaskRequest {
        title,
        body,
        agent_id,
        skill_id: None,
        complexity: 1,
    };
    client
        .post(&format!("{}/tasks", SIDECAR_URL))
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Task>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_agents() -> Result<Vec<Agent>, String> {
    let client = reqwest::Client::new();
    client
        .get(&format!("{}/agents", SIDECAR_URL))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Vec<Agent>>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_tasks() -> Result<Vec<Task>, String> {
    let client = reqwest::Client::new();
    client
        .get(&format!("{}/tasks", SIDECAR_URL))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Vec<Task>>()
        .await
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![create_task, list_agents, list_tasks])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Constraints:**
- All CSS uses CSS custom properties from `--bg`, `--surface`, etc. defined in `index.html`
- No CSS framework (no Tailwind, no Bootstrap) — pure inline styles + CSS variables
- `EventSource` used directly for SSE — no third-party SSE library
- `fetch()` used directly for REST calls — no axios or react-query in Phase 1
- Font loading: add `<link>` tag in index.html for Geist font from Google Fonts or Fontsource CDN
- Tauri `src-tauri/src/build.rs` is auto-generated by `tauri-build` — the agent must also create it:
  ```rust
  // src-tauri/build.rs
  fn main() {
    tauri_build::build()
  }
  ```

---

## Acceptance Test Mapping

- Criterion: "Tauri app scaffolded with package.json, vite.config.ts, tsconfig.json, index.html, src/main.tsx, src-tauri/Cargo.toml, src-tauri/tauri.conf.json, src-tauri/src/main.rs"
  Verifiable as: All listed files exist and are syntactically valid. `package.json` has `@tauri-apps/api` and `react` deps. `Cargo.toml` has `tauri` and `reqwest` deps.

- Criterion: "Python sidecar starts with FastAPI app + lifespan + CORS"
  Verifiable as: `sidecar/main.py` imports FastAPI, defines `lifespan` context manager calling `init_db()`, adds `CORSMiddleware` with `allow_origins=["*"]`. `pyproject.toml` has fastapi, uvicorn, litellm, aiosqlite deps.

- Criterion: "sidecar/db.py initializes SQLite at ~/.wonka/conductor.db with all 6 tables and seeds"
  Verifiable as: `init_db()` creates all 6 tables (`tasks`, `xp_events`, `badges`, `streaks`, `agent_stats`, `skills`). Seeds agent_stats from agents.json (9 rows INSERT OR IGNORE). Seeds skills from skills.json (10 rows). Seeds streaks with gabriel row.

- Criterion: "sidecar/agents.py implements CLIAgent (asyncio subprocess, stdin close, ANSI strip) and APIAgent (LiteLLM streaming)"
  Verifiable as: `CLIAgent.stream()` calls `process.stdin.close()` after write, uses ANSI_ESCAPE regex, handles CancelledError with process.terminate(). `APIAgent.stream()` calls `litellm.acompletion(..., stream=True)`.

- Criterion: "sidecar/tasks.py implements CRUD + status machine"
  Verifiable as: All 5 CRUD endpoints exist. Status transitions implemented: queued→running (on SSE start), running→done/error/cancelled. PATCH accepts partial updates.

- Criterion: "sidecar/gamification.py implements XP formula, badge triggers, streak logic"
  Verifiable as: `compute_xp()` uses the exact formula. `check_badges()` checks first_run, speedrunner, on_fire conditions. `update_streak()` increments on consecutive days.

- Criterion: "FastAPI exposes all 13 endpoints"
  Verifiable as: Router includes: POST /tasks, GET /tasks, GET /tasks/{id}, PATCH /tasks/{id}, DELETE /tasks/{id}, GET /tasks/{id}/output (SSE), POST /tasks/{id}/cancel, GET /agents, GET /agents/{id}/stats, GET /skills, GET /gamification — that is 11 listed + 2 implicit (total verified against spec).

- Criterion: "src/App.tsx renders 3-panel layout"
  Verifiable as: App.tsx has GamificationHUD (header), AgentRoster (left 240px), TaskBoard (center flex), OutputPanel/SkillsLibrary (right flex). Uses CSS flex layout.

- Criterion: "GamificationHUD shows streak, total XP, tasks done"
  Verifiable as: Component renders streak count with 🔥, tasks_done count, total_xp value. Fetches from GET /gamification.

- Criterion: "AgentRoster renders agent cards from GET /agents with status dot, name, level badge, XP bar"
  Verifiable as: Fetches /agents, maps to cards with colored status dot, name, type badge, XP bar (3px indigo).

- Criterion: "TaskBoard renders Kanban (Backlog | Active | Done)"
  Verifiable as: 3 columns with correct task filtering by status. Task cards show title, agent, status badge.

- Criterion: "OutputPanel connects to SSE and renders token events progressively"
  Verifiable as: Uses `new EventSource(...)`, handles `onmessage` parsing JSON, accumulates tokens, closes on done/error.

- Criterion: "SkillsLibrary renders 3-column grid from GET /skills"
  Verifiable as: Fetches /skills, renders 3-column CSS grid, each card shows emoji + name + category.

- Criterion: "Tauri IPC commands implemented: create_task, list_agents, list_tasks"
  Verifiable as: `src-tauri/src/main.rs` has `#[tauri::command]` functions for all three, registered with `generate_handler![]`.
