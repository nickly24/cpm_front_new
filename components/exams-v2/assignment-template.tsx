"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { buildAssignmentWorkbook, loadAssignmentStudents } from "@/lib/exams-v2/assignment-workbook";
import { examContextKey } from "@/lib/bff/exams-shared";
import type { Person } from "@/lib/exams-v2/types";
import { Action, ErrorNotice, Field, PersonPicker } from "./shared";
import s from "./exams.module.css";

export function AssignmentTemplate({ examId }: { examId: number }) {
  const [open, setOpen] = useState(false), [members, setMembers] = useState<Person[]>([]), [limit, setLimit] = useState("0");
  const [progress, setProgress] = useState<number | null>(null), [error, setError] = useState<Error | null>(null), [downloaded, setDownloaded] = useState<number | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const download = async () => {
    if (request.current) return;
    const controller = new AbortController(), context = examContextKey(); request.current = controller;
    setProgress(0); setError(null); setDownloaded(null);
    try {
      const students = await loadAssignmentStudents(controller.signal, setProgress);
      const blob = await buildAssignmentWorkbook(students, members, Number(limit));
      controller.signal.throwIfAborted();
      if (context !== examContextKey()) throw new Error("Кабинет изменился. Подготовьте файл заново.");
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `exam-${examId}-assignments.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloaded(students.length);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error("Не удалось подготовить файл"));
    } finally { if (request.current === controller) { request.current = null; setProgress(null); } }
  };
  const busy = progress !== null;
  return <details className={s.importBuilder} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Подготовить Excel с учениками и комиссией</summary>
    {open && <div className={s.stack}>
      <p className={s.muted}>Файл включит всех активных учеников выбранного подразделения и одну комиссию. В Excel можно удалить лишние строки и поменять состав для отдельных учеников. Назначения появятся после загрузки и подтверждения файла.</p>
      <div className={s.row}>{members.map(member => <span className={s.importMember} key={member.id}>{member.fullName}<Action disabled={busy} aria-label={`Убрать ${member.fullName}`} onClick={() => setMembers(old => old.filter(m => m.id !== member.id))}><X aria-hidden="true" /></Action></span>)}</div>
      {members.length < 6 && <PersonPicker kind="examinators" label={`Комиссия · ${members.length} из 6`} value={null} exclude={members.map(m => m.id)} disabled={busy} onChange={member => { if (member) setMembers(old => old.some(m => m.id === member.id) ? old : [...old, member].slice(0, 6)); }} />}
      <Field label="Лимит замен вопросов" hint="Одинаковый для всех строк; можно изменить в Excel"><input className={s.input} type="number" min="0" max="100" step="1" value={limit} disabled={busy} onChange={event => setLimit(event.target.value)} /></Field>
      <div className={s.row}><Action disabled={busy || members.length === 0 || !/^\d+$/.test(limit) || Number(limit) > 100} onClick={() => void download()}><Download aria-hidden="true" />{busy ? `Подготовлено учеников: ${progress}…` : "Скачать заполненный Excel"}</Action>{busy && <Action onClick={() => { request.current?.abort(); request.current = null; setProgress(null); }}>Отменить</Action>}</div>
      {downloaded !== null && <p role="status" className={s.success}>Файл подготовлен: {downloaded} учеников. Проверьте распределение и загрузите его ниже. Уже назначенные ученики будут отмечены как конфликт.</p>}
      <ErrorNotice error={error} />
    </div>}
  </details>;
}
