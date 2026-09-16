import { useState, type FormEvent } from 'react'

import { useAuth } from './useAuth'

export default function LoginScreen({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="game-panel">
      <h1>Sign in</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? '…' : 'Sign in'}
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
      {note && <p className="muted">{note}</p>}
      <button
        className="back-button"
        type="button"
        onClick={() => setNote('Password reset is coming soon.')}
      >
        Forgot password?
      </button>
      <button className="back-button" type="button" onClick={onSwitch}>
        Need an account? Sign up
      </button>
    </section>
  )
}
