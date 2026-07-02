"use client";

import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { createExternalAdminTest } from "@/lib/admin/admin-tests-api";
import type {
  AdminExternalTestFormData,
  Direction,
} from "@/lib/admin/admin-tests-types";
import { useMemo, useState } from "react";

interface AdminExternalTestFormProps {
  directions: Direction[];
  defaultDirection?: string;
  onBack: () => void;
  onSaved: (directionName?: string) => void;
}

export function AdminExternalTestForm({
  directions,
  defaultDirection = "",
  onBack,
  onSaved,
}: AdminExternalTestFormProps) {
  const defaultDirectionId = useMemo(() => {
    return (
      directions.find((direction) => direction.name === defaultDirection)?.id ??
      directions[0]?.id ??
      0
    );
  }, [defaultDirection, directions]);

  const [formData, setFormData] = useState<AdminExternalTestFormData>({
    name: "",
    direction_id: defaultDirectionId,
    date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedDirectionId = formData.direction_id || defaultDirectionId;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError("Укажите название теста");
      return;
    }
    if (!selectedDirectionId) {
      setError("Выберите направление");
      return;
    }
    if (!formData.date) {
      setError("Укажите дату проведения");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createExternalAdminTest({
        ...formData,
        name: formData.name.trim(),
        direction_id: selectedDirectionId,
      });
      const selectedDirection = directions.find(
        (direction) => direction.id === selectedDirectionId,
      );
      onSaved(selectedDirection?.name);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось создать внешний тест",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${styles.fullscreenShell} ${styles.formWrap}`}>
      <header className={styles.fullscreenHeader}>
        <div className={styles.fullscreenHeaderContent}>
          <AdminFullscreenBack onBack={onBack} />
          <h1 className={styles.fullscreenTitle}>Создание теста вне системы</h1>
        </div>
      </header>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.formSection}>
          <h3 className={styles.formSectionTitle}>Основная информация</h3>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Название теста</span>
            <input
              className={styles.input}
              name="name"
              value={formData.name}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, name: event.target.value }))
              }
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Направление</span>
            <select
              className={styles.input}
              name="direction_id"
              value={selectedDirectionId || ""}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  direction_id: Number(event.target.value),
                }))
              }
              required
            >
              <option value="">Выберите направление</option>
              {directions.map((direction) => (
                <option key={direction.id} value={direction.id}>
                  {direction.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Дата проведения</span>
            <input
              className={styles.input}
              type="date"
              name="date"
              value={formData.date}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, date: event.target.value }))
              }
              required
            />
          </label>

          <p className={styles.externalNotice}>
            Внешний тест хранится без вопросов и попыток CPM-LMS. В списке
            студента он будет доступен только для просмотра результата.
          </p>
        </section>

        <Button type="submit" disabled={saving}>
          {saving ? "Сохранение…" : "Создать внешний тест"}
        </Button>
      </form>
    </div>
  );
}
