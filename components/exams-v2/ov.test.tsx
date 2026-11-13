// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { OvEditor, OvSummary } from "./ov";
import { ResultSummary } from "./student";
import type { AttemptResult } from "@/lib/exams-v2/types";

afterEach(cleanup);

describe("OV for a specific exam attempt", () => {
  it("allows an empty value and sends the independent revision when choosing a status", () => {
    const save = vi.fn(), dirty = vi.fn();
    render(<OvEditor value={{ ovStatus: null, ovRevision: 0 }} canEdit disabled={false} onSave={save} onDirtyChange={dirty} />);
    expect((screen.getByLabelText("Статус OV") as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("button", { name: "Сохранить OV" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Статус OV"), { target: { value: "accepted" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить OV" }));
    expect(save).toHaveBeenCalledWith({ expectedOvRevision: 0, ovStatus: "accepted", ovComment: null });
    expect(dirty).toHaveBeenLastCalledWith(true);
  });
  it("shows an optional comment only for remarks and clears it on a different status", () => {
    const save = vi.fn();
    render(<OvEditor value={{ ovStatus: "remarks", ovComment: "Проверить приложение", ovRevision: 4 }} canEdit disabled={false} onSave={save} />);
    const comment = screen.getByLabelText("Комментарий к замечаниям · необязательно") as HTMLTextAreaElement;
    expect(comment.required).toBe(false);
    fireEvent.change(comment, { target: { value: "<script>Комментарий</script>" } });
    fireEvent.change(screen.getByLabelText("Статус OV"), { target: { value: "missing" } });
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить OV" }));
    expect(save).toHaveBeenLastCalledWith({ expectedOvRevision: 4, ovStatus: "missing", ovComment: null });
    fireEvent.change(screen.getByLabelText("Статус OV"), { target: { value: "remarks" } });
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить OV" }));
    expect(save).toHaveBeenLastCalledWith({ expectedOvRevision: 4, ovStatus: "remarks", ovComment: null });
  });
  it("can clear an existing status and cancel an unsaved edit", () => {
    const save = vi.fn(), dirty = vi.fn();
    render(<OvEditor value={{ ovStatus: "accepted", ovRevision: 2 }} canEdit disabled={false} onSave={save} onDirtyChange={dirty} />);
    fireEvent.change(screen.getByLabelText("Статус OV"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить OV" }));
    expect(save).toHaveBeenLastCalledWith({ expectedOvRevision: 2, ovStatus: null, ovComment: null });
    fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
    expect((screen.getByLabelText("Статус OV") as HTMLSelectElement).value).toBe("accepted");
    expect(dirty).toHaveBeenLastCalledWith(false);
  });
  it("does not offer editing without permission or while an outcome is unresolved", () => {
    const save = vi.fn();
    const { rerender } = render(<OvEditor value={{ ovStatus: null }} canEdit={false} disabled={false} onSave={save} />);
    expect(screen.getByText("Не указано")).toBeDefined();
    expect(screen.queryByRole("combobox")).toBeNull();
    rerender(<OvEditor value={{ ovStatus: null }} canEdit disabled onSave={save} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("button", { name: "Сохранить OV" }).closest("form")!);
    expect(save).not.toHaveBeenCalled();
  });
  it("renders comments as text and does not fabricate OV in a student result", () => {
    const html = renderToStaticMarkup(<OvSummary value={{ ovStatus: "remarks", ovComment: "<script>alert(1)</script>" }} />);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    const result: AttemptResult = { attemptId: 1, attemptNo: 1, grade: 0, rawTotal: 0, roundedTotal: 0, maxScore: 5, hasAppeal: false, completedAt: "2026-11-13T09:00:00Z" };
    expect(renderToStaticMarkup(<ResultSummary result={result} />)).not.toContain("Сданы OV");
    expect(renderToStaticMarkup(<ResultSummary result={{ ...result, ovStatus: null }} />)).toContain("Не указано");
  });
});
