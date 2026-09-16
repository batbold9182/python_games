import { useEffect, useState, type ReactNode } from 'react'

import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type UserPublic,
} from '../api'
import { AuthContext } from './auth-context'
import { tokenStorage } from './tokenStorage'

function hasToken(): boolean {
  const { access, refresh } = tokenStorage.get()
  return Boolean(access || refresh)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null)
  // loading is only true when we have a token and still need to verify it
  const [loading, setLoading] = useState(hasToken)

  useEffect(() => {
    if (!hasToken()) return
    getMe()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const t = await apiLogin(email, password)
    tokenStorage.save(t.access_token, t.refresh_token)
    setUser(await getMe())
  }

  async function register(username: string, email: string, password: string) {
    const t = await apiRegister(username, email, password)
    tokenStorage.save(t.access_token, t.refresh_token)
    setUser(await getMe())
  }

  async function logout() {
    const { refresh } = tokenStorage.get()
    if (refresh) await apiLogout(refresh)
    tokenStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
