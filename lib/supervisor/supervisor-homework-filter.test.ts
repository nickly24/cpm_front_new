import { describe, expect, it, vi } from "vitest";
import { filterSupervisorHomeworkStudents } from "./supervisor-homework-filter";
import { exportSupervisorOvHomeworkExcel } from "./supervisor-homework-export";
import type { SupervisorOvHomeworkStudent } from "./supervisor-homework-api";
const captured = vi.hoisted(() => ({ rows: [] as unknown[][] }));
vi.mock("xlsx", () => ({ utils: { aoa_to_sheet: (rows: unknown[][]) => { captured.rows = rows; return {}; }, book_new: () => ({}), book_append_sheet: vi.fn() }, writeFile: vi.fn() }));
const student = (id: number, name: string, grade: number | null): SupervisorOvHomeworkStudent => ({ id, full_name: name, class: grade, group_name: null, results: [{ homework_id: 7, status: 1, result: 0, date_pass: null, deadline: null, status_text: "Сдано", days_overdue: 0 }] });
const rows = [student(21, "Иван", 10), student(22, "Иванов", null), student(23, "Нулевой", 0)];
describe("Homework class and Excel output", () => {
  it("combines authorized name and class filters, preserving unknown separately from zero", () => {
    expect(filterSupervisorHomeworkStudents(rows, " ИВАН ", "10").map(row => row.id)).toEqual([21]);
    expect(filterSupervisorHomeworkStudents(rows, "", "unknown").map(row => row.id)).toEqual([22]);
    expect(filterSupervisorHomeworkStudents(rows, "", "0").map(row => row.id)).toEqual([23]);
  });
  it("exports the same filtered class rows with zero result instead of an invented missing grade", () => {
    exportSupervisorOvHomeworkExcel([{ id: 7, name: "Работа", type: "Custom", deadline: null }], filterSupervisorHomeworkStudents(rows, "", "10"), "report.xlsx");
    expect(captured.rows).toEqual([["ФИО", "Класс", "Группа", "Работа"], ["Иван", 10, "", "0% · Сдано"]]);
  });
});
