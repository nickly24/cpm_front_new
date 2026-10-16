"use client";

import { useEffect, useRef } from "react";
import { formatAttemptDeadline } from "@/lib/student/test-attempt-catalog";
import styles from "@/components/student/tests/tests.module.css";
import detail from "./test-detail-desktop.module.css";
import { TestActionArtwork, type TestActionKind } from "./test-action-artwork";
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
  ArrowUpRight,
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Globe2,
  Target,
  Timer,
} from "lucide-react";

interface TestDetailPanelProps {
  test: StudentTestItem | null;
  session: TestSession | null;
  onStartTest: (testId: string) => void;
  onResumeTest: (testId: string, attemptId: string) => void;
  onPractice: (testId: string) => void;
  onViewAnswers: (testId: string, sessionId: string) => void;
  variant?: "inline" | "sheet" | "page";
  onClose?: () => void;
}

function ActionContent({kind,title,hint}:{kind:TestActionKind;title:string;hint:string}) {
  return <><span className={detail.digital} aria-hidden="true"><svg viewBox="0 0 600 160" fill="none"><g stroke="currentColor" strokeWidth="1.4"><rect x="410" y="24" width="28" height="35" rx="6" transform="rotate(-16 410 24)"/><path d="M505 105h24v24h-24zM516 94h24v24h-24zM470 27v16m-8-8h16M560 57l7 7-7 7-7-7zM397 117v14m-7-7h14"/></g><g fill="currentColor"><circle cx="551" cy="26" r="3"/><circle cx="460" cy="133" r="3"/></g></svg></span><span className={detail.glyph}><TestActionArtwork kind={kind}/></span><span className={detail.copy}><span>{title}</span><small aria-hidden="true">{hint}</small></span><ArrowUpRight className={detail.arrow} size={20} aria-hidden="true"/></>;
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
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (variant !== "sheet") return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, [variant]);
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
  const isPage = variant === "page";
  const remainingSeconds = Math.max(0, Math.floor(test.activeAttempt?.remainingSeconds || 0));
  const remainingLabel = remainingSeconds >= 60 ? `${Math.floor(remainingSeconds / 60)} мин${remainingSeconds % 60 ? ` ${remainingSeconds % 60} сек` : ""}` : `${remainingSeconds} сек`;
  const score = external
    ? getExternalScore(test)
    : session?.score != null
      ? Math.round(Number(session.score))
      : null;

  return (
    <aside
      ref={panelRef}
      role={isSheet ? "dialog" : undefined}
      aria-modal={isSheet ? true : undefined}
      aria-label={isSheet ? "Карточка теста" : undefined}
      onKeyDown={event => {
        if (!isSheet) return;
        if (event.key === "Escape") onClose?.();
        if (event.key === "Tab") {
          const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled), summary');
          if (!buttons?.length) return;
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}
      className={`${styles.detailPane} ${isSheet ? `${styles.detailPaneSheet} ${detail.sheet}` : isPage ? `${styles.detailPanePage} ${detail.page}` : ""}`.trim()}
    >
      {isPage ? <button type="button" className={styles.desktopBack} onClick={onClose}><ArrowLeft size={20}/>К списку тестов</button> : null}
      {isSheet ? (
        <div className={styles.mobileSheetTop}>
          <button
            type="button"
            className={styles.mobileSheetClose}
            onClick={onClose}
            aria-label="К списку тестов"
          >
            <ArrowLeft size={23} />
          </button>
          <span className={styles.sheetTitle}>Тест</span><span className={styles.sheetHeaderSpacer} aria-hidden/>
        </div>
      ) : null}

      <div className={`${styles.detailBody} ${detail.body}`}>
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

          <div className={`${styles.infoRow} ${detail.infoRow}`}>
            <CalendarRange size={16} className={`${styles.infoRowIcon} ${detail.infoIcon}`} />
            <div className={styles.infoRowText}>
              <span className={styles.infoRowLabel}>Дата</span>
              <span className={`${styles.infoRowValue} ${detail.infoValue}`}>
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
            <p className={styles.mutedNote}>{test.hasResult ? "Результат добавлен, балл пока не указан" : "Результат пока не добавлен"}</p>
          )}
        </div>
      ) : (
        <div className={styles.detailBlock}>
          <div className={`${styles.infoRow} ${detail.infoRow}`}>
            <Clock3 size={16} className={`${styles.infoRowIcon} ${detail.infoIcon}`} />
            <div className={styles.infoRowText}>
              <span className={styles.infoRowLabel}>На прохождение</span>
              <span className={`${styles.infoRowValue} ${detail.infoValue}`}>
                {test.timeLimitMinutes ?? "—"} мин
              </span>
            </div>
          </div>

          <div className={`${styles.infoRow} ${detail.infoRow}`}>
            <CalendarRange size={16} className={`${styles.infoRowIcon} ${detail.infoIcon}`} />
            <div className={styles.infoRowText}>
              <span className={styles.infoRowLabel}>Когда можно начать</span>
              <span className={`${styles.infoRowValue} ${detail.infoValue}`}>
                {formatTestDate(test.startDate)} — {formatTestDate(test.endDate)}
              </span>
            </div>
          </div>

          {test.canRequestHelp && test.activeAttempt ? (
            <div className={styles.attemptBannerExpired} role="status">
              <p className={styles.attemptTitleExpired}>Срок отправки истёк</p>
              <p className={styles.attemptMeta}>Самостоятельная отправка больше недоступна. Сохранённые на устройстве ответы не удалены.</p>
              <details>
                <summary>Как получить помощь</summary>
                <p className={styles.attemptMeta}>Обратитесь к администратору и передайте название теста, номер попытки {test.activeAttempt.id} и срок отправки {formatAttemptDeadline(test.activeAttempt.uploadDeadline)}. Сохраните данные этого браузера до решения вопроса.</p>
              </details>
            </div>
          ) : null}

          {test.canResume && test.activeAttempt ? (
            <div className={styles.attemptBanner}>
              <p className={styles.attemptTitle}>Продолжите с того же места</p>
              <div className={styles.attemptProgressMeta}><span>{test.activeAttempt.answeredCount} из {test.activeAttempt.totalQuestions} ответов</span><span><Clock3 size={14}/>{remainingLabel}</span></div>
              <progress className={styles.attemptProgress} value={test.activeAttempt.answeredCount} max={Math.max(1, test.activeAttempt.totalQuestions)} aria-label="Прогресс ответов"/>
              <div className={styles.attemptDeadlines}><p><span>Ответить до</span><strong>{formatAttemptDeadline(test.activeAttempt.expiresAt)}</strong></p><p><span>Отправить до</span><strong>{formatAttemptDeadline(test.activeAttempt.uploadDeadline)}</strong></p></div>
            </div>
          ) : null}

          {test.canSubmitExpired && test.activeAttempt ? (
            <div className={styles.attemptBannerExpired}>
              <p className={styles.attemptTitleExpired}>Время ответов истекло</p>
              <p className={styles.attemptMeta}>
                Сохранено ответов: {test.activeAttempt.answeredCount} из{" "}
                {test.activeAttempt.totalQuestions}
              </p>
              <p className={styles.attemptMeta}>
                Новые ответы добавить нельзя — можно отправить уже сохранённые.
              </p>
            </div>
          ) : null}

          {test.activeAttempt && !test.canResume ? <div className={styles.attemptDeadlines}><p><span>Ответить до</span><strong>{formatAttemptDeadline(test.activeAttempt.expiresAt)}</strong></p><p><span>Отправить до</span><strong>{formatAttemptDeadline(test.activeAttempt.uploadDeadline)}</strong></p></div> : null}

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

          {!test.isCompleted && test.status === "missed" && !test.activeAttempt ? (
            <p className={styles.mutedNote}>
              Окно сдачи закрылось {formatTestDate(test.endDate)}
            </p>
          ) : null}

          {test.status === "checking" ? (
            <p className={styles.attemptBanner} role="status">
              {test.calculationStatus === "processing" ? "Ответы проверяются." : test.calculationStatus === "retrying" ? "Проверка будет повторена автоматически." : "Ответы приняты и ожидают проверки в очереди."} Результат появится после проверки.
            </p>
          ) : null}

          {test.status === "calculation_failed" ? (
            <p className={styles.attemptBannerExpired} role="alert">Проверку пока не удалось завершить. Ответы сохранены. Обратитесь к администратору.</p>
          ) : null}

          {test.isCompleted && test.status === "completed" && !test.canViewResults ? (
            <p className={styles.mutedNote}>
              Просмотр ответов откроется после разрешения преподавателя
            </p>
          ) : null}

          {!test.isCompleted && test.status === "missed" && !test.canPractice ? (
            <p className={styles.mutedNote}>
              Тренировка станет доступна после публикации ответов преподавателем
            </p>
          ) : null}
        </div>
      )}

      </div>
      <div className={`${styles.detailActions} ${detail.actions}`}>
        {!external && test.canSubmitExpired && test.activeAttempt ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary} ${detail.action} ${detail.primary}`}
            onClick={() => onResumeTest(testId, test.activeAttempt!.id)}
          >
            <ActionContent kind="submit" title="Отправить сохранённые ответы" hint="Завершить текущую попытку"/>
          </button>
        ) : null}

        {!external && test.canResume && test.activeAttempt ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary} ${detail.action} ${detail.primary}`}
            onClick={() => onResumeTest(testId, test.activeAttempt!.id)}
          >
            <ActionContent kind="resume" title="Продолжить тест" hint="Вернуться к текущей попытке"/>
          </button>
        ) : null}

        {!external && test.canStart ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary} ${detail.action} ${detail.primary}`}
            onClick={() => onStartTest(testId)}
          >
            <ActionContent kind="start" title="Пройти тест" hint="Начать прохождение"/>
          </button>
        ) : null}

        {!external && test.canPractice ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPractice} ${detail.action} ${detail.practice}`}
            onClick={() => onPractice(testId)}
          >
            <ActionContent kind="practice" title="Тренироваться" hint="Закрепить материал"/>
          </button>
        ) : null}

        {!external && test.canViewResults && test.isCompleted && session?.id ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnReview} ${detail.action} ${detail.review}`}
            onClick={() => onViewAnswers(testId, session.id)}
          >
            <ActionContent kind="review" title="Смотреть ответы" hint="Разобрать свои ответы"/>
          </button>
        ) : null}
      </div>
    </aside>
  );
}
