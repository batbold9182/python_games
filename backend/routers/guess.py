from uuid import uuid4

from fastapi import APIRouter, HTTPException

from games.number_guessing_game.guess import HIGH, LOW, MAX_ATTEMPTS, GuessGame
from models.game import GuessRequest, GuessResponse, NewGameResponse

router = APIRouter(prefix="/guess", tags=["number-guessing-game"])

# In-memory game sessions, keyed by game_id. Fine for a single dev process;
# resets on restart and won't work if you ever run multiple server workers.
_games: dict[str, GuessGame] = {}


@router.post("/new", response_model=NewGameResponse)
def new_game() -> NewGameResponse:
    game_id = str(uuid4())
    _games[game_id] = GuessGame.new()
    return NewGameResponse(
        game_id=game_id,
        message=f"Guess a number between {LOW} and {HIGH}.",
        low=LOW,
        high=HIGH,
        max_attempts=MAX_ATTEMPTS,
    )


@router.post("/{game_id}", response_model=GuessResponse)
def make_guess(game_id: str, body: GuessRequest) -> GuessResponse:
    game = _games.get(game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.finished:
        raise HTTPException(status_code=400, detail="Game already finished")
    if not (LOW <= body.value <= HIGH):
        raise HTTPException(status_code=422, detail=f"Guess must be between {LOW} and {HIGH}")

    result = game.guess(body.value)
    attempts_remaining = max(game.max_attempts - game.attempts, 0)

    response = GuessResponse(
        result=result,
        attempts=game.attempts,
        attempts_remaining=attempts_remaining,
        score=game.score() if result == "correct" else None,
        target=game.target if game.finished else None,
    )

    if game.finished:
        del _games[game_id]

    return response
