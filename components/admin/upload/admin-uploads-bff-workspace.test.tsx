import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn(() => ({ user: { organizations: [{ id:7, name:"Сборная", divisions:[{id:11,name:"Основная"}] }] } })) }));
import { UploadBackgroundConfirmation, UploadJobSummary, type UploadBackgroundIntent } from "./admin-uploads-bff-workspace";
import type { UploadJob, UploadSession } from "@/lib/bff/uploads";

const scope = { actor_account_id: 9, organization_id: 7, division_id: 11 };
const session: UploadSession = { ...scope, id: "a".repeat(32), type: "exams.outside", owner: "exams", target_id: "42", revision: 3, owner_revision: 2, state: "preview", expires_at: "2099-01-01", created_at: "2026-10-09" };
const job: UploadJob = { ...scope, id: "b".repeat(32), session_id: session.id, type: session.type, owner: "exams", status: "outcome_unknown", attempt: 0, processed: 0, total: 0, created_at: "2026-10-09" };
const confirm = (intent: UploadBackgroundIntent) => renderToStaticMarkup(createElement(UploadBackgroundConfirmation, { intent, busy: false, onConfirm: vi.fn(), onCancel: vi.fn() }));

describe("explicit background import intent", () => {
  it("shows the original cabinet, target and preview revision before granting background access", () => {
    const html = confirm({ action: "commit", session });
    expect(html).toContain("Результаты экзамена вне LMS"); expect(html).toContain("Организация: Сборная"); expect(html).toContain("подразделение: Основная");
    expect(html).toContain("Выбранный объект: 42"); expect(html).toContain("Версия предпросмотра: 3");
    expect(html).toContain("после выхода из аккаунта"); expect(html).toContain("не отменяет уже применённые данные"); expect(html).toContain("Отмена");
  });
  it("makes recovery receipt-only and revoke non-rollback, without suggesting another apply", () => {
    const recovery = confirm({ action: "recover", job });
    expect(recovery).toContain("только проверка исходной квитанции"); expect(recovery).toContain("Данные не применятся повторно");
    const revoke = confirm({ action: "revoke", job });
    expect(revoke).toContain("не откатывает уже выполненные изменения"); expect(revoke).toContain("может завершиться одновременно");
  });
  it("continues the original confirmation with its original revision, rather than announcing a new import", () => {
    const html = confirm({ action: "confirmation", job, session: { ...session, revision: 99 }, originalRevision: 3 });
    expect(html).toContain("Версия предпросмотра: 3"); expect(html).not.toContain("Версия предпросмотра: 99");
    expect(html).toContain("Новый импорт не создаётся");
  });
  it("shows the saved Cards direction and new/existing theme when coordinator target_id is blank", () => {
    const cards = { ...session, type: "cards.xlsx", owner: "cards", target_id: "", preview: { direction_id: 17, preview: { direction_id: 17, create_new_theme: true, new_theme_name: "Сохранённая тема", theme_id: 0, theme_name_collision: false } } };
    const created = confirm({ action: "commit", session: cards });
    expect(created).toContain("Направление: ID 17"); expect(created).toContain("Новая тема: Сохранённая тема"); expect(created).not.toContain("Выбранный объект:");
    const existing = confirm({ action: "commit", session: { ...cards, preview: { preview: { direction_id: 17, theme_id: 91, create_new_theme: false } } } });
    expect(existing).toContain("Существующая тема: ID 91"); expect(existing).not.toContain("Новая тема:");
    const collision = confirm({ action: "commit", session: { ...cards, preview: { preview: { direction_id: 17, theme_id: 91, create_new_theme: true, theme_name_collision: true, new_theme_name: "Сохранённая тема" } } } });
    expect(collision).toContain("Существующая тема: Сохранённая тема · ID 91"); expect(collision).not.toContain("Новая тема:");
  });
  it("shows the native saved JSON test title/direction and makes absent preview data explicit", () => {
    const test = { ...session, type: "tests.json", owner: "tests", target_id: "", preview: { preview: { direction_id: 19, source_title: "Исходный заголовок", preview: { title: "Сохранённый тест", direction_id: 19, direction_name: "Физика" } } } };
    const html = confirm({ action: "commit", session: test });
    expect(html).toContain("Направление: Физика · ID 19"); expect(html).toContain("Название теста: Сохранённый тест"); expect(html).not.toContain("Исходный заголовок"); expect(html).not.toContain("Выбранный объект:");
    const absent = confirm({ action: "commit", session: { ...test, preview: undefined } });
    expect(absent).toContain("Направление: не указано в сохранённом предпросмотре"); expect(absent).toContain("Название теста: не указано в сохранённом предпросмотре"); expect(absent).not.toContain("Физика"); expect(absent).not.toContain("ID 19");
  });
});
describe("honest job progress", () => {
  it("preserves zero progress without declaring native completion and never renders private owner report fields", () => {
    const html = renderToStaticMarkup(createElement(UploadJobSummary, { job: { ...job, report: { password: "SECRET", grant_binding: "PRIVATE" } } }));
    expect(html).toContain("Обработано: 0 из 0"); expect(html).toContain("Завершение импорта пока не подтверждено");
    expect(html).toContain("Данные могли быть применены"); expect(html).not.toContain("SECRET"); expect(html).not.toContain("PRIVATE");
  });
  it("only labels owner-confirmed completion as applied", () => {
    for (const status of ["authorizing", "authorization_unknown", "queued", "running", "access_required", "revoked"]) {
      const html = renderToStaticMarkup(createElement(UploadJobSummary, { job: { ...job, status } }));
      expect(html).not.toContain("Применение подтверждено владельцем данных");
    }
    const html = renderToStaticMarkup(createElement(UploadJobSummary, { job: { ...job, status: "completed" } }));
    expect(html).toContain("Применение подтверждено владельцем данных");
  });
});
