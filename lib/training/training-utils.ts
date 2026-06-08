import type { TrainingCard } from "./training-types";

export function calcProgressPercent(
  learned: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return Math.round((learned / total) * 100);
}

export function getProgressLabel(percent: number): string {
  if (percent >= 100) return "Изучено";
  if (percent >= 75) return "Почти готово";
  if (percent >= 40) return "В процессе";
  if (percent > 0) return "Начато";
  return "Не начато";
}

export function shuffleCards<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function splitCardsByLearned(cards: TrainingCard[]): {
  learned: TrainingCard[];
  unlearned: TrainingCard[];
} {
  const learned = cards.filter((c) => c.is_learned);
  const unlearned = cards.filter((c) => !c.is_learned);
  return { learned, unlearned };
}

export const FLASH_ONBOARDING_KEY = "flash_onboarding_seen";
