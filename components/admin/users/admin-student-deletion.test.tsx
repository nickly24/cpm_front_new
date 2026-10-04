// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { AdminStudentDeletionDialog, AdminStudentDeletionManager } from "./admin-student-deletion";
import * as api from "@/lib/admin/student-deletion-api";
import { ApiError } from "@/lib/api/client";
import { deletionStorageKey, DELETION_POLL_MS } from "@/lib/admin/use-student-deletion-jobs";
import { previewFixture, jobFixture } from "@/lib/admin/student-deletion-test-fixtures";
import type { DeletionStudent } from "@/lib/admin/student-deletion";

vi.mock("@/lib/admin/student-deletion-api", () => ({
  fetchStudentDeletionPreview: vi.fn(), fetchStudentDeletionJobs: vi.fn(), fetchStudentDeletionJob: vi.fn(),
  createStudentDeletionJob: vi.fn(), retryStudentDeletionJob: vi.fn(),
}));

const onClose = vi.fn(), onAccepted = vi.fn(), onPending = vi.fn(), onRejected = vi.fn();
function dialog() {
  return render(<AdminStudentDeletionDialog student={previewFixture.student} job={undefined} onClose={onClose}
    onAccepted={onAccepted} onPending={onPending} onRejected={onRejected} />);
}
function Manager({ onCompleted = vi.fn(), initiallyOpen = true }: { onCompleted?: (id: number) => void; initiallyOpen?: boolean }) {
  const [selected, setSelected] = useState<DeletionStudent | null>(initiallyOpen ? previewFixture.student : null);
  return <AdminStudentDeletionManager owner="admin:1" selected={selected} onSelect={setSelected} onCompleted={onCompleted} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(api.fetchStudentDeletionJobs).mockResolvedValue([]);
  vi.mocked(api.fetchStudentDeletionPreview).mockResolvedValue(previewFixture);
  vi.mocked(api.createStudentDeletionJob).mockResolvedValue(jobFixture);
  vi.mocked(api.fetchStudentDeletionJob).mockResolvedValue(jobFixture);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("student deletion dialog", () => {
  it("names the student, shows exact counts, requires confirmation, and cancels without a mutation", async () => {
    dialog();
    await screen.findByText("Будет удалено");
    expect(screen.getByText("Тестовый Ученик")).toBeTruthy();
    expect(screen.getByText("ID 42 · Тестовая группа")).toBeTruthy();
    expect(screen.getByText("Файлы и загрузки по данным системы").nextElementSibling?.textContent).toBe("5");
    expect((screen.getByRole("button", { name: "Удалить безвозвратно" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(api.createStudentDeletionJob).not.toHaveBeenCalled();
  });
  it("displays unknown counts and blocks confirmation when preview is unavailable", async () => {
    vi.mocked(api.fetchStudentDeletionPreview).mockResolvedValue({ ...previewFixture, available: false,
      blockers: ["Файловое хранилище недоступно"], counts: { ...previewFixture.counts, homework_files: null } });
    dialog();
    await screen.findByText("Неизвестно");
    expect(screen.getByText("Файловое хранилище недоступно")).toBeTruthy();
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  });
  it("deduplicates double clicks and submits the confirmed snapshot token", async () => {
    vi.mocked(api.createStudentDeletionJob).mockReturnValue(new Promise(() => {}));
    dialog();
    await screen.findByText("Будет удалено");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Удалить безвозвратно" }));
    fireEvent.click(screen.getByRole("button", { name: "Запуск…" }));
    expect(api.createStudentDeletionJob).toHaveBeenCalledTimes(1);
    expect(api.createStudentDeletionJob).toHaveBeenCalledWith(42, "synthetic-confirmation", expect.any(String));
    expect(onPending).toHaveBeenCalledWith(42, expect.any(String));
  });
  it("refreshes stale preview and requires a new confirmation", async () => {
    vi.mocked(api.createStudentDeletionJob).mockRejectedValue(new ApiError("Changed", 409, undefined, "preview_changed"));
    dialog();
    await screen.findByText("Будет удалено");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Удалить безвозвратно" }));
    await waitFor(() => expect(api.fetchStudentDeletionPreview).toHaveBeenCalledTimes(2));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("button", { name: "Удалить безвозвратно" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onRejected).toHaveBeenCalledWith(42);
  });
  it("recovers an existing server operation without starting another", async () => {
    vi.mocked(api.fetchStudentDeletionJobs).mockResolvedValue([jobFixture]);
    render(<Manager />);
    await screen.findByText("Ожидаем удаления файлов");
    expect(api.fetchStudentDeletionPreview).not.toHaveBeenCalled();
    expect(api.createStudentDeletionJob).not.toHaveBeenCalled();
  });
  it("recovers an accepted job after a lost POST response", async () => {
    vi.mocked(api.fetchStudentDeletionJobs).mockResolvedValueOnce([]).mockResolvedValue([jobFixture]);
    vi.mocked(api.createStudentDeletionJob).mockRejectedValue(new ApiError("Connection lost"));
    render(<Manager />);
    await screen.findByText("Будет удалено");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Удалить безвозвратно" }));
    await screen.findByText("Ожидаем удаления файлов");
    expect(api.createStudentDeletionJob).toHaveBeenCalledOnce();
  });
  it("retries the same failed job and never presents partial failure as success", async () => {
    const failed = { ...jobFixture, status: "failed" as const, percent: 100, retryable: true, error: "Synthetic storage failure" };
    vi.mocked(api.retryStudentDeletionJob).mockResolvedValue(jobFixture);
    render(<AdminStudentDeletionDialog student={previewFixture.student} job={failed} onClose={onClose} onAccepted={onAccepted} onPending={onPending} onRejected={onRejected} />);
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("99");
    expect(screen.getByText("Synthetic storage failure")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Повторить очистку" }));
    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(jobFixture));
    expect(api.retryStudentDeletionJob).toHaveBeenCalledWith(jobFixture.id);
    expect(api.createStudentDeletionJob).not.toHaveBeenCalled();
  });
  it("shows exact residuals and permits retry without hiding a partial outcome", async () => {
    const partial = { ...jobFixture, status: "partial" as const, student_deleted: true, percent: 80,
      retryable: true, error: "Часть данных требует дополнительной очистки.",
      residuals: [{ source: "files" as const, target: "synthetic/remaining.pdf", message: "Удалите ключ вручную." }] };
    vi.mocked(api.retryStudentDeletionJob).mockResolvedValue(jobFixture);
    render(<AdminStudentDeletionDialog student={previewFixture.student} job={partial} onClose={onClose}
      onAccepted={onAccepted} onPending={onPending} onRejected={onRejected} />);
    expect(screen.getByText("Учётная запись ученика уже удалена.")).toBeTruthy();
    expect(screen.getByText("synthetic/remaining.pdf")).toBeTruthy();
    expect(screen.getByText("Не удалось удалить:")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("80");
    fireEvent.click(screen.getByRole("button", { name: "Повторить очистку" }));
    await waitFor(() => expect(api.retryStudentDeletionJob).toHaveBeenCalledWith(jobFixture.id));
  });
  it("shows cards, attendance and explicit warnings before confirmation", async () => {
    vi.mocked(api.fetchStudentDeletionPreview).mockResolvedValue({ ...previewFixture,
      warnings: [{ source: "mongo", target: "legacy-documents", message: "Проверьте старые документы вручную." }] });
    dialog();
    await screen.findByText("Будет удалено");
    expect(screen.getByText("Выученные карточки").nextElementSibling?.textContent).toBe("4");
    expect(screen.getByText("Записи посещаемости").nextElementSibling?.textContent).toBe("12");
    expect(screen.getByText(/Проверьте старые документы вручную/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect((screen.getByRole("button", { name: "Удалить безвозвратно" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("refreshes the student list after SQL commit while continuing to poll files", async () => {
    vi.useFakeTimers();
    const completed = vi.fn();
    localStorage.setItem(deletionStorageKey("admin:1"), JSON.stringify([{ student_id: 42, job_id: jobFixture.id, idempotency_key: "original" }]));
    vi.mocked(api.fetchStudentDeletionJob).mockResolvedValue({ ...jobFixture, status: "waiting", student_deleted: true, percent: 70 });
    render(<Manager onCompleted={completed} initiallyOpen={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(completed).toHaveBeenCalledExactlyOnceWith(42);
    const callCount = vi.mocked(api.fetchStudentDeletionJob).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS); });
    expect(api.fetchStudentDeletionJob).toHaveBeenCalledTimes(callCount + 1);
    expect(completed).toHaveBeenCalledOnce();
    expect(screen.getByText(/Ожидание · 70%/)).toBeTruthy();
  });
  it("restores after reload and keeps polling after the modal closes, refreshing only on completion", async () => {
    vi.useFakeTimers();
    const completed = vi.fn();
    localStorage.setItem(deletionStorageKey("admin:1"), JSON.stringify([{ student_id: 42, job_id: jobFixture.id, idempotency_key: "original" }]));
    render(<Manager onCompleted={completed} initiallyOpen={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(api.fetchStudentDeletionJob).toHaveBeenCalledWith(jobFixture.id);
    expect(screen.getByText(/Удаление · 40%/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Подробнее" }));
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS); });
    expect(completed).not.toHaveBeenCalled();
    expect(screen.getByText(/Удаление · 40%/)).toBeTruthy();
    vi.mocked(api.fetchStudentDeletionJob).mockResolvedValue({ ...jobFixture, status: "completed", percent: 100, completed_units: 10 });
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS); });
    expect(completed).toHaveBeenCalledExactlyOnceWith(42);
    expect(screen.getByText(/Удаление завершено · 100%/)).toBeTruthy();
    const callCount = vi.mocked(api.fetchStudentDeletionJob).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS * 2); });
    expect(api.fetchStudentDeletionJob).toHaveBeenCalledTimes(callCount);
  });
  it("keeps last server progress visible during polling failure and recovers", async () => {
    vi.useFakeTimers();
    localStorage.setItem(deletionStorageKey("admin:1"), JSON.stringify([{ student_id: 42, job_id: jobFixture.id, idempotency_key: "original" }]));
    render(<Manager initiallyOpen={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    vi.mocked(api.fetchStudentDeletionJob).mockRejectedValue(new Error("Synthetic offline"));
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS * 3); });
    expect(screen.getByText(/Удаление · 40%/)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Synthetic offline");
    vi.mocked(api.fetchStudentDeletionJob).mockResolvedValue({ ...jobFixture, percent: 60 });
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS); });
    expect(screen.getByText(/Удаление · 60%/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
