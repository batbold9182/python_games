import pyodbc
from fastapi import APIRouter, Depends, HTTPException, status

from core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from database.database import get_db
from models.auth import (
    AccessToken,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


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
    try:
        cursor.execute(
            "INSERT INTO dbo.Users (username, email, password_hash) "
            "OUTPUT INSERTED.id VALUES (?, ?, ?)",
            (body.username, body.email, hash_password(body.password)),
        )
        user_id = cursor.fetchone()[0]
        conn.commit()
    except pyodbc.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already taken",
        ) from None
    return _issue_token_pair(conn, user_id)


@router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, conn=Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, password_hash FROM dbo.Users WHERE email = ?",
        (body.email,),
    )
    row = cursor.fetchone()
    if row is None or not verify_password(body.password, row[1]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return AccessToken(access_token=create_access_token(row[0]))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, conn=Depends(get_db)):
    token_hash = hash_refresh_token(body.refresh_token)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE dbo.RefreshTokens SET revoked = 1 WHERE token_hash = ?",
        (token_hash,),
    )
    conn.commit()
