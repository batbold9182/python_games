from fastapi import APIRouter, Depends

from core.deps import get_current_user
from database.database import get_db
from models.user import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def get_me(user=Depends(get_current_user), conn=Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, email, created_at FROM dbo.Users WHERE id = ?",
        (user["id"],),
    )
    row = cursor.fetchone()
    cursor.execute(
        "SELECT COALESCE(SUM(points), 0) FROM dbo.PointsLedgers WHERE user_id = ?",
        (user["id"],),
    )
    points = cursor.fetchone()[0]
    return UserPublic(
        id=row[0], username=row[1], email=row[2], points=points, created_at=row[3]
    )
