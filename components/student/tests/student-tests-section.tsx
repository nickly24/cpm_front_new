"use client";

import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { usePullToRefresh, PullRefreshIndicator } from "../shared/pull-to-refresh";
import { BFF_DEV } from "@/lib/config";
import { TestAttemptScreen } from "@/components/student/tests/attempt/test-attempt-screen";
import { TestReviewScreen } from "@/components/student/tests/review/test-review-screen";
import { TestsSearchScreen, type TestsSearchValues } from "./tests-search-screen";
import { ArrowLeft, Search } from "lucide-react";
import { TestDetailPanel } from "@/components/student/tests/test-detail-panel";
import { TestsDesktopList } from "./tests-desktop-list";
import { DesktopCatalogToolbar } from "../shared/desktop-catalog-toolbar";
import { TESTS_STATUS_FILTER_OPTIONS } from "./tests-filter-options";
import { TestsListItem } from "@/components/student/tests/tests-list-item";
import { TestsFeedEnd } from "./tests-feed-end";
import { useTestsFeed } from "./use-tests-feed";
import { TestsPagination } from "@/components/student/tests/tests-pagination";
import styles from "@/components/student/tests/tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import {
  buildSessionMap,
  fetchDirections,
  fetchStudentAvailableTests,
  fetchTestsWithSessions,
  filterTestsBySearch,
  filterTestsByStatus,
  getTestId,
  getTestTitle,
} from "@/lib/student/tests-api";
import type {
  Direction,
  TestStatusFilter,
} from "@/lib/student/tests-types";
import { TESTS_STATUS_LABELS } from "@/lib/student/tests-types";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeLocalAttempt } from "@/lib/student/test-attempt-catalog";
import { listV2Bundles } from "@/lib/student/test-attempt-v2-store";

type TestsViewMode = "overview" | "catalog";

