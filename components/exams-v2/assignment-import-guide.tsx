"use client";

import { useEffect, useRef, useState } from "react";
import { examContextKey } from "@/lib/bff/exams-shared";
import { exportExamParticipants } from "@/lib/bff/exam-participants";
import { Action, ErrorNotice } from "./shared";
import { AssignmentTemplate } from "./assignment-template";
import s from "./exams.module.css";

export function AssignmentImportGuide({ examId }: { examId: number }) {
  const request = useRef<AbortController | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const download = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setCount(0); setError(null);
    try {
      const blob = await exportExamParticipants(controller.signal, setCount);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = `exam-${examId}-participants.csv`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error("Не удалось выгрузить участников"));
    } finally { request.current = null; if (!controller.signal.aborted) setCount(null); }
  };
  return <div className={s.stack}>
    <p className={s.muted}>Распределение применяется только к экзамену №{examId} в выбранном подразделении.</p>
    <AssignmentTemplate key={`${examContextKey()}:${examId}`} examId={examId} />
    <details className={s.importInstructions}><summary>Как заполнить файл вручную</summary>
    <ol>
      <li>Скачайте шаблон Excel и список участников подразделения.</li>
      <li>Одна строка — один ученик и его комиссия: от 1 до 6 экзаменаторов. Для комиссии из одного человека заполните только examinator_1_id или examinator_1_login.</li>
      <li>В student_id и examinator_N_id переносите <strong>account_id</strong>. profile_id — справочный номер профиля, он не подходит для импорта. Можно вместо ID использовать точный логин, сохранив начальные нули.</li>
      <li>Укажите replacement_limit — число разрешённых замен вопросов. Проверьте строки в предпросмотре и примените импорт целиком.</li>
    </ol>
    </details>
    <p className={s.muted}>Одинаковый состав экзаменаторов объединяется в одну комиссию. Существующие назначения учеников не заменяются: конфликт будет виден до сохранения. Все участники должны быть активны и иметь доступ в это подразделение.</p>
    <div><Action disabled={count !== null} onClick={() => void download()}>{count !== null ? `Выгружаем: ${count} участников…` : "Скачать участников подразделения · CSV"}</Action></div>
    <p className={s.muted}>В списке — ID для импорта, логины, ФИО и подразделение. Если экзаменатора нет, добавьте ему подразделение: «Пользователи → Сотрудники → Экзаменаторы».</p>
    <ErrorNotice error={error} />
  </div>;
}
