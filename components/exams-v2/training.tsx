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
  return (
    <section aria-label="Подготовка по карточкам">
      <details className={s.trainingPanel}>
        <summary className={s.trainingSummary}>
          Подготовка по карточкам
          {state && <span className={s.badge}>{state.exam.trainingEnabled ? "Открыта студентам" : "Скрыта"} · {state.cards_count} карточек</span>}
        </summary>
        <div className={s.trainingBody}>
          <ErrorNotice error={resource.error} reload={resource.reload} />
          {state && (
            <>
              <label className={s.row}>
                <input type="checkbox" checked={Boolean(state.exam.trainingEnabled)} disabled={!canEdit || saving || resource.loading || Boolean(resource.error)} onChange={() => void toggle()} />
                Доступна студентам для подготовки
              </label>
              <p className={s.muted}>Вопросы и эталонные ответы можно изучать в карточках. Доступ к подготовке не зависит от периода проведения экзамена.</p>
              <p className={s.muted}>Частей: {state.parts_count} · Карточек: {state.cards_count}</p>
              {!state.cards_count && <p className={s.muted}>Добавьте вопрос с эталонным ответом, чтобы студентам было по чему готовиться.</p>}
            </>
          )}
          <div className={s.row}>
            <Action onClick={() => setPreview(true)}>Предпросмотр подготовки</Action>
            <Action onClick={openBank}>Части и вопросы</Action>
          </div>
          {saving || resource.loading ? <p role="status" className={s.muted}>{saving ? "Сохранение…" : "Обновление состояния…"}</p> : null}
          {notice ? <p role="status" className={s.muted}>{notice}</p> : null}
        </div>
      </details>
      {preview && <Modal title="Предпросмотр подготовки" onClose={() => setPreview(false)}><ExamTrainingPreview examId={examId} /></Modal>}
    </section>
  );
}
