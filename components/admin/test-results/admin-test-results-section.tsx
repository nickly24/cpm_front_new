"use client";

import {
  AdminAnswerItemsList,
  reviewItemsToRows,
} from "@/components/admin/tests/admin-answer-items-list";
import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import resultStyles from "@/components/admin/test-results/admin-test-results.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchStudentTestSessions,
  fetchTestSessionStats,
} from "@/lib/admin/admin-test-results-api";
import type { StudentTestSession } from "@/lib/admin/admin-test-results-types";
import {
  fetchAdminSessionDetail,
} from "@/lib/admin/admin-tests-monitoring-api";
import type { AdminSessionDetailResponse } from "@/lib/admin/admin-tests-monitoring-types";
import { fetchAdminStudents } from "@/lib/admin/admin-users-api";
import type { AdminStudent } from "@/lib/admin/admin-users-types";
import { formatAdminTestDate } from "@/lib/admin/admin-tests-utils";
import { fetchTestSessionReview } from "@/lib/student/test-review-api";
import type { TestSessionReview } from "@/lib/student/test-review-types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCallback, useEffect, useMemo, useState } from "react";

const STUDENTS_PAGE_SIZE = 12;
const SESSIONS_PAGE_SIZE = 9;

function scoreClass(score: number | null | undefined): string {
  if (score == null || Number.isNaN(Number(score))) {
    return "";
  }
  const value = Number(score);
  if (value >= 80) return resultStyles.scoreGood;
  if (value >= 60) return resultStyles.scoreMid;
  return resultStyles.scoreLow;
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(Number(minutes))) {
    return "—";
  }
  const total = Number(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) {
    return `${hours} ч ${mins} мин`;
  }
  return `${mins} мин`;
}

function questionTypeLabel(type: string): string {
  if (type === "single") return "Одиночный выбор";
  if (type === "multiple") return "Множественный выбор";
  if (type === "text") return "Текстовый ответ";
  return type;
}

