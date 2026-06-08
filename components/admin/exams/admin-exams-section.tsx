"use client";

import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import examStyles from "@/components/admin/exams/admin-exams.module.css";
import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchExamSessionsByExamPaginated,
  fetchExamsPaginated,
} from "@/lib/exams/exams-api";
import type {
  Exam,
  ExamPagination,
  ExamSession,
  ExamSessionSortField,
  ExamSortField,
} from "@/lib/exams/exams-types";
import {
  formatExamDate,
  getExamGradeClass,
  getExamGradeLabel,
} from "@/lib/exams/exams-utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCallback, useEffect, useState } from "react";

const EXAMS_PAGE_SIZE = 20;
const SESSIONS_PAGE_SIZE = 25;

const EMPTY_PAGINATION: ExamPagination = {
  page: 1,
  limit: EXAMS_PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

function gradeClassName(grade: number): string {
  const tone = getExamGradeClass(grade);
  if (tone === "good") return examStyles.gradeGood;
  if (tone === "mid") return examStyles.gradeMid;
  if (tone === "ok") return examStyles.gradeOk;
  return examStyles.gradeLow;
}

function ExamSessionDetail({
  session,
  onBack,
}: {
  session: ExamSession;
  onBack: () => void;
}) {
  return (
    <div className={styles.page}>
      <AdminFullscreenBack onBack={onBack} label="Назад к сессиям" />

      <article className={examStyles.detailCard}>
        <div>
          <h2 className={examStyles.detailTitle}>{session.exam_name}</h2>
          <p className={examStyles.pageSubtitle}>
            {formatExamDate(session.exam_date)}
          </p>
        </div>

        <div className={examStyles.infoBlock}>
          <h3 className={styles.detailSectionTitle}>Ученик</h3>
          <p className={examStyles.infoLine}>
            <strong>{session.student_name ?? "—"}</strong>
          </p>
          <p className={examStyles.infoLine}>
            ID: <strong>{session.student_id ?? "—"}</strong>
          </p>
        </div>

        <div className={examStyles.statsGrid}>
          <div className={examStyles.statCard}>
            <span className={examStyles.statLabel}>Оценка</span>
            <span className={`${examStyles.statValue} ${gradeClassName(session.grade)}`}>
              {session.grade}
            </span>
            <span className={examStyles.statHint}>
              {getExamGradeLabel(session.grade)}
            </span>
          </div>
          <div className={examStyles.statCard}>
            <span className={examStyles.statLabel}>Баллы</span>
            <span className={examStyles.statValue}>{session.points}</span>
            <span className={examStyles.statHint}>из 6 максимальных</span>
          </div>
          {session.examinator ? (
            <div className={examStyles.statCard}>
              <span className={examStyles.statLabel}>Экзаменатор</span>
              <span
                className={examStyles.statValue}
                style={{ fontSize: 16, lineHeight: 1.35 }}
              >
                {session.examinator}
              </span>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export function AdminExamsSection() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [examSearch, setExamSearch] = useState("");
  const debouncedExamSearch = useDebouncedValue(examSearch, 300);
  const [examSort, setExamSort] = useState<ExamSortField>("date");
  const [examPage, setExamPage] = useState(1);
  const [examPagination, setExamPagination] =
    useState<ExamPagination>(EMPTY_PAGINATION);

  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const debouncedSessionSearch = useDebouncedValue(sessionSearch, 300);
  const [sessionSort, setSessionSort] =
    useState<ExamSessionSortField>("student_name");
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionPagination, setSessionPagination] =
    useState<ExamPagination>(EMPTY_PAGINATION);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(
    null,
  );

  const loadExams = useCallback(async () => {
    setExamsLoading(true);
    setExamsError(null);
    try {
      const response = await fetchExamsPaginated({
        page: examPage,
        limit: EXAMS_PAGE_SIZE,
        search: debouncedExamSearch.trim() || undefined,
        sort: examSort,
      });
      if (response.status && response.exams) {
        setExams(response.exams);
        setExamPagination(response.pagination ?? EMPTY_PAGINATION);
      } else {
        setExams([]);
        setExamPagination(EMPTY_PAGINATION);
        setExamsError(response.error ?? "Не удалось загрузить список экзаменов");
      }
    } catch (err) {
      setExams([]);
      setExamPagination(EMPTY_PAGINATION);
      setExamsError(
        err instanceof Error ? err.message : "Ошибка загрузки экзаменов",
      );
    } finally {
      setExamsLoading(false);
    }
  }, [debouncedExamSearch, examPage, examSort]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const loadSessions = useCallback(async () => {
    if (!selectedExam) {
      return;
    }

    setSessionsLoading(true);
    setSessionsError(null);
    setSelectedSession(null);
    try {
      const response = await fetchExamSessionsByExamPaginated(selectedExam.id, {
        page: sessionPage,
        limit: SESSIONS_PAGE_SIZE,
        search: debouncedSessionSearch.trim() || undefined,
        sort: sessionSort,
      });
      if (response.status && response.sessions) {
        setSessions(response.sessions);
        setSessionPagination(response.pagination ?? EMPTY_PAGINATION);
      } else {
        setSessions([]);
        setSessionPagination(EMPTY_PAGINATION);
        setSessionsError(
          response.error ?? "Не удалось загрузить сессии экзамена",
        );
      }
    } catch (err) {
      setSessions([]);
      setSessionPagination(EMPTY_PAGINATION);
      setSessionsError(
        err instanceof Error ? err.message : "Ошибка загрузки сессий",
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [
    debouncedSessionSearch,
    selectedExam,
    sessionPage,
    sessionSort,
  ]);

  useEffect(() => {
    if (selectedExam) {
      void loadSessions();
    }
  }, [loadSessions, selectedExam]);

  useEffect(() => {
    setExamPage(1);
  }, [debouncedExamSearch, examSort]);

  useEffect(() => {
    setSessionPage(1);
  }, [debouncedSessionSearch, sessionSort, selectedExam?.id]);

  const handleSelectExam = (exam: Exam) => {
    setSelectedExam(exam);
    setSessionSearch("");
    setSessionSort("student_name");
    setSessionPage(1);
  };

  const handleBackToExams = () => {
    setSelectedExam(null);
    setSessions([]);
    setSelectedSession(null);
    setSessionSearch("");
    setSessionPagination(EMPTY_PAGINATION);
  };

  if (selectedSession) {
    return (
      <ExamSessionDetail
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  if (selectedExam) {
    return (
      <div className={styles.page}>
        <AdminFullscreenBack onBack={handleBackToExams} label="К списку экзаменов" />

        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>{selectedExam.name}</h1>
            <p className={examStyles.pageSubtitle}>
              {formatExamDate(selectedExam.date)} · сессий:{" "}
              {sessionPagination.total || selectedExam.sessions_count || 0}
            </p>
          </div>
        </header>

        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            placeholder="Поиск по ученику, ID или экзаменатору…"
            value={sessionSearch}
            onChange={(event) => setSessionSearch(event.target.value)}
          />

          <div className={examStyles.filtersRow}>
            <div className={examStyles.filterGroup}>
              <label className={examStyles.filterLabel} htmlFor="session-sort">
                Сортировка
              </label>
              <select
                id="session-sort"
                className={styles.select}
                value={sessionSort}
                onChange={(event) =>
                  setSessionSort(event.target.value as ExamSessionSortField)
                }
              >
                <option value="student_name">По ученику</option>
                <option value="grade">По оценке</option>
                <option value="points">По баллам</option>
              </select>
            </div>
          </div>
        </div>

        {sessionsLoading ? (
          <LoadingState label="Загрузка сессий…" variant="panel" />
        ) : sessionsError ? (
          <p className={styles.errorText}>{sessionsError}</p>
        ) : sessions.length === 0 ? (
          <div className={examStyles.emptyState}>
            <p>
              {sessionPagination.total === 0
                ? "По этому экзамену пока нет сданных сессий."
                : "Ничего не найдено по запросу."}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Ученик</th>
                    <th>ID</th>
                    <th>Оценка</th>
                    <th>Баллы</th>
                    <th>Экзаменатор</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className={examStyles.clickableRow}
                      onClick={() => setSelectedSession(session)}
                    >
                      <td>{session.student_name ?? "—"}</td>
                      <td>{session.student_id ?? "—"}</td>
                      <td>
                        <span className={gradeClassName(session.grade)}>
                          {session.grade}
                        </span>
                      </td>
                      <td>{session.points}</td>
                      <td>{session.examinator ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminListPaginationBar
              pagination={sessionPagination}
              onPageChange={setSessionPage}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Экзамены</h1>
          <p className={examStyles.pageSubtitle}>
            Выберите экзамен, чтобы посмотреть сессии учеников.
          </p>
        </div>
      </header>

      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          placeholder="Поиск по названию…"
          value={examSearch}
          onChange={(event) => setExamSearch(event.target.value)}
        />

        <div className={examStyles.filtersRow}>
          <div className={examStyles.filterGroup}>
            <label className={examStyles.filterLabel} htmlFor="exam-sort">
              Сортировка
            </label>
            <select
              id="exam-sort"
              className={styles.select}
              value={examSort}
              onChange={(event) =>
                setExamSort(event.target.value as ExamSortField)
              }
            >
              <option value="date">По дате</option>
              <option value="name">По названию</option>
            </select>
          </div>
        </div>
      </div>

      {examsLoading ? (
        <LoadingState label="Загрузка экзаменов…" variant="panel" />
      ) : examsError ? (
        <p className={styles.errorText}>{examsError}</p>
      ) : exams.length === 0 ? (
        <div className={examStyles.emptyState}>
          <p>
            {examPagination.total === 0
              ? "В системе пока нет экзаменов."
              : "Ничего не найдено по запросу."}
          </p>
        </div>
      ) : (
        <>
          <div className={examStyles.examsGrid}>
            {exams.map((exam) => (
              <button
                key={exam.id}
                type="button"
                className={examStyles.examListCard}
                onClick={() => handleSelectExam(exam)}
              >
                <h3 className={examStyles.examListCardTitle}>{exam.name}</h3>
                <p className={examStyles.examListCardDate}>
                  {formatExamDate(exam.date)}
                </p>
                <p className={examStyles.examListCardHint}>
                  {exam.sessions_count ?? 0} сессий · открыть →
                </p>
              </button>
            ))}
          </div>

          <AdminListPaginationBar
            pagination={examPagination}
            onPageChange={setExamPage}
          />
        </>
      )}
    </div>
  );
}
