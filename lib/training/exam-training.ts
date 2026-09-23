import { ApiError } from "@/lib/api/client";
import type { SectionStats, SectionStudyViewResponse, StudyFilter, TrainingCard, TrainingSectionNode } from "./training-types";

export function filterStudyCards(cards: TrainingCard[], mode: StudyFilter): TrainingCard[] {
  if (mode === "all") return cards;
  if (mode === "learned") return cards.filter((card) => card.status === "learned");
  if (mode === "stale") return cards.filter((card) => card.status === "answer_changed");
  return cards.filter((card) => card.status !== "learned");
}

export function trainingStats(cards: TrainingCard[]): SectionStats {
  const stats = { total: cards.length, learned: 0, unlearned: 0, answer_changed: 0, progress_percent: 0 };
  for (const card of cards) stats[card.status] += 1;
  stats.progress_percent = stats.total ? Math.round(stats.learned * 100 / stats.total) : 0;
  return stats;
}

export function studyBatches(cards: TrainingCard[], size: number) {
  return Array.from({ length: Math.ceil(cards.length / size) }, (_, index) => {
    const chunk = cards.slice(index * size, (index + 1) * size);
    return { index, from: index * size + 1, to: index * size + chunk.length, size: chunk.length, stats: trainingStats(chunk) };
  });
}

export function examSection(view: SectionStudyViewResponse): TrainingSectionNode {
  return { kind: "exam", refId: view.section_ref_id, name: view.section_name, exam_id: view.exam?.id,
    part_id: view.part_id ?? undefined, stats: view.stats, total_cards: view.stats.total,
    learned_cards: view.stats.learned, answer_changed_cards: view.stats.answer_changed,
    progress_percent: view.stats.progress_percent ?? 0 };
}

export function trainingError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  const messages: Record<string, string> = {
    training_disabled: "Подготовка по этому экзамену сейчас недоступна",
    exam_not_found: "Экзамен не найден",
    part_not_found: "Часть удалена из экзамена. Выберите другую часть.",
    exam_empty: "В экзамене пока нет карточек для подготовки",
    question_not_found: "Вопрос удалён из экзамена",
    content_changed: "Содержание карточки изменилось. Ознакомьтесь с обновлённым вопросом и ответом",
  };
  return (code && messages[code]) || (error instanceof Error ? error.message : "Не удалось загрузить карточки");
}

export function examPeriod(start?: string | null, end?: string | null): string {
  const format = (value: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short" }).format(new Date(value));
  if (!start && !end) return "Период не задан";
  return `${start ? format(start) : "…"} — ${end ? format(end) : "…"} · МСК`;
}
