import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ domain: vi.fn(), scope: "one" }));
vi.mock("./client", () => ({ domain: state.domain, getIdentity: () => ({ user: { division_id: 10 } }) }));
vi.mock("./exams-shared", () => ({ examContextKey: () => state.scope }));
import { exportExamParticipants, participantCSVCell } from "./exam-participants";
beforeEach(() => { state.domain.mockReset(); state.scope = "one"; });
const row = (id: number) => ({ account_id: id, profile_id: id + 5000, login: `0${id}`, full_name: `Участник ${id}`, role: "examinator", division_id: 10, division_name: "Отдел" });
describe("participant export", () => {
  it("walks every bounded page using account ID cursors, with BOM and no credentials", async () => {
    state.domain.mockResolvedValueOnce({ items: Array.from({ length: 200 }, (_, i) => ({ ...row(i + 1), password: "must-not-export" })) }).mockResolvedValueOnce({ items: [row(9001)] });
    const blob = await exportExamParticipants();
    const bytes = new Uint8Array(await blob.arrayBuffer()); expect([...bytes.slice(0, 3)]).toEqual([239, 187, 191]);
    const csv = await blob.text(); expect(csv.split("\r\n")).toHaveLength(203); expect(csv).toContain('"9001";"14001";"09001"'); expect(csv).not.toContain("must-not-export");
    expect(state.domain.mock.calls.map(call => call[0])).toEqual(["/core/exam-participants?limit=200&after_id=0", "/core/exam-participants?limit=200&after_id=200"]);
  });
  it.each(["=SUM(1)", "+1", "-1", "@SUM(1)", "  =SUM(1)", "\ttext", "\rtext"])("neutralizes spreadsheet formulas %s", value => { expect(participantCSVCell(value)).toContain("'"); });
  it("quotes separators, quotes and line breaks", () => { expect(participantCSVCell('a;"b\nc')).toBe('"a;""b\nc"'); });
  it("discards the export if context changes or a response crosses division scope", async () => {
    state.domain.mockImplementationOnce(async () => { state.scope = "two"; return { items: [row(1)] }; });
    await expect(exportExamParticipants()).rejects.toThrow("Кабинет изменился");
    state.domain.mockResolvedValueOnce({ items: [{ ...row(1), division_id: 11 }] });
    await expect(exportExamParticipants()).rejects.toThrow("идентификаторы");
  });
  it("refuses repeated cursors and unsafe IDs instead of silently truncating or rounding", async () => {
    for (const items of [[row(1), row(1)], [row(Number.MAX_SAFE_INTEGER + 1)]]) {
      state.domain.mockResolvedValueOnce({ items }); await expect(exportExamParticipants()).rejects.toThrow("идентификаторы");
    }
  });
});
