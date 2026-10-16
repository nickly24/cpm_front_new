// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceType, Command, Journal, Student } from "@/lib/bff/attendance";
const mocks = vi.hoisted(() => ({ read: vi.fn(), execute: vi.fn(), user: { role: "admin", organization_admin: true, organization_id: 1001, account_id: 9, division_id: 2 }, refresh: null as null | (() => Promise<void>), immersive: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/contexts/cabinet-chrome-context", () => ({ useCabinetChrome: () => ({ setImmersive: mocks.immersive }) }));
vi.mock("@/lib/bff/use-context-guard", () => ({ useContextGuard: vi.fn() }));
vi.mock("@/lib/bff/attendance", async original => ({ ...await original<typeof import("@/lib/bff/attendance")>(), readAttendance: mocks.read }));
vi.mock("./shared", () => ({ useAction: (refresh: () => Promise<void>) => { mocks.refresh = refresh; return { busy: false, pending: null, execute: mocks.execute }; }, ActionNotice: () => null }));
vi.mock("@tanstack/react-virtual", () => ({ useVirtualizer: ({ count }: { count: number }) => ({ getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 40, end: (index + 1) * 40 })), getTotalSize: () => count * 40 }) }));
import { ExcelAttendanceJournal } from "./excel-journal";
import { excelReport } from "@/lib/attendance/excel-report";
import { summarizeStudentAttendance } from "@/lib/attendance/attendance-report-summary";
import { buildCellMap } from "@/lib/attendance/attendance-report-utils";

