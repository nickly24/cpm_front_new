"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Action, Empty, ErrorNotice, Loading } from "@/components/exams-v2/shared";
import type { ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import { coreReport, coreReportCellKey, coreReportCellLabel, coreReportColumns, coreReportRows, coreReportItemKindLabel, exportCoreReport, type CoreReportKind } from "@/lib/bff/core-reports";
import { useRatingResource } from "@/lib/ratings/use-rating-resource";
import s from "./core-report.module.css";

const TITLES = { tests: "Результаты тестов", exams: "Результаты экзаменов", attendance: "Посещаемость" };
const DESCRIPTIONS = {
  tests: "Опубликованные тесты, официально отправленные работы и внешние тесты. До отправки попытка в отчёт не входит. «Без оценки» означает сохранённый внешний результат без процента.",
  exams: "Текущие результаты завершённых экзаменов с учётом пересдач и решений по апелляциям.",
  attendance: "Отметки посещаемости за период. Отсутствие отметки означает «Не отмечено».",
};

export function CoreReportWorkspace({ kind, period, onBack }: { kind: CoreReportKind; period: ReportPeriodSelection; onBack: () => void }) {
  const { user } = useAuth();
  const scope = user?.context_revision || `${user?.organization_id}:${user?.division_id}:${user?.account_id}`;
  return <CoreReportContent key={`${scope}:${kind}:${period.dateFrom}:${period.dateTo}`} kind={kind} period={period} onBack={onBack} scope={scope} />;
}
function CoreReportContent({ kind, period, onBack, scope }: { kind: CoreReportKind; period: ReportPeriodSelection; onBack: () => void; scope: string }) {
  const [search, setSearch] = useState(""); const [group, setGroup] = useState(""); const [school, setSchool] = useState(""); const [studentClass, setStudentClass] = useState(""); const [direction, setDirection] = useState("");
  const [exportError, setExportError] = useState<Error | null>(null);
  const load = useCallback((signal: AbortSignal) => coreReport(kind, period, signal), [kind, period]);
  const report = useRatingResource(`${scope}:core-report:${kind}:${period.dateFrom}:${period.dateTo}`, load);
  const data = report.data; const rows = data ? coreReportRows(data, { search, group, school, class: studentClass }) : []; const columns = data ? coreReportColumns(data, direction) : [];
  const values = new Map(data?.cells.map((cell) => [coreReportCellKey(cell.account_id, cell.item_id), cell]));
  const groups = new Map(data?.students.filter((student) => student.group_id !== null).map((student) => [student.group_id, student.group_name]));
  const schools = new Map(data?.students.filter((student) => student.school_id !== null).map((student) => [student.school_id, student.school_name]));
  const directions = new Map(data?.items.filter((item) => item.direction_id).map((item) => [item.direction_id, item.direction_name || `Направление ${item.direction_id}`]));
  const classes = [...new Set(data?.students.flatMap((student) => student.class === null ? [] : [student.class]))].sort((a, b) => a - b);
  const download = () => { if (!data) return; try { exportCoreReport(data, rows, columns); setExportError(null); } catch (error) { setExportError(error instanceof Error ? error : new Error("Не удалось сохранить отчёт")); } };
  return <div className={s.page}>
    <header className={s.panel}><div className={s.header}><h1 className={s.title}>{TITLES[kind]}</h1><Action onClick={onBack}>Изменить период</Action></div><p className={s.subtitle}>{DESCRIPTIONS[kind]}</p><p className={s.subtitle}>{period.dateFrom} — {period.dateTo}</p>
      <div className={s.controls}><Action onClick={report.reload}>Обновить отчёт</Action><Action disabled={!data || report.loading || !rows.length || !columns.length || Boolean(report.error)} onClick={download}>Скачать Excel</Action></div>
    </header>
    <section className={s.panel} aria-label={TITLES[kind]}>
      <ErrorNotice error={report.error} reload={report.reload} /><ErrorNotice error={exportError} />
      {report.loading && <Loading text="Загрузка отчёта…" />}
      {report.error && data && <p role="status" className={s.notice}>Не удалось обновить данные. Ниже показан отчёт, полученный ранее.</p>}
      {data && <><div className={s.controls}>
        <label className={s.label}>Поиск ученика<input className={s.input} value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="ФИО, группа или школа" /></label>
        <label className={s.label}>Группа<select aria-label="Группа" className={s.select} value={group} onChange={(event) => setGroup(event.target.value)}><option value="">Все группы</option><option value="none">Без группы</option>{[...groups].map(([id, name]) => <option key={id} value={String(id)}>{name || `Группа ${id}`}</option>)}</select></label>
        <label className={s.label}>Школа<select aria-label="Школа" className={s.select} value={school} onChange={(event) => setSchool(event.target.value)}><option value="">Все школы</option><option value="none">Без школы</option>{[...schools].map(([id, name]) => <option key={id} value={String(id)}>{name || `Школа ${id}`}</option>)}</select></label>
        <label className={s.label}>Класс<select aria-label="Класс" className={s.select} value={studentClass} onChange={(event) => setStudentClass(event.target.value)}><option value="">Все классы</option><option value="none">Без класса</option>{classes.map((value) => <option key={value} value={String(value)}>{value}</option>)}</select></label>
        {kind !== "attendance" && <label className={s.label}>Направление<select aria-label="Направление" className={s.select} value={direction} onChange={(event) => setDirection(event.target.value)}><option value="">Все направления</option>{[...directions].map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}</select></label>}
      </div>
      <p className={s.subtitle}>Учеников: {rows.length} из {data.students.length} · {kind === "attendance" ? "Дней" : "Работ"}: {columns.length} · Получено: {new Date(data.as_of).toLocaleString("ru-RU")}</p>
      {!data.items.length ? <Empty>За выбранный период нет {kind === "attendance" ? "дней занятий" : kind === "tests" ? "опубликованных тестов" : "экзаменов"}.</Empty> : !rows.length ? <Empty>Ученики по выбранным фильтрам не найдены.</Empty> : !columns.length ? <Empty>Работы по выбранному направлению не найдены.</Empty> : <div className={s.tableWrap}><table className={s.table}>
        <thead><tr><th>Ученик</th><th>Класс</th><th>Группа</th><th>Школа</th>{columns.map((item) => <th key={item.id}>{item.name}<small>{item.date}{coreReportItemKindLabel(item) ? ` · ${coreReportItemKindLabel(item)}` : ""}</small></th>)}</tr></thead>
        <tbody>{rows.map((student) => <tr key={student.account_id}><th scope="row">{student.full_name}</th><td>{student.class ?? "Без класса"}</td><td>{student.group_name || "Без группы"}</td><td>{student.school_name || "Без школы"}</td>{columns.map((item) => { const cell = values.get(coreReportCellKey(student.account_id, item.id)); return <td key={item.id} data-status={cell?.status} className={cell?.status === "ready" || cell?.status === "completed" ? s.score : undefined}><span>{coreReportCellLabel(cell, kind)}</span>{cell?.attempt_no ? <small>Попытка {cell.attempt_no}</small> : null}{cell?.has_appeal ? <small>С учётом апелляции</small> : null}</td>; })}</tr>)}</tbody>
      </table></div>}</>}
    </section>
  </div>;
}
