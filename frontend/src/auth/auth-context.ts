import { createContext } from 'react'

import type { UserPublic } from '../api'

export interface AuthValue {
  user: UserPublic | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)
