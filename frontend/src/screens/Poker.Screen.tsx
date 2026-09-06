import PokerGame from '../games/PokerGame'

interface PokerScreenProps {
  onBack: () => void
}

export default function PokerScreen({ onBack }: PokerScreenProps) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <PokerGame />
    </div>
  )
}
