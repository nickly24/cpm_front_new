"use client";

import styles from "@/components/admin/training/admin-training.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  createTrainingCard,
  createTrainingTheme,
  deleteTrainingCard,
  deleteTrainingTheme,
  fetchAdminCardsByTheme,
  fetchAdminTrainingCatalog,
  updateTrainingCard,
  updateTrainingTheme,
} from "@/lib/training/admin-training-api";
import type {
  AdminTrainingCardRow,
  AdminTrainingDirectionRow,
  AdminTrainingSectionRow,
} from "@/lib/training/admin-training-types";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AdminView = "directions" | "sections" | "cards";

type ModalKind = "section-create" | "section-edit" | "card-create" | "card-edit";

interface ModalState {
  kind: ModalKind;
  direction?: AdminTrainingDirectionRow;
  section?: AdminTrainingSectionRow;
  card?: AdminTrainingCardRow;
}

function confirmDelete(message: string): boolean {
  return window.confirm(message);
}

function FormModal({
  state,
  directions,
  onClose,
  onSaved,
}: {
  state: ModalState;
  directions: AdminTrainingDirectionRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (state.kind === "section-create") {
      setName("");
      setDirectionId(String(state.direction?.id ?? directions[0]?.id ?? ""));
      return;
    }
    if (state.kind === "section-edit" && state.section) {
      setName(state.section.name);
      setDirectionId(String(state.section.direction_id));
      return;
    }
    if (state.kind === "card-create") {
      setQuestion("");
      setAnswer("");
      return;
    }
    if (state.kind === "card-edit" && state.card) {
      setQuestion(state.card.question);
      setAnswer(state.card.answer);
    }
  }, [directions, state]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const title =
    state.kind === "section-create"
      ? "Новый раздел"
      : state.kind === "section-edit"
        ? "Редактировать раздел"
        : state.kind === "card-create"
          ? "Новая карточка"
          : "Редактировать карточку";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let res;
      switch (state.kind) {
        case "section-create":
          if (!name.trim()) throw new Error("Укажите название");
          if (!directionId) throw new Error("Выберите направление");
          res = await createTrainingTheme({
            name: name.trim(),
            direction_id: Number(directionId),
          });
          break;
        case "section-edit":
          if (!state.section) return;
          res = await updateTrainingTheme(state.section.id, {
            name: name.trim(),
            direction_id: Number(directionId),
          });
          break;
        case "card-create":
          if (!state.section) return;
          if (!question.trim() || !answer.trim()) {
            throw new Error("Заполните вопрос и ответ");
          }
          res = await createTrainingCard({
            theme_id: state.section.id,
            question: question.trim(),
            answer: answer.trim(),
          });
          break;
        case "card-edit":
          if (!state.card) return;
          if (!question.trim() || !answer.trim()) {
            throw new Error("Заполните вопрос и ответ");
          }
          res = await updateTrainingCard(state.card.id, {
            question: question.trim(),
            answer: answer.trim(),
          });
          break;
      }
      if (!res?.success) {
        throw new Error(res?.error ?? "Ошибка сохранения");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
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
      >
        <h2 className={styles.modalTitle}>{title}</h2>
        {(state.kind === "section-create" || state.kind === "section-edit") && (
          <p className={styles.modalHint}>
            Раздел — набор карточек внутри направления (предмета).
          </p>
        )}

        <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
          {(state.kind === "section-create" ||
            state.kind === "section-edit") && (
            <>
              <label className={styles.field}>
                <span className={styles.label}>Название раздела</span>
                <input
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Направление</span>
                <select
                  className={styles.input}
                  value={directionId}
                  onChange={(e) => setDirectionId(e.target.value)}
                >
                  {directions.map((direction) => (
                    <option key={direction.id} value={direction.id}>
                      {direction.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {(state.kind === "card-create" || state.kind === "card-edit") && (
            <>
              <label className={styles.field}>
                <span className={styles.label}>Вопрос</span>
                <textarea
                  className={styles.textarea}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  autoFocus
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Ответ</span>
                <textarea
                  className={styles.textarea}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </label>
            </>
          )}

          {error ? <p className={styles.formError}>{error}</p> : null}

          <div className={styles.formActions}>
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

export function AdminTrainingSection() {
  const [view, setView] = useState<AdminView>("directions");
  const [directions, setDirections] = useState<AdminTrainingDirectionRow[]>([]);
  const [selectedDirection, setSelectedDirection] =
    useState<AdminTrainingDirectionRow | null>(null);
  const [selectedSection, setSelectedSection] =
    useState<AdminTrainingSectionRow | null>(null);
  const [cards, setCards] = useState<AdminTrainingCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminTrainingCatalog();
      setDirections(data);
      setSelectedDirection((prev) => {
        if (!prev) return prev;
        return data.find((d) => d.id === prev.id) ?? prev;
      });
      setSelectedSection((prev) => {
        if (!prev) return prev;
        for (const direction of data) {
          const section = direction.sections.find((s) => s.id === prev.id);
          if (section) return section;
        }
        return prev;
      });
    } catch (err) {
      setDirections([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [reloadKey]);

  const loadCards = useCallback(async (sectionId: number) => {
    setCardsLoading(true);
    setError(null);
    try {
      setCards(await fetchAdminCardsByTheme(sectionId));
    } catch (err) {
      setCards([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки карточек");
    } finally {
      setCardsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (view === "cards" && selectedSection) {
      void loadCards(selectedSection.id);
    }
  }, [view, selectedSection, loadCards, reloadKey]);

  const refresh = () => setReloadKey((v) => v + 1);

  const handleDeleteSection = async (section: AdminTrainingSectionRow) => {
    const hint =
      section.cards_count > 0
        ? `Удалить раздел «${section.name}» и ${section.cards_count} карточек?`
        : `Удалить раздел «${section.name}»?`;
    if (!confirmDelete(hint)) return;
    try {
      const res = await deleteTrainingTheme(section.id);
      if (!res.success) throw new Error(res.error);
      if (selectedSection?.id === section.id) {
        setSelectedSection(null);
        setView("sections");
      }
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const handleDeleteCard = async (card: AdminTrainingCardRow) => {
    if (
      !confirmDelete(
        `Удалить карточку «${
          card.question.length > 60
            ? `${card.question.slice(0, 60)}…`
            : card.question
        }»?`,
      )
    ) {
      return;
    }
    try {
      const res = await deleteTrainingCard(card.id);
      if (!res.success) throw new Error(res.error);
      refresh();
      if (selectedSection) void loadCards(selectedSection.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const openCreate = () => {
    if (view === "sections" && selectedDirection) {
      setModal({ kind: "section-create", direction: selectedDirection });
      return;
    }
    if (view === "cards" && selectedSection) {
      setModal({ kind: "card-create", section: selectedSection });
    }
  };

  const pageTitle =
    view === "cards" && selectedSection
      ? selectedSection.name
      : view === "sections" && selectedDirection
        ? selectedDirection.name
        : "Тренировки";

  const pageSubtitle =
    view === "directions"
      ? "Направления из справочника тестов → разделы → карточки."
      : view === "sections"
        ? "Manual-разделы внутри направления. Test-разделы создаются из тестов с открытыми ответами."
        : "Вопросы и ответы для режима карточек.";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          {view !== "directions" ? (
            <nav className={styles.breadcrumb} aria-label="Навигация">
              <button
                type="button"
                className={styles.breadcrumbLink}
                onClick={() => {
                  setView("directions");
                  setSelectedDirection(null);
                  setSelectedSection(null);
                }}
              >
                Направления
              </button>
              {selectedDirection ? (
                <>
                  <span className={styles.breadcrumbSep}>/</span>
                  {view === "sections" ? (
                    <span className={styles.breadcrumbCurrent}>
                      {selectedDirection.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.breadcrumbLink}
                      onClick={() => {
                        setView("sections");
                        setSelectedSection(null);
                      }}
                    >
                      {selectedDirection.name}
                    </button>
                  )}
                </>
              ) : null}
              {view === "cards" && selectedSection ? (
                <>
                  <span className={styles.breadcrumbSep}>/</span>
                  <span className={styles.breadcrumbCurrent}>
                    {selectedSection.name}
                  </span>
                </>
              ) : null}
            </nav>
          ) : null}
          <span className={styles.eyebrow}>Управление</span>
          <h1 className={styles.title}>{pageTitle}</h1>
          <p className={styles.subtitle}>{pageSubtitle}</p>
        </div>
        {view !== "directions" ? (
          <Button type="button" className={styles.flashModeBtn} onClick={openCreate}>
            <Plus size={16} aria-hidden />
            {view === "sections" ? "Раздел" : "Карточка"}
          </Button>
        ) : null}
      </header>

      {error ? <p className={styles.alert}>{error}</p> : null}

      {loading ? (
        <LoadingState label="Загрузка…" variant="panel" />
      ) : view === "directions" ? (
        <div className={styles.panel}>
          {directions.length === 0 ? (
            <p className={styles.empty}>
              Направлений нет. Добавьте их в справочнике тестов.
            </p>
          ) : (
            <div className={styles.list}>
              {directions.map((direction) => (
                <div key={direction.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.rowMain}
                    onClick={() => {
                      setSelectedDirection(direction);
                      setView("sections");
                    }}
                  >
                    <p className={styles.rowTitle}>{direction.name}</p>
                    <p className={styles.rowMeta}>
                      {direction.topics_count} разделов · {direction.cards_count}{" "}
                      карточек
                    </p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : view === "sections" && selectedDirection ? (
        <div className={styles.panel}>
          {selectedDirection.sections.length === 0 ? (
            <p className={styles.empty}>
              В направлении «{selectedDirection.name}» пока нет manual-разделов.
            </p>
          ) : (
            <div className={styles.list}>
              {selectedDirection.sections.map((section) => (
                <div key={section.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.rowMain}
                    onClick={() => {
                      setSelectedSection(section);
                      setView("cards");
                    }}
                  >
                    <p className={styles.rowTitle}>{section.name}</p>
                    <p className={styles.rowMeta}>
                      {section.cards_count} карточек
                    </p>
                  </button>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Редактировать"
                      onClick={() =>
                        setModal({ kind: "section-edit", section })
                      }
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      aria-label="Удалить"
                      onClick={() => void handleDeleteSection(section)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : view === "cards" && selectedSection ? (
        <div className={styles.panel}>
          {cardsLoading ? (
            <LoadingState label="Загрузка карточек…" variant="compact" />
          ) : cards.length === 0 ? (
            <p className={styles.empty}>
              В разделе «{selectedSection.name}» пока нет карточек.
            </p>
          ) : (
            <div className={styles.list}>
              {cards.map((card) => (
                <div key={card.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <p className={styles.rowTitle}>{card.question}</p>
                    <p className={styles.cardPreview}>
                      <strong>Ответ:</strong> {card.answer}
                    </p>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Редактировать"
                      onClick={() => setModal({ kind: "card-edit", card })}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      aria-label="Удалить"
                      onClick={() => void handleDeleteCard(card)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {modal ? (
        <FormModal
          state={modal}
          directions={directions}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
            if (view === "cards" && selectedSection) {
              void loadCards(selectedSection.id);
            }
          }}
        />
      ) : null}
    </div>
  );
}
