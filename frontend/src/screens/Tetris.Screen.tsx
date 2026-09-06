import TetrisGame from '../games/TetrisGame'

interface TetrisScreenProps {
  onBack: () => void
}

export default function TetrisScreen({ onBack }: TetrisScreenProps) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <TetrisGame />
    </div>
  )
}
