import styles from "@/components/admin/tests/admin-test-change-history-panel.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchAdminTestChanges } from "@/lib/admin/admin-tests-api";
import {
  canvasQuestionIdFromNumber,
  formatChangeTimestamp,
  getChangeEventLabel,
  groupChangesIntoCommits,
  summarizeChangeEvent,
} from "@/lib/admin/admin-test-change-history";
import type { AdminTestChangeCommit } from "@/lib/admin/admin-tests-types";
import { useCallback, useEffect, useState } from "react";

interface AdminTestChangeHistoryPanelProps {
  testId: string;
  selectedQuestionId?: number | null;
  refreshKey?: number;
  onSelectQuestion?: (canvasQuestionId: string) => void;
}

export function AdminTestChangeHistoryPanel({
  testId,
  selectedQuestionId = null,
  refreshKey = 0,
  onSelectQuestion,
}: AdminTestChangeHistoryPanelProps) {
  const [commits, setCommits] = useState<AdminTestChangeCommit[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCommitId, setExpandedCommitId] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetchAdminTestChanges(testId, {
          page: nextPage,
          limit: 20,
          questionId: selectedQuestionId ?? undefined,
        });
        const grouped = groupChangesIntoCommits(response.items);
        setCommits((prev) => (append ? [...prev, ...grouped] : grouped));
        setPage(response.pagination.page);
        setHasNext(response.pagination.hasNext);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить историю");
        if (!append) setCommits([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedQuestionId, testId],
  );

  useEffect(() => {
    void loadPage(1, false);
  }, [loadPage, refreshKey]);

  if (loading) {
    return <LoadingState label="Загружаем историю изменений..." />;
  }

  if (error) {
    return (
      <div className={styles.stateBox}>
        <p>{error}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void loadPage(1, false)}>
          Повторить
        </Button>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className={styles.stateBox}>
        <p className={styles.emptyTitle}>История пока пуста</p>
        <p className={styles.emptyHint}>
          {selectedQuestionId
            ? "Для этого вопроса ещё не было сохранённых изменений."
            : "После первого сохранения изменений здесь появятся коммиты с аудитом."}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.scopeHint}>
        {selectedQuestionId
          ? `Показана история вопроса №${selectedQuestionId}`
          : "Показана история всего теста"}
      </p>

      <div className={styles.commitList}>
        {commits.map((commit) => {
          const expanded = expandedCommitId === commit.id;
          const eventCount = commit.events.length;

          return (
            <article key={commit.id} className={styles.commitCard}>
              <button
                type="button"
                className={styles.commitHead}
                onClick={() => setExpandedCommitId(expanded ? null : commit.id)}
              >
                <div className={styles.commitMain}>
                  <span className={styles.commitActor}>{commit.actorName}</span>
                  <span className={styles.commitTime}>{formatChangeTimestamp(commit.changedAt)}</span>
                </div>
                <div className={styles.commitMeta}>
                  <span className={styles.commitBadge}>
                    {eventCount} {eventCount === 1 ? "изменение" : eventCount < 5 ? "изменения" : "изменений"}
                  </span>
                  <span className={styles.commitToggle}>{expanded ? "Свернуть" : "Подробнее"}</span>
                </div>
              </button>

              {expanded ? (
                <div className={styles.eventList}>
                  {commit.events.map((event) => {
                    const canNavigate =
                      event.questionId != null && Boolean(onSelectQuestion);

                    return (
                      <div key={event.id} className={styles.eventItem}>
                        <div className={styles.eventHead}>
                          <span className={styles.eventType}>
                            {getChangeEventLabel(event.eventType)}
                          </span>
                          {event.questionId != null ? (
                            <span className={styles.eventQuestion}>Вопрос №{event.questionId}</span>
                          ) : (
                            <span className={styles.eventQuestion}>Метаданные</span>
                          )}
                          <span className={styles.eventRevision}>rev.{event.revision}</span>
                        </div>
                        <p className={styles.eventSummary}>{summarizeChangeEvent(event)}</p>
                        {canNavigate ? (
                          <button
                            type="button"
                            className={styles.eventLink}
                            onClick={() =>
                              onSelectQuestion?.(canvasQuestionIdFromNumber(event.questionId!))
                            }
                          >
                            Показать на полотне
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.commitPreview}>
                  {summarizeChangeEvent(commit.events[0]!)}
                  {eventCount > 1 ? ` и ещё ${eventCount - 1}` : ""}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {hasNext ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loadingMore}
          onClick={() => void loadPage(page + 1, true)}
        >
          {loadingMore ? "Загружаем..." : "Показать ещё"}
        </Button>
      ) : null}
    </div>
  );
}