export function AdminTestResultsSection() {
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const debouncedStudentSearch = useDebouncedValue(studentSearch, 300);
  const [studentPage, setStudentPage] = useState(1);

  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);
  const [sessions, setSessions] = useState<StudentTestSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const debouncedSessionSearch = useDebouncedValue(sessionSearch, 300);
  const [sessionPage, setSessionPage] = useState(1);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AdminSessionDetailResponse | null>(null);
  const [review, setReview] = useState<TestSessionReview | null>(null);
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof fetchTestSessionStats>
  > | null>(null);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      setStudents(await fetchAdminStudents());
    } catch (err) {
      setStudents([]);
      setStudentsError(
        err instanceof Error ? err.message : "Не удалось загрузить учеников",
      );
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const loadSessions = useCallback(async (studentId: number) => {
    setSessionsLoading(true);
    setSessionsError(null);
    setActiveSessionId(null);
    setDetail(null);
    setReview(null);
    setStats(null);
    try {
      setSessions(await fetchStudentTestSessions(studentId));
    } catch (err) {
      setSessions([]);
      setSessionsError(
        err instanceof Error ? err.message : "Не удалось загрузить результаты",
      );
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const filteredStudents = useMemo(() => {
    const query = debouncedStudentSearch.trim().toLowerCase();
    if (!query) {
      return students;
    }
    return students.filter(
      (student) =>
        student.full_name.toLowerCase().includes(query) ||
        String(student.id).includes(query) ||
        String(student.class ?? "").includes(query),
    );
  }, [students, debouncedStudentSearch]);

  const studentPagination = useMemo(() => {
    const total = filteredStudents.length;
    const totalPages = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));
    const page = Math.min(studentPage, totalPages);
    const start = (page - 1) * STUDENTS_PAGE_SIZE;
    return {
      page,
      limit: STUDENTS_PAGE_SIZE,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      items: filteredStudents.slice(start, start + STUDENTS_PAGE_SIZE),
    };
  }, [filteredStudents, studentPage]);

  const filteredSessions = useMemo(() => {
    const query = debouncedSessionSearch.trim().toLowerCase();
    if (!query) {
      return sessions;
    }
    return sessions.filter((session) =>
      (session.testTitle ?? "").toLowerCase().includes(query),
    );
  }, [sessions, debouncedSessionSearch]);

  const sessionPagination = useMemo(() => {
    const total = filteredSessions.length;
    const totalPages = Math.max(1, Math.ceil(total / SESSIONS_PAGE_SIZE));
    const page = Math.min(sessionPage, totalPages);
    const start = (page - 1) * SESSIONS_PAGE_SIZE;
    return {
      page,
      limit: SESSIONS_PAGE_SIZE,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      items: filteredSessions.slice(start, start + SESSIONS_PAGE_SIZE),
    };
  }, [filteredSessions, sessionPage]);

  useEffect(() => {
    setStudentPage(1);
  }, [debouncedStudentSearch]);

  useEffect(() => {
    setSessionPage(1);
  }, [debouncedSessionSearch, selectedStudent?.id]);

  const handleSelectStudent = (student: AdminStudent) => {
    setSelectedStudent(student);
    setSessionSearch("");
    void loadSessions(student.id);
  };

  const handleBackToStudents = () => {
    setSelectedStudent(null);
    setSessions([]);
    setActiveSessionId(null);
    setDetail(null);
    setReview(null);
    setStats(null);
    setSessionSearch("");
  };

  const openSessionDetail = async (session: StudentTestSession) => {
    setDetailLoading(true);
    setActiveSessionId(session.id);
    setDetail(null);
    setReview(null);
    setStats(null);
    try {
      const [adminDetail, reviewRes, statsRes] = await Promise.all([
        fetchAdminSessionDetail(session.id),
        fetchTestSessionReview(session.id),
        fetchTestSessionStats(session.id),
      ]);
      setDetail(adminDetail);
      setStats(statsRes);
      if (reviewRes.success && reviewRes.review) {
        setReview(reviewRes.review);
      }
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось загрузить сдачу",
      );
      setActiveSessionId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const reviewRows = review ? reviewItemsToRows(review.items) : [];

  if (selectedStudent) {
    return (
      <div className={styles.page}>
        <AdminFullscreenBack onBack={handleBackToStudents} label="К списку учеников" />

        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>{selectedStudent.full_name}</h1>
            <p className={resultStyles.pageSubtitle}>
              Результаты тестов · ID {selectedStudent.id}
              {selectedStudent.class ? ` · класс ${selectedStudent.class}` : ""}
            </p>
          </div>
        </header>

        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            placeholder="Поиск по названию теста…"
            value={sessionSearch}
            onChange={(event) => setSessionSearch(event.target.value)}
          />
        </div>

        {sessionsLoading ? (
          <LoadingState label="Загрузка результатов…" variant="panel" />
        ) : sessionsError ? (
          <p className={styles.errorText}>{sessionsError}</p>
        ) : filteredSessions.length === 0 ? (
          <div className={resultStyles.emptyState}>
            <p>
              {sessions.length === 0
                ? "У ученика пока нет завершённых тестов."
                : "Ничего не найдено по запросу."}
            </p>
          </div>
        ) : (
          <>
            <div className={resultStyles.sessionsGrid}>
              {sessionPagination.items.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={`${resultStyles.sessionCard} ${
                    activeSessionId === session.id
                      ? resultStyles.sessionCardActive
                      : ""
                  }`}
                  onClick={() => void openSessionDetail(session)}
                >
                  <div className={resultStyles.sessionCardHead}>
                    <h3 className={resultStyles.sessionTitle}>
                      {session.testTitle ?? "Без названия"}
                    </h3>
                    <span
                      className={`${resultStyles.sessionScore} ${scoreClass(session.score)}`}
                    >
                      {session.score ?? "—"}%
                    </span>
                  </div>
                  <div className={resultStyles.sessionMeta}>
                    <span>{formatAdminTestDate(session.completedAt)}</span>
                    <span>{formatDuration(session.timeSpentMinutes)}</span>
                  </div>
                </button>
              ))}
            </div>

            <AdminListPaginationBar
              pagination={sessionPagination}
              onPageChange={setSessionPage}
            />
          </>
        )}

        {detailLoading ? (
          <LoadingState label="Загрузка разбора…" variant="compact" />
        ) : null}

        {detail && !detailLoading ? (
          <div className={styles.detailCard}>
            <div className={styles.detailCardHead}>
              <div>
                <h3>{review?.testTitle ?? stats?.testTitle ?? "Сдача теста"}</h3>
                <p className={styles.panelHint}>
                  Итог: {review?.score ?? stats?.totalPoints ?? "—"}% ·{" "}
                  {formatAdminTestDate(review?.completedAt)}
                </p>
              </div>
            </div>

            <div className={resultStyles.statsGrid}>
              <div className={resultStyles.statCard}>
                <span className={resultStyles.statLabel}>Точность</span>
                <span className={resultStyles.statValue}>
                  {stats?.accuracy != null ? `${stats.accuracy}%` : "—"}
                </span>
              </div>
              <div className={resultStyles.statCard}>
                <span className={resultStyles.statLabel}>Верных</span>
                <span className={resultStyles.statValue}>
                  {stats?.correctAnswers != null && stats?.totalQuestions != null
                    ? `${stats.correctAnswers} / ${stats.totalQuestions}`
                    : review
                      ? `${review.items.filter((item) => item.isCorrect).length} / ${review.items.length}`
                      : "—"}
                </span>
              </div>
              <div className={resultStyles.statCard}>
                <span className={resultStyles.statLabel}>Время</span>
                <span className={resultStyles.statValue}>
                  {formatDuration(stats?.timeSpentMinutes)}
                </span>
              </div>
            </div>

            {stats?.questionTypes && Object.keys(stats.questionTypes).length > 0 ? (
              <div className={resultStyles.typeGrid}>
                {Object.entries(stats.questionTypes).map(([type, value]) => (
                  <div key={type} className={resultStyles.typeCard}>
                    <h4 className={resultStyles.typeTitle}>
                      {questionTypeLabel(type)}
                    </h4>
                    <p className={resultStyles.typeMeta}>Всего: {value.count}</p>
                    <p className={resultStyles.typeMeta}>
                      Правильно: {value.correct}
                    </p>
                    <p className={resultStyles.typeMeta}>Баллы: {value.points}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <h4 className={styles.detailSectionTitle}>Ответы по вопросам</h4>
            <AdminAnswerItemsList items={reviewRows} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Результаты тестов</h1>
          <p className={resultStyles.pageSubtitle}>
            Выберите ученика, чтобы посмотреть его сдачи и разбор ответов.
          </p>
        </div>
      </header>

      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          placeholder="Поиск по имени, ID или классу…"
          value={studentSearch}
          onChange={(event) => setStudentSearch(event.target.value)}
        />
      </div>

      {studentsLoading ? (
        <LoadingState label="Загрузка учеников…" variant="panel" />
      ) : studentsError ? (
        <p className={styles.errorText}>{studentsError}</p>
      ) : filteredStudents.length === 0 ? (
        <div className={resultStyles.emptyState}>
          <p>Ученики не найдены.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th>ID</th>
                  <th>Класс</th>
                  <th>Группа</th>
                </tr>
              </thead>
              <tbody>
                {studentPagination.items.map((student) => (
                  <tr
                    key={student.id}
                    className={resultStyles.studentRow}
                    onClick={() => handleSelectStudent(student)}
                  >
                    <td>
                      <div className={resultStyles.studentCell}>
                        <span className={resultStyles.studentAvatar}>
                          {student.full_name.charAt(0).toUpperCase()}
                        </span>
                        <strong>{student.full_name}</strong>
                      </div>
                    </td>
                    <td>{student.id}</td>
                    <td>{student.class ?? "—"}</td>
                    <td>{student.group_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AdminListPaginationBar
            pagination={studentPagination}
            onPageChange={setStudentPage}
          />
        </>
      )}
    </div>
  );
}
