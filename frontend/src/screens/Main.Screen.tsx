import { useState } from 'react'
import GuessScreen from './Guess.Screen'
import SnakeScreen from './Snake.Screen'
import TetrisScreen from './Tetris.Screen'
import PokerScreen from './Poker.Screen'
import ChessScreen from './Chess.Screen'

interface GameEntry {
  id: 'guess' | 'snake' | 'chess' | 'poker' | 'tetris'
  title: string
  description: string
  icon: string
  available: boolean
}

const GAMES: GameEntry[] = [
  {
    id: 'guess',
    title: 'Number Guessing Game',
    description: 'Guess the secret number in as few tries as possible.',
    icon: '🎯',
    available: true,
  },
  {
    id: 'snake',
    title: 'Snake',
    description: 'Classic snake.',
    icon: '🐍',
    available: false,
  },
  {
    id: 'chess',
    title: 'Chess',
    description: 'Play a game of chess.',
    icon: '♟️',
    available: false,
  },
  {
    id: 'poker',
    title: 'Poker',
    description: 'Play a game of poker.',
    icon: '🃏',
    available: false,
  },
  {
    id: 'tetris',
    title: 'Tetris',
    description: 'Play the classic game of Tetris.',
    icon: '🧩',
    available: false,
  }
]

type ScreenId = 'main' | GameEntry['id']

export default function MainScreen() {
  const [screen, setScreen] = useState<ScreenId>('main')

  if (screen === 'guess') return <GuessScreen onBack={() => setScreen('main')} />
  if (screen === 'snake') return <SnakeScreen onBack={() => setScreen('main')} />
  if (screen === 'chess') return <ChessScreen onBack={() => setScreen('main')} />
  if (screen === 'poker') return <PokerScreen onBack={() => setScreen('main')} />
  if (screen === 'tetris') return <TetrisScreen onBack={() => setScreen('main')} />

  return (
    <div className="hub">
      <div>
        <h1>Game Hub</h1>
        <p className="muted">Pick a game to play</p>
      </div>

      <div className="game-list">
        {GAMES.map((game) => (
          <button
            key={game.id}
            className="game-card"
            onClick={() => setScreen(game.id)}
            disabled={!game.available}
          >
            <span className="game-card-icon">{game.icon}</span>
            <span className="game-card-body">
              <span className="game-card-title">{game.title}</span>
              <span className="game-card-description">{game.description}</span>
            </span>
            {!game.available && <span className="badge">Soon</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
