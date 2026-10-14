import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
const state = vi.hoisted(() => ({ loading: false, error: null as Error | null, execute: vi.fn() }));
const preview = { id: "session", examId: 31, previewVersion: 8, status: "editable", expiresAt: "2026-10-12T10:00:00Z", rows: [{ rowId: "r1", sourceRow: 2, input: { points: 0 }, excluded: false, errors: [], warnings: [] }], summary: { total: 1, included: 1, excluded: 0, creatable: 1, errors: 0, conflicts: 0 } };
vi.mock("@/lib/exams-v2/hooks", () => ({
  useExamResource: () => ({ data: { session: preview }, loading: state.loading, error: state.error, reload: vi.fn() }),
  useExamMutation: () => ({ busy: false, uncertain: false, error: null, execute: state.execute, retry: vi.fn(), dismiss: vi.fn() }),
}));
import { PreviewEditor } from "./import";
beforeEach(() => { state.loading = false; state.error = null; state.execute.mockReset(); });
const render = () => renderToStaticMarkup(<PreviewEditor sessionId="session" prefix="/api/exams/31/imports/outside" storageKey="unit-only" reset={() => {}} actor="9" examId={31} canEdit onChanged={() => {}} />);
function commitButton(html: string) { return html.match(/<button[^>]*>Применить импорт целиком<\/button>/)?.[0]; }
describe("import preview freshness actions", () => {
  it("allows applying a successfully loaded valid preview", () => { expect(commitButton(render())).not.toContain("disabled"); });
  it("disables apply and editing while a preview with retained data is loading", () => {
    state.loading = true; const html = render();
    expect(commitButton(html)).toContain("disabled");
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*value="0"/);
  });
  it.each([409, 502])("disables apply and editing after a failed %i preview refresh until fresh data is read", status => {
    state.error = new ApiError("Предпросмотр изменился", status, undefined, status === 409 ? "preview_modified" : "invalid_response");
    const html = render(); expect(commitButton(html)).toContain("disabled");
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*value="0"/);
    expect(html).toContain("Обновить данные");
    expect(state.execute).not.toHaveBeenCalled();
  });
});
