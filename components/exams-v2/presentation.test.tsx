import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResultSummary } from "./student";
import { QuestionProtocolCard, RoundVotes } from "./protocol";
import { RatingFreshnessNotice } from "./rating-freshness";
import { ErrorNotice } from "./shared";
import { ApiError } from "@/lib/api/client";
import type {
  AttemptResult,
  PresentedQuestion,
  Round,
} from "@/lib/exams-v2/types";

describe("safe exam result and protocol presentation", () => {
  it("shows grade zero after appeal and a worse retake as current facts", () => {
    const result: AttemptResult = {
      attemptId: 9,
      attemptNo: 2,
      grade: 0,
      rawTotal: 0.5,
      roundedTotal: 0,
      maxScore: 6,
      hasAppeal: true,
      completedAt: "2026-09-12T10:00:00Z",
      commission: [{ id: 1, fullName: "Экзаменатор" }],
    };
    const html = renderToStaticMarkup(<ResultSummary result={result} />);
    expect(html).toContain("Пересдача");
    expect(html).toContain("После апелляции");
    expect(html).toContain("0 / 5");
    expect(html).toContain("0,5");
  });
  it("renders public question and answer as plain text and never exposes hidden rounds to student", () => {
    const question: PresentedQuestion = {
      id: 1,
      sequenceNo: 1,
      purpose: "tie_breaker",
      partCode: "A",
      questionText: '<script>alert("x")</script>\nВопрос',
      answerText: "<b>Ответ</b>",
      weight: 2,
      cycleNo: 2,
      status: "consensus",
      consensus: 1,
      awardedPoints: 0,
      replacesPresentedQuestionId: null,
      round: {
        votes: [{ fullName: "Private examiner vote", value: 0 }],
      } as Round,
    };
    const html = renderToStaticMarkup(
      <QuestionProtocolCard question={question} />,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;Ответ&lt;/b&gt;");
    expect(html).not.toContain("Private examiner vote");
    expect(html).not.toContain("История голосования");
    expect(html).toContain("Баллы: 0");
  });
  it("shows all commission disagreements in a completed round", () => {
    const round: Round = {
      id: 1,
      roundNo: 2,
      status: "disputed",
      votesReceived: 2,
      votesRequired: 2,
      hasVoted: true,
      myVote: 0,
      votes: [
        { fullName: "Первый", value: 0 },
        { fullName: "Второй", value: 1 },
      ],
    };
    const html = renderToStaticMarkup(<RoundVotes round={round} />);
    expect(html).toContain("Расхождение");
    expect(html).toContain("Первый: 0");
    expect(html).toContain("Второй: 1");
  });
  it("labels rating freshness only as exams and displays correlation errors", () => {
    const html = renderToStaticMarkup(
      <RatingFreshnessNotice
        value={{
          scope: "exams",
          isStale: true,
          reason: "exam_data_changed",
          activeJobId: null,
        }}
      />,
    );
    expect(html).toContain("требуется пересчёт");
    expect(html).toContain("относится к экзаменам");
    expect(
      renderToStaticMarkup(
        <ErrorNotice
          error={
            new ApiError(
              "Ошибка",
              409,
              undefined,
              "config_modified",
              {},
              "trace-1",
            )
          }
        />,
      ),
    ).toContain("trace-1");
  });
});
