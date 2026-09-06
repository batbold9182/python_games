import SnakeGame from '../games/SnakeGame'

interface SnakeScreenProps {
  onBack: () => void
}

export default function SnakeScreen({ onBack }: SnakeScreenProps) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <SnakeGame />
    </div>
  )
}
