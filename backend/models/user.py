from datetime import datetime

from pydantic import BaseModel, Field


class CreateUser(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=6, max_length=100)


class UserPublic(BaseModel):
    id: int
    username: str
    email: str
    points: int
    created_at: datetime
