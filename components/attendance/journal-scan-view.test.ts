import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { displayedJournal, resolveJournalDay } from "./journal";
import { journalExportHeaders, journalExportRows, journalRoster, type AttendanceType, type Day, type Entry, type Journal, type Student } from "@/lib/bff/attendance";

const days: Day[] = [
    { id: 11, division_id: 12, date: "2026-10-08", comment: "", lesson_ids: [], has_history: true },
    { id: 22, division_id: 12, date: "2026-10-09", comment: "", lesson_ids: [], has_history: true },
    { id: 33, division_id: 12, date: "2026-10-10", comment: "", lesson_ids: [], has_history: false },
];
const type: AttendanceType = {
    id: 5, division_id: 12, version: 1, code: "present", name: "Название в сохранённой отметке", color: "#008800", mark: "+",
    sort_order: 10, is_active: true, counts_as_present: true, counts_as_absent: false, is_excused: false,
    scan_default: true, zap_default: false,
};
const entry = (day = 22, account = 7): Entry => ({
    id: 100 + day, division_id: 12, class_day_id: day, account_id: account, group_id: 8,
    full_name: "Ученик", type, zap_id: null, is_deleted: false, updated_at: "2026-10-09T06:00:00Z",
});
const student: Student = {
    account_id: 7, profile_id: 70, role: "student", full_name: "Ученик", class: 10,
    group_id: 8, group_name: "Группа", school_id: 9, school_name: "Школа", school_short_name: "ШК",
};
const report = (entries: Entry[] = [entry()]): Journal => ({
    organization_id: 1001, division_id: 12, days, entries,
    counts_by_type_code: { present: entries.length }, unmarked_is_absent: false,
});
function workbookRows(journal: Journal) {
    const roster = journalRoster([student], journal.entries);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(journalExportRows(journal, roster), { header: journalExportHeaders(journal) }), "Посещаемость");
    const saved = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
    const sheet = saved.Sheets["Посещаемость"];
    return { headers: XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0], rows: XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet) };
}

describe("scan journal uses only its loaded day's data", () => {
    it("keeps every picker candidate but displays/exports only the loaded middle day and its real snapshot", () => {
        const journal = report();
        const original = JSON.stringify(journal);
        const display = displayedJournal(journal, true, 22)!;
        expect(display.days).toEqual([days[1]]);
        expect(display.entries).toEqual(journal.entries);
        expect(display.entries[0]).toBe(journal.entries[0]);
        expect(journal.days).toBe(days);
        expect(journal.days.map(day => day.id)).toEqual([11, 22, 33]);
        const saved = workbookRows(display);
        expect(saved.headers.slice(7)).toEqual(["2026-10-09"]);
        expect(saved.rows[0]["2026-10-09"]).toBe("Название в сохранённой отметке");
        expect(saved.rows[0]).not.toHaveProperty("2026-10-08");
        expect(saved.rows[0]).not.toHaveProperty("2026-10-10");
        expect(JSON.stringify(journal)).toBe(original);
    });
    it("falls back to the first available day when the requested selection leaves the range", () => {
        const journal = { ...report([entry(22)]), days: days.slice(1) };
        const actuallyLoaded = resolveJournalDay(journal.days, 11);
        expect(actuallyLoaded).toBe(22);
        const display = displayedJournal(journal, true, actuallyLoaded)!;
        expect(display.days.map(day => day.id)).toEqual([22]);
        expect(workbookRows(display).headers.slice(7)).toEqual(["2026-10-09"]);
        expect(resolveJournalDay(journal.days, 33)).toBe(33);
        expect(resolveJournalDay(journal.days, 0)).toBe(22);
    });
    it("shows a genuinely unmarked loaded day without manufacturing values for the other candidate days", () => {
        const journal = report([]);
        const display = displayedJournal(journal, true, 33)!;
        const saved = workbookRows(display);
        expect(saved.headers.slice(7)).toEqual(["2026-10-10"]);
        expect(saved.rows[0]["2026-10-10"]).toBe("Не отмечен");
        expect(saved.rows[0]).not.toHaveProperty("2026-10-08");
        expect(saved.rows[0]).not.toHaveProperty("2026-10-09");
        expect(journal.days).toHaveLength(3);
    });
    it("does not reinterpret previously loaded entries as the day the user has just requested", () => {
        const journal = report([entry(22), entry(11, 99)]);
        const desiredNextDay = resolveJournalDay(journal.days, 11);
        expect(desiredNextDay).toBe(11);
        const stillLoaded = displayedJournal(journal, true, 22)!;
        expect(stillLoaded.days.map(day => day.id)).toEqual([22]);
        expect(stillLoaded.entries.map(value => value.account_id)).toEqual([7]);
        expect(workbookRows(stillLoaded).rows).toHaveLength(1);
    });
    it("retains the exact period report object and every date for the normal journal", () => {
        const journal = report([entry(11), entry(22)]);
        const display = displayedJournal(journal, false, 22)!;
        expect(display).toBe(journal);
        expect(display.days).toBe(journal.days);
        expect(display.entries).toBe(journal.entries);
        const saved = workbookRows(display);
        expect(saved.headers.slice(7)).toEqual(days.map(day => day.date));
        expect(saved.rows[0]).toMatchObject({ "2026-10-08": type.name, "2026-10-09": type.name, "2026-10-10": "Не отмечен" });
    });
    it("has no selected day, date columns or entries before a scan day is available", () => {
        expect(resolveJournalDay([], 33)).toBe(0);
        expect(displayedJournal(null, true, 33)).toBeNull();
        const journal = report();
        const display = displayedJournal(journal, true, 0)!;
        expect(display.days).toEqual([]);
        expect(display.entries).toEqual([]);
        expect(journalExportHeaders(display)).toHaveLength(7);
        expect(journal.days).toHaveLength(3);
    });
});
