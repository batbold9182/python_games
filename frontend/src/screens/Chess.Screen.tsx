import ChessGame from '../games/ChessGame'

interface ChessScreenProps {
  onBack: () => void
}

export default function ChessScreen({ onBack }: ChessScreenProps) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <ChessGame />
    </div>
  )
}
