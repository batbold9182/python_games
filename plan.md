# Auth (JWT) — step-by-step implementation guide

> **Part 1 (backend): ✅ DONE** — implemented and curl-tested (10 cases) on 2026-09-06.
> `core/security.py`, `core/deps.py`, `models/auth.py`, `routers/auth.py`, `routers/users.py`
> exist; `main.py` wires them in; `pytest` green.
>
> **Part 2 (frontend): ⬜ TODO** — `auth/` folder, `authFetch` wrapper, gated `App.tsx`. No
> backend changes needed. Scroll to "Part 2" below.

This walks through adding registration, login, and protected routes to the FastAPI backend,
using the `Users` and `RefreshTokens` tables in `backend/database/schema.sql`. The steps build
on each other and each is small enough to test before moving on.

**Reference points:**
- `backend/database/database.py` has `get_connection()` and `get_db()` (a FastAPI dependency
  that yields a connection and closes it in `finally`) — reuse `get_db` for every query, don't
  call `get_connection()` directly in routes.
- `backend/models/user.py` has `CreateUser` and `UserPublic`.

**The two-token idea, briefly:** a JWT **access token** is short-lived (15 min) and self-contained
— the server can verify it without a database lookup, just by checking its signature. That's
what makes JWTs fast, but it also means you can't revoke one early; it's just valid until it
expires. A **refresh token** is the opposite: a long-lived (30 day), opaque random string that
*is* looked up in the database on every use — that's what lets you revoke it (logout) and is
why `RefreshTokens` exists as a table instead of being another JWT. The client uses the access
token for every request, and only calls `/auth/refresh` with the refresh token when the access
token expires.

---

## Step 1 — Add the two new dependencies

Add to `backend/requirements.txt`:
```
bcrypt
pyjwt
pytest
```
> **Watch the name:** it's `pyjwt`, not `jwt`. `jwt` is a *different, unrelated* package on
> PyPI that also imports as `jwt` but has no `jwt.encode` — if you install it by mistake you'll
> get `AttributeError: module 'jwt' has no attribute 'encode'`.

`pytest` is Python's test runner (like Jest). See the **Testing** section at the bottom for how
it's set up — from here on, verify each step with a test file instead of a throwaway shell
command.
Then install:
```bash
cd backend
.venv\Scripts\pip install -r requirements.txt
```
- `bcrypt` hashes passwords — never store a plain password, and never write your own hashing.
  bcrypt automatically salts each hash, so two users with the same password get different
  hashes in the database.
- `pyjwt` encodes/decodes JWTs (signs them with a secret key so they can't be forged, and
  reads them back out).

## Step 2 — Add a JWT secret to `.env`

Add a line to `backend/.env`:
```
JWT_SECRET_KEY=<a long random string>
```
Generate one with:
```bash
.venv\Scripts\python -c "import secrets; print(secrets.token_hex(32))"
```
This is the key that signs every access token. Anyone who has it can forge tokens as any user,
so it must never be committed — `.env` is already in `.gitignore`, so you're covered.

## Step 3 — `backend/core/security.py`

Create `backend/core/__init__.py` (empty) and `backend/core/security.py`:

```python
import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET_KEY not set — add it to backend/.env")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    # Raises jwt.PyJWTError (expired, bad signature, malformed) — let the caller catch it.
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def new_refresh_token() -> tuple[str, str, datetime]:
    """Returns (raw_token_to_send_to_client, hash_to_store_in_db, expires_at)."""
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return raw, token_hash, expires_at


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()
```

**Why hash the refresh token before storing it?** Same reason as passwords: if your database
ever leaks, a raw refresh token in a row is a working login for whoever finds it. A hash isn't
usable to log in — you can only check "does this presented token hash to this row," which is
exactly what refreshing needs.

**Why `load_dotenv()` here too?** `os.getenv(...)` only sees variables already in the process
environment — `.env` files aren't automatic. `load_dotenv()` reads the file into `os.environ`.
`database.py` already calls it, but this module needs its own call so it works when imported on
its own (and so import order never matters). Run your commands from the `backend/` directory so
it finds `backend/.env`.

Test it with `pytest` (see the **Testing** section below) — `tests/test_security.py` already
covers hashing, token round-trips, and rejecting a garbage token:
```bash
.venv\Scripts\python -m pytest tests/test_security.py -v
``` 