const type: AttendanceType = { id: 88, division_id: 2, code: "custom_excused", name: "Особая причина", color: "#abcdef", mark: "УП", version: 3, is_active: true, sort_order: 1, counts_as_present: false, counts_as_absent: true, is_excused: true, scan_default: false, zap_default: true };
const student: Student = { account_id: 7, profile_id: 700, role: "student", full_name: "Synthetic student", class: 11, group_id: null, group_name: null, school_id: 8, school_name: "Synthetic school", school_short_name: "School" };
let revision: number, journal: Journal;
function mount() { return render(<ExcelAttendanceJournal division={2} divisionName="Synthetic division" period={{ dateFrom: "2026-06-01", dateTo: "2026-06-30" }} onBack={vi.fn()} />); }
async function loaded() { await waitFor(() => expect(screen.queryByText("Загрузка журнала…")).toBeNull()); }
describe("restored Attendance Excel journal", () => {
  beforeEach(() => {
    vi.clearAllMocks(); revision = 3; mocks.user.role = "admin";
    journal = { organization_id: 1001, division_id: 2, days: [1, 2].map(id => ({ id, division_id: 2, date: `2026-06-0${id}`, comment: "", lesson_ids: [], has_history: false })), entries: [], counts_by_type_code: {}, unmarked_is_absent: false };
    mocks.read.mockImplementation(async (path: string) => ({ revision, value: path.includes("attendance-report") ? structuredClone(journal) : path.endsWith("/students") ? [student] : [type] }));
    mocks.execute.mockImplementation(async (command: Command) => { revision++; await mocks.refresh?.(); return { revision, value: command.data }; });
  });
  afterEach(cleanup);
  it("loads scoped current-owner data and writes the account ID with CAS, not the profile ID", async () => {
    mount(); await loaded(); expect(mocks.read.mock.calls[0][0]).toBe("/divisions/2/attendance-report?date_from=2026-06-01&date_to=2026-06-30");
    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Пусто" })[0], { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    expect(mocks.execute.mock.calls[0][0]).toMatchObject({ path: "/divisions/2/class-days/1/attendance", method: "POST", revision: 3, data: { account_id: 7, attendance_type_id: 88 } });
  });
  it("serializes a brush stroke with the confirmed revision of each preceding cell", async () => {
    let release!: () => void;
    mocks.execute.mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve; }); revision++; await mocks.refresh?.(); return { revision, value: {} }; });
    mount(); await loaded(); fireEvent.click(screen.getByRole("button", { name: "Кисть" }));
    const cells = screen.getAllByRole("button", { name: "Пусто" });
    fireEvent.mouseDown(cells[0], { button: 0 }); fireEvent.mouseEnter(cells[1]); fireEvent.mouseEnter(cells[1]);
    expect(mocks.execute).toHaveBeenCalledTimes(1); await act(async () => release());
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2));
    expect(mocks.execute.mock.calls.map(call => call[0].revision)).toEqual([3, 4]);
  });
  it("stops queued brush commands when a reply is unknown", async () => {
    let release!: () => void;
    mocks.execute.mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve; }); return null; });
    mount(); await loaded(); fireEvent.click(screen.getByRole("button", { name: "Кисть" })); const cells = screen.getAllByRole("button", { name: "Пусто" });
    fireEvent.mouseDown(cells[0], { button: 0 }); fireEvent.mouseEnter(cells[1]); await act(async () => release());
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
  it("stops a brush if a concurrent change arrives before the readback", async () => {
    let release!: () => void;
    mocks.execute.mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve; }); revision += 2; await mocks.refresh?.(); return { revision: revision - 1, value: {} }; });
    mount(); await loaded(); fireEvent.click(screen.getByRole("button", { name: "Кисть" })); const cells = screen.getAllByRole("button", { name: "Пусто" });
    fireEvent.mouseDown(cells[0], { button: 0 }); fireEvent.mouseEnter(cells[1]); await act(async () => release());
    expect(mocks.execute).toHaveBeenCalledTimes(1); expect(screen.getByRole("alert").textContent).toContain("изменился параллельно");
  });
  it("shows immutable custom/archived display and protects a mark linked to a zap", async () => {
    journal.entries = [{ id: 45, division_id: 2, class_day_id: 1, account_id: 7, group_id: null, full_name: student.full_name, type: { ...type, is_active: false }, zap_id: 12, is_deleted: false, updated_at: "2026-06-01T12:00:00Z" }];
    const report = excelReport(journal, [student], "2026-06-01", "2026-06-30");
    expect(summarizeStudentAttendance(7, report.class_days, buildCellMap(report.entries))).toMatchObject({ marked: 1, empty: 1, snapshots: [{ name: type.name, color: type.color, mark: type.mark, count: 1 }] });
    mount(); await loaded(); const cell = screen.getByRole("button", { name: "Особая причина" }); expect(cell.style.backgroundColor).toBe("rgb(171, 205, 239)");
    fireEvent.mouseDown(cell, { button: 0 }); expect(screen.getByText(/связана с отгулом №12/)).toBeTruthy(); expect(screen.queryByRole("button", { name: "Сохранить" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" })); fireEvent.click(screen.getByRole("button", { name: "Ластик" })); fireEvent.mouseDown(cell, { button: 0 }); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("uses account ID in the DELETE path", async () => {
    journal.entries = [{ id: 45, division_id: 2, class_day_id: 1, account_id: 7, group_id: null, full_name: student.full_name, type, zap_id: null, is_deleted: false, updated_at: "2026-06-01T12:00:00Z" }];
    mount(); await loaded(); fireEvent.click(screen.getByRole("button", { name: "Ластик" })); fireEvent.mouseDown(screen.getByRole("button", { name: type.name }), { button: 0 });
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    expect(mocks.execute.mock.calls[0][0]).toMatchObject({ method: "DELETE", path: "/divisions/2/class-days/1/attendance/7", revision: 3, data: {} });
  });
  it("does not continue a brush after a confirmed command if authoritative refresh fails", async () => {
    let release!: () => void;
    mocks.execute.mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve; }); revision++; mocks.read.mockRejectedValue(new Error("Unavailable")); await mocks.refresh?.(); return { revision, value: {} }; });
    mount(); await loaded(); fireEvent.click(screen.getByRole("button", { name: "Кисть" })); const cells = screen.getAllByRole("button", { name: "Пусто" });
    fireEvent.mouseDown(cells[0], { button: 0 }); fireEvent.mouseEnter(cells[1]); await act(async () => release());
    expect(mocks.execute).toHaveBeenCalledTimes(1); expect(screen.getByRole("alert").textContent).toContain("Unavailable");
  });
  it("keeps empty cells unmarked and allows read-only inspection", async () => {
    mocks.user.role = "supervisor"; mount(); await loaded(); expect(screen.queryByRole("button", { name: "Карандаш" })).toBeNull();
    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Пусто" })[0], { button: 0 }); expect(screen.getByRole("dialog")).toBeTruthy(); expect(mocks.execute).not.toHaveBeenCalled();
  });
});
