import { useState } from 'react'

import LoginScreen from './Login.Screen'
import RegisterScreen from './Register.Screen'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  return mode === 'login' ? (
    <LoginScreen onSwitch={() => setMode('register')} />
  ) : (
    <RegisterScreen onSwitch={() => setMode('login')} />
  )
}
