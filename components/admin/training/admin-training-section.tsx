"use client";

import styles from "@/components/admin/training/admin-training.module.css";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import heroStyles from "@/components/student/section-hero-banner.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { cn } from "@/lib/cn";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
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
import {
  adminSectionKey,
  normalizeAdminSection,
} from "@/lib/training/admin-training-types";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

function AdminSearchPopover({
  value,
  onChange,
  placeholder,
  open,
  onOpenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current && !anchorRef.current.contains(target)) {
        onOpenChange(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      {open ? (
        <button
          type="button"
          className={styles.popoverBackdrop}
          aria-label="Закрыть"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <div className={styles.popoverAnchor} ref={anchorRef}>
        <button
          type="button"
          className={cn(
            styles.toolbarIconBtn,
            (open || value.trim()) && styles.toolbarIconBtnActive,
          )}
          aria-label="Поиск"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          <Search size={17} aria-hidden />
        </button>
        {open ? (
          <div className={styles.searchPopover} role="dialog" aria-label="Поиск">
            <label className={styles.searchField}>
              <Search size={15} aria-hidden />
              <input
                ref={inputRef}
                className={styles.searchInput}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
              />
            </label>
          </div>
        ) : null}
      </div>
    </>
  );
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
          if (!state.section?.id) {
            throw new Error("Раздел не найден");
          }
          if (!name.trim()) throw new Error("Укажите название");
          if (!directionId) throw new Error("Выберите направление");
          res = await updateTrainingTheme(state.section.id, {
            name: name.trim(),
            direction_id: Number(directionId),
          });
          break;
        case "card-create":
          if (!state.section?.id) {
            throw new Error("Раздел не найден");
          }
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
  const router = useRouter();
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
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminTrainingCatalog();
      const normalized = data.map((direction) => ({
        ...direction,
        sections: (direction.sections ?? []).map(normalizeAdminSection),
        topics: (direction.topics ?? direction.sections ?? []).map(
          normalizeAdminSection,
        ),
      }));
      setDirections(normalized);
      setSelectedDirection((prev) => {
        if (!prev) return prev;
        return normalized.find((d) => d.id === prev.id) ?? prev;
      });
      setSelectedSection((prev) => {
        if (!prev) return prev;
        const prevKey = adminSectionKey(prev);
        for (const direction of normalized) {
          const section = direction.sections.find(
            (item) => adminSectionKey(item) === prevKey,
          );
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
    if (
      view === "cards" &&
      selectedSection?.kind === "manual" &&
      selectedSection.id
    ) {
      void loadCards(selectedSection.id);
    }
  }, [view, selectedSection, loadCards, reloadKey]);

  useEffect(() => {
    setSearchTerm("");
    setSearchOpen(false);
  }, [view, selectedDirection?.id, selectedSection?.id]);

  const refresh = () => setReloadKey((v) => v + 1);

  const filteredSections = useMemo(() => {
    if (!selectedDirection) return [];
    const query = searchTerm.trim().toLowerCase();
    if (!query) return selectedDirection.sections;
    return selectedDirection.sections.filter((section) =>
      section.name.toLowerCase().includes(query),
    );
  }, [searchTerm, selectedDirection]);

  const filteredCards = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return cards;
    return cards.filter(
      (card) =>
        card.question.toLowerCase().includes(query) ||
        card.answer.toLowerCase().includes(query),
    );
  }, [cards, searchTerm]);

  const handleDeleteSection = async (section: AdminTrainingSectionRow) => {
    if (section.kind === "test" || !section.id) return;
    const hint =
      section.cards_count > 0
        ? `Удалить раздел «${section.name}» и ${section.cards_count} карточек?`
        : `Удалить раздел «${section.name}»?`;
    if (!confirmDelete(hint)) return;
    try {
      const res = await deleteTrainingTheme(section.id);
      if (!res.success) throw new Error(res.error);
      if (
        selectedSection &&
        adminSectionKey(selectedSection) === adminSectionKey(section)
      ) {
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
      if (selectedSection?.id) void loadCards(selectedSection.id);
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

  const openTestSection = (
    direction: AdminTrainingDirectionRow,
    section: AdminTrainingSectionRow,
  ) => {
    if (!section.test_id) return;
    const params = new URLSearchParams({
      direction: direction.name,
      test: section.test_id,
    });
    router.push(`/cabinet/admin/tests?${params.toString()}`);
  };

  const openSection = (
    direction: AdminTrainingDirectionRow,
    section: AdminTrainingSectionRow,
  ) => {
    if (section.kind === "test") {
      openTestSection(direction, section);
      return;
    }
    setSelectedSection(section);
    setView("cards");
  };

  const heroSubtitle =
    view === "directions"
      ? "Направления из справочника тестов → разделы → карточки"
      : view === "sections" && selectedDirection
        ? `Разделы направления «${selectedDirection.name}»`
        : selectedSection
          ? `Карточки раздела «${selectedSection.name}»`
          : "Управление карточками для студентов";

  const breadcrumb =
    view !== "directions" ? (
      <nav className={heroStyles.breadcrumb} aria-label="Навигация">
        <button
          type="button"
          className={heroStyles.breadcrumbLink}
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
            <span className={heroStyles.breadcrumbSep}>/</span>
            {view === "sections" ? (
              <span className={heroStyles.breadcrumbCurrent}>
                {selectedDirection.name}
              </span>
            ) : (
              <button
                type="button"
                className={heroStyles.breadcrumbLink}
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
            <span className={heroStyles.breadcrumbSep}>/</span>
            <span className={heroStyles.breadcrumbCurrent}>
              {selectedSection.name}
            </span>
          </>
        ) : null}
      </nav>
    ) : null;

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.trainFlashcards}
        textTone="dark"
        eyebrow="Управление"
        title="Карточки"
        subtitle={heroSubtitle}
        leading={breadcrumb ?? undefined}
        footer={
          view !== "directions" ? (
            <Button
              type="button"
              className={styles.heroActionBtn}
              onClick={openCreate}
            >
              <Plus size={16} aria-hidden />
              {view === "sections" ? "Новый раздел" : "Новая карточка"}
            </Button>
          ) : undefined
        }
      />

      {error ? <p className={styles.alert}>{error}</p> : null}

      {loading ? (
        <LoadingState label="Загрузка…" variant="panel" />
      ) : view === "directions" ? (
        directions.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Направлений нет</h2>
            <p className={styles.emptyText}>
              Добавьте направления в справочнике тестов — они появятся здесь
              автоматически.
            </p>
          </div>
        ) : (
          <div className={styles.directionGrid}>
            {directions.map((direction) => (
              <button
                key={direction.id}
                type="button"
                className={styles.directionCard}
                onClick={() => {
                  setSelectedDirection(direction);
                  setView("sections");
                }}
              >
                <span className={styles.directionCardIcon} aria-hidden>
                  <BookOpen size={18} />
                </span>
                <h3 className={styles.directionCardTitle}>{direction.name}</h3>
                <p className={styles.directionCardMeta}>
                  {direction.topics_count} разделов · {direction.cards_count}{" "}
                  карточек
                </p>
                <ChevronRight
                  size={18}
                  className={styles.directionCardArrow}
                  aria-hidden
                />
              </button>
            ))}
          </div>
        )
      ) : view === "sections" && selectedDirection ? (
        <>
          <div className={styles.catalogHeader}>
            <div className={styles.directionTabs}>
              {directions.map((direction) => (
                <button
                  key={direction.id}
                  type="button"
                  className={cn(
                    styles.directionTab,
                    selectedDirection.id === direction.id &&
                      styles.directionTabActive,
                  )}
                  onClick={() => {
                    setSelectedDirection(direction);
                    setSelectedSection(null);
                  }}
                >
                  {direction.name}
                </button>
              ))}
            </div>
            <AdminSearchPopover
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Поиск раздела…"
              open={searchOpen}
              onOpenChange={setSearchOpen}
            />
          </div>

          <p className={styles.infoBanner}>
            <Layers size={16} aria-hidden />
            <span>
              <strong>Manual-разделы</strong> создаются здесь. Разделы{" "}
              <strong>из тестов</strong> ведут в раздел «Тесты» — там
              редактируются вопросы и видимость ответов.
            </span>
          </p>

          {filteredSections.length === 0 ? (
            <div className={styles.empty}>
              <h2 className={styles.emptyTitle}>
                {selectedDirection.sections.length === 0
                  ? "Разделов пока нет"
                  : "Ничего не найдено"}
              </h2>
              <p className={styles.emptyText}>
                {selectedDirection.sections.length === 0
                  ? `В направлении «${selectedDirection.name}» нет manual-разделов и опубликованных тестов с карточками. Создайте manual-раздел или добавьте тест в разделе «Тесты».`
                  : "Попробуйте изменить строку поиска."}
              </p>
            </div>
          ) : (
            <>
              <p className={styles.listMeta}>
                {filteredSections.length} из {selectedDirection.sections.length}{" "}
                разделов
              </p>
              <div className={styles.sectionList}>
                {filteredSections.map((section) => {
                  const isTestSection = section.kind === "test";

                  return (
                    <div
                      key={adminSectionKey(section)}
                      className={styles.sectionCard}
                    >
                      <button
                        type="button"
                        className={styles.sectionCardMain}
                        onClick={() => {
                          if (!selectedDirection) return;
                          openSection(selectedDirection, section);
                        }}
                      >
                        <span
                          className={cn(
                            styles.sectionCardBadge,
                            isTestSection && styles.sectionCardBadgeTest,
                          )}
                        >
                          {isTestSection ? (
                            <ClipboardList size={12} aria-hidden />
                          ) : (
                            <FileText size={12} aria-hidden />
                          )}
                          {isTestSection ? "Из теста" : "Manual"}
                        </span>
                        <h3 className={styles.sectionCardTitle}>
                          {section.name}
                        </h3>
                        <p className={styles.sectionCardMeta}>
                          {section.cards_count} карточек
                          {isTestSection && section.visible === false
                            ? " · ответы скрыты у студентов"
                            : ""}
                        </p>
                      </button>
                      <div className={styles.rowActions}>
                        {isTestSection ? (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label="Открыть тест"
                            onClick={() => {
                              if (!selectedDirection) return;
                              openTestSection(selectedDirection, section);
                            }}
                          >
                            <ExternalLink size={16} />
                          </button>
                        ) : (
                          <>
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
                              className={cn(styles.iconBtn, styles.iconBtnDanger)}
                              aria-label="Удалить"
                              onClick={() => void handleDeleteSection(section)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : view === "cards" &&
        selectedSection &&
        selectedSection.kind === "manual" ? (
        <>
          <div className={cn(styles.catalogHeader, styles.catalogHeaderEnd)}>
            <AdminSearchPopover
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Поиск по вопросу или ответу…"
              open={searchOpen}
              onOpenChange={setSearchOpen}
            />
          </div>

          {cardsLoading ? (
            <LoadingState label="Загрузка карточек…" variant="inline" />
          ) : cards.length === 0 ? (
            <div className={styles.empty}>
              <h2 className={styles.emptyTitle}>Карточек пока нет</h2>
              <p className={styles.emptyText}>
                В разделе «{selectedSection.name}» ещё нет карточек. Добавьте
                первую.
              </p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className={styles.empty}>
              <h2 className={styles.emptyTitle}>Ничего не найдено</h2>
              <p className={styles.emptyText}>
                Попробуйте изменить строку поиска.
              </p>
            </div>
          ) : (
            <>
              <p className={styles.listMeta}>
                {filteredCards.length} из {cards.length} карточек
              </p>
              <div className={styles.cardList}>
                {filteredCards.map((card) => (
                  <div key={card.id} className={styles.cardItem}>
                    <div className={styles.cardItemBody}>
                      <p className={styles.cardQuestion}>{card.question}</p>
                      <p className={styles.cardAnswer}>
                        <span className={styles.cardAnswerLabel}>Ответ: </span>
                        {card.answer}
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
                        className={cn(styles.iconBtn, styles.iconBtnDanger)}
                        aria-label="Удалить"
                        onClick={() => void handleDeleteCard(card)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}

      {modal ? (
        <FormModal
          state={modal}
          directions={directions}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
            if (view === "cards" && selectedSection?.id) {
              void loadCards(selectedSection.id);
            }
          }}
        />
      ) : null}
    </div>
  );
}