## Step 4 — `backend/core/deps.py`

This is the dependency every protected route will use.

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.security import decode_access_token
from database.database import get_db

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    conn=Depends(get_db),
):
    try:
        payload = decode_access_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = int(payload["sub"])
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email FROM dbo.Users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return {"id": row[0], "username": row[1], "email": row[2]}
```

`HTTPBearer` reads the `Authorization: Bearer <token>` header for you — you never parse headers
by hand. Any route that adds `user = Depends(get_current_user)` as a parameter is now
protected: FastAPI runs this function first, and a request with no/bad token never reaches your
route body.

## Step 5 — `backend/models/auth.py`

```python
from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)  # public display name only
    email: str = Field(..., max_length=100)                  # the login identity
    password: str = Field(..., min_length=6, max_length=100)


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

## Step 6 — `backend/routers/auth.py`

```python
from fastapi import APIRouter, Depends, HTTPException, status

from core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from database.database import get_db
from models.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenPair, AccessToken

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_token_pair(conn, user_id: int) -> TokenPair:
    access_token = create_access_token(user_id)
    raw_refresh, refresh_hash, expires_at = new_refresh_token()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO dbo.RefreshTokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        (user_id, refresh_hash, expires_at),
    )
    conn.commit()
    return TokenPair(access_token=access_token, refresh_token=raw_refresh)


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, conn=Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO dbo.Users (username, email, password_hash) OUTPUT INSERTED.id VALUES (?, ?, ?)",
        (body.username, body.email, hash_password(body.password)),
    )
    user_id = cursor.fetchone()[0]
    conn.commit()
    return _issue_token_pair(conn, user_id)


@router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, conn=Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, password_hash FROM dbo.Users WHERE email = ?", (body.email,)
    )
    row = cursor.fetchone()
    if row is None or not verify_password(body.password, row[1]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return _issue_token_pair(conn, row[0])


@router.post("/refresh", response_model=AccessToken)
def refresh(body: RefreshRequest, conn=Depends(get_db)):
    token_hash = hash_refresh_token(body.refresh_token)
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT user_id FROM dbo.RefreshTokens
        WHERE token_hash = ? AND revoked = 0 AND expires_at > SYSUTCDATETIME()
        """,
        (token_hash,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    return AccessToken(access_token=create_access_token(row[0]))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, conn=Depends(get_db)):
    token_hash = hash_refresh_token(body.refresh_token)
    cursor = conn.cursor()
    cursor.execute("UPDATE dbo.RefreshTokens SET revoked = 1 WHERE token_hash = ?", (token_hash,))
    conn.commit()
```

**Why `OUTPUT INSERTED.id`?** SQL Server's way of getting back the auto-generated identity
value from an `INSERT` in the same round trip, instead of a separate `SELECT @@IDENTITY` query.

**Notice the pattern**: `register` and `login` both end by calling `_issue_token_pair` — that
shared helper is what actually creates the `RefreshTokens` row. Don't duplicate that insert in
both routes.

## Step 7 — Fill in `backend/routers/users.py`

```python
from fastapi import APIRouter, Depends

from core.deps import get_current_user
from database.database import get_db
from models.user import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def get_me(user=Depends(get_current_user), conn=Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, email, created_at FROM dbo.Users WHERE id = ?", (user["id"],)
    )
    row = cursor.fetchone()
    cursor.execute(
        "SELECT COALESCE(SUM(points), 0) FROM dbo.PointsLedgers WHERE user_id = ?", (user["id"],)
    )
    points = cursor.fetchone()[0]
    return UserPublic(id=row[0], username=row[1], email=row[2], points=points, created_at=row[3])
```

This is your first genuinely **protected** route — `Depends(get_current_user)` means a request
without a valid `Authorization: Bearer <token>` header never reaches the function body at all.

## Step 8 — Wire it into `backend/main.py`

```python
from routers import auth, guess, users

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(guess.router)
```
(`guess.router` is already there — just add the other two imports and `include_router` calls.)

## Step 9 — Test it

**Quick manual check:** start the server (`fastapi dev main.py` from `backend/`) and open
`http://127.0.0.1:8000/docs` — FastAPI auto-generates an interactive page for every route. Try
in order: `POST /auth/register` → copy the `access_token` → click the padlock on `GET /users/me`
and call it → `POST /auth/refresh` with the `refresh_token` → `POST /auth/logout` then refresh
again (should now `401`).

