import type { DraftQuestionNode } from "@/lib/admin/admin-test-drafts-types";

export interface MatchedAnswerSnippet {
  answerId: string;
  snippet: string;
  highlightTokens: string[];
}

export interface DraftQuestionSearchResult {
  questionId: string;
  index: number;
  questionText: string;
  score: number;
  highlightTokens: string[];
  matchedAnswers: MatchedAnswerSnippet[];
}

const SNIPPET_RADIUS = 24;

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenizeQuery(query: string) {
  return normalizeText(query)
    .split(" ")
    .filter(Boolean);
}

function buildSnippet(text: string, token: string) {
  const normalized = normalizeText(text);
  const index = normalized.indexOf(token);
  if (index < 0) return text.trim();

  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(normalized.length, index + token.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalized.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

function scoreTokenInQuestion(questionText: string, token: string) {
  const normalized = normalizeText(questionText);
  const index = normalized.indexOf(token);
  if (index < 0) return 0;
  return index === 0 ? 100 : 60;
}

function scoreTokenInAnswers(
  answers: DraftQuestionNode["answers"],
  token: string,
): { score: number; matches: MatchedAnswerSnippet[] } {
  let score = 0;
  const matches: MatchedAnswerSnippet[] = [];

  for (const answer of answers) {
    const normalized = normalizeText(answer.text);
    if (!normalized.includes(token)) continue;
    score += 25;
    matches.push({
      answerId: answer.id,
      snippet: buildSnippet(answer.text, token),
      highlightTokens: [token],
    });
  }

  return { score, matches };
}

function scoreQuestionNumber(index: number, token: string) {
  if (!/^\d+$/.test(token)) return 0;
  return Number(token) === index + 1 ? 80 : 0;
}

function scoreQuestion(question: DraftQuestionNode, index: number, tokens: string[]) {
  let score = 0;
  let allTokensInQuestion = true;
  const highlightTokens = new Set<string>();
  const matchedAnswersMap = new Map<string, MatchedAnswerSnippet>();

  for (const token of tokens) {
    let tokenMatched = false;

    const questionScore = scoreTokenInQuestion(question.text, token);
    if (questionScore > 0) {
      score += questionScore;
      tokenMatched = true;
      highlightTokens.add(token);
    } else {
      allTokensInQuestion = false;
    }

    const numberScore = scoreQuestionNumber(index, token);
    if (numberScore > 0) {
      score += numberScore;
      tokenMatched = true;
    }

    const answerMatch = scoreTokenInAnswers(question.answers, token);
    if (answerMatch.score > 0) {
      score += answerMatch.score;
      tokenMatched = true;
      for (const match of answerMatch.matches) {
        const existing = matchedAnswersMap.get(match.answerId);
        if (existing) {
          existing.highlightTokens = Array.from(
            new Set([...existing.highlightTokens, ...match.highlightTokens]),
          );
        } else {
          matchedAnswersMap.set(match.answerId, match);
        }
      }
    }

    if (!tokenMatched) {
      return null;
    }
  }

  if (allTokensInQuestion && tokens.length > 0) {
    score += 40;
  }

  return {
    questionId: question.id,
    index,
    questionText: question.text.trim() || "Текст вопроса",
    score,
    highlightTokens: Array.from(highlightTokens),
    matchedAnswers: Array.from(matchedAnswersMap.values()),
  } satisfies DraftQuestionSearchResult;
}

export function searchDraftQuestions(
  questions: DraftQuestionNode[],
  query: string,
): DraftQuestionSearchResult[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const results: DraftQuestionSearchResult[] = [];

  questions.forEach((question, index) => {
    const scored = scoreQuestion(question, index, tokens);
    if (scored) {
      results.push(scored);
    }
  });

  return results.sort((a, b) => b.score - a.score || a.index - b.index);
}

export function splitTextByTokens(text: string, tokens: string[]) {
  if (tokens.length === 0) return [{ text, highlight: false }];

  const normalizedTokens = tokens
    .map((token) => normalizeText(token))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (normalizedTokens.length === 0) {
    return [{ text, highlight: false }];
  }

  const normalizedText = text.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];

  for (const token of normalizedTokens) {
    let from = 0;
    while (from < normalizedText.length) {
      const index = normalizedText.indexOf(token, from);
      if (index < 0) break;
      ranges.push({ start: index, end: index + token.length });
      from = index + token.length;
    }
  }

  if (ranges.length === 0) {
    return [{ text, highlight: false }];
  }

  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
    }
  }

  const parts: Array<{ text: string; highlight: boolean }> = [];
  let cursor = 0;
  for (const range of merged) {
    if (cursor < range.start) {
      parts.push({ text: text.slice(cursor, range.start), highlight: false });
    }
    parts.push({ text: text.slice(range.start, range.end), highlight: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), highlight: false });
  }

  return parts.filter((part) => part.text.length > 0);
}
