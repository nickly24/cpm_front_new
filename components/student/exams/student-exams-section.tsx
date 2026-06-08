"use client";

import styles from "@/components/student/exams/student-exams.module.css";
import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import { fetchStudentExamSessionsPaginated } from "@/lib/exams/exams-api";
import type {
  ExamGradeFilter,
  ExamPagination,
  ExamSession,
  ExamSessionsSummary,
  StudentExamSortField,
} from "@/lib/exams/exams-types";
import {
  formatExamDate,
  getExamGradeClass,
  getExamGradeLabel,
} from "@/lib/exams/exams-utils";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 20;

const EMPTY_PAGINATION: ExamPagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

const EMPTY_SUMMARY: ExamSessionsSummary = {
  count: 0,
  averageGrade: 0,
  totalPoints: 0,
};

function gradeBadgeClass(grade: number): string {
  const tone = getExamGradeClass(grade);
  if (tone === "good") return styles.gradeGood;
  if (tone === "mid") return styles.gradeMid;
  if (tone === "ok") return styles.gradeOk;
  return styles.gradeLow;
}

function gradeValueClass(grade: number): string {
  const tone = getExamGradeClass(grade);
  if (tone === "good") return styles.gradeGood;
  if (tone === "mid") return styles.gradeMid;
  if (tone === "ok") return styles.gradeOk;
  return styles.gradeLow;
}

function ExamDetailView({
  session,
  onBack,
}: {
  session: ExamSession;
  onBack: () => void;
}) {
  return (
    <div className={styles.page}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        <ArrowLeft size={16} aria-hidden />
        Назад к списку
      </button>

      <article className={styles.detailPanel}>
        <div>
          <h2 className={styles.detailTitle}>{session.exam_name}</h2>
          <p className={styles.detailDate}>{formatExamDate(session.exam_date)}</p>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Оценка</span>
            <span
              className={`${styles.statValue} ${gradeValueClass(session.grade)}`}
            >
              {session.grade}
            </span>
            <span className={styles.statHint}>
              {getExamGradeLabel(session.grade)}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Баллы</span>
            <span className={styles.statValue}>{session.points}</span>
            <span className={styles.statHint}>из 6 максимальных</span>
          </div>
          {session.examinator ? (
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Экзаменатор</span>
              <span
                className={styles.statValue}
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

export function StudentExamsSection() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [summary, setSummary] = useState<ExamSessionsSummary>(EMPTY_SUMMARY);
  const [pagination, setPagination] =
    useState<ExamPagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterGrade, setFilterGrade] = useState<ExamGradeFilter>("all");
  const [sortBy, setSortBy] = useState<StudentExamSortField>("exam_date");
  const [page, setPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(
    null,
  );

  const loadSessions = useCallback(async () => {
    if (!user?.id) {
      setError("ID ученика не найден");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchStudentExamSessionsPaginated(user.id, {
        page,
        limit: PAGE_SIZE,
        grade: filterGrade,
        sort: sortBy,
      });
      if (response.status && response.sessions) {
        setSessions(response.sessions);
        setSummary(response.summary ?? EMPTY_SUMMARY);
        setPagination(response.pagination ?? EMPTY_PAGINATION);
      } else {
        setSessions([]);
        setSummary(EMPTY_SUMMARY);
        setPagination(EMPTY_PAGINATION);
        setError(response.error ?? "Не удалось загрузить экзамены");
      }
    } catch (err) {
      setSessions([]);
      setSummary(EMPTY_SUMMARY);
      setPagination(EMPTY_PAGINATION);
      setError(
        err instanceof Error ? err.message : "Ошибка при загрузке экзаменов",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, page, filterGrade, sortBy]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    setPage(1);
  }, [filterGrade, sortBy]);

  if (selectedSession) {
    return (
      <ExamDetailView
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  if (loading && sessions.length === 0) {
    return (
      <div className={styles.page}>
        <SectionHeroBanner
          imageSrc={STUDENT_SECTION_BANNERS.exams}
          title="Мои экзамены"
          subtitle="Результаты сданных экзаменов и зачётов"
        />
        <LoadingState label="Загрузка экзаменов…" variant="block" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.exams}
        title="Мои экзамены"
        subtitle="Результаты сданных экзаменов и зачётов"
      />

      {summary.count > 0 ? (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{summary.count}</span>
            <span className={styles.summaryLabel}>Сдано</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>
              {summary.averageGrade.toFixed(2)}
            </span>
            <span className={styles.summaryLabel}>Средняя оценка</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{summary.totalPoints}</span>
            <span className={styles.summaryLabel}>Всего баллов</span>
          </div>
        </div>
      ) : null}

      {summary.count > 0 ? (
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="student-exam-grade">
              Оценка
            </label>
            <select
              id="student-exam-grade"
              className={styles.select}
              value={filterGrade}
              onChange={(event) =>
                setFilterGrade(event.target.value as ExamGradeFilter)
              }
            >
              <option value="all">Все</option>
              <option value="5">5 — отлично</option>
              <option value="4">4 — хорошо</option>
              <option value="3">3 — удовлетворительно</option>
              <option value="2">2 — неудовлетворительно</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="student-exam-sort">
              Сортировка
            </label>
            <select
              id="student-exam-sort"
              className={styles.select}
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as StudentExamSortField)
              }
            >
              <option value="exam_date">По дате</option>
              <option value="grade">По оценке</option>
              <option value="points">По баллам</option>
            </select>
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingState label="Обновление списка…" variant="compact" />
      ) : null}

      {summary.count === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Пока нет сданных экзаменов</p>
          <p className={styles.emptyText}>
            После сдачи экзаменов их результаты появятся здесь.
          </p>
        </div>
      ) : sessions.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Нет результатов по фильтру</p>
          <p className={styles.emptyText}>
            Попробуйте изменить параметры фильтрации.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.cardsGrid}>
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={styles.examCard}
                onClick={() => setSelectedSession(session)}
              >
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>{session.exam_name}</h3>
                  <span
                    className={`${styles.gradeBadge} ${gradeBadgeClass(session.grade)}`}
                  >
                    {session.grade}
                  </span>
                </div>
                <p className={styles.cardMeta}>
                  {formatExamDate(session.exam_date)}
                </p>
                <div className={styles.cardFooter}>
                  <span>Баллы: {session.points} / 6</span>
                  {session.examinator ? (
                    <span>Экзаменатор: {session.examinator}</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>

          <AdminListPaginationBar pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
