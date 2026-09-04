from typing import Literal

from pydantic import BaseModel, Field

GuessResult = Literal["higher", "lower", "correct", "out_of_attempts"]


class NewGameResponse(BaseModel):
    game_id: str
    message: str
    low: int
    high: int
    max_attempts: int


class GuessRequest(BaseModel):
    value: int = Field(..., description="Your guess")


class GuessResponse(BaseModel):
    result: GuessResult
    attempts: int
    attempts_remaining: int
    score: int | None = None
    target: int | None = None