**The real test** — `tests/test_auth_flow.py`, run with `pytest`. This uses FastAPI's
`TestClient`, which runs your whole app in-process (no server to start) and lets you make
requests against it:

```python
import uuid

import pytest
from fastapi.testclient import TestClient

from database.database import get_connection
from main import app

client = TestClient(app)


@pytest.fixture
def new_user():
    """A unique account per test run, cleaned up afterward."""
    handle = f"test_{uuid.uuid4().hex[:8]}"
    yield {"username": handle, "email": f"{handle}@example.com", "password": "hunter22"}
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE r FROM dbo.RefreshTokens r JOIN dbo.Users u ON r.user_id = u.id WHERE u.email = ?", (f"{handle}@example.com",))
    cur.execute("DELETE FROM dbo.Users WHERE email = ?", (f"{handle}@example.com",))
    conn.commit()
    conn.close()


def test_register_login_me_refresh_logout(new_user):
    # register
    r = client.post("/auth/register", json=new_user)
    assert r.status_code == 201
    tokens = r.json()
    assert "access_token" in tokens and "refresh_token" in tokens

    # password was hashed, not stored raw
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM dbo.Users WHERE email = ?", (new_user["email"],))
    assert cur.fetchone()[0].startswith("$2b$")
    conn.close()

    # login with email + password also works
    r = client.post("/auth/login", json={"email": new_user["email"], "password": new_user["password"]})
    assert r.status_code == 200
    r = client.post("/auth/login", json={"email": new_user["email"], "password": "wrong"})
    assert r.status_code == 401

    # protected route with the token
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}
    r = client.get("/users/me", headers=auth)
    assert r.status_code == 200
    assert r.json()["username"] == new_user["username"]
    assert r.json()["points"] == 0

    # protected route without a token
    assert client.get("/users/me").status_code in (401, 403)
    assert client.get("/users/me", headers={"Authorization": "Bearer garbage"}).status_code == 401

    # refresh gives a new access token
    r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200 and "access_token" in r.json()

    # logout revokes it
    client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 401
```

Run everything with:
```bash
.venv\Scripts\python -m pytest -v
```

## Checklist

- [x] `bcrypt`, `pyjwt`, `pytest` added to `requirements.txt` and installed
- [x] `JWT_SECRET_KEY` in `.env`
- [x] `core/__init__.py`, `core/security.py`  → `pytest tests/test_security.py` green
- [x] `core/deps.py`
- [x] `models/auth.py`
- [x] `routers/auth.py` (register, login, refresh, logout)
- [x] `routers/users.py` (`GET /users/me`)
- [x] `main.py` wired up
- [x] verified end to end with curl (register, dup→409, login, wrong-pw→401, /users/me with/without token, refresh, logout, revoked→401)
- [ ] *(optional)* add `tests/test_auth_flow.py` for a permanent regression test — code is in "Step 9" above

---

## Testing (pytest setup)

Already wired up in this repo:

- **`backend/pyproject.toml`** tells pytest where things are:
  ```toml
  [tool.pytest.ini_options]
  pythonpath = ["."]      # so `from core.security import ...` works from test files
  testpaths = ["tests"]   # where pytest looks for tests
  ```
- **`backend/tests/`** holds the test files. pytest auto-discovers any file named `test_*.py`
  and any function named `test_*` inside it — no registration, no config per file.

**How to run** (from `backend/`):
```bash
.venv\Scripts\python -m pytest          # run everything
.venv\Scripts\python -m pytest -v       # verbose — one line per test
.venv\Scripts\python -m pytest tests/test_security.py       # one file
.venv\Scripts\python -m pytest -k refresh                   # only tests with "refresh" in the name
```

**Anatomy of a test** — it's just a function starting with `test_` that uses `assert`:
```python
def test_verify_password():
    h = hash_password("hunter2")
    assert verify_password("hunter2", h) is True
    assert verify_password("wrong", h) is False
```
When an `assert` fails, pytest shows you both sides of the comparison and stops that test (other
tests still run). `with pytest.raises(SomeError):` is how you assert that a block *should* throw.

**Fixtures** (`@pytest.fixture`) are reusable setup/teardown — the `new_user` fixture in
`test_auth_flow.py` hands each test a fresh unique username and deletes it afterward, so tests
don't collide or leave junk in the database. A test "asks for" a fixture by naming it as a
parameter.

