import { useState, type FormEvent } from 'react'
import { startNewGame, submitGuess, type NewGameResponse, type GuessResponse } from '../api'

type Status = 'idle' | 'playing' | 'won' | 'lost'

export default function GuessGame() {
  const [game, setGame] = useState<NewGameResponse | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [guessValue, setGuessValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [lastResult, setLastResult] = useState<GuessResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setError(null)
    try {
      const newGame = await startNewGame()
      setGame(newGame)
      setStatus('playing')
      setHistory([])
      setLastResult(null)
      setGuessValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    }
  }

  async function handleGuess(e: FormEvent) {
    e.preventDefault()
    if (!game) return

    const value = Number(guessValue)
    if (!Number.isInteger(value)) {
      setError('Enter a whole number')
      return
    }

    setError(null)
    try {
      const res = await submitGuess(game.game_id, value)
      setLastResult(res)
      setHistory((h) => [`${value} → ${res.result}`, ...h])
      setGuessValue('')
      if (res.result === 'correct') setStatus('won')
      else if (res.result === 'out_of_attempts') setStatus('lost')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const attemptsRemaining = lastResult ? lastResult.attempts_remaining : game?.max_attempts

  return (
    <section className="game-panel">
      <h1>Number Guessing Game</h1>

      {status === 'idle' && (
        <>
          <p className="muted">Guess a number between 1 and 100 in as few tries as you can.</p>
          <button className="btn btn-primary" onClick={handleStart}>
            Start game
          </button>
        </>
      )}

      {game && status === 'playing' && (
        <>
          <p className="attempts-badge">Attempts left: {attemptsRemaining}</p>
          <form className="guess-form" onSubmit={handleGuess}>
            <input
              className="guess-input"
              type="number"
              value={guessValue}
              onChange={(e) => setGuessValue(e.target.value)}
              min={game.low}
              max={game.high}
              placeholder={`${game.low}-${game.high}`}
              autoFocus
            />
            <button className="btn btn-primary" type="submit">
              Guess
            </button>
          </form>
          {lastResult && (
            <p className="hint">{lastResult.result === 'higher' ? '⬆ Go higher!' : '⬇ Go lower!'}</p>
          )}
        </>
      )}

      {status === 'won' && lastResult && (
        <div className="result result-success">
          <p>Correct! The number was {lastResult.target}.</p>
          <p className="score">Score: {lastResult.score}</p>
          <button className="btn btn-primary" onClick={handleStart}>
            Play again
          </button>
        </div>
      )}

      {status === 'lost' && lastResult && (
        <div className="result result-danger">
          <p>Out of attempts. The number was {lastResult.target}.</p>
          <button className="btn btn-primary" onClick={handleStart}>
            Try again
          </button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {history.length > 0 && (
        <ul className="history-list">
          {history.map((entry, i) => (
            <li key={i}>{entry}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
