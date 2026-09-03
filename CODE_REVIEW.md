# Code review — `python` project

A learning-oriented walkthrough of the codebase as of 2026-09-03. Nothing here changes your
code; it explains what you have, what's good, and what to improve (and *why*), roughly in the
order worth doing it.

---

## 1. The big picture

You're building a **FastAPI** web service backed by **SQL Server**. The plan is a shared
user-account system plus several small games that mostly share one points system.

Three layers, and you've already sketched all three:

```
HTTP request
    │
    ▼
main.py              ← FastAPI "routes": functions decorated with @app.get(...) etc.
    │  calls
    ▼
database/database.py ← opens a connection to SQL Server via the pyodbc driver
    │  runs SQL
    ▼
SQL Server           ← the actual database (tables like dbo.Item)
```

- **FastAPI** turns Python functions into HTTP endpoints. It reads your type hints to validate
  input and to auto-generate interactive API docs at `http://127.0.0.1:8000/docs`.
- **pyodbc** is a low-level database driver. You write SQL strings yourself and get back rows
  of data. It is *not* an ORM — there's no automatic mapping between Python objects and tables.
- **SQL Server** stores the data. `dbo` is just the default schema name (namespace) inside the
  database; `dbo.Item` means "the `Item` table in the `dbo` schema".

### What happens on `GET /items`

1. A request arrives for `/items`. FastAPI matches it to `get_items()` in `main.py`.
2. `get_connection()` builds a connection string and calls `pyodbc.connect(...)` → a live
   connection to SQL Server.
3. `conn.cursor()` creates a cursor (a handle you run queries through and read results from).
4. `cursor.execute("SELECT * FROM dbo.Item")` sends the query.
5. `cursor.fetchall()` pulls every result row into memory as a list of `Row` objects.
6. `conn.close()` closes the connection.
7. `return {"items": [list(row) for row in rows]}` — FastAPI converts the dict to JSON and
   sends it back with status 200.

I could not run this endpoint live — it needs a running SQL Server with a `dbo.Item` table.
Everything below is from reading the code.

---

## 2. File by file

### `main.py`
```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from database.database import get_connection
app = FastAPI()


"/items is test endpoint"
@app.get("/items")
def get_items():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dbo.Item")
    rows = cursor.fetchall()
    conn.close()
    return {"items": [list(row) for row in rows]}
```
- `app = FastAPI()` is the application object. `fastapi dev main.py` looks for a variable
  named `app` in the file you point it at.
- `@app.get("/items")` registers the function below it as the handler for `GET /items`.
- Only `FastAPI` is actually used from all those imports — see P3.1.
- `"/items is test endpoint"` on its own line is a **string expression statement**: Python
  evaluates it and throws it away. It is not a comment and not a docstring (a docstring has to
  be the *first* statement inside the module, function, or class). See P3.2.

### `database/database.py`
```python
import pyodbc
import os

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    f"SERVER={os.getenv('DB_SERVER', 'localhost')};"
    f"DATABASE={os.getenv('DB_NAME', 'python')};"
    "Trusted_Connection=yes;"
)

def get_connection():
    return pyodbc.connect(CONN_STR)
```
- Good instinct: the server and database names come from **environment variables** with
  sensible fallbacks, so you don't hardcode machine-specific values.
- `Trusted_Connection=yes` means "log in as the current Windows user" (Windows auth), so
  there's no password in the string. Good.
- `CONN_STR` is built **once at import time**. That means `os.getenv` runs once, when the
  module is first imported — changing an env var later won't affect it. That's fine here, just
  worth knowing.
- `ODBC Driver 17 for SQL Server` *is* installed on your machine (I checked), so this works.
  See P2.4 for why you might still make it configurable.

### `models/user.py`, `models/game.py`, `models/leaderboard.py`
All **empty**. This is where your Pydantic models will live — see P2.1 for what that means and
what should go in each.

### `games/`
Empty directory, no files. Fine as a placeholder.

### `requirements.txt`
```
fastapi[standard]>=0.141,<0.142
pyodbc>=5.3,<6
```
- Good: version ranges are pinned, so `pip install -r requirements.txt` is reproducible.
- `[standard]` pulls in the extras most apps want: the `uvicorn` server, the `fastapi` CLI,
  `python-dotenv`, `python-multipart`, `jinja2`, `email-validator`, etc. That's why your venv
  has ~30 packages from a 2-line file.
