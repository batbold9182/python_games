import { useState, type FormEvent } from 'react'
import { startNewGame, submitGuess, type NewGameResponse, type GuessResponse } from './api'

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
      setHistory((h) => [...h, `${value} -> ${res.result}`])
      setGuessValue('')
      if (res.result === 'correct') setStatus('won')
      else if (res.result === 'out_of_attempts') setStatus('lost')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const attemptsRemaining = lastResult ? lastResult.attempts_remaining : game?.max_attempts

  return (
    <main style={{ maxWidth: 420, margin: '48px auto', fontFamily: 'system-ui', textAlign: 'center' }}>
      <h1>Number Guessing Game</h1>

      {status === 'idle' && <button onClick={handleStart}>Start game</button>}

      {game && status === 'playing' && (
        <>
          <p>{game.message}</p>
          <p>Attempts left: {attemptsRemaining}</p>
          <form onSubmit={handleGuess}>
            <input
              type="number"
              value={guessValue}
              onChange={(e) => setGuessValue(e.target.value)}
              min={game.low}
              max={game.high}
              autoFocus
            />
            <button type="submit">Guess</button>
          </form>
          {lastResult && (
            <p>{lastResult.result === 'higher' ? 'Go higher!' : 'Go lower!'}</p>
          )}
        </>
      )}

      {status === 'won' && lastResult && (
        <>
          <p>Correct! The number was {lastResult.target}.</p>
          <p>Score: {lastResult.score}</p>
          <button onClick={handleStart}>Play again</button>
        </>
      )}

      {status === 'lost' && lastResult && (
        <>
          <p>Out of attempts. The number was {lastResult.target}.</p>
          <button onClick={handleStart}>Try again</button>
        </>
      )}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {history.length > 0 && (
        <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, marginTop: 24 }}>
          {history.map((entry, i) => (
            <li key={i}>{entry}</li>
          ))}
        </ul>
      )}
    </main>
  )
}
