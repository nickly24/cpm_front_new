"use client";

import attendanceStyles from "@/components/admin/attendance/admin-attendance.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { createClassDay, updateClassDay } from "@/lib/attendance/attendance-api";
import type { ClassDay } from "@/lib/attendance/attendance-types";
import { todayIsoDate } from "@/lib/attendance/attendance-utils";
import { useState } from "react";

interface ClassDayFormModalProps {
  mode: "create" | "edit";
  editingDay?: ClassDay | null;
  onClose: () => void;
  onSaved: (id: number) => void | Promise<void>;
}

export function ClassDayFormModal({
  mode,
  editingDay = null,
  onClose,
  onSaved,
}: ClassDayFormModalProps) {
  const [date, setDate] = useState(editingDay?.date ?? todayIsoDate());
  const [comment, setComment] = useState(editingDay?.comment ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title =
    mode === "create" ? "Создать день занятий" : "Редактировать день занятий";
  const submitLabel =
    mode === "create"
      ? loading
        ? "Создание…"
        : "Создать"
      : loading
        ? "Сохранение…"
        : "Сохранить";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        date,
        comment: comment.trim() || undefined,
      };

      const result =
        mode === "create"
          ? await createClassDay(payload)
          : await updateClassDay(editingDay!.id, payload);

      if (result.status && result.id) {
        await onSaved(result.id);
        onClose();
        return;
      }

      setError(result.error ?? "Не удалось сохранить день");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={attendanceStyles.modalOverlay} onClick={onClose}>
      <form
        className={attendanceStyles.modal}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <h3 className={attendanceStyles.modalTitle}>{title}</h3>
        <div className={attendanceStyles.modalField}>
          <label className={attendanceStyles.fieldLabel} htmlFor="class-day-date">
            Дата
          </label>
          <input
            id="class-day-date"
            type="date"
            className={attendanceStyles.modalInput}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
        <div className={attendanceStyles.modalField}>
          <label className={attendanceStyles.fieldLabel} htmlFor="class-day-comment">
            Комментарий
          </label>
          <input
            id="class-day-comment"
            type="text"
            className={attendanceStyles.modalInput}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Тема занятия"
          />
        </div>
        {error ? <p className={styles.errorText}>{error}</p> : null}
        <div className={attendanceStyles.modalActions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={loading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