- `<0.142` is a *very* tight ceiling (it blocks 0.142, 0.143, ...). `<0.2` or `<1` is the more
  common choice. Not wrong, just deliberate-looking — make sure you meant it.

### `.env`
Exists but is **empty (0 bytes)** — and nothing loads it anyway. See P1.2.

### `.vscode/settings.json`
```json
"python.defaultInterpreterPath": "${C:\\Users\\Batbold\\python}\\.venv\\Scripts\\python.exe"
```
`${...}` is VS Code's variable syntax, but `${C:\\Users\\Batbold\\python}` is not a real
variable, so VS Code uses it literally and the path is broken. Use the built-in
`${workspaceFolder}`:
```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}\\.venv\\Scripts\\python.exe",
  "python.terminal.activateEnvironment": true
}
```

---

## 3. What's already good

- **Layered layout.** Separating `database/` and `models/` from `main.py` is the right
  instinct — it's how real FastAPI projects are structured.
- **Config via environment variables**, not hardcoded machine names.
- **Pinned dependencies** in `requirements.txt`.
- **A virtualenv** (`.venv/`) so project packages don't pollute your system Python.
- **Windows auth** for the DB, so no password sitting in a string.

---

## 4. Issues & improvements

Format: **what** → **why it matters** → **how to fix** → **concept to learn**.

### P1 — correctness & security (do these first)

#### P1.1 — SQL: use explicit columns and parameters, never string-building

**What.** `SELECT *` plus `list(row)` returns data with no column names —
`["sword", 10, 1]` instead of `{"name": "sword", "price": 10, ...}`. The caller has to *guess*
the order, and the order silently changes if someone edits the table.

More importantly, the moment you add a filter like "get item by id", the tempting move is:
```python
cursor.execute(f"SELECT * FROM dbo.Item WHERE id = {item_id}")   # DANGER
```
If `item_id` ever comes from the user, they can pass `0 OR 1=1` (dump everything) or worse.
This is **SQL injection**, the #1 classic web vulnerability.

**How to fix.** Name your columns, and pass values as **parameters** with `?` placeholders —
the driver sends them separately from the SQL text, so they can never be interpreted as code:
```python
@app.get("/items/{item_id}")
def get_item(item_id: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, price FROM dbo.Item WHERE id = ?",
            (item_id,),
        )
        row = cursor.fetchone()
        columns = [c[0] for c in cursor.description]   # ['id', 'name', 'price']
    finally:
        conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Item not found")

    return dict(zip(columns, row))                     # {'id': 1, 'name': 'sword', 'price': 10}
```

**Concept to learn.** Parameterized queries / prepared statements; SQL injection.

#### P1.2 — Your `.env` is never loaded

**What.** `database.py` calls `os.getenv('DB_SERVER', ...)`, but nothing ever reads the `.env`
file into the environment, and `.env` is empty. So right now the env-var logic always falls
back to `localhost` / `python`. Neither `python` nor `uvicorn`/`fastapi dev` loads `.env`
automatically.

**How to fix.** `python-dotenv` is already installed. Load it once, as early as possible —
before anything reads env vars:
```python
# main.py, very top — before "from database.database import ..."
from dotenv import load_dotenv
load_dotenv()
```
Then put real values in `.env`:
```
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=python
```
A cleaner alternative once you have more settings: `pydantic-settings` (also already
installed) gives you a typed `Settings` class that reads `.env` and validates it.

**Concept to learn.** The 12-factor "config in the environment" idea; `.env` files are a dev
convenience, not something you deploy.

#### P1.3 — Close connections even when something fails

**What.** `get_items()` calls `conn.close()` on the last line. If `cursor.execute(...)` raises
(bad SQL, DB down), that line never runs and the connection leaks. Enough leaks and the DB
refuses new connections.

**How to fix (small).** `try/finally`, as in the P1.1 example — `finally` always runs.

**How to fix (better, the FastAPI way).** A dependency that yields a connection and cleans up
after the response:
```python
# database/database.py
def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
```
```python
# main.py
from fastapi import Depends

@app.get("/items")
def get_items(conn = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, price FROM dbo.Item")
    columns = [c[0] for c in cursor.description]
    return {"items": [dict(zip(columns, r)) for r in cursor.fetchall()]}
```
FastAPI calls `get_db()`, injects the connection, and runs the cleanup half after the
response is sent. Later you can swap in real **connection pooling** without touching routes.

