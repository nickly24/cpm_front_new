"use client";

import { AdminLessonFormPanel } from "@/components/admin/schedule/admin-lesson-form-panel";
import styles from "@/components/schedule/schedule.module.css";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import {
  createScheduleLesson,
  deleteScheduleLesson,
  fetchSchedule,
  updateScheduleLesson,
} from "@/lib/schedule/schedule-api";
import type { ScheduleLesson, ScheduleLessonFormData } from "@/lib/schedule/types";
import { lessonToFormData } from "@/lib/schedule/utils";
import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type FormState =
  | { mode: "create" }
  | { mode: "edit"; lesson: ScheduleLesson };

export function AdminScheduleSection() {
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchSchedule();

      if (response.status) {
        setLessons(response.schedule ?? []);
      } else {
        setLessons([]);
        setError(response.error ?? "Не удалось загрузить расписание");
      }
    } catch (err) {
      setLessons([]);
      setError(
        err instanceof ApiError
          ? err.message
          : "Ошибка при загрузке расписания",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const handleCreate = async (data: ScheduleLessonFormData) => {
    setActionBusy(true);
    try {
      const response = await createScheduleLesson(data);
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось добавить занятие");
      }
      await loadSchedule();
    } finally {
      setActionBusy(false);
    }
  };

  const handleUpdate = async (lessonId: string, data: ScheduleLessonFormData) => {
    setActionBusy(true);
    try {
      const response = await updateScheduleLesson(lessonId, data);
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось обновить занятие");
      }
      await loadSchedule();
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async (lessonId: string) => {
    const lesson = lessons.find((item) => item._id === lessonId);
    const label = lesson?.lesson_name ?? "занятие";

    if (!window.confirm(`Удалить «${label}» из расписания?`)) {
      return;
    }

    setActionBusy(true);
    setError(null);

    try {
      const response = await deleteScheduleLesson(lessonId);
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось удалить занятие");
      }
      await loadSchedule();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Ошибка удаления",
      );
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Расписание</h1>
          <p className={styles.pageSubtitle}>
            Недельная сетка занятий. Клик по паре — редактирование, конфликты
            времени проверяются на сервере.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void loadSchedule()}
            disabled={loading || actionBusy}
          >
            <RefreshCw size={16} style={{ marginRight: 6 }} />
            Обновить
          </Button>
          <Button
            type="button"
            onClick={() => setFormState({ mode: "create" })}
            disabled={actionBusy}
          >
            <Plus size={16} style={{ marginRight: 6 }} />
            Добавить
          </Button>
        </div>
      </header>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <ScheduleBoard
        lessons={lessons}
        loading={loading}
        mode="manage"
        onEditLesson={(lesson) => setFormState({ mode: "edit", lesson })}
        onDeleteLesson={(lessonId) => void handleDelete(lessonId)}
      />

      {formState?.mode === "create" ? (
        <AdminLessonFormPanel
          mode="create"
          onClose={() => setFormState(null)}
          onSubmit={handleCreate}
        />
      ) : null}

      {formState?.mode === "edit" ? (
        <AdminLessonFormPanel
          mode="edit"
          initialData={lessonToFormData(formState.lesson)}
          onClose={() => setFormState(null)}
          onSubmit={(data) => handleUpdate(formState.lesson._id, data)}
        />
      ) : null}
    </div>
  );
}
