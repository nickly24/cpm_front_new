"use client";

import styles from "@/components/admin/training/admin-training.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  createTrainingCard,
  createTrainingSection,
  createTrainingTheme,
  deleteTrainingCard,
  deleteTrainingSection,
  deleteTrainingTheme,
  fetchAdminCardsByTheme,
  fetchAdminTrainingCatalog,
  updateTrainingCard,
  updateTrainingSection,
  updateTrainingTheme,
} from "@/lib/training/admin-training-api";
import type {
  AdminTrainingCardRow,
  AdminTrainingSectionRow,
  AdminTrainingTopicRow,
} from "@/lib/training/admin-training-types";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AdminView = "sections" | "topics" | "cards";

type ModalKind =
  | "section-create"
  | "section-edit"
  | "topic-create"
  | "topic-edit"
  | "card-create"
  | "card-edit";

interface ModalState {
  kind: ModalKind;
  section?: AdminTrainingSectionRow;
  topic?: AdminTrainingTopicRow;
  card?: AdminTrainingCardRow;
}

function confirmDelete(message: string): boolean {
  return window.confirm(message);
}

function FormModal({
  state,
  sections,
  onClose,
  onSaved,
}: {
  state: ModalState;
  sections: AdminTrainingSectionRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [sectionId, setSectionId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (state.kind === "section-create") {
      setName("");
      setSortOrder("0");
      return;
    }
    if (state.kind === "section-edit" && state.section) {
      setName(state.section.name);
      setSortOrder(String(state.section.sort_order));
      return;
    }
    if (state.kind === "topic-create") {
      setName("");
      setSectionId(String(state.section?.id ?? ""));
      return;
    }
    if (state.kind === "topic-edit" && state.topic) {
      setName(state.topic.name);
      setSectionId(String(state.topic.section_id));
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
  }, [state]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const title =
    state.kind === "section-create"
      ? "Новая тема"
      : state.kind === "section-edit"
        ? "Редактировать тему"
        : state.kind === "topic-create"
          ? "Новая тренировка"
          : state.kind === "topic-edit"
            ? "Редактировать тренировку"
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
          res = await createTrainingSection({
            name: name.trim(),
            sort_order: Number(sortOrder) || 0,
          });
          break;
        case "section-edit":
          if (!state.section) return;
          res = await updateTrainingSection(state.section.id, {
            name: name.trim(),
            sort_order: Number(sortOrder) || 0,
          });
          break;
        case "topic-create":
          if (!name.trim()) throw new Error("Укажите название");
          if (!sectionId) throw new Error("Выберите тему");
          res = await createTrainingTheme({
            name: name.trim(),
            section_id: Number(sectionId),
          });
          break;
        case "topic-edit":
          if (!state.topic) return;
          res = await updateTrainingTheme(state.topic.id, {
            name: name.trim(),
            section_id: Number(sectionId),
          });
          break;
        case "card-create":
          if (!state.topic) return;
          if (!question.trim() || !answer.trim()) {
            throw new Error("Заполните вопрос и ответ");
          }
          res = await createTrainingCard({
            theme_id: state.topic.id,
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
        aria-labelledby="training-modal-title"
      >
        <h2 id="training-modal-title" className={styles.modalTitle}>
          {title}
        </h2>
        {(state.kind === "section-create" || state.kind === "topic-create") && (
          <p className={styles.modalHint}>
            {state.kind === "section-create"
              ? "Тема — верхний уровень: предмет или блок материала."
              : "Тренировка — набор карточек внутри темы."}
          </p>
        )}

        <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
          {(state.kind === "section-create" ||
            state.kind === "section-edit" ||
            state.kind === "topic-create" ||
            state.kind === "topic-edit") && (
            <label className={styles.field}>
              <span className={styles.label}>Название</span>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
          )}

          {(state.kind === "section-create" ||
            state.kind === "section-edit") && (
            <label className={styles.field}>
              <span className={styles.label}>Порядок сортировки</span>
              <input
                className={styles.input}
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </label>
          )}

          {(state.kind === "topic-create" || state.kind === "topic-edit") && (
            <label className={styles.field}>
              <span className={styles.label}>Тема (раздел)</span>
              <select
                className={styles.input}
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
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
  const [view, setView] = useState<AdminView>("sections");
  const [sections, setSections] = useState<AdminTrainingSectionRow[]>([]);
  const [selectedSection, setSelectedSection] =
    useState<AdminTrainingSectionRow | null>(null);
  const [selectedTopic, setSelectedTopic] =
    useState<AdminTrainingTopicRow | null>(null);
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
      setSections(data);
      setSelectedSection((prev) => {
        if (!prev) return prev;
        return data.find((s) => s.id === prev.id) ?? prev;
      });
      setSelectedTopic((prev) => {
        if (!prev) return prev;
        for (const section of data) {
          const topic = section.topics.find((t) => t.id === prev.id);
          if (topic) return topic;
        }
        return prev;
      });
    } catch (err) {
      setSections([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [reloadKey]);

  const loadCards = useCallback(async (topicId: number) => {
    setCardsLoading(true);
    setError(null);
    try {
      setCards(await fetchAdminCardsByTheme(topicId));
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
    if (view === "cards" && selectedTopic) {
      void loadCards(selectedTopic.id);
    }
  }, [view, selectedTopic, loadCards, reloadKey]);

  const refresh = () => setReloadKey((v) => v + 1);

  const handleDeleteSection = async (section: AdminTrainingSectionRow) => {
    const hint =
      section.topics_count > 0
        ? `Удалить тему «${section.name}» вместе с ${section.topics_count} тренировками и ${section.cards_count} карточками?`
        : `Удалить тему «${section.name}»?`;
    if (!confirmDelete(hint)) return;
    try {
      const res = await deleteTrainingSection(section.id);
      if (!res.success) throw new Error(res.error);
      if (selectedSection?.id === section.id) {
        setSelectedSection(null);
        setSelectedTopic(null);
        setView("sections");
      }
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const handleDeleteTopic = async (topic: AdminTrainingTopicRow) => {
    const hint =
      topic.cards_count > 0
        ? `Удалить тренировку «${topic.name}» и ${topic.cards_count} карточек?`
        : `Удалить тренировку «${topic.name}»?`;
    if (!confirmDelete(hint)) return;
    try {
      const res = await deleteTrainingTheme(topic.id);
      if (!res.success) throw new Error(res.error);
      if (selectedTopic?.id === topic.id) {
        setSelectedTopic(null);
        setView("topics");
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
      if (selectedTopic) void loadCards(selectedTopic.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const createLabel =
    view === "sections"
      ? "Тема"
      : view === "topics"
        ? "Тренировка"
        : "Карточка";

  const openCreate = () => {
    if (view === "sections") {
      setModal({ kind: "section-create" });
      return;
    }
    if (view === "topics" && selectedSection) {
      setModal({ kind: "topic-create", section: selectedSection });
      return;
    }
    if (view === "cards" && selectedTopic) {
      setModal({ kind: "card-create", topic: selectedTopic });
    }
  };

  const pageTitle =
    view === "cards" && selectedTopic
      ? selectedTopic.name
      : view === "topics" && selectedSection
        ? selectedSection.name
        : "Тренировки";

  const pageSubtitle =
    view === "sections"
      ? "Темы → тренировки → карточки. Управление контентом для учеников."
      : view === "topics"
        ? "Тренировки внутри темы — наборы карточек."
        : "Вопросы и ответы для режима карточек.";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          {view !== "sections" ? (
            <nav className={styles.breadcrumb} aria-label="Навигация">
              <button
                type="button"
                className={styles.breadcrumbLink}
                onClick={() => {
                  setView("sections");
                  setSelectedSection(null);
                  setSelectedTopic(null);
                }}
              >
                Темы
              </button>
              {selectedSection ? (
                <>
                  <span className={styles.breadcrumbSep}>/</span>
                  {view === "topics" ? (
                    <span className={styles.breadcrumbCurrent}>
                      {selectedSection.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.breadcrumbLink}
                      onClick={() => {
                        setView("topics");
                        setSelectedTopic(null);
                      }}
                    >
                      {selectedSection.name}
                    </button>
                  )}
                </>
              ) : null}
              {view === "cards" && selectedTopic ? (
                <>
                  <span className={styles.breadcrumbSep}>/</span>
                  <span className={styles.breadcrumbCurrent}>
                    {selectedTopic.name}
                  </span>
                </>
              ) : null}
            </nav>
          ) : null}
          <span className={styles.eyebrow}>Управление</span>
          <h1 className={styles.title}>{pageTitle}</h1>
          <p className={styles.subtitle}>{pageSubtitle}</p>
        </div>
        <Button
          type="button"
          className={styles.flashModeBtn}
          onClick={openCreate}
        >
          <Plus size={16} aria-hidden />
          {createLabel}
        </Button>
      </header>

      {error ? <p className={styles.alert}>{error}</p> : null}

      {loading ? (
        <LoadingState label="Загрузка…" variant="panel" />
      ) : view === "sections" ? (
        <div className={styles.panel}>
          {sections.length === 0 ? (
            <p className={styles.empty}>
              Тем пока нет. Создайте первую — например, «Государство и право».
            </p>
          ) : (
            <div className={styles.list}>
              {sections.map((section) => (
                <div key={section.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.rowMain}
                    onClick={() => {
                      setSelectedSection(section);
                      setView("topics");
                    }}
                  >
                    <p className={styles.rowTitle}>{section.name}</p>
                    <p className={styles.rowMeta}>
                      {section.topics_count} тренировок · {section.cards_count}{" "}
                      карточек · порядок {section.sort_order}
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
      ) : view === "topics" && selectedSection ? (
        <div className={styles.panel}>
          {selectedSection.topics.length === 0 ? (
            <p className={styles.empty}>
              В теме «{selectedSection.name}» пока нет тренировок.
            </p>
          ) : (
            <div className={styles.list}>
              {selectedSection.topics.map((topic) => (
                <div key={topic.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.rowMain}
                    onClick={() => {
                      setSelectedTopic(topic);
                      setView("cards");
                    }}
                  >
                    <p className={styles.rowTitle}>{topic.name}</p>
                    <p className={styles.rowMeta}>
                      {topic.cards_count} карточек
                    </p>
                  </button>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Редактировать"
                      onClick={() => setModal({ kind: "topic-edit", topic })}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      aria-label="Удалить"
                      onClick={() => void handleDeleteTopic(topic)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : view === "cards" && selectedTopic ? (
        <div className={styles.panel}>
          {cardsLoading ? (
            <LoadingState label="Загрузка карточек…" variant="compact" />
          ) : cards.length === 0 ? (
            <p className={styles.empty}>
              В тренировке «{selectedTopic.name}» пока нет карточек.
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
          sections={sections}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
            if (view === "cards" && selectedTopic) {
              void loadCards(selectedTopic.id);
            }
          }}
        />
      ) : null}
    </div>
  );
}
