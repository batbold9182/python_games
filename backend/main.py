from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.database import get_connection
from routers import auth, guess, users

app = FastAPI()

cors = {
    "allow_origins": ["*"],
    "allow_credentials": False,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

app.add_middleware(CORSMiddleware, **cors)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(guess.router)


@app.get("/items")
def get_items():
    """Test endpoint: dump every row of dbo.Item."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM dbo.Item")

    rows = cursor.fetchall()

    conn.close()

    return {"items": [list(row) for row in rows]}
