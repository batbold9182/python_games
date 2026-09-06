import GuessGame from '../games/GuessGame'

interface GuessScreenProps {
  onBack: () => void
}

export default function GuessScreen({ onBack }: GuessScreenProps) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <GuessGame />
    </div>
  )
}