**Concept to learn.** Context managers (`with` / `try...finally`), FastAPI dependency
injection (`Depends`), resource leaks.

#### P1.4 — Make it a git repo, and ignore the right things

**What.** This folder isn't under version control. When it becomes one, you must *not* commit
`.venv/` (huge, machine-specific), `__pycache__/` (generated), or `.env` (secrets/local
config).

**How to fix.**
```bash
cd C:/Users/Batbold/python
git init
```
Create `.gitignore`:
```
.venv/
__pycache__/
*.pyc
.env
.vscode/
```
Then `git add . && git commit -m "Initial commit"`.

**Concept to learn.** What belongs in version control (source + lockfiles) vs. what's
generated or secret.

#### P1.5 — (for when you build login) never store plaintext passwords

**What.** A user-account system means storing credentials. Plaintext passwords in a table is
a serious breach waiting to happen.

**How to fix.** Hash with a slow, salted algorithm — `bcrypt` or `argon2` (via `passlib`).
Store only the hash. For the API side, use FastAPI's OAuth2 password flow + JWT tokens rather
than inventing your own session scheme. Add this when you get there — just don't skip it.

**Concept to learn.** Password hashing (bcrypt/argon2), why salts matter, JWT.

### P2 — structure

#### P2.1 — What goes in `models/`

"Model" is an overloaded word. You actually have **two** kinds.

**(a) Pydantic models** — Python classes describing the *shape of data crossing your API*
(what a request body must contain, what a response looks like). These belong in `models/`:

```python
# models/user.py
from datetime import datetime
from pydantic import BaseModel, Field


class UserCreate(BaseModel):           # what the client sends to register
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8)


class UserPublic(BaseModel):           # what you send back — note: no password
    id: int
    username: str
    points: int
    created_at: datetime
```

Then routes get validation and docs for free:

```python
@app.post("/users", response_model=UserPublic, status_code=201)
def create_user(user: UserCreate):
    ...
```

**(b) The database schema** — the actual `CREATE TABLE` statements. With raw pyodbc these live
in `.sql` files (e.g. a `database/schema.sql` or numbered migration files), not in Python.

Keeping "API shape" and "DB shape" separate is a feature: you can add a column without
exposing it, or accept input you don't store verbatim (like a raw password).

#### P2.2 — A layout for "many games, shared points"

A shape that scales:

```
python/
├─ main.py                  # creates app, includes routers
├─ database/
│  ├─ database.py           # get_connection / get_db
│  └─ schema.sql            # CREATE TABLE statements
├─ models/                  # Pydantic models (user.py, game.py, ...)
├─ routers/
│  ├─ users.py              # APIRouter for /users/*
│  └─ leaderboard.py        # APIRouter for /leaderboard
└─ games/
   ├─ guess_number.py       # one module per game: its rules + its routes
   └─ tic_tac_toe.py
```

For the points system, prefer an **append-only ledger** over a single mutable `points`
column:
```sql
CREATE TABLE dbo.Users (
    id         INT IDENTITY PRIMARY KEY,
    username   NVARCHAR(32) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.PointsLedger (
    id         BIGINT IDENTITY PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES dbo.Users(id),
    game       NVARCHAR(50) NOT NULL,     -- which game caused this
    delta      INT NOT NULL,              -- +10, -5, ...
    reason     NVARCHAR(200) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```
A user's balance is `SELECT SUM(delta) FROM dbo.PointsLedger WHERE user_id = ?`. Why bother:
you get a full history ("where did my points go?"), it's safe under concurrent updates, and
you can never get a balance that doesn't match its transactions. If the `SUM` ever gets slow,
*then* add a cached balance column — but keep the ledger as the source of truth.

Games that don't use shared points just don't write to the ledger — that's your "exception"
case handled for free.

`main.py` then stays small:
```python
from fastapi import FastAPI
from routers import users, leaderboard
from games import guess_number

app = FastAPI()
app.include_router(users.router)
app.include_router(leaderboard.router)
app.include_router(guess_number.router)
```

#### P2.3 — `__init__.py`

