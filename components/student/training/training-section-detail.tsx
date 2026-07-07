"use client";

import styles from "@/components/student/training/student-training.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchSectionStudyView,
  markCardLearned,
  unmarkCardLearned,
  updateSectionStudySettings,
} from "@/lib/training/training-api";
import {
  BATCH_SIZE_PRESETS,
  CARD_STATUS_LABELS,
  STUDY_FILTER_LABELS,
  type SectionKind,
  type StudyFilter,
  type TrainingCard,
  type TrainingSectionNode,
} from "@/lib/training/training-types";
import { calcProgressPercent } from "@/lib/training/training-utils";
import { cn } from "@/lib/cn";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  ClipboardList,
  FileText,
  LayoutList,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  Settings2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TrainingSectionDetailProps {
  section: TrainingSectionNode;
  studentId: number;
  onBack: () => void;
  onStartFlashcards: (batchIndex: number, studyMode: StudyFilter) => void;
  onProgressChange?: (section: TrainingSectionNode) => void;
}

const STUDY_FILTER_ICONS: Record<StudyFilter, LucideIcon> = {
  all: LayoutList,
  unlearned: CircleDot,
  learned: CheckCircle2,
  stale: RefreshCw,
};

function CardListItem({
  card,
  onToggleLearned,
}: {
  card: TrainingCard;
  onToggleLearned: () => void;
}) {
  const status = card.status;
  const isLearned = status === "learned";

  return (
    <div
      className={cn(
        styles.cardRow,
        isLearned && styles.cardRowLearned,
        status === "answer_changed" && styles.cardRowStale,
      )}
    >
      <div className={styles.cardRowMain}>
        <div className={styles.cardRowBody}>
          <span className={styles.cardRowQuestion}>{card.question}</span>
          <span className={styles.cardRowSeparator}>—</span>
          <span className={styles.cardRowAnswer}>{card.answer}</span>
        </div>
        <span className={styles.cardMeta}>{CARD_STATUS_LABELS[status]}</span>
      </div>
      <button
        type="button"
        className={cn(
          styles.cardRowToggle,
          isLearned && styles.cardRowToggleLearned,
        )}
        onClick={onToggleLearned}
        aria-label={
          status === "learned"
            ? "Пометить как невыученное"
            : "Пометить как выученное"
        }
        title={status === "learned" ? "Сбросить" : "Выучено"}
      >
        {isLearned ? (
          <RotateCcw size={14} />
        ) : (
          <Check size={14} strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}

export function TrainingSectionDetail({
  section,
  studentId,
  onBack,
  onStartFlashcards,
  onProgressChange,
}: TrainingSectionDetailProps) {
  const [cards, setCards] = useState<TrainingCard[]>([]);
  const [batches, setBatches] = useState<
    Awaited<ReturnType<typeof fetchSectionStudyView>>["batches"]
  >([]);
  const [batchSize, setBatchSize] = useState(10);
  const [studyMode, setStudyMode] = useState<StudyFilter>("unlearned");
  const [selectedBatch, setSelectedBatch] = useState(0);
  const [stats, setStats] = useState(section.stats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSelect, setSettingsSelect] = useState<"size" | "mode" | null>(
    null,
  );

  const sectionKind = section.kind as SectionKind;
  const sectionRefId = section.refId;
  const sectionSnapshotRef = useRef(section);
  const onProgressChangeRef = useRef(onProgressChange);

  sectionSnapshotRef.current = section;
  onProgressChangeRef.current = onProgressChange;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSectionStudyView(
        studentId,
        sectionKind,
        sectionRefId,
      );
      setCards(data.cards);
      setBatches(data.batches);
      setBatchSize(data.settings.batch_size ?? 10);
      setStudyMode(data.settings.study_mode ?? "unlearned");
      setSelectedBatch(data.settings.last_batch_index ?? 0);
      setStats(data.stats);
      onProgressChangeRef.current?.({
        ...sectionSnapshotRef.current,
        stats: data.stats,
        total_cards: data.stats.total,
        learned_cards: data.stats.learned,
        answer_changed_cards: data.stats.answer_changed,
        progress_percent: data.stats.progress_percent ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [sectionKind, sectionRefId, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistSettings = async (
    patch: Partial<{ batch_size: number; study_mode: StudyFilter; last_batch_index: number }>,
  ) => {
    setSavingSettings(true);
    try {
      await updateSectionStudySettings(studentId, sectionKind, sectionRefId, {
        batch_size: patch.batch_size ?? batchSize,
        study_mode: patch.study_mode ?? studyMode,
        last_batch_index: patch.last_batch_index ?? selectedBatch,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleBatchSizeChange = async (size: number) => {
    setBatchSize(size);
    setSelectedBatch(0);
    await persistSettings({ batch_size: size, last_batch_index: 0 });
    void load();
  };

  const handleStudyModeChange = async (mode: StudyFilter) => {
    setStudyMode(mode);
    await persistSettings({ study_mode: mode });
  };

  const handleToggleLearned = async (card: TrainingCard) => {
    try {
      if (card.status === "learned") {
        await unmarkCardLearned(studentId, card.card_ref);
      } else {
        await markCardLearned({
          student_id: studentId,
          section_kind: sectionKind,
          section_ref_id: sectionRefId,
          card_ref: card.card_ref,
          content_fingerprint: card.content_fingerprint,
        });
      }
      await load();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return <LoadingState label="Загрузка раздела…" variant="panel" />;
  }

  if (error) {
    return <p className={styles.alert}>{error}</p>;
  }

  const currentBatch = batches[selectedBatch];
  const progressPercent = calcProgressPercent(stats.learned, stats.total);
  const progressFillPercent = progressPercent > 0 ? Math.max(progressPercent, 2) : 0;
  const SectionKindIcon = section.kind === "test" ? FileText : ClipboardList;
  const cardGroups = cards.reduce<TrainingCard[][]>((groups, card, index) => {
    const groupIndex = Math.floor(index / batchSize);
    if (!groups[groupIndex]) groups[groupIndex] = [];
    groups[groupIndex].push(card);
    return groups;
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Назад к разделам
        </button>
      </div>

      <header className={styles.header}>
        <div className={styles.detailHeader}>
          <div className={styles.detailHeaderMain}>
            <span
              className={cn(
                styles.sectionKindBadge,
                section.kind === "test" && styles.sectionKindBadgeTest,
              )}
            >
              <SectionKindIcon size={14} aria-hidden />
              {section.kind === "test" ? "Тест" : "Карточки"}
            </span>
            <span className={styles.eyebrow}>Раздел</span>
            <h1 className={styles.title}>{section.name}</h1>
            {section.kind === "test" && section.sourceTestTitle ? (
              <p className={styles.cardBadge}>
                <Sparkles size={14} aria-hidden />
                На базе теста: {section.sourceTestTitle}
              </p>
            ) : null}
            <div className={styles.detailProgressBlock}>
              <div className={styles.detailProgressMeta}>
                <span>Прогресс раздела</span>
                <strong>{progressPercent}%</strong>
              </div>
              <div className={styles.detailProgressTrack}>
                <div
                  className={styles.detailProgressFill}
                  style={{ width: `${progressFillPercent}%` }}
                />
              </div>
              <div className={styles.detailProgressTicks}>
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.controlsWrap}>
        <div className={styles.statsInline}>
          <span className={styles.statInlineItem}>
            <strong>{stats.learned}</strong>
            выучено
          </span>
          <span className={styles.statInlineItem}>
            <strong>{stats.answer_changed}</strong>
            новый ответ
          </span>
          <span className={styles.statInlineItem}>
            <strong>{stats.unlearned}</strong>
            осталось
          </span>
          <span className={styles.statInlineItem}>
            <strong>{stats.total}</strong>
            всего
          </span>
        </div>

        <div className={styles.settingsRow}>
          <button
            type="button"
            className={cn(styles.settingsBtn, settingsOpen && styles.settingsBtnActive)}
            onClick={() => {
              setSettingsOpen((prev) => !prev);
              setSettingsSelect(null);
            }}
            aria-label="Настройки обучения"
            title="Настройки обучения"
          >
            <Settings2 size={17} aria-hidden />
          </button>
        </div>

        {settingsOpen ? (
          <div className={styles.settingsMenu}>
            <div className={styles.settingsField}>
              <span className={styles.settingsLabel}>По сколько карточек учить</span>
              <button
                type="button"
                className={styles.settingsSelect}
                onClick={() =>
                  setSettingsSelect((prev) => (prev === "size" ? null : "size"))
                }
              >
                {batchSize} карточек
                <ChevronDown
                  size={14}
                  className={cn(
                    styles.settingsSelectChevron,
                    settingsSelect === "size" && styles.settingsSelectChevronOpen,
                  )}
                />
              </button>
              {settingsSelect === "size" ? (
                <div className={styles.settingsOptions}>
                  {BATCH_SIZE_PRESETS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={cn(
                        styles.settingsOption,
                        batchSize === size && styles.settingsOptionActive,
                      )}
                      onClick={() => {
                        void handleBatchSizeChange(size);
                        setSettingsSelect(null);
                      }}
                    >
                      <Layers size={14} />
                      {size} карточек
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={styles.settingsField}>
              <span className={styles.settingsLabel}>Режим</span>
              <button
                type="button"
                className={styles.settingsSelect}
                onClick={() =>
                  setSettingsSelect((prev) => (prev === "mode" ? null : "mode"))
                }
              >
                {studyMode === "all" ? "Все карточки" : STUDY_FILTER_LABELS[studyMode]}
                <ChevronDown
                  size={14}
                  className={cn(
                    styles.settingsSelectChevron,
                    settingsSelect === "mode" && styles.settingsSelectChevronOpen,
                  )}
                />
              </button>
              {settingsSelect === "mode" ? (
                <div className={styles.settingsOptions}>
                  {(Object.keys(STUDY_FILTER_LABELS) as StudyFilter[]).map((mode) => {
                    const FilterIcon = STUDY_FILTER_ICONS[mode];
                    return (
                      <button
                        key={mode}
                        type="button"
                        className={cn(
                          styles.settingsOption,
                          studyMode === mode && styles.settingsOptionActive,
                        )}
                        onClick={() => {
                          void handleStudyModeChange(mode);
                          setSettingsSelect(null);
                        }}
                      >
                        <FilterIcon size={14} />
                        {mode === "all" ? "Все карточки" : STUDY_FILTER_LABELS[mode]}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={styles.batchList}>
          <div className={styles.batchListHead}>Наборы карточек</div>
          <div className={styles.batchListBody}>
            <button
              type="button"
              className={cn(
                styles.batchRow,
                styles.batchRowAll,
                selectedBatch === -1 && styles.batchRowActive,
              )}
              onClick={() => setSelectedBatch(-1)}
            >
              <span className={styles.batchRowRange}>Все карточки</span>
              <span className={styles.batchRowMark} aria-hidden>
                {selectedBatch === -1 ? (
                  <CheckCircle size={16} />
                ) : (
                  <Circle size={16} />
                )}
              </span>
              <span className={styles.batchRowMeta}>
                {stats.learned}/{stats.total} выучено
              </span>
              <div className={styles.batchRowTrack}>
                <div
                  className={styles.batchRowFill}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </button>
            {batches.map((batch) => {
              const batchPercent = calcProgressPercent(
                batch.stats.learned,
                batch.stats.total,
              );
              return (
                <button
                  key={batch.index}
                  type="button"
                  className={cn(
                    styles.batchRow,
                    selectedBatch === batch.index && styles.batchRowActive,
                  )}
                  onClick={() => {
                    setSelectedBatch(batch.index);
                    void persistSettings({ last_batch_index: batch.index });
                  }}
                >
                  <span className={styles.batchRowRange}>
                    {batch.from}–{batch.to}
                  </span>
                  <span className={styles.batchRowMark} aria-hidden>
                    {selectedBatch === batch.index ? (
                      <CheckCircle size={16} />
                    ) : (
                      <Circle size={16} />
                    )}
                  </span>
                  <span className={styles.batchRowMeta}>
                    {batch.stats.learned}/{batch.stats.total} выучено
                  </span>
                  <div className={styles.batchRowTrack}>
                    <div
                      className={styles.batchRowFill}
                      style={{ width: `${batchPercent}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {currentBatch ? (
          <Button
            type="button"
            className={styles.studyCta}
            onClick={() => onStartFlashcards(selectedBatch, studyMode)}
          >
            <Play size={18} aria-hidden />
            {selectedBatch === -1
              ? "Учить все карточки раздела"
              : `Учить набор ${currentBatch.from}–${currentBatch.to}`}
          </Button>
        ) : selectedBatch === -1 ? (
          <Button
            type="button"
            className={styles.studyCta}
            onClick={() => onStartFlashcards(-1, studyMode)}
          >
            <Play size={18} aria-hidden />
            Учить все карточки раздела
          </Button>
        ) : null}
      </section>

      <section className={styles.cardsPanel}>
        <div className={styles.cardsSectionHead}>
          <h3 className={styles.cardsSectionTitle}>Карточки выбранного набора</h3>
          <span className={styles.cardsSectionCount}>
            {cards.length} · {cardGroups.length} наборов
          </span>
        </div>
        {cardGroups.map((group, groupIndex) => {
          const from = groupIndex * batchSize + 1;
          const to = from + group.length - 1;
          return (
            <div key={`group-${groupIndex}`} className={styles.cardsGroup}>
              <div className={styles.cardsGroupHead}>
                <span className={styles.cardsGroupDivider} aria-hidden />
                <h4 className={styles.cardsGroupTitle}>
                  Набор {groupIndex + 1}: {from}–{to}
                </h4>
              </div>
              <div className={styles.cardsList}>
                {group.map((card) => (
                  <CardListItem
                    key={card.card_ref}
                    card={card}
                    onToggleLearned={() => void handleToggleLearned(card)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}