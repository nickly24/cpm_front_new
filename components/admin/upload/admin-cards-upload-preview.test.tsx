import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminCardsUploadPreview } from "./admin-cards-upload-preview";
import type { CardImportPreview } from "@/lib/admin/admin-upload-types";

function preview(question: string, answer: string): CardImportPreview {
  return {
    direction_id: 1,
    theme_id: 2,
    cards: [{ row: 2, question, answer, action: "create", errors: [], warnings: [] }],
    summary: {
      total_rows: 1, cards_to_import: 1, cards_create: 1,
      cards_warning: 0, cards_skip: 0, row_errors: 0,
    },
  };
}

describe("multiline card import preview", () => {
  it("renders editable question and answer with their internal blank lines", () => {
    const html = renderToStaticMarkup(
      <AdminCardsUploadPreview
        preview={preview("Вопрос\nуточнение", "Первый\n\nВторой; третий")}
        onCardChange={vi.fn()} onCommit={vi.fn()} onReset={vi.fn()}
      />,
    );
    expect(html).toMatch(/<textarea[^>]*aria-label="Вопрос, строка 2"[^>]*>Вопрос\nуточнение<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*aria-label="Ответ, строка 2"[^>]*>Первый\n\nВторой; третий<\/textarea>/);
    expect(html).not.toContain('value="Первый');
  });

  it("keeps edited multiline text as text even when it includes HTML", () => {
    const html = renderToStaticMarkup(
      <AdminCardsUploadPreview
        preview={preview("Вопрос", "Новая строка\n<script>bad()</script>\nПоследняя")}
        onCardChange={vi.fn()} onCommit={vi.fn()} onReset={vi.fn()}
      />,
    );
    expect(html).toContain("Новая строка\n&lt;script&gt;bad()&lt;/script&gt;\nПоследняя");
    expect(html).not.toContain("<script>");
  });
});