Your imports (`from database.database import get_connection`) work today because Python 3
allows **namespace packages** (a folder without `__init__.py` can still be imported) and
`fastapi dev` puts the project root on the import path.

It's still worth adding an empty `__init__.py` to `database/`, `models/`, `routers/`,
`games/`:
- it makes each folder an explicit **regular package** (clearer intent, better tooling
  support),
- it's the place to put package-level shortcuts later (e.g. re-export the main classes),
- namespace packages have sharp edges once you have tests or multiple import roots.

#### P2.4 — Don't hardcode the ODBC driver name

Driver 17 works on your machine, but Driver **18** is current (it defaults to
`Encrypt=yes`, which matters for real servers), and a teammate or server may have a different
one installed. Make it configurable:
```python
driver = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
CONN_STR = (
    f"DRIVER={{{driver}}};"
    f"SERVER={os.getenv('DB_SERVER', 'localhost')};"
    f"DATABASE={os.getenv('DB_NAME', 'python')};"
    "Trusted_Connection=yes;"
    "Encrypt=no;"          # fine for localhost dev; revisit for a real server
)
```

### P3 — style & polish

#### P3.1 — Remove unused imports
`HTTPException`, `FileResponse`, `BaseModel`, `Field` in `main.py` are never used. Unused
imports mislead a reader about what the file does. Add them back when you actually use them
(you'll want `HTTPException` very soon).

#### P3.2 — Line 9 isn't a comment
```python
"/items is test endpoint"     # evaluated and discarded — does nothing
```
Use a real comment or a docstring:
```python
@app.get("/items")
def get_items():
    """Test endpoint: dump every row of dbo.Item."""
    ...
```
The docstring also shows up in `/docs`. Bonus: give the route a `tags=["debug"]` or delete it
once you have real endpoints.

#### P3.3 — Document how to run it
There's no `if __name__ == "__main__"` block and no note on how to start the server. Add a
short `README.md`:
````markdown
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
fastapi dev main.py        # http://127.0.0.1:8000/docs
```
````

#### P3.4 — Formatting / linting
Small things (blank lines, import grouping) — don't do these by hand. Add **ruff**:
```bash
pip install ruff
ruff check .        # finds unused imports, etc.
ruff format .       # auto-formats
```
Add `ruff` to a `requirements-dev.txt` so it's not shipped with the app.

---

## 5. Suggested next steps (smallest useful order)

1. `git init` + `.gitignore` + first commit (P1.4).
2. Add `load_dotenv()` and put real values in `.env` (P1.2); confirm you can connect.
3. Fix `.vscode/settings.json` interpreter path so VS Code picks up the venv.
4. Write `database/schema.sql` with the `Users` + `PointsLedger` tables (P2.2) and run it
   once against your database.
5. Write `models/user.py` with `UserCreate` / `UserPublic` (P2.1).
6. Replace `/items` with `POST /users` and `GET /users/{id}`, using `Depends(get_db)` and
   parameterized queries (P1.1, P1.3).
7. Add `ruff`, run `ruff check .`, clean up what it finds.
8. Only then start on the first game in `games/`.

---

## 6. Mini-glossary

| Term | One-liner |
|---|---|
| **ASGI** | The async server interface FastAPI speaks; `uvicorn` is the ASGI server that runs your app. |
| **Pydantic** | Library that validates data against Python type hints; FastAPI uses it for request/response models. |
| **ORM** | "Object-Relational Mapper" — maps table rows to objects automatically (SQLAlchemy). You're *not* using one; pyodbc is raw SQL. |
| **cursor** | The object you call `.execute()` / `.fetchall()` on to run a query and read results. |
| **parameterized query** | SQL with `?` placeholders; values are sent separately so they can't be executed as code (stops SQL injection). |
| **connection pool** | A reusable set of open DB connections, so each request doesn't pay the cost of connecting. |
| **virtualenv** | A project-local Python + packages folder (`.venv/`), isolated from system Python. |
| **namespace package** | A folder importable as a package *without* an `__init__.py` (Python 3 feature). |
| **dependency injection (`Depends`)** | FastAPI calls a function for you and passes its result into your route; used for DB connections, auth, etc. |
| **12-factor config** | Keep environment-specific settings (DB host, secrets) in env vars, not in code. |
