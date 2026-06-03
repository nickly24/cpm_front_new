"use client";

import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  createAdminHomework,
  updateAdminHomework,
} from "@/lib/admin/admin-homework-api";
import type {
  AdminHomeworkFormData,
  AdminHomeworkItem,
  HomeworkKind,
} from "@/lib/admin/admin-homework-types";
import {
  emptyAdminHomeworkForm,
  homeworkToFormData,
} from "@/lib/admin/admin-homework-utils";
import { useEffect, useId, useState } from "react";

type FormMode = "create" | "edit" | "view";

interface AdminHomeworkFormProps {
  mode: FormMode;
  editingHomework?: AdminHomeworkItem | null;
  embedded?: boolean;
  onBack: () => void;
  onSaved: () => void;
}

export function AdminHomeworkForm({
  mode,
  editingHomework = null,
  embedded = false,
  onBack,
  onSaved,
}: AdminHomeworkFormProps) {
  const publishedId = useId();
  const isReadOnly = mode === "view";
  const [form, setForm] = useState<AdminHomeworkFormData>(emptyAdminHomeworkForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingHomework && (mode === "edit" || mode === "view")) {
      setForm(homeworkToFormData(editingHomework));
    } else if (mode === "create") {
      setForm(emptyAdminHomeworkForm());
    }
  }, [editingHomework, mode]);

  const title =
    mode === "view"
      ? "Просмотр домашнего задания"
      : mode === "edit"
        ? "Редактирование домашнего задания"
        : "Создание домашнего задания";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!form.name.trim()) {
      setError("Укажите название");
      return;
    }
    if (!form.deadline) {
      setError("Укажите дедлайн");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        await createAdminHomework(form);
      } else if (editingHomework) {
        await updateAdminHomework(editingHomework.id, form);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось сохранить задание",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? styles.embeddedForm : styles.fullscreenShell}>
      {!embedded ? (
        <header className={styles.fullscreenHeader}>
          <div className={styles.fullscreenHeaderContent}>
            <AdminFullscreenBack onBack={onBack} />
            <h1 className={styles.fullscreenTitle}>{title}</h1>
          </div>
        </header>
      ) : (
        <h2 className={styles.formSectionTitle}>{title}</h2>
      )}

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <form
        className={embedded ? styles.formEmbedded : styles.formWrap}
        onSubmit={handleSubmit}
      >
        <section className={styles.formSection}>
          <h3 className={styles.formSectionTitle}>Параметры</h3>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Название</span>
            <input
              className={styles.input}
              name="name"
              value={form.name}
              readOnly={isReadOnly}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Тип</span>
            <select
              className={styles.input}
              name="type"
              value={form.type}
              disabled={isReadOnly}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  type: e.target.value as HomeworkKind,
                }))
              }
            >
              <option value="ДЗНВ">ДЗНВ</option>
              <option value="ОВ">ОВ</option>
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Дедлайн</span>
            <input
              className={styles.input}
              type="date"
              name="deadline"
              value={form.deadline}
              readOnly={isReadOnly}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, deadline: e.target.value }))
              }
              required
            />
          </label>

          <div className={styles.formToggles}>
            <Toggle
              id={publishedId}
              label="Видимость для студентов"
              variant="success"
              checked={form.published}
              disabled={isReadOnly}
              onChange={(checked) =>
                setForm((prev) => ({ ...prev, published: checked }))
              }
            />
          </div>
        </section>

        {!isReadOnly && !embedded ? (
          <div className={styles.formTopBar}>
            <Button type="button" variant="ghost" onClick={onBack}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Сохранение…"
                : mode === "create"
                  ? "Создать"
                  : "Сохранить"}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
