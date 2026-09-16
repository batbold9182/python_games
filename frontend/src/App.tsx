import AuthScreen from './auth/AuthScreen'
import { useAuth } from './auth/useAuth'
import MainScreen from './screens/Main.Screen'

function App() {
  const { user, loading } = useAuth()

  return (
    <main className="container">
      {loading ? (
        <p className="muted">Loading…</p>
      ) : user ? (
        <MainScreen />
      ) : (
        <AuthScreen />
      )}
    </main>
  )
}

export default App
