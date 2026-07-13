"use client";

import styles from "@/components/admin/training/admin-training.module.css";
import uploadStyles from "@/components/admin/upload/admin-upload.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  commitCardTransformSession,
  createCardTransformSession,
} from "@/lib/admin/admin-upload-api";
import type { AdminTrainingCardRow, AdminTrainingSectionRow } from "@/lib/training/admin-training-types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface AdminCardsToDraftModalProps {
  section: AdminTrainingSectionRow;
  cards: AdminTrainingCardRow[];
  onClose: () => void;
}

export function AdminCardsToDraftModal({
  section,
  cards,
  onClose,
}: AdminCardsToDraftModalProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(cards.map((card) => card.id)),
  );
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return cards;
    }
    return cards.filter(
      (card) =>
        card.question.toLowerCase().includes(query) ||
        card.answer.toLowerCase().includes(query),
    );
  }, [cards, search]);

  const draftTitle = `${section.name} — тест`;
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    filteredCards.length > 0 &&
    filteredCards.every((card) => selectedIds.has(card.id));

  const toggleCard = (cardId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredCards.forEach((card) => next.add(card.id));
      return next;
    });
  };

  const clearVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredCards.forEach((card) => next.delete(card.id));
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!section.id || selectedCount === 0) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await createCardTransformSession(
        section.id,
        Array.from(selectedIds),
      );
      if (!session.status) {
        throw new Error("Не удалось подготовить трансформацию");
      }
      await commitCardTransformSession(session.session_id);
      onClose();
      router.push("/cabinet/admin/upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить трансформацию");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 720, width: "min(720px, 96vw)" }}
      >
        <h2 className={styles.modalTitle}>Трансформировать в тест</h2>
        <p className={styles.modalHint}>
          Раздел «{section.name}». Драфт будет называться «{draftTitle}». Каждая
          карточка станет text-вопросом с одним ответом целиком. Прогресс — в
          разделе «Загрузка» → «Журнал».
        </p>

        <div className={uploadStyles.previewFilters}>
          <input
            type="search"
            className={styles.input}
            placeholder="Поиск по вопросу или ответу…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="button" variant="ghost" size="sm" onClick={selectAllVisible}>
            {allVisibleSelected ? "Снять видимые" : "Выбрать видимые"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearVisible}>
            Снять выбор
          </Button>
        </div>

        <p className={styles.modalHint}>
          Выбрано: <strong>{selectedCount}</strong> из {cards.length}
        </p>

        <div
          className={uploadStyles.previewTableWrap}
          style={{ maxHeight: 360, marginBottom: 16 }}
        >
          <table className={uploadStyles.previewTable}>
            <thead>
              <tr>
                <th />
                <th>Вопрос</th>
                <th>Ответ</th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.map((card) => (
                <tr key={card.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(card.id)}
                      onChange={() => toggleCard(card.id)}
                    />
                  </td>
                  <td>{card.question}</td>
                  <td>{card.answer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error ? <p className={styles.alert}>{error}</p> : null}

        <div className={uploadStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={submitting || selectedCount === 0}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Запуск…" : "Запустить трансформацию"}
          </Button>
        </div>

        {submitting ? (
          <LoadingState label="Запуск фоновой трансформации…" variant="inline" />
        ) : null}
      </div>
    </div>
  );
}
