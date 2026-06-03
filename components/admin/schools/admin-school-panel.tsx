"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { Button } from "@/components/ui/button";
import {
  createAdminSchool,
  updateAdminSchool,
} from "@/lib/admin/admin-schools-api";
import type { AdminSchool } from "@/lib/admin/admin-schools-types";
import { useEffect, useState } from "react";

interface AdminSchoolPanelProps {
  mode: "create" | "edit";
  school: AdminSchool | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function AdminSchoolPanel({
  mode,
  school,
  onClose,
  onSaved,
}: AdminSchoolPanelProps) {
  const [name, setName] = useState(school?.name ?? "");
  const [shortName, setShortName] = useState(school?.short_name ?? "");
  const [notes, setNotes] = useState(school?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Укажите название");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "create") {
        const res = await createAdminSchool({
          name: name.trim(),
          short_name: shortName.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        if (!res.status) {
          throw new Error(res.error || "Не удалось создать школу");
        }
      } else if (school) {
        const res = await updateAdminSchool(school.school_id, {
          name: name.trim(),
          short_name: shortName.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        if (!res.status) {
          throw new Error(res.error || "Не удалось сохранить");
        }
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {mode === "create" ? "Новая школа" : "Редактирование школы"}
        </h1>
        <Button type="button" variant="ghost" onClick={onClose}>
          ← Назад
        </Button>
      </header>

      <form className={userStyles.formGrid} onSubmit={handleSubmit}>
        <label className={userStyles.field}>
          <span className={userStyles.fieldLabel}>Название</span>
          <input
            className={userStyles.fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className={userStyles.field}>
          <span className={userStyles.fieldLabel}>Короткое имя</span>
          <input
            className={userStyles.fieldInput}
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
          />
        </label>

        <label className={userStyles.field}>
          <span className={userStyles.fieldLabel}>Комментарий</span>
          <textarea
            className={userStyles.fieldTextarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {error ? <p className={styles.errorText}>{error}</p> : null}

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
  );
}
