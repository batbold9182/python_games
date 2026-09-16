import { tokenStorage } from './auth/tokenStorage'

const api = import.meta.env.VITE_API_BASE as string

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

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserPublic {
  id: number
  username: string
  email: string
  points: number
  created_at: string
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  return body?.detail ?? `Request failed (${res.status})`
}

// ---- auth ----

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<TokenPair> {
  const res = await fetch(`${api}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const res = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function logout(refresh_token: string): Promise<void> {
  await fetch(`${api}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  }).catch(() => {
    // best effort — clearing local tokens is what matters
  })
}

/**
 * fetch() that attaches the access token and, on a 401, refreshes once and retries.
 * Every protected call goes through this.
 */
async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) =>
    fetch(`${api}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  const { access, refresh } = tokenStorage.get()
  let res = await send(access)

  if (res.status === 401 && refresh) {
    const r = await fetch(`${api}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (r.ok) {
      const { access_token } = await r.json()
      tokenStorage.saveAccess(access_token)
      res = await send(access_token)
    } else {
      tokenStorage.clear() // refresh token is dead → force re-login
    }
  }
  return res
}

export async function getMe(): Promise<UserPublic> {
  const res = await authFetch('/users/me')
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

// ---- guessing game ----

export async function startNewGame(): Promise<NewGameResponse> {
  const res = await fetch(`${api}/guess/new`, { method: 'POST' })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function submitGuess(gameId: string, value: number): Promise<GuessResponse> {
  const res = await fetch(`${api}/guess/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}
