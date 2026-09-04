const API_BASE = 'http://127.0.0.1:8000'

export interface NewGameResponse {
  game_id: string
  message: string
  low: number
  high: number
  max_attempts: number
}

export type GuessResult = 'higher' | 'lower' | 'correct' | 'out_of_attempts'

export interface GuessResponse {
  result: GuessResult
  attempts: number
  attempts_remaining: number
  score: number | null
  target: number | null
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  return body?.detail ?? `Request failed (${res.status})`
}

export async function startNewGame(): Promise<NewGameResponse> {
  const res = await fetch(`${API_BASE}/guess/new`, { method: 'POST' })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function submitGuess(gameId: string, value: number): Promise<GuessResponse> {
  const res = await fetch(`${API_BASE}/guess/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}
