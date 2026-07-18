import styles from "@/components/student/tests/tests.module.css";
import {
  formatTestDate,
  formatTestScore,
  getExternalScore,
  getTestTitle,
  isExternalTest,
} from "@/lib/student/tests-api";
import type { StudentTestItem, TestSession } from "@/lib/student/tests-types";
import { TESTS_STATUS_LABELS } from "@/lib/student/tests-types";
import {
  Brain,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Eye,
  Globe2,
  Play,
  RotateCcw,
  Send,
  Target,
  Timer,
  X,
} from "lucide-react";

interface TestDetailPanelProps {
  test: StudentTestItem | null;
  session: TestSession | null;
  onStartTest: (testId: string) => void;
  onResumeTest: (testId: string, attemptId: string) => void;
  onPractice: (testId: string) => void;
  onViewAnswers: (testId: string, sessionId: string) => void;
  variant?: "inline" | "sheet";
  onClose?: () => void;
}

export function TestDetailPanel({
  test,
  session,
  onStartTest,
  onResumeTest,
  onPractice,
  onViewAnswers,
  variant = "inline",
  onClose,
}: TestDetailPanelProps) {
  if (!test) {
    if (variant === "sheet") {
      return null;
    }

    return (
      <aside className={styles.detailPane}>
        <div className={styles.detailEmpty}>
          <p>Выберите тест из списка</p>
        </div>
      </aside>
    );
  }

  const external = isExternalTest(test);
  const testId = String(test.id);
  const isSheet = variant === "sheet";
  const score = external
    ? getExternalScore(test)
    : session?.score != null
      ? Math.round(Number(session.score))
      : null;

  return (
    <aside
      className={`${styles.detailPane} ${isSheet ? styles.detailPaneSheet : ""}`.trim()}
    >
      {isSheet ? (
        <div className={styles.mobileSheetTop}>
          <span className={styles.mobileSheetHandle} aria-hidden />
          <button
            type="button"
            className={styles.mobileSheetClose}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>
      ) : null}

      <div className={styles.detailHeader}>
        <div className={styles.detailBadges}>
          <span
            className={`${styles.statusText} ${
              styles[`statusText_${test.status}`] ?? ""
            } ${styles.statusTextLarge}`.trim()}
          >
            {external ? "Вне системы" : TESTS_STATUS_LABELS[test.status]}
          </span>
          {external ? (
            <span className={styles.externalTag}>
              <Globe2 size={12} />
              Вне CPM-LMS
            </span>
          ) : null}
        </div>

        <h2 className={styles.detailTitle}>{getTestTitle(test)}</h2>
      </div>

      {external ? (
        <div className={styles.detailBlock}>
          <p className={styles.externalNotice}>
            Тест проводился вне платформы CPM-LMS. Пройти или потренироваться
            здесь нельзя — только просмотр результата, если он добавлен.
          </p>

          <div className={styles.infoRow}>
            <CalendarRange size={16} className={styles.infoRowIcon} />
            <div className={styles.infoRowText}>
              <span className={styles.infoRowLabel}>Дата</span>
              <span className={styles.infoRowValue}>
                {formatTestDate(test.date)}
              </span>
            </div>
          </div>

          {score != null ? (
            <div className={styles.scoreHero}>
              <span className={styles.scoreHeroLabel}>Рейтинговый балл</span>
              <span className={styles.scoreHeroValue}>{score}</span>
            </div>
          ) : (
            <p className={styles.mutedNote}>Результат пока не добавлен</p>
          )}
        </div>
      ) : (
        <div className={styles.detailBlock}>
          <div className={styles.infoRow}>
            <Clock3 size={16} className={styles.infoRowIcon} />
            <div className={styles.infoRowText}>
              <span className={styles.infoRowLabel}>Лимит времени</span>
              <span className={styles.infoRowValue}>
                {test.timeLimitMinutes ?? "—"} мин
              </span>
            </div>
          </div>

          <div className={styles.infoRow}>
            <CalendarRange size={16} className={styles.infoRowIcon} />
            <div className={styles.infoRowText}>
              <span className={styles.infoRowLabel}>Период сдачи</span>
              <span className={styles.infoRowValue}>
                {formatTestDate(test.startDate)} — {formatTestDate(test.endDate)}
              </span>
            </div>
          </div>

          {test.canResume && test.activeAttempt ? (
            <div className={styles.attemptBanner}>
              <p className={styles.attemptTitle}>Незавершённая попытка</p>
              <p className={styles.attemptMeta}>
                Ответов: {test.activeAttempt.answeredCount} из{" "}
                {test.activeAttempt.totalQuestions}
              </p>
              <p className={styles.attemptMeta}>
                Осталось: {Math.max(0, test.activeAttempt.remainingSeconds)} сек
              </p>
            </div>
          ) : null}

          {test.canSubmitExpired && test.activeAttempt ? (
            <div className={styles.attemptBannerExpired}>
              <p className={styles.attemptTitleExpired}>Время попытки истекло</p>
              <p className={styles.attemptMeta}>
                Сохранено ответов: {test.activeAttempt.answeredCount} из{" "}
                {test.activeAttempt.totalQuestions}
              </p>
              <p className={styles.attemptMeta}>
                Новые ответы добавить нельзя — можно отправить уже сохранённые.
              </p>
            </div>
          ) : null}

          {score != null ? (
            <div className={styles.scoreHero}>
              <span className={styles.scoreHeroLabel}>Балл</span>
              <span className={styles.scoreHeroValue}>
                {formatTestScore(score)}
              </span>
            </div>
          ) : null}

          {session?.stats ? (
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <CheckCircle2 size={18} className={styles.statIcon} />
                <div className={styles.statText}>
                  <span className={styles.statLabel}>Верных ответов</span>
                  <span className={styles.statValue}>
                    {session.stats.correctAnswers ?? 0} /{" "}
                    {session.stats.totalQuestions ?? 0}
                  </span>
                </div>
              </div>

              <div className={styles.statItem}>
                <Target size={18} className={styles.statIcon} />
                <div className={styles.statText}>
                  <span className={styles.statLabel}>Точность</span>
                  <span className={styles.statValue}>
                    {session.stats.accuracy ?? 0}%
                  </span>
                </div>
              </div>

              <div className={styles.statItem}>
                <Timer size={18} className={styles.statIcon} />
                <div className={styles.statText}>
                  <span className={styles.statLabel}>Время</span>
                  <span className={styles.statValue}>
                    {session.timeSpentMinutes ?? 0} мин
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {!test.isCompleted && test.status === "upcoming" ? (
            <p className={styles.mutedNote}>
              Тест откроется {formatTestDate(test.startDate)}
            </p>
          ) : null}

          {!test.isCompleted && test.status === "missed" ? (
            <p className={styles.mutedNote}>
              Окно сдачи закрылось {formatTestDate(test.endDate)}
            </p>
          ) : null}

          {test.isCompleted && !test.canViewResults ? (
            <p className={styles.mutedNote}>
              Результаты и тренировка станут доступны после публикации ответов преподавателем
            </p>
          ) : null}

          {!test.isCompleted && test.status === "missed" && !test.canPractice ? (
            <p className={styles.mutedNote}>
              Тренировка станет доступна после публикации ответов преподавателем
            </p>
          ) : null}
        </div>
      )}

      <div className={styles.detailActions}>
        {!external && test.canSubmitExpired && test.activeAttempt ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => onResumeTest(testId, test.activeAttempt!.id)}
          >
            <Send size={18} />
            Отправить сохранённые ответы
          </button>
        ) : null}

        {!external && test.canResume && test.activeAttempt ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => onResumeTest(testId, test.activeAttempt!.id)}
          >
            <RotateCcw size={18} />
            Продолжить тест
          </button>
        ) : null}

        {!external && test.canStart ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => onStartTest(testId)}
          >
            <Play size={18} />
            Пройти тест
          </button>
        ) : null}

        {!external && test.canPractice ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPractice}`}
            onClick={() => onPractice(testId)}
          >
            <Brain size={18} />
            Тренироваться
          </button>
        ) : null}

        {!external && test.canViewResults && test.isCompleted && session?.id ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnReview}`}
            onClick={() => onViewAnswers(testId, session.id)}
          >
            <Eye size={18} />
            Смотреть ответы
          </button>
        ) : null}
      </div>
    </aside>
  );
}
