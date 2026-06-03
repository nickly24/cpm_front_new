import type { ReviewItem } from "./test-review-types";

export function getStudentAnswerText(item: ReviewItem): string {
  const question = item.question;
  const answer = item.studentAnswer;

  if (!answer) {
    return "Ответ не дан";
  }

  if (question.type === "single") {
    const option = question.answers?.find(
      (entry) => entry.id === answer.selectedAnswer,
    );
    return option?.text ?? "Не выбран ответ";
  }

  if (question.type === "multiple") {
    const selected = answer.selectedAnswers ?? [];
    const labels = (question.answers ?? [])
      .filter((entry) => selected.includes(entry.id))
      .map((entry) => entry.text);

    return labels.length > 0 ? labels.join(", ") : "Не выбраны ответы";
  }

  return answer.textAnswer?.trim() || "Ответ не дан";
}

export function getCorrectAnswerText(item: ReviewItem): string | null {
  if (!item.correct) {
    return null;
  }

  const question = item.question;

  if (question.type === "text") {
    const values = item.correct.correctAnswers ?? [];
    return values.length > 0 ? values.join(", ") : "—";
  }

  const options = item.correct.answers;
  if (options?.length) {
    const labels = options
      .filter((entry) => entry.isCorrect)
      .map((entry) => entry.text);
    if (labels.length > 0) {
      return labels.join(", ");
    }
  }

  const fromQuestion = (question.answers ?? [])
    .filter((entry) => item.correct?.correctOptionIds?.includes(entry.id))
    .map((entry) => entry.text);

  return fromQuestion.length > 0 ? fromQuestion.join(", ") : "—";
}
