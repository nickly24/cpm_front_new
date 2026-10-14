import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { filterJournalStudents, journalExportHeaders, journalExportRows, journalRoster, journalTypeOptions, studentGroupLabel, studentSchoolLabel, type AttendanceType, type Entry, type Journal, type Student } from "./attendance";

const student = (account: number, patch: Partial<Student> = {}): Student => ({
    account_id: account, profile_id: account + 100, role: "student", full_name: `Ученик ${account}`,
    class: 10, group_id: 7, group_name: "Группа А", school_id: 90,
    school_name: "Полное название школы", school_short_name: "Школа А", ...patch,
});
const snapshot: AttendanceType = {
    id: 5, division_id: 12, version: 1, code: "present", name: "Был на занятии", color: "#008800", mark: "+",
    sort_order: 10, is_active: true, counts_as_present: true, counts_as_absent: false, is_excused: false,
    scan_default: true, zap_default: false,
};
const entry = (account: number, patch: Partial<Entry> = {}): Entry => ({
    id: account + 200, division_id: 12, class_day_id: 30, account_id: account, group_id: 7,
    full_name: `Прежнее имя ${account}`, type: { ...snapshot }, zap_id: null, is_deleted: false,
    updated_at: "2026-10-09T06:00:00Z", ...patch,
});
const report = (entries: Entry[] = []): Journal => ({
    organization_id: 1001, division_id: 12,
    days: [{ id: 30, division_id: 12, date: "2026-10-09", comment: "", lesson_ids: [], has_history: true },
        { id: 31, division_id: 12, date: "2026-10-10", comment: "", lesson_ids: [], has_history: false }],
    entries, counts_by_type_code: {}, unmarked_is_absent: false,
});
const all = { class: "all", group: "all", school: "all" };

describe("attendance journal metadata and filtered export", () => {
    it("uses current roster metadata while retaining departed students' historical name/group without inventing class or school", () => {
        const current = student(1, { group_id: 8, group_name: "Новая группа" });
        const entries = [entry(1), entry(2), entry(2, { id: 203, class_day_id: 31 })];
        const merged = journalRoster([current], entries);
        expect(merged).toHaveLength(2);
        expect(merged[0]).toBe(current);
        expect(merged[1]).toMatchObject({ account_id: 2, full_name: "Прежнее имя 2", group_id: 7,
            group_name: null, class: null, school_id: null, school_name: null, school_short_name: null });
        expect(studentGroupLabel(merged[1])).toBe("Группа #7");
        expect(studentSchoolLabel(merged[1])).toBe("—");
        expect(entries[0].group_id).toBe(7);
    });
    it("combines class/group/school filters by identity even when names match", () => {
        const roster = [student(1), student(2, { group_id: 8 }), student(3, { school_id: 91 }), student(4, { class: 11 })];
        const filtered = filterJournalStudents(roster, { class: "10", group: "7", school: "90" });
        expect(filtered.map(value => value.account_id)).toEqual([1]);
        expect(filterJournalStudents(roster, all)).toEqual(roster);
        expect(filterJournalStudents(roster, { ...all, group: "8" }).map(value => value.account_id)).toEqual([2]);
        expect(filterJournalStudents(roster, { ...all, school: "91" }).map(value => value.account_id)).toEqual([3]);
    });
    it("offers independent null filters without treating an unmarked day as absence", () => {
        const unknown = student(2, { class: null, group_id: null, group_name: null, school_id: null, school_name: null, school_short_name: null });
        const visible = filterJournalStudents([student(1), unknown], { class: "none", group: "none", school: "none" });
        expect(visible).toEqual([unknown]);
        expect(journalExportRows(report(), visible)[0]).toMatchObject({ "Класс": "—", "Группа": "—", "Школа": "—", "2026-10-09": "Не отмечен" });
    });
    it("exports only filtered visible rows with organization/division, real metadata, and historical type names", () => {
        const journal = report([entry(1), entry(2, { type: { ...snapshot, id: 6, code: "excused", name: "Старое название отгула", is_excused: true }, zap_id: 70 })]);
        const currentType = { ...snapshot, version: 2, name: "Новое название", is_active: false };
        const visible = filterJournalStudents(journalRoster([student(1), student(2, { school_id: 91, school_short_name: "Школа Б" })], journal.entries), { ...all, school: "91" });
        const rows = journalExportRows(journal, visible);
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows, { header: journalExportHeaders(journal) }), "Посещаемость");
        const restored = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
        const exported = XLSX.utils.sheet_to_json(restored.Sheets["Посещаемость"]);
        expect(exported).toEqual([{
            "Организация ID": 1001, "Подразделение ID": 12, "Ученик": "Ученик 2", "Класс": 10,
            "Группа": "Группа А", "Школа": "Полное название школы", "Краткое название школы": "Школа Б",
            "2026-10-09": "Старое название отгула", "2026-10-10": "Не отмечен",
        }]);
        expect(JSON.stringify(exported)).not.toContain(currentType.name);
        expect(journal.entries[1].type.version).toBe(1);
    });
    it("keeps useful column headers when the selected filters contain no students", () => {
        const journal = report();
        const sheet = XLSX.utils.json_to_sheet(journalExportRows(journal, []), { header: journalExportHeaders(journal) });
        expect(XLSX.utils.sheet_to_json(sheet, { header: 1 })).toEqual([journalExportHeaders(journal)]);
    });
    it("shows the short school name when available and the full name otherwise", () => {
        expect(studentSchoolLabel(student(1))).toBe("Школа А");
        expect(studentSchoolLabel(student(1, { school_short_name: null }))).toBe("Полное название школы");
    });
    it("keeps a recorded type's original label after rename/archive while offering current labels for unmarked students", () => {
        const renamed = { ...snapshot, name: "Новое название", version: 2 };
        const other = { ...snapshot, id: 6, code: "absent", name: "Не был" };
        expect(journalTypeOptions([renamed, other], entry(1))).toEqual([{ id: 5, name: "Был на занятии" }, { id: 6, name: "Не был" }]);
        expect(journalTypeOptions([renamed, other])).toEqual([{ id: 5, name: "Новое название" }, { id: 6, name: "Не был" }]);
        expect(journalTypeOptions([{ ...renamed, is_active: false }, other], entry(1))).toEqual([{ id: 5, name: "Был на занятии · архив" }, { id: 6, name: "Не был" }]);
    });
});