**Two kinds of tests you'll write here:**
- *Unit* — `tests/test_security.py`: pure functions, no database, no server. Fast.
- *Integration* — `tests/test_auth_flow.py`: uses `TestClient(app)` to run the whole FastAPI
  app in-process and make real requests against real routes (hitting the real dev database).
  Slower, but proves the pieces actually work together.

---

# Part 2 — Frontend auth (login / signup, gated app)

**Backend needs zero changes** — it already returns both tokens in the response body and
reads the refresh token from the request body. Decisions made:

- **Require login** — no hub or games until signed in.
- **localStorage** for both tokens; on a `401`, try `/auth/refresh` once, then retry.

The two *screens* are the small part. The real pieces are `tokenStorage`, the `authFetch`
wrapper in `api.ts`, and `AuthContext`. Build in this order.

## Step 1 — `frontend/src/auth/tokenStorage.ts`

Every `localStorage` call can throw (private windows, storage disabled) — wrap them all.

```ts
const ACCESS = 'access_token'
const REFRESH = 'refresh_token'

export const tokenStorage = {
  get(): { access: string | null; refresh: string | null } {
    try {
      return { access: localStorage.getItem(ACCESS), refresh: localStorage.getItem(REFRESH) }
    } catch {
      return { access: null, refresh: null }
    }
  },
  save(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS, access)
      localStorage.setItem(REFRESH, refresh)
    } catch {
      // ignore — user just won't stay logged in across reloads
    }
  },
  saveAccess(access: string) {
    try {
      localStorage.setItem(ACCESS, access)
    } catch {}
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS)
      localStorage.removeItem(REFRESH)
    } catch {}
  },
}
```

## Step 2 — extend `frontend/src/api.ts`

Add the types, the auth calls, and one `authFetch` wrapper that every *protected* request goes
through.

