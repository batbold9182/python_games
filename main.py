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

