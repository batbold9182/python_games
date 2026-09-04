import random
from dataclasses import dataclass

LOW = 1
HIGH = 100
MAX_ATTEMPTS = 10


@dataclass
class GuessGame:
    target: int
    max_attempts: int = MAX_ATTEMPTS
    attempts: int = 0
    finished: bool = False

    @classmethod
    def new(cls, low: int = LOW, high: int = HIGH, max_attempts: int = MAX_ATTEMPTS) -> "GuessGame":
        return cls(target=random.randint(low, high), max_attempts=max_attempts)

    def guess(self, value: int) -> str:
        if self.finished:
            raise ValueError("game already finished")

        self.attempts += 1

        if value == self.target:
            self.finished = True
            return "correct"

        if self.attempts >= self.max_attempts:
            self.finished = True
            return "out_of_attempts"

        return "higher" if value < self.target else "lower"

    def score(self) -> int:
        return max(100 - (self.attempts - 1) * 10, 10)
