"use client";

import adminStyles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import scheduleStyles from "@/components/schedule/schedule.module.css";
import { Button } from "@/components/ui/button";
import {
  SCHEDULE_DAYS,
  type ScheduleDay,
} from "@/lib/schedule/constants";
import type { ScheduleLessonFormData } from "@/lib/schedule/types";
import { createEmptyLessonForm } from "@/lib/schedule/utils";
import { useEffect, useState } from "react";

interface AdminLessonFormPanelProps {
  mode: "create" | "edit";
  initialData?: ScheduleLessonFormData;
  defaultDay?: ScheduleDay;
  onClose: () => void;
  onSubmit: (data: ScheduleLessonFormData) => Promise<void>;
}

export function AdminLessonFormPanel({
  mode,
  initialData,
  defaultDay,
  onClose,
  onSubmit,
}: AdminLessonFormPanelProps) {
  const [form, setForm] = useState<ScheduleLessonFormData>(
    initialData ?? createEmptyLessonForm(defaultDay),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const updateField = <K extends keyof ScheduleLessonFormData>(
    key: K,
    value: ScheduleLessonFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.lesson_name.trim()) {
      setError("Укажите название занятия");
      return;
    }

    if (!form.teacher_name.trim()) {
      setError("Укажите преподавателя");
      return;
    }

    if (!form.location.trim()) {
      setError("Укажите место проведения");
      return;
    }

    if (form.start_time >= form.end_time) {
      setError("Время окончания должно быть позже начала");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        ...form,
        lesson_name: form.lesson_name.trim(),
        teacher_name: form.teacher_name.trim(),
        location: form.location.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={userStyles.overlay} onClick={onClose}>
      <div
        className={userStyles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-form-title"
      >
        <h2 id="lesson-form-title" className={userStyles.modalTitle}>
          {mode === "create" ? "Новое занятие" : "Редактировать занятие"}
        </h2>

        <form className={userStyles.formGrid} onSubmit={handleSubmit}>
          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>День недели</span>
            <select
              className={userStyles.fieldSelect}
              value={form.day_of_week}
              onChange={(event) =>
                updateField("day_of_week", event.target.value as ScheduleDay)
              }
              required
            >
              {SCHEDULE_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>

          <div className={scheduleStyles.formRow}>
            <label className={userStyles.field}>
              <span className={userStyles.fieldLabel}>Начало</span>
              <input
                type="time"
                className={userStyles.fieldInput}
                value={form.start_time}
                onChange={(event) => updateField("start_time", event.target.value)}
                required
              />
            </label>
            <label className={userStyles.field}>
              <span className={userStyles.fieldLabel}>Окончание</span>
              <input
                type="time"
                className={userStyles.fieldInput}
                value={form.end_time}
                onChange={(event) => updateField("end_time", event.target.value)}
                required
              />
            </label>
          </div>

          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>Название</span>
            <input
              className={userStyles.fieldInput}
              value={form.lesson_name}
              onChange={(event) => updateField("lesson_name", event.target.value)}
              placeholder="Например, Математика"
              required
            />
          </label>

          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>Преподаватель</span>
            <input
              className={userStyles.fieldInput}
              value={form.teacher_name}
              onChange={(event) => updateField("teacher_name", event.target.value)}
              placeholder="Иванов И. И."
              required
            />
          </label>

          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>Место</span>
            <input
              className={userStyles.fieldInput}
              value={form.location}
              onChange={(event) => updateField("location", event.target.value)}
              placeholder="Аудитория 101"
              required
            />
          </label>

          {error ? <p className={adminStyles.errorText}>{error}</p> : null}

          <div className={userStyles.modalActions}>
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
