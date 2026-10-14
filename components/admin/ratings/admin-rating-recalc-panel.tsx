"use client";

import userStyles from "@/components/admin/users/admin-users.module.css";
import ratingStyles from "@/components/admin/ratings/admin-ratings.module.css";
import adminStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { BFF_DEV } from "@/lib/config";
import { pendingRatingCommand } from "@/lib/admin/admin-ratings-api";
import { useEffect, useState } from "react";

interface AdminRatingRecalcPanelProps {
  onClose: () => void;
  onStarted: () => void;
  onSubmit: (payload: { date_from: string; date_to: string }) => Promise<void>;
  disabled?: boolean;
}

function defaultYearRange() {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function AdminRatingRecalcPanel({
  onClose,
  onStarted,
  onSubmit,
  disabled = false,
}: AdminRatingRecalcPanelProps) {
  const saved = BFF_DEV ? pendingRatingCommand() : null;
  const defaults = saved && "date_from" in saved.body ? { from: saved.body.date_from, to: saved.body.date_to } : defaultYearRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
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
    if (!dateFrom || !dateTo) {
      setError("Укажите обе даты");
      return;
    }
    if (dateFrom > dateTo) {
      setError("Начальная дата должна быть раньше конечной");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ date_from: dateFrom, date_to: dateTo });
      onStarted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить пересчёт");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DismissibleOverlay className={userStyles.overlay} onDismiss={onClose}>
      <div
        className={userStyles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className={userStyles.modalTitle}>Пересчёт рейтинга</h2>
        <p className={ratingStyles.pageSubtitle} style={{ margin: "0 0 16px" }}>
          Задача запустится в фоне. Прогресс и результат — во вкладке «Журнал пересчётов».
        </p>

        <form className={userStyles.formGrid} onSubmit={handleSubmit}>
          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>Дата начала</span>
            <input
              disabled={Boolean(saved) || submitting}
              type="date"
              className={userStyles.fieldInput}
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              required
            />
          </label>
          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>Дата окончания</span>
            <input
              disabled={Boolean(saved) || submitting}
              type="date"
              className={userStyles.fieldInput}
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              required
            />
          </label>

          {saved && !submitting ? <p role="status">Ответ на предыдущий запрос не получен. Повторите его с тем же периодом: сервис вернёт существующую задачу.</p> : null}
          {error ? <p className={adminStyles.errorText}>{error}</p> : null}

          <div className={userStyles.modalActions}>
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting || disabled}>
              {submitting ? "Запуск…" : saved ? "Повторить запрос" : "Запустить пересчёт"}
            </Button>
          </div>
        </form>
      </div>
    </DismissibleOverlay>
  );
}
