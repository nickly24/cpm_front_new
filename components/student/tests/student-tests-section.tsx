"use client";

import { TestAttemptScreen } from "@/components/student/tests/attempt/test-attempt-screen";
import { TestReviewScreen } from "@/components/student/tests/review/test-review-screen";
import { TestsListSearch } from "@/components/student/tests/tests-list-search";
import { TestDetailPanel } from "@/components/student/tests/test-detail-panel";
import { TestsListItem } from "@/components/student/tests/tests-list-item";
import { TestsPagination } from "@/components/student/tests/tests-pagination";
import { TestsToolbar } from "@/components/student/tests/tests-toolbar";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import styles from "@/components/student/tests/tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import {
  buildSessionMap,
  fetchDirections,
  fetchStudentAvailableTests,
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
  TestsPagination as TestsPaginationMeta,
  TestStatusFilter,
} from "@/lib/student/tests-types";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useCallback, useEffect, useMemo, useState } from "react";

type TestsViewMode = "overview" | "catalog";

export function StudentTestsSection() {
  const [viewMode, setViewMode] = useState<TestsViewMode>("overview");
  const [directions, setDirections] = useState<Direction[]>([]);
  const [directionName, setDirectionName] = useState("");
  const [tests, setTests] = useState<StudentTestItem[]>([]);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [pagination, setPagination] = useState<TestsPaginationMeta | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [loadingDirections, setLoadingDirections] = useState(false);
  const [loadingTests, setLoadingTests] = useState(true);
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
    if (viewMode !== "catalog") {
      return;
    }

    let cancelled = false;

    async function loadDirections() {
      setLoadingDirections(true);
      setError(null);

      try {
        const data = await fetchDirections();
        if (cancelled) {
          return;
        }

        const list = Array.isArray(data) ? data : [];
        setDirections(list);

        if (list.length > 0) {
          setDirectionName((current) => current || list[0].name);
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
  }, [viewMode]);

  useEffect(() => {
    let cancelled = false;

    async function loadTests() {
      if (viewMode === "catalog" && !directionName) {
        return;
      }

      setLoadingTests(true);
      setError(null);

      try {
        const response =
          viewMode === "overview"
            ? await fetchStudentAvailableTests(page)
            : await fetchTestsWithSessions(directionName, page);

        if (cancelled) {
          return;
        }

        setTests(Array.isArray(response.tests) ? response.tests : []);
        setSessions(Array.isArray(response.sessions) ? response.sessions : []);
        setPagination(response.pagination ?? null);
      } catch (err) {
        if (!cancelled) {
          setTests([]);
          setSessions([]);
          setPagination(null);
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
  }, [viewMode, directionName, page, reloadToken]);

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
    setPage(1);
  }, [directionName, viewMode]);

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

  const openCatalog = useCallback(() => {
    setViewMode("catalog");
    setPage(1);
  }, []);

  const backToOverview = useCallback(() => {
    setViewMode("overview");
    setPage(1);
    setDirectionName("");
    setDirections([]);
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
    setSelectedTestId(null);
  }, []);

  const isOverview = viewMode === "overview";
  const heroTitle = isOverview ? "Доступные тесты" : "Все тесты";
  const heroSubtitle = isOverview
    ? "Тесты, которые можно начать или продолжить прямо сейчас. Полный каталог — по кнопке ниже."
    : "Выберите направление и тест. Список загружается по 5 штук на страницу.";

  if (viewMode === "catalog" && loadingDirections) {
    return (
      <div className={styles.page}>
        <LoadingState label="Загрузка направлений…" variant="block" />
      </div>
    );
  }

  if (viewMode === "catalog" && directions.length === 0) {
    return (
      <div className={styles.page}>
        <SectionHeroBanner
          imageSrc={STUDENT_SECTION_BANNERS.tests}
          eyebrow="Тесты"
          title="Тесты"
        />
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Направления не найдены</h2>
          <p className={styles.emptyText}>
            Нет доступных направлений для загрузки тестов.
          </p>
          <button
            type="button"
            className={styles.backToOverviewBtn}
            onClick={backToOverview}
          >
            К доступным тестам
          </button>
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
        <SectionHeroBanner
          imageSrc={STUDENT_SECTION_BANNERS.tests}
          eyebrow="Тесты"
          title={heroTitle}
          subtitle={heroSubtitle}
        />

        {viewMode === "catalog" ? (
          <div className={styles.catalogNav}>
            <button
              type="button"
              className={styles.backToOverviewBtn}
              onClick={backToOverview}
            >
              ← Доступные тесты
            </button>
          </div>
        ) : null}

        {error ? <div className={styles.alert}>{error}</div> : null}

        {viewMode === "catalog" ? (
          <TestsToolbar
            directions={directions}
            directionName={directionName}
            onDirectionChange={setDirectionName}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
          />
        ) : null}

        {loadingTests ? (
          <LoadingState label="Загрузка тестов…" variant="inline" />
        ) : null}

        <div className={styles.layout}>
          <section className={styles.listPane}>
            {viewMode === "catalog" ? (
              <TestsListSearch
                value={searchTerm}
                onChange={setSearchTerm}
                disabled={!directionName || loadingTests}
                resultCount={filteredTests.length}
              />
            ) : null}

            {filteredTests.length > 0 ? (
              <div className={styles.list}>
                {filteredTests.map((test) => (
                  <TestsListItem
                    key={getTestId(test)}
                    test={test}
                    selected={getTestId(test) === selectedTestId}
                    onSelect={handleSelectTest}
                    showDirection={isOverview}
                  />
                ))}
              </div>
            ) : !loadingTests ? (
              <div className={styles.listEmpty}>
                <p className={styles.listEmptyTitle}>
                  {isOverview
                    ? "Сейчас нет доступных тестов"
                    : "Тесты не найдены"}
                </p>
                <p className={styles.listEmptyText}>
                  {isOverview
                    ? "Когда откроется окно сдачи или останется незавершённая попытка, тест появится здесь."
                    : "Измените фильтры или выберите другое направление."}
                </p>
              </div>
            ) : null}

            <TestsPagination
              pagination={pagination}
              onPageChange={handlePageChange}
              disabled={loadingTests}
            />

            {isOverview ? (
              <div className={styles.viewAllBlock}>
                <button
                  type="button"
                  className={styles.viewAllBtn}
                  onClick={openCatalog}
                >
                  Смотреть все тесты
                </button>
                <p className={styles.viewAllHint}>
                  Направления и полный каталог с фильтрами
                </p>
              </div>
            ) : null}
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
