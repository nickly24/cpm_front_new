"use client";
import { BFF_DEV } from "@/lib/config";
import { useExamMutation, useExamResource } from "@/lib/exams-v2/hooks";
import { queryString } from "@/lib/exams-v2/api";
import type { DeletePreview } from "@/lib/exams-v2/types";
import { formatDate } from "@/lib/exams-v2/utils";
import { Action, ErrorNotice, Loading, Modal, MutationNotice } from "./shared";
import s from "./exams.module.css";

const countNames: Record<string, string> = {
  parts: "Части",
  divisions: "Подключённые подразделения",
  outside_results: "Результаты вне LMS",
  classic_results: "Текущие результаты классических экзаменов",
  attempts: "Сдачи",
  attemptsCount: "Сдачи",
  questions: "Вопросы",
  presentedQuestions: "Выданные вопросы",
  presented_questions: "Выданные вопросы",
  votes: "Голоса",
  rounds: "Раунды",
  appeals: "Апелляции",
  assignments: "Назначения",
  commissions: "Комиссии",
  results: "Результаты",
  outsideResults: "Результаты вне LMS",
  retakeAssignments: "Назначения пересдачи",
  privileges: "Привилегии",
};
export function DeleteEntity({
  title,
  description,
  path,
  previewPath,
  version,
  actor,
  canEdit,
  onClose,
  onDeleted,
}: {
  title: string;
  description: string;
  path: string;
  previewPath?: string;
  version?: number;
  actor: string;
  canEdit: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const preview = useExamResource<DeletePreview>(previewPath ?? null);
  const mutation = useExamMutation<void>(`${actor}:delete:${path}`, onDeleted);
  return (
    <Modal title={title} onClose={onClose} busy={mutation.busy}>
      <p className={s.text}>{description}</p>
      <div className={s.warning}>
        Это физическое удаление. Восстановление через интерфейс невозможно.
      </div>
      <ErrorNotice error={preview.error} reload={preview.reload} />
      {preview.loading && <Loading text="Проверяем связанные записи…" />}
      {preview.data && (
        <>
          <ul>
            {Object.entries(preview.data.counts).map(([name, count]) => (
              <li key={name}>
                {countNames[name] ?? name}: {count}
              </li>
            ))}
          </ul>
          <p className={s.muted}>
            {preview.data.expiresAt ? `Подтверждение действительно до ${formatDate(preview.data.expiresAt)}. ` : ""}
            Если данные изменятся, потребуется обновить предпросмотр.
          </p>
        </>
      )}
      <MutationNotice
        mutation={mutation}
        reload={previewPath ? preview.reload : undefined}
      />
      <Action
        danger
        disabled={
          !canEdit ||
          mutation.busy ||
          mutation.uncertain ||
          Boolean(
            previewPath && (!preview.data || preview.loading || preview.error),
          )
        }
        onClick={() =>
          void mutation.execute({
            path: `${path}${queryString({ expectedVersion: version })}`,
            method: "DELETE",
            ...(BFF_DEV ? { body: { expectedVersion: version ?? preview.data?.version, expectedHistoryGeneration: preview.data?.historyGeneration } } : {}),
            confirmationToken: preview.data?.confirmationToken,
          })
        }
      >
        {mutation.busy ? "Удаляем…" : "Удалить безвозвратно"}
      </Action>
    </Modal>
  );
}
