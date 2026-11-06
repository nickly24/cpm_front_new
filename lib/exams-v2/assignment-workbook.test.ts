import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
const state = vi.hoisted(() => ({ domain: vi.fn(), identity: { context_revision: "one", user: { account_id: 1, organization_id: 1, division_id: 11 } } }));
vi.mock("@/lib/bff/client", () => ({ domain: state.domain, getIdentity: () => state.identity }));
import { buildAssignmentWorkbook, loadAssignmentStudents } from "./assignment-workbook";

const student = (id: number) => ({ account_id: id, profile_id: id + 1000, login: id === 7 ? "0007" : `student.${id}`, full_name: "Тестовый ученик", role: "student" as const, division_id: 11, division_name: "Тестовое подразделение" });
const member = { id: 13, fullName: "Тестовый экзаменатор" };
beforeEach(() => { state.domain.mockReset(); state.identity.context_revision = "one"; });

describe("assignment workbook contract", () => {
  it("preserves account IDs and zero-prefixed logins in one importable sheet; one examiner suffices", async () => {
    const blob = await buildAssignmentWorkbook([student(7), { ...student(8), login: "=not-a-formula" }], [member], 2);
    const bytes = await blob.arrayBuffer(), book = XLSX.read(bytes, { type: "array", cellFormula: true });
    expect(book.SheetNames).toEqual(["Назначения"]);
    const sheet = book.Sheets[book.SheetNames[0]];
    expect(XLSX.utils.sheet_to_json(sheet)).toEqual([
      { student_id: 7, student_login: "0007", examinator_1_id: 13, examinator_2_id: "", examinator_3_id: "", examinator_4_id: "", examinator_5_id: "", examinator_6_id: "", replacement_limit: 2 },
      { student_id: 8, student_login: "=not-a-formula", examinator_1_id: 13, examinator_2_id: "", examinator_3_id: "", examinator_4_id: "", examinator_5_id: "", examinator_6_id: "", replacement_limit: 2 },
    ]);
    expect(sheet.B3.f).toBeUndefined(); expect(sheet.B3.t).toBe("s");
    expect(sheet.A2.c?.[0].t).toBe("Тестовый ученик");
    if (process.env.CPM_ASSIGNMENT_FIXTURE) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(process.env.CPM_ASSIGNMENT_FIXTURE, Buffer.from(bytes));
    }
  });
  it("supports six members, rejects duplicate commission accounts and invalid limits", async () => {
    const people = Array.from({ length: 6 }, (_, i) => ({ ...member, id: i + 1 }));
    const sheet = XLSX.read(await (await buildAssignmentWorkbook([student(7)], people, 0)).arrayBuffer()).Sheets["Назначения"];
    expect(sheet.H2.v).toBe(6);
    await expect(buildAssignmentWorkbook([student(7)], [member, member], 0)).rejects.toThrow("разных экзаменаторов");
    await expect(buildAssignmentWorkbook([student(7)], [member], 101)).rejects.toThrow("Лимит замен");
  });
  it("rejects IDs that Excel would round instead of silently changing them", async () => {
    await expect(buildAssignmentWorkbook([student(9007199254740991)], [member], 0)).rejects.toThrow("длинные ID");
  });
  it("fetches each roster page only for explicit export, using increasing account IDs", async () => {
    state.domain.mockResolvedValueOnce({ items: Array.from({ length: 200 }, (_, i) => student(i + 1)) }).mockResolvedValueOnce({ items: [student(9001)] });
    const progress = vi.fn();
    const result = await loadAssignmentStudents(new AbortController().signal, progress);
    expect(result).toHaveLength(201);
    expect(state.domain.mock.calls.map(call => call[0])).toEqual(["/core/exam-participants?role=student&limit=200&after_id=0", "/core/exam-participants?role=student&limit=200&after_id=200"]);
    expect(progress.mock.calls).toEqual([[200], [201]]);
  });
  it("discards data after a cabinet switch or cancellation", async () => {
    state.domain.mockImplementationOnce(() => { state.identity.context_revision = "two"; return { items: [student(7)] }; });
    await expect(loadAssignmentStudents(new AbortController().signal, vi.fn())).rejects.toThrow("Кабинет изменился");
    const controller = new AbortController(); controller.abort();
    await expect(loadAssignmentStudents(controller.signal, vi.fn())).rejects.toMatchObject({ name: "AbortError" });
    expect(state.domain).toHaveBeenCalledTimes(1);
  });
  it.each([{ items: [student(7), student(7)] }, { items: [{ ...student(7), division_id: 99 }] }, { items: [{ ...student(7), role: "examinator" }] }])("rejects mixed, duplicate or wrong-scope roster data", async ({ items }) => {
    state.domain.mockResolvedValueOnce({ items });
    await expect(loadAssignmentStudents(new AbortController().signal, vi.fn())).rejects.toThrow("Список участников изменился");
  });
  it("never truncates a roster larger than the import limit", async () => {
    let first = 1;
    state.domain.mockImplementation(() => { const items = Array.from({ length: 200 }, (_, i) => student(first + i)); first += 200; return { items }; });
    await expect(loadAssignmentStudents(new AbortController().signal, vi.fn())).rejects.toThrow("больше 5000");
    expect(state.domain).toHaveBeenCalledTimes(26);
  });
});