export function StudentTestsSection() {
  const feedScroll = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const { setImmersive } = useCabinetChrome();
  const returnPosition = useRef<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<TestsViewMode>("overview");
  const [directions, setDirections] = useState<Direction[]>([]);
  const [directionName, setDirectionName] = useState("");
  const [page, setPage] = useState(1);
  const [loadingDirections, setLoadingDirections] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TestStatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchTerm), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [attemptLaunch, setAttemptLaunch] = useState<{
    testId: string;
    testTitle: string;
    timeLimitMinutes?: number | null;
    resumeAttemptId?: string;
    isPractice?: boolean;
  } | null>(null);
  const [reviewLaunch, setReviewLaunch] = useState<{
    sessionId: string;
    testTitle: string;
  } | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [desktopDetailOpen, setDesktopDetailOpen] = useState(false);
  const isMobileLayout = useMediaQuery("(max-width: 768px)");
  const fullScreen = Boolean(attemptLaunch || reviewLaunch || mobileSheetOpen && isMobileLayout);
  useEffect(() => {
    if (!fullScreen) return;
    setImmersive(true);
    return () => setImmersive(false);
  }, [fullScreen, setImmersive]);

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

  const loadPage = useCallback(async (requestedPage: number, signal: AbortSignal) => {
    const limit = desktop ? 12 : isMobileLayout ? 6 : undefined;
    const filters = { signal, search: searchQuery, status: statusFilter };
    const response = viewMode === "overview"
      ? await fetchStudentAvailableTests(requestedPage, limit, filters)
      : await fetchTestsWithSessions(directionName, requestedPage, limit, filters);
    signal.throwIfAborted();
    let loadedTests = Array.isArray(response.tests) ? response.tests : [];
    const localBundles = await listV2Bundles().catch(() => []);
    signal.throwIfAborted();
    const byTest = new Map(localBundles.map(bundle => [bundle.testId, bundle]));
    loadedTests = loadedTests.map(test => {
      const local = byTest.get(String(test.id));
      // Local delivery state must not reopen access revoked by the owner.
      if (!local || (BFF_DEV && (test.activeAttempt?.id !== local.attemptId || (!test.canResume && !test.canSubmitExpired && !test.canRequestHelp)))) return test;
      return mergeLocalAttempt(test, local);
    });
    if (viewMode === "overview" && !BFF_DEV && requestedPage === 1) {
      const ids = new Set(loadedTests.map(test => String(test.id)));
      for (const local of localBundles) {
        if (!ids.has(local.testId) && local.localStatus !== "uploaded") loadedTests.push(mergeLocalAttempt({ id: local.testId, title: local.testTitle, status: "running" }, local));
      }
    }
    if (!isMobileLayout && response.pagination?.total_pages && requestedPage > response.pagination.total_pages) setPage(response.pagination.total_pages);
    return { ...response, tests: loadedTests, sessions: Array.isArray(response.sessions) ? response.sessions : [] };
  }, [viewMode, directionName, isMobileLayout, desktop, searchQuery, statusFilter]);
  const { tests, sessions, pagination, loading: loadingTests, error: testsError, hasNext, loadNext, retry, refreshChecking } = useTestsFeed({
    queryKey: JSON.stringify([desktop ? "desktop" : "compact", viewMode, viewMode === "catalog" ? directionName : "", searchQuery, statusFilter]),
    mobile: isMobileLayout, page, enabled: viewMode === "overview" || Boolean(directionName), revision: reloadToken, loadPage,
  });

  const refreshFeed = useCallback(() => setReloadToken(value => value + 1), []);
  const pullDistance = usePullToRefresh(feedScroll, { loading: loadingTests, disabled: desktop || Boolean(searchOpen || mobileSheetOpen || attemptLaunch || reviewLaunch), onRefresh: refreshFeed });

  const awaitingCalculation = tests.some(test => test.status === "checking");
  useEffect(() => {
    if (!BFF_DEV || !awaitingCalculation || attemptLaunch || reviewLaunch || mobileSheetOpen) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshChecking();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [awaitingCalculation, attemptLaunch, reviewLaunch, mobileSheetOpen, refreshChecking]);

  const sessionMap = useMemo(() => buildSessionMap(sessions), [sessions]);

  const filteredTests = useMemo(() => {
    if (BFF_DEV) return tests;
    let result = filterTestsByStatus(tests, statusFilter);
    result = filterTestsBySearch(result, searchTerm);
    return result;
  }, [tests, statusFilter, searchTerm]);

  const effectiveSelectedTestId = filteredTests.some(test => getTestId(test) === selectedTestId)
    ? selectedTestId : filteredTests[0] ? getTestId(filteredTests[0]) : null;

  const resetFilters = useCallback(() => {
    setStatusFilter("all"); setSearchTerm(""); setSearchQuery("");
    setSelectedTestId(null); setPage(1);
  }, []);

  const selectedTest = useMemo(
    () =>
      filteredTests.find((test) => getTestId(test) === effectiveSelectedTestId) ?? null,
    [filteredTests, effectiveSelectedTestId],
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
    if (isMobileLayout) return;
    const timer = window.setTimeout(() => setMobileSheetOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [isMobileLayout]);

  const closeMobileSheet = useCallback(() => {
    setMobileSheetOpen(false);
  }, []);

  useEffect(() => {
    if (desktopDetailOpen || mobileSheetOpen || attemptLaunch || reviewLaunch || returnPosition.current === null) return;
    const top = returnPosition.current;
    returnPosition.current = null;
    if (!desktop && feedScroll.current) feedScroll.current.scrollTop = top; else window.scrollTo({ top, behavior: "instant" });
    // Repeat after overflow/focus cleanup so the browser cannot anchor us to the overlay.
    const frame = window.requestAnimationFrame?.(() => { if (!desktop && feedScroll.current) feedScroll.current.scrollTop = top; else window.scrollTo({ top, behavior: "instant" }); });
    return () => { if (frame !== undefined) window.cancelAnimationFrame(frame); };
  }, [desktop, desktopDetailOpen, mobileSheetOpen, attemptLaunch, reviewLaunch]);

  const handleSelectTest = useCallback(
    (testId: string) => {
      setSelectedTestId(testId);
      if (desktop) {
        returnPosition.current = window.scrollY;
        setDesktopDetailOpen(true);
        window.scrollTo({ top: 0, behavior: "instant" });
      } else if (isMobileLayout) {
        returnPosition.current = desktop ? window.scrollY : (feedScroll.current?.scrollTop ?? window.scrollY);
        setMobileSheetOpen(true);
      }
    },
    [desktop, isMobileLayout],
  );

  const handleStartTest = useCallback(
    (testId: string) => {
      const test = tests.find((item) => getTestId(item) === testId);
      if (!test) {
        return;
      }

      if (returnPosition.current === null) returnPosition.current = desktop ? window.scrollY : (feedScroll.current?.scrollTop ?? window.scrollY);
      setMobileSheetOpen(false);
      setAttemptLaunch({
        testId,
        testTitle: getTestTitle(test),
        timeLimitMinutes: test.timeLimitMinutes,
      });
    },
    [desktop, tests],
  );

  const handleResumeTest = useCallback(
    (testId: string, attemptId: string) => {
      const test = tests.find((item) => getTestId(item) === testId);
      if (!test) {
        return;
      }

      if (returnPosition.current === null) returnPosition.current = desktop ? window.scrollY : (feedScroll.current?.scrollTop ?? window.scrollY);
      setMobileSheetOpen(false);
      setAttemptLaunch({
        testId,
        testTitle: getTestTitle(test),
        timeLimitMinutes: test.timeLimitMinutes,
        resumeAttemptId: attemptId,
      });
    },
    [desktop, tests],
  );

  const handlePractice = useCallback(
    (testId: string) => {
      const test = tests.find((item) => getTestId(item) === testId);
      if (!test) {
        return;
      }

      if (returnPosition.current === null) returnPosition.current = desktop ? window.scrollY : (feedScroll.current?.scrollTop ?? window.scrollY);
      setMobileSheetOpen(false);
      setAttemptLaunch({
        testId,
        testTitle: getTestTitle(test),
        timeLimitMinutes: test.timeLimitMinutes,
        isPractice: true,
      });
    },
    [desktop, tests],
  );

  const handleViewAnswers = useCallback(
    (testId: string, sessionId: string) => {
      const test = tests.find((item) => getTestId(item) === testId);
      if (!test) {
        return;
      }

      if (returnPosition.current === null) returnPosition.current = desktop ? window.scrollY : (feedScroll.current?.scrollTop ?? window.scrollY);
      setMobileSheetOpen(false);
      setReviewLaunch({
        sessionId,
        testTitle: getTestTitle(test),
      });
    },
    [desktop, tests],
  );

  const openCatalog = useCallback(() => {
    setDesktopDetailOpen(false); resetFilters(); setViewMode("catalog");
  }, [resetFilters]);

  const backToOverview = useCallback(() => {
    setDesktopDetailOpen(false); resetFilters(); setViewMode("overview");
    setDirectionName("");
    setDirections([]);
  }, [resetFilters]);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
    setSelectedTestId(null);
    setMobileSheetOpen(false);
    if (desktop) window.scrollTo({ top: 0, behavior: "instant" }); else listRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [desktop]);

  const isOverview = viewMode === "overview";
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
          timeLimitMinutes={attemptLaunch.timeLimitMinutes}
          resumeAttemptId={attemptLaunch.resumeAttemptId}
          isPractice={attemptLaunch.isPractice}
          onExit={() => { setAttemptLaunch(null); setReloadToken(value => value + 1); }}
          onCompleted={() => {
            setAttemptLaunch(null);
            if (!attemptLaunch.isPractice) {
              setReloadToken((value) => value + 1);
            }
          }}
        />
      ) : null}

      {searchOpen ? <TestsSearchScreen initial={{ query: searchTerm, direction: directionName, status: statusFilter }} directions={directions} titles={[...new Set(tests.map(getTestTitle))]} loading={loadingDirections} onClose={() => setSearchOpen(false)} onApply={(values: TestsSearchValues) => { setSearchTerm(values.query); setSearchQuery(values.query); setDirectionName(values.direction); setStatusFilter(values.status); setPage(1); setSelectedTestId(null); setSearchOpen(false); }}/> : null}
      <div className={styles.page} data-desktop-detail={desktop && desktopDetailOpen ? "true" : undefined} inert={Boolean(attemptLaunch || reviewLaunch)}>
        {desktop ? !desktopDetailOpen ? <>
          <nav className={styles.desktopTabs} aria-label="Каталог тестов"><button type="button" aria-current={isOverview ? "page" : undefined} onClick={backToOverview}>Доступные</button><button type="button" aria-current={!isOverview ? "page" : undefined} onClick={openCatalog}>Все тесты</button></nav>
          {!isOverview ? <DesktopCatalogToolbar key={searchQuery} search={searchQuery} searchLabel="Найти тест" fields={[
            {key:"direction",label:"Направление",value:directionName,options:directions.map(item=>({value:item.name,label:item.name}))},
            {key:"status",label:"Статус теста",value:statusFilter,options:TESTS_STATUS_FILTER_OPTIONS.map(item=>({value:item.value,label:item.label}))}
          ]} onApply={values=>{setSearchTerm(values.search);setSearchQuery(values.search);setDirectionName(values.direction);setStatusFilter(values.status as typeof statusFilter);setPage(1);setSelectedTestId(null);}} onReset={()=>{resetFilters();setDirectionName(directions[0]?.name??"");}}/> : null}
        </> : null : isOverview ? <nav className={styles.viewTabs} aria-label="Каталог тестов">
          <button type="button" aria-current="page" onClick={() => {}}>Доступные</button>
          <button type="button" onClick={openCatalog}>Все тесты</button>
        </nav> : <div className={styles.catalogSearchBar}>
          <button type="button" className={styles.catalogBack} onClick={backToOverview} aria-label="К доступным тестам"><ArrowLeft size={23}/></button>
          <button type="button" className={styles.catalogSearch} onClick={() => setSearchOpen(true)} aria-label="Изменить поиск тестов"><Search size={19}/><span><strong>{searchTerm || "Все тесты"}</strong><small>{directionName || "Все направления"} · {statusFilter === "all" ? "Все статусы" : TESTS_STATUS_LABELS[statusFilter]}</small></span></button>
        </div>}

        {error || testsError ? <div className={styles.alert} role="alert">{error || testsError}{!isMobileLayout && testsError ? <button type="button" onClick={retry}>Повторить загрузку</button> : null}</div> : null}
        {loadingDirections ? <LoadingState label="Загрузка направлений…" variant="inline" /> : null}
        {!isOverview && !loadingDirections && !directions.length && !error ? <p className={styles.listEmptyText}>Направления не найдены</p> : null}

        {!isMobileLayout && loadingTests ? (
          <LoadingState label="Загрузка тестов…" variant="inline" />
        ) : null}

        <div className={styles.layout}>
          <section className={styles.listPane} hidden={desktop && desktopDetailOpen} ref={listRef} aria-label="Список тестов" aria-busy={loadingTests}>
            {!isMobileLayout && !desktop ? <TestsPagination pagination={pagination} onPageChange={handlePageChange} disabled={loadingTests} /> : null}


            <div ref={feedScroll} className={styles.feedScroll} role="region" aria-label="Лента тестов" tabIndex={0}>

            <PullRefreshIndicator distance={pullDistance} loading={loadingTests && filteredTests.length > 0 && pullDistance > 0}/>
            {filteredTests.length > 0 ? (
              desktop ? <TestsDesktopList tests={filteredTests} sessions={sessionMap} onSelect={handleSelectTest}/> : <div className={styles.list} data-layout={isOverview ? "cards" : "rows"}>
                {filteredTests.map((test) => (
                  <TestsListItem
                    key={getTestId(test)}
                    test={test}
                    selected={(!isMobileLayout || mobileSheetOpen) && getTestId(test) === effectiveSelectedTestId}
                    onSelect={handleSelectTest}
                    showDirection
                  />
                ))}
              </div>
            ) : !loadingTests && !loadingDirections && (isOverview || directionName) ? (
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

            {isMobileLayout ? <TestsFeedEnd hasNext={hasNext} loading={loadingTests} error={testsError} paused={Boolean(searchOpen || mobileSheetOpen || attemptLaunch || reviewLaunch)} count={filteredTests.length} onLoad={loadNext} onRetry={retry} /> : desktop && pagination && pagination.total_pages <= 1 ? <p className={styles.desktopCount}>Тестов: {pagination.total_items}</p> : <TestsPagination pagination={pagination} onPageChange={handlePageChange} disabled={loadingTests} />}

            </div>
          </section>

          {!isMobileLayout && (!desktop || desktopDetailOpen) ? (
            <TestDetailPanel
              variant={desktop ? "page" : "inline"}
              onClose={() => setDesktopDetailOpen(false)}
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