```ts
import { tokenStorage } from './auth/tokenStorage'

const api = import.meta.env.VITE_API_BASE as string

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserPublic {
  id: number
  username: string
  email: string
  points: number
  created_at: string
}

// ... keep the existing readError(), NewGameResponse, GuessResponse, etc. ...

export async function register(username: string, email: string, password: string): Promise<TokenPair> {
  const res = await fetch(`${api}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const res = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function logout(refresh_token: string): Promise<void> {
  await fetch(`${api}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  }).catch(() => {})
}

// Fetch that attaches the access token and refreshes once on a 401.
async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) =>
    fetch(`${api}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  const { access, refresh } = tokenStorage.get()
  let res = await send(access)

  if (res.status === 401 && refresh) {
    const r = await fetch(`${api}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (r.ok) {
      const { access_token } = await r.json()
      tokenStorage.saveAccess(access_token)
      res = await send(access_token)
    } else {
      tokenStorage.clear() // refresh token is dead → force re-login
    }
  }
  return res
}

export async function getMe(): Promise<UserPublic> {
  const res = await authFetch('/users/me')
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}
```

**Why a wrapper, not per-call code:** every future protected call (`/matches`, `/leaderboard`,
the points-aware guess game) goes through `authFetch` and gets the token + auto-refresh for
free. You write the refresh dance once.

## Step 3 — `frontend/src/auth/AuthContext.tsx`

Holds the user, exposes `login` / `register` / `logout`, and rehydrates on page load.

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getMe, login as apiLogin, register as apiRegister, logout as apiLogout, type UserPublic } from '../api'
import { tokenStorage } from './tokenStorage'

interface AuthValue {
  user: UserPublic | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null)
  const [loading, setLoading] = useState(true)

  // page load: if we have a token, try to become logged-in again
  useEffect(() => {
    const { access, refresh } = tokenStorage.get()
    if (!access && !refresh) {
      setLoading(false)
      return
    }
    getMe()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const t = await apiLogin(email, password)
    tokenStorage.save(t.access_token, t.refresh_token)
    setUser(await getMe())
  }

  async function register(username: string, email: string, password: string) {
    const t = await apiRegister(username, email, password)
    tokenStorage.save(t.access_token, t.refresh_token)
    setUser(await getMe())
  }

  async function logout() {
    const { refresh } = tokenStorage.get()
    if (refresh) await apiLogout(refresh)
    tokenStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
```

## Step 4 — the screens

`frontend/src/auth/AuthScreen.tsx` — toggles between the two:
```tsx
import { useState } from 'react'
import LoginScreen from './Login.Screen'
import RegisterScreen from './Register.Screen'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  return mode === 'login' ? (
    <LoginScreen onSwitch={() => setMode('register')} />
  ) : (
    <RegisterScreen onSwitch={() => setMode('login')} />
  )
}
```

`frontend/src/auth/Login.Screen.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'

export default function LoginScreen({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="game-panel">
      <h1>Sign in</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" value={email}
               onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <input type="password" placeholder="Password" value={password}
               onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? '…' : 'Sign in'}
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
      <button className="back-button" onClick={onSwitch}>Need an account? Sign up</button>
    </section>
  )
}
```

`frontend/src/auth/Register.Screen.tsx` — same shape, plus a `username` field, and the input
constraints matching the backend so the user gets told *before* the request:
```tsx
// ...same imports and state, plus:
const [username, setUsername] = useState('')

// in the form, before email:
<input placeholder="Username" value={username} minLength={3} maxLength={50} required
       onChange={(e) => setUsername(e.target.value)} />
// password input: add minLength={6}
// submit calls: await register(username, email, password)
```

The API returns `{"detail": "..."}` on failure — `readError()` already pulls that out, so a
duplicate email shows "Username or email already taken", a bad login shows "Invalid email or
password".

## Step 5 — wire it in

`frontend/src/main.tsx`:
```tsx
import { AuthProvider } from './auth/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
```

`frontend/src/App.tsx` — the gate:
```tsx
import { useAuth } from './auth/AuthContext'
import AuthScreen from './auth/AuthScreen'
import MainScreen from './screens/Main.Screen'

function App() {
  const { user, loading } = useAuth()
  return (
    <main className="container">
      {loading ? <p className="muted">Loading…</p> : user ? <MainScreen /> : <AuthScreen />}
    </main>
  )
}

export default App
```

## Step 6 — show who's logged in

In `frontend/src/screens/Main.Screen.tsx`, add a small header above the game list:
```tsx
import { useAuth } from '../auth/AuthContext'
// ...
const { user, logout } = useAuth()
// ...
<div className="hub-header">
  <span>{user?.username} · {user?.points ?? 0} pts</span>
  <button className="back-button" onClick={logout}>Sign out</button>
</div>
```

## Step 7 — `frontend/src/index.css`

```css
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.auth-form input {
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}

.auth-form input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-dim);
}
```

## Step 8 — test it

```bash
cd frontend
npm run build      # tsc + vite build, must be clean
npm run lint       # oxlint
npm run dev        # then open http://localhost:5173
```

With the **backend running** (`fastapi dev main.py` from `backend/`):

1. You see the Sign-in screen (not the hub).
2. "Sign up" → register → lands on the hub, header shows your username + 0 pts.
3. **Reload the page** → still on the hub (token persisted).
4. Play the guessing game → still works (it doesn't use auth yet).
5. "Sign out" → back to Sign-in. Sign in again → hub.
6. Bad password → "Invalid email or password". Duplicate email on signup → "already taken".
7. *(refresh path)* DevTools → Application → Local Storage → change `access_token` to garbage →
   navigate so `getMe()` runs → it should silently refresh and still work. Then also break
   `refresh_token` → next protected call bounces you to Sign-in.

## Checklist

- [ ] `src/auth/tokenStorage.ts`
- [ ] `src/api.ts` — `TokenPair` / `UserPublic` types, `register` / `login` / `logout` / `getMe`, `authFetch`
- [ ] `src/auth/AuthContext.tsx` — `AuthProvider` + `useAuth`
- [ ] `src/auth/AuthScreen.tsx`, `Login.Screen.tsx`, `Register.Screen.tsx`
- [ ] `main.tsx` wrapped in `<AuthProvider>`
- [ ] `App.tsx` gate (loading / user / AuthScreen)
- [ ] `Main.Screen.tsx` header with username + points + Sign out
- [ ] `index.css` — `.auth-form`, `.hub-header`
- [ ] `npm run build` + `npm run lint` clean
- [ ] all 7 test steps pass

**After this:** `award_points()` + `UserGameStats` on the backend and auth on `/guess/*` so the
guessing game actually banks points ([ARCHITECTURE §6](architecture/ARCHITECTURE.MD#6-points-system)).
