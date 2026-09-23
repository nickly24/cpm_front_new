"use client";

import { useState } from "react";
import type { ExamSummary } from "@/lib/exams-v2/types";
import { examMutate } from "@/lib/exams-v2/api";
import { useExamResource } from "@/lib/exams-v2/hooks";
import { ApiError } from "@/lib/api/client";
import { ExamTrainingPreview } from "@/components/student/training/exam-training";
import { Action, ErrorNotice, Modal } from "./shared";
import s from "./exams.module.css";

interface TrainingState { exam: ExamSummary; parts_count: number; cards_count: number }

export function ExamTrainingToolbar({ examId, canEdit, onChanged, openBank }: {
  examId: number; canEdit: boolean; onChanged: () => void; openBank: () => void;
}) {
  const resource = useExamResource<TrainingState>(`/api/exams/${examId}/training`);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const state = resource.data;
  const toggle = async () => {
    if (!state || saving || !canEdit) return;
    setSaving(true);
    setNotice("");
    try {
      await examMutate<TrainingState>({ path: `/api/exams/${examId}/training`, method: "PATCH",
        body: { enabled: !state.exam.trainingEnabled, expectedVersion: state.exam.version }, key: crypto.randomUUID(), createdAt: Date.now() });
      setNotice("Доступ к подготовке сохранён");
      onChanged();
    } catch (error) {
      setNotice(error instanceof ApiError && error.status === 409
        ? "Настройка изменена другим пользователем. Обновите данные и повторите действие"
        : error instanceof Error ? error.message : "Не удалось сохранить доступ к подготовке");
    } finally {
      // Also resolves an uncertain transport outcome before another toggle is allowed.
      resource.reload();
      setSaving(false);
    }
  };
  return <section className={s.panel} aria-label="Подготовка по карточкам">
    <div className={s.header}><h2>Подготовка по карточкам</h2><div className={s.row}>
      <Action onClick={() => setPreview(true)}>Предпросмотр подготовки</Action><Action onClick={openBank}>Части и вопросы</Action>
    </div></div>
    <ErrorNotice error={resource.error} reload={resource.reload} />
    {state ? <>
      <label className={s.row}><input type="checkbox" checked={Boolean(state.exam.trainingEnabled)} disabled={!canEdit || saving || resource.loading || Boolean(resource.error)} onChange={() => void toggle()} />Доступен студентам для подготовки</label>
      <p className={s.muted}>Студенты смогут просматривать вопросы и эталонные ответы и учить их в карточках. Доступ не зависит от периода проведения экзамена.</p>
      <p>{state.exam.trainingEnabled ? state.cards_count ? "Подготовка открыта" : "Нет вопросов для подготовки" : "Подготовка скрыта"} · Частей: {state.parts_count} · Карточек: {state.cards_count}</p>
      {!state.cards_count && !state.exam.trainingEnabled ? <p className={s.muted}>Добавьте хотя бы один вопрос с эталонным ответом, чтобы открыть подготовку студентам.</p> : null}
    </> : null}
    {saving || resource.loading ? <p role="status">{saving ? "Сохранение…" : "Обновление состояния…"}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {preview ? <Modal title="Предпросмотр подготовки" onClose={() => setPreview(false)}><ExamTrainingPreview examId={examId} /></Modal> : null}
  </section>;
}
