# python_games

A "Game Hub" — sign in, play small games, earn points — built while learning Python.

- **`backend/`** — FastAPI + SQL Server (JWT auth, per-game points, event-sourced matches)
- **`frontend/`** — React + TypeScript + Vite
- **[`architecture/ARCHITECTURE.MD`](architecture/ARCHITECTURE.MD)** — the full design: schema, structure, auth flow, points, scaling, game AI, current status
- **[`plan.md`](plan.md)** — step-by-step auth guide: Part 1 backend (done), Part 2 frontend (todo)

## Run it

```bash
# backend
cd backend
python -m venv .venv && .venv\Scripts\pip install -r requirements.txt
fastapi dev main.py            # http://127.0.0.1:8000/docs

# frontend (separate terminal)
cd frontend
npm install && npm run dev     # http://localhost:5173
```
