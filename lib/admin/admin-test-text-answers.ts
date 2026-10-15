import type { AdminTestQuestion } from "./admin-tests-types";

export interface TextAnswerIssue {
  answerIndex?: number;
  message: string;
}

// Match Go strings.TrimSpace/strings.ToLower used by the Tests owner, including
// U+0085, dotted I and context-independent sigma. JS trim/lower differ here.
function aliasKey(value: string): string {
  const trimmed = value.replace(/^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g, "");
  return Array.from(trimmed, char => char === "İ" ? "i" : char.toLowerCase()).join("");
}

export function textAnswerIssue(question: Pick<AdminTestQuestion, "type" | "correctAnswers">): TextAnswerIssue | null {
  if (question.type !== "text") return null;
  const answers = question.correctAnswers || [];
  if (answers.length < 1) return { message: "Добавьте хотя бы один правильный текстовый ответ." };
  if (answers.length > 50) return { message: "Допустимо не больше 50 правильных текстовых ответов." };
  const seen = new Map<string, number>();
  for (let index = 0; index < answers.length; index++) {
    const answer = answers[index], key = aliasKey(answer);
    let message: string | undefined;
    if (!key) message = "Заполните правильный ответ или удалите пустой вариант.";
    else if (Array.from(answer).length > 1000) message = "Правильный ответ должен содержать не больше 1000 символов.";
    else if (answer.includes("\0") || /[\uD800-\uDFFF]/u.test(answer)) message = "Удалите недопустимый символ из правильного ответа.";
    else if (seen.has(key)) message = `Этот ответ повторяет вариант №${seen.get(key)! + 1}. Регистр и пробелы по краям не учитываются.`;
    if (message) return { answerIndex: index, message };
    seen.set(key, index);
  }
  return null;
}

export function testTextAnswerIssue(questions: AdminTestQuestion[]): (TextAnswerIssue & { questionIndex: number }) | null {
  for (let index = 0; index < questions.length; index++) {
    const issue = textAnswerIssue(questions[index]);
    if (issue) return { ...issue, questionIndex: index, message: `Вопрос №${index + 1}${issue.answerIndex === undefined ? "" : `, ответ №${issue.answerIndex + 1}`}: ${issue.message}` };
  }
  return null;
}

export function assertTestTextAnswers(questions: AdminTestQuestion[]): void {
  const issue = testTextAnswerIssue(questions);
  if (issue) throw new Error(issue.message);
}
