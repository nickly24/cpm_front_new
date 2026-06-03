"use client";

import { TestAttemptScreen } from "@/components/student/tests/attempt/test-attempt-screen";
import { TestReviewScreen } from "@/components/student/tests/review/test-review-screen";
import { TestsListSearch } from "@/components/student/tests/tests-list-search";
import { TestDetailPanel } from "@/components/student/tests/test-detail-panel";
import { TestsListItem } from "@/components/student/tests/tests-list-item";
import { TestsToolbar } from "@/components/student/tests/tests-toolbar";
import styles from "@/components/student/tests/tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import {
  buildSessionMap,
  fetchDirections,
  fetchTestsWithSessions,
  filterTestsByDate,
  filterTestsBySearch,
  filterTestsByStatus,
  getTestId,
  getTestTitle,
} from "@/lib/student/tests-api";
import type {
  Direction,
  StudentTestItem,
  TestSession,
  TestsDateFilter,
  TestStatusFilter,
} from "@/lib/student/tests-types";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useCallback, useEffect, useMemo, useState } from "react";

export function StudentTestsSection() {
  const [directions, setDirections] = useState<Direction[]>([]);
  const [directionName, setDirectionName] = useState("");
  const [tests, setTests] = useState<StudentTestItem[]>([]);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [loadingDirections, setLoadingDirections] = useState(true);
  const [loadingTests, setLoadingTests] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TestStatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<TestsDateFilter>({
    startDate: "",
    endDate: "",
  });
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [attemptLaunch, setAttemptLaunch] = useState<{
    testId: string;
    testTitle: string;
    resumeAttemptId?: string;
    isPractice?: boolean;
  } | null>(null);
  const [reviewLaunch, setReviewLaunch] = useState<{
    sessionId: string;
    testTitle: string;
  } | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const isMobileLayout = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    let cancelled = false;

    async function loadDirections() {
      setLoadingDirections(true);
      setError(null);

      try {
        const data = await fetchDirections();
        if (cancelled) {
          return;
        }

        setDirections(Array.isArray(data) ? data : []);

        if (data.length > 0) {
          setDirectionName(data[0].name);
        }
      } catch (err) {
        if (!cancelled) {
          setDirections([]);
          setError(
            err instanceof Error
              ? err.message
              : "Не удалось загрузить направления",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDirections(false);
        }
      }
    }

    void loadDirections();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!directionName) {
      return;
    }

    let cancelled = false;

    async function loadTests() {
      setLoadingTests(true);
      setError(null);

      try {
        const response = await fetchTestsWithSessions(directionName);
        if (cancelled) {
          return;
        }

        setTests(Array.isArray(response.tests) ? response.tests : []);
        setSessions(Array.isArray(response.sessions) ? response.sessions : []);
      } catch (err) {
        if (!cancelled) {
          setTests([]);
          setSessions([]);
          setError(
            err instanceof Error ? err.message : "Не удалось загрузить тесты",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingTests(false);
        }
      }
    }

    void loadTests();

    return () => {
      cancelled = true;
    };
  }, [directionName, reloadToken]);

  const sessionMap = useMemo(() => buildSessionMap(sessions), [sessions]);

  const filteredTests = useMemo(() => {
    let result = filterTestsByStatus(tests, statusFilter);
    result = filterTestsBySearch(result, searchTerm);
    result = filterTestsByDate(result, dateFilter);
    return result;
  }, [tests, statusFilter, searchTerm, dateFilter]);

  useEffect(() => {
    if (filteredTests.length === 0) {
      setSelectedTestId(null);
      return;
    }

    const stillVisible = filteredTests.some(
      (test) => getTestId(test) === selectedTestId,
    );

    if (!stillVisible) {
      setSelectedTestId(getTestId(filteredTests[0]));
    }
  }, [filteredTests, selectedTestId]);

  useEffect(() => {
    if (selectedTestId || filteredTests.length === 0) {
      return;
    }

    setSelectedTestId(getTestId(filteredTests[0]));
  }, [filteredTests, selectedTestId]);

  useEffect(() => {
    setStatusFilter("all");
    setSearchTerm("");
    setDateFilter({ startDate: "", endDate: "" });
    setSelectedTestId(null);
  }, [directionName]);

  const selectedTest = useMemo(
    () =>
      filteredTests.find((test) => getTestId(test) === selectedTestId) ?? null,
    [filteredTests, selectedTestId],
  );

  const selectedSession = useMemo(() => {
    if (!selectedTest) {
      return null;
    }

    return sessionMap.get(getTestId(selectedTest)) ?? null;
  }, [selectedTest, sessionMap]);

  useEffect(() => {
    if (!isMobileLayout || !mobileSheetOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileLayout, mobileSheetOpen]);

  useEffect(() => {
    if (!isMobileLayout) {
      setMobileSheetOpen(false);
    }
  }, [isMobileLayout]);

  const closeMobileSheet = useCallback(() => {
    setMobileSheetOpen(false);
  }, []);

  const handleSelectTest = useCallback(
    (testId: string) => {
      setSelectedTestId(testId);
      if (isMobileLayout) {
        setMobileSheetOpen(true);
      }
    },
    [isMobileLayout],
  );

  const handleStartTest = useCallback(
    (testId: string) => {
      const test = tests.find((item) => getTestId(item) === testId);
      if (!test) {
        return;
      }

      setMobileSheetOpen(false);
      setAttemptLaunch({
        testId,
        testTitle: getTestTitle(test),
      });
    },
    [tests],
  );

  const handleResumeTest = useCallback(
    (testId: string, attemptId: string) => {
      const test = tests.find((item) => getTestId(item) === testId);
      if (!test) {
        return;
      }

      setMobileSheetOpen(false);
      setAttemptLaunch({
        testId,
        testTitle: getTestTitle(test),
        resumeAttemptId: attemptId,
      });
    },
    [tests],
  );

  const handlePractice = useCallback(
    (testId: string) => {
      const test = tests.find((item) => getTestId(item) === testId);
      if (!test) {
        return;
      }

      setMobileSheetOpen(false);
      setAttemptLaunch({
        testId,
        testTitle: getTestTitle(test),
        isPractice: true,
      });
    },
    [tests],
  );

  const handleViewAnswers = useCallback(
    (testId: string, sessionId: string) => {
      const test = tests.find((item) => getTestId(item) === testId);
      if (!test) {
        return;
      }

      setMobileSheetOpen(false);
      setReviewLaunch({
        sessionId,
        testTitle: getTestTitle(test),
      });
    },
    [tests],
  );

  if (loadingDirections) {
    return (
      <div className={styles.page}>
        <LoadingState label="Загрузка направлений…" variant="block" />
      </div>
    );
  }

  if (directions.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Тесты</span>
          <h1 className={styles.title}>Тесты</h1>
        </header>
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Направления не найдены</h2>
          <p className={styles.emptyText}>
            Нет доступных направлений для загрузки тестов.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {reviewLaunch ? (
        <TestReviewScreen
          sessionId={reviewLaunch.sessionId}
          testTitle={reviewLaunch.testTitle}
          onExit={() => setReviewLaunch(null)}
        />
      ) : null}

      {attemptLaunch ? (
        <TestAttemptScreen
          testId={attemptLaunch.testId}
          testTitle={attemptLaunch.testTitle}
          resumeAttemptId={attemptLaunch.resumeAttemptId}
          isPractice={attemptLaunch.isPractice}
          onExit={() => setAttemptLaunch(null)}
          onCompleted={() => {
            setAttemptLaunch(null);
            if (!attemptLaunch.isPractice) {
              setReloadToken((value) => value + 1);
            }
          }}
        />
      ) : null}

      <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Тесты</span>
          <h1 className={styles.title}>Список тестов</h1>
          <p className={styles.subtitle}>
            Выберите тест слева — справа откроется карточка с деталями и
            действиями.
          </p>
        </div>
      </header>

      {error ? <div className={styles.alert}>{error}</div> : null}

      <TestsToolbar
        directions={directions}
        directionName={directionName}
        onDirectionChange={setDirectionName}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />

      {loadingTests ? (
        <LoadingState label="Загрузка тестов…" variant="inline" />
      ) : null}

      <div className={styles.layout}>
        <section className={styles.listPane}>
          <TestsListSearch
            value={searchTerm}
            onChange={setSearchTerm}
            disabled={!directionName || loadingTests}
            resultCount={filteredTests.length}
          />

          {filteredTests.length > 0 ? (
            <div className={styles.list}>
              {filteredTests.map((test) => (
                <TestsListItem
                  key={getTestId(test)}
                  test={test}
                  selected={getTestId(test) === selectedTestId}
                  onSelect={handleSelectTest}
                />
              ))}
            </div>
          ) : (
            <div className={styles.listEmpty}>
              <p className={styles.listEmptyTitle}>Тесты не найдены</p>
              <p className={styles.listEmptyText}>
                Измените фильтры или выберите другое направление.
              </p>
            </div>
          )}
        </section>

        {!isMobileLayout ? (
          <TestDetailPanel
            test={selectedTest}
            session={selectedSession}
            onStartTest={handleStartTest}
            onResumeTest={handleResumeTest}
            onPractice={handlePractice}
            onViewAnswers={handleViewAnswers}
          />
        ) : null}
      </div>

      {isMobileLayout && mobileSheetOpen && selectedTest ? (
        <>
          <button
            type="button"
            className={styles.mobileSheetOverlay}
            aria-label="Закрыть карточку теста"
            onClick={closeMobileSheet}
          />
          <TestDetailPanel
            variant="sheet"
            test={selectedTest}
            session={selectedSession}
            onClose={closeMobileSheet}
            onStartTest={handleStartTest}
            onResumeTest={handleResumeTest}
            onPractice={handlePractice}
            onViewAnswers={handleViewAnswers}
          />
        </>
      ) : null}
    </div>
    </>
  );
}
