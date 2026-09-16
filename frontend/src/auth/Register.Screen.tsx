import { useState, type FormEvent } from 'react'

import { useAuth } from './useAuth'

export default function RegisterScreen({ onSwitch }: { onSwitch: () => void }) {
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await register(username, email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="game-panel">
      <h1>Create account</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={50}
          required
          autoFocus
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          maxLength={100}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? '…' : 'Sign up'}
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
      <button className="back-button" type="button" onClick={onSwitch}>
        Already have an account? Sign in
      </button>
    </section>
  )
}
