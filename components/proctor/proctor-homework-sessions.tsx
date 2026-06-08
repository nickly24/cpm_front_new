"use client";

import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  ProctorConfirmDialog,
  type ProctorConfirmDialogState,
} from "@/components/proctor/proctor-confirm-dialog";
import { ProctorPassModeToggle } from "@/components/proctor/proctor-pass-mode-toggle";
import { ProctorScoreInput } from "@/components/proctor/proctor-score-input";
import {
  editProctorHomeworkSession,
  fetchProctorHomeworkSessions,
  passProctorHomework,
  passProctorHomeworkBulk,
} from "@/lib/proctor/proctor-api";
import type { ProctorHomeworkSession } from "@/lib/proctor/proctor-types";
import {
  formatDateForInput,
  formatProctorDate,
} from "@/lib/proctor/proctor-utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./proctor.module.css";

type PassMode = "auto" | "manual";
type SessionFilter = "all" | "submitted" | "pending";

interface ProctorHomeworkSessionsProps {
  homeworkId: number;
  proctorId: number;
}

function todayInputValue(): string {
  return formatDateForInput(new Date().toISOString());
}

export function ProctorHomeworkSessions({
  homeworkId,
  proctorId,
}: ProctorHomeworkSessionsProps) {
  const [sessions, setSessions] = useState<ProctorHomeworkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [passMode, setPassMode] = useState<PassMode>("auto");
  const [bulkMode, setBulkMode] = useState<PassMode>("auto");

  const [editingPass, setEditingPass] = useState<ProctorHomeworkSession | null>(
    null,
  );
  const [editingSubmitted, setEditingSubmitted] =
    useState<ProctorHomeworkSession | null>(null);
  const [datePass, setDatePass] = useState("");
  const [scoreInput, setScoreInput] = useState("100");
  const [bulkDate, setBulkDate] = useState(todayInputValue());
  const [bulkScore, setBulkScore] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] =
    useState<ProctorConfirmDialogState | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] =
    useState<ProctorHomeworkSession | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchProctorHomeworkSessions(proctorId, homeworkId);
      if (response.status && Array.isArray(response.res)) {
        setSessions(response.res);
      } else {
        setSessions([]);
        setError("Не удалось загрузить данные по ученикам");
      }
    } catch (err) {
      setSessions([]);
      setError(
        err instanceof Error ? err.message : "Ошибка при загрузке сессий",
      );
    } finally {
      setLoading(false);
    }
  }, [homeworkId, proctorId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!success) {
      return;
    }
    const timer = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const stats = useMemo(() => {
    const submitted = sessions.filter((session) => session.status === 1).length;
    return { submitted, pending: sessions.length - submitted, total: sessions.length };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (sessionFilter === "submitted") {
      return sessions.filter((session) => session.status === 1);
    }
    if (sessionFilter === "pending") {
      return sessions.filter((session) => session.status !== 1);
    }
    return sessions;
  }, [sessionFilter, sessions]);

  const resetForm = () => {
    setEditingPass(null);
    setEditingSubmitted(null);
    setDatePass("");
    setScoreInput("100");
  };

  const parseScore = (value: string): number | undefined => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return undefined;
    }
    return Math.max(0, Math.min(100, Math.round(parsed)));
  };

  const resolveSessionId = (session: ProctorHomeworkSession): number | null => {
    if (session.id != null && session.id > 0) {
      return session.id;
    }
    const fresh = sessions.find(
      (item) =>
        item.student_id === session.student_id &&
        item.id != null &&
        item.id > 0,
    );
    return fresh?.id ?? null;
  };

  const handlePassHomework = async () => {
    if (!editingPass || !datePass) {
      return;
    }

    const manualScore =
      passMode === "manual" ? parseScore(scoreInput) : undefined;
    if (passMode === "manual" && manualScore === undefined) {
      setError("Укажите корректный балл от 0 до 100");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await passProctorHomework({
        sessionId: editingPass.id,
        datePass,
        studentId: editingPass.student_id,
        homeworkId,
        result: manualScore,
      });

      if (!response.status) {
        throw new Error("Не удалось занести сдачу");
      }

      setSessions((prev) =>
        prev.map((session) =>
          session.student_id === editingPass.student_id
            ? {
                ...session,
                id: response.sessionId ?? session.id ?? editingPass.id,
                status: 1,
                date_pass: datePass,
                result: response.result ?? manualScore ?? 100,
              }
            : session,
        ),
      );
      setSuccess(`ДЗ для ${editingPass.student_full_name} успешно занесено`);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка при занесении сдачи",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditHomework = async () => {
    if (!editingSubmitted) {
      return;
    }

    if (!datePass) {
      setError("Укажите дату сдачи");
      return;
    }

    const manualScore = parseScore(scoreInput);
    if (manualScore === undefined) {
      setError("Укажите корректный балл от 0 до 100");
      return;
    }

    const sessionId = resolveSessionId(editingSubmitted);

    setSubmitting(true);
    setError(null);

    try {
      const response = await editProctorHomeworkSession({
        sessionId,
        studentId: editingSubmitted.student_id,
        homeworkId,
        datePass,
        result: manualScore,
        status: 1,
      });

      if (!response.status) {
        throw new Error(response.error ?? "Не удалось сохранить изменения");
      }

      const nextDatePass =
        response.date_pass != null
          ? formatDateForInput(String(response.date_pass))
          : datePass;

      setSessions((prev) =>
        prev.map((session) =>
          session.student_id === editingSubmitted.student_id
            ? {
                ...session,
                id: sessionId ?? session.id,
                date_pass: nextDatePass || datePass,
                result: response.result ?? manualScore,
              }
            : session,
        ),
      );
      setSuccess(
        `ДЗ для ${editingSubmitted.student_full_name} успешно отредактировано`,
      );
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка при редактировании",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmission = async (session: ProctorHomeworkSession) => {
    const sessionId = resolveSessionId(session);
    if (!sessionId && session.status !== 1) {
      return;
    }

    setPendingDeleteSession(session);
    setConfirmDialog({
      kind: "delete",
      title: "Удалить сдачу?",
      description: `Сдача для ${session.student_full_name} будет сброшена. Ученик снова появится в списке как «не сдал».`,
    });
  };

  const executeDeleteSubmission = async () => {
    const session = pendingDeleteSession;
    if (!session) {
      return;
    }

    const sessionId = resolveSessionId(session);

    setSubmitting(true);
    setError(null);

    try {
      const response = await editProctorHomeworkSession({
        sessionId,
        studentId: session.student_id,
        homeworkId,
        status: 0,
      });

      if (!response.status) {
        throw new Error("Не удалось удалить сдачу");
      }

      setSessions((prev) =>
        prev.map((item) =>
          item.student_id === session.student_id
            ? {
                ...item,
                status: 0,
                result: 0,
                date_pass: null,
              }
            : item,
        ),
      );
      setSuccess(`Сдача для ${session.student_full_name} удалена`);
      resetForm();
      setConfirmDialog(null);
      setPendingDeleteSession(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка при удалении сдачи",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePassAll = () => {
    if (!bulkDate) {
      setError("Укажите дату сдачи для массового занесения");
      return;
    }

    const manualScore =
      bulkMode === "manual" ? parseScore(bulkScore) : undefined;
    if (bulkMode === "manual" && manualScore === undefined) {
      setError("Укажите корректный балл от 0 до 100");
      return;
    }

    setConfirmDialog({
      kind: "bulk",
      title: "Сдали все?",
      description: `Занести сдачу всем, кто ещё не сдал. Уже отмеченные ученики будут пропущены.`,
      pending: stats.pending,
    });
  };

  const executePassAll = async () => {
    if (!bulkDate) {
      setError("Укажите дату сдачи для массового занесения");
      return;
    }

    const manualScore =
      bulkMode === "manual" ? parseScore(bulkScore) : undefined;
    if (bulkMode === "manual" && manualScore === undefined) {
      setError("Укажите корректный балл от 0 до 100");
      return;
    }

    setBulkSubmitting(true);
    setError(null);

    try {
      const response = await passProctorHomeworkBulk({
        proctorId,
        homeworkId,
        datePass: bulkDate,
        result: manualScore,
      });

      if (!response.status) {
        throw new Error(response.error ?? "Не удалось занести сдачу всем");
      }

      await loadSessions();
      setSuccess(
        `Занесено ${response.passed ?? 0} из ${response.total ?? 0} (пропущено уже сдавших: ${response.skipped ?? 0})`,
      );
      setConfirmDialog(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка при массовом занесении",
      );
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleConfirmDialog = () => {
    if (!confirmDialog) {
      return;
    }
    if (confirmDialog.kind === "delete") {
      void executeDeleteSubmission();
      return;
    }
    void executePassAll();
  };

  if (loading) {
    return <LoadingState label="Загрузка учеников…" variant="panel" />;
  }

  if (error && sessions.length === 0) {
    return (
      <div className={styles.errorBox}>
        <p>{error}</p>
        <Button size="sm" variant="ghost" onClick={() => void loadSessions()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.sessionsWrap}>
      <div className={styles.sessionsToolbar}>
        <span className={styles.counter}>
          Сдали: {stats.submitted} / {stats.total}
        </span>
        <div className={styles.sessionFilterGroup}>
          {(
            [
              ["all", "Все"],
              ["submitted", "Сдали"],
              ["pending", "Не сдали"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${styles.filterChip} ${
                sessionFilter === value ? styles.filterChipActive : ""
              }`.trim()}
              onClick={() => setSessionFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {success ? <div className={styles.successBox}>{success}</div> : null}
      {error ? <div className={styles.errorBox}>{error}</div> : null}

      <div className={styles.sessionsList}>
        {filteredSessions.map((session) => {
          const submitted = session.status === 1;
          const isPassEditing =
            editingPass?.student_id === session.student_id && !submitted;
          const isEditEditing =
            editingSubmitted?.student_id === session.student_id && submitted;

          return (
            <div
              key={session.id ?? session.student_id}
              className={`${styles.sessionCard} ${
                submitted ? styles.sessionCardSubmitted : styles.sessionCardPending
              }`.trim()}
            >
              <div className={styles.studentInfo}>
                <span className={styles.studentName}>
                  {session.student_full_name}
                </span>
                <span className={styles.studentId}>ID: {session.student_id}</span>
              </div>

              {submitted ? (
                <div className={styles.sessionActions}>
                  <div className={styles.sessionMeta}>
                    <span>Баллы: {session.result}</span>
                    <span>
                      Дата сдачи: {formatProctorDate(session.date_pass, "Не указана")}
                    </span>
                  </div>

                  {isEditEditing ? (
                    <div className={styles.formStack}>
                      <div className={styles.formRow}>
                        <input
                          type="date"
                          className={styles.dateInput}
                          value={datePass}
                          min="2000-01-01"
                          max="2100-12-31"
                          onChange={(event) => setDatePass(event.target.value)}
                        />
                        <ProctorScoreInput
                          value={scoreInput}
                          onChange={setScoreInput}
                          disabled={submitting}
                        />
                      </div>
                      <div className={styles.formRow}>
                        <Button
                          type="button"
                          size="sm"
                          disabled={submitting || !datePass}
                          onClick={() => void handleEditHomework()}
                        >
                          {submitting ? "Сохранение…" : "Сохранить"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={resetForm}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.formRow}>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingSubmitted(session);
                          setEditingPass(null);
                          setDatePass(
                            formatDateForInput(session.date_pass) ||
                              todayInputValue(),
                          );
                          setScoreInput(String(session.result ?? 100));
                        }}
                      >
                        Редактировать
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={styles.dangerBtn}
                        disabled={submitting}
                        onClick={() => void handleDeleteSubmission(session)}
                      >
                        Удалить сдачу
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.sessionActions}>
                  <span className={styles.statusPending}>Не сдал</span>

                  {isPassEditing ? (
                    <div className={styles.formStack}>
                      <ProctorPassModeToggle
                        value={passMode}
                        onChange={setPassMode}
                      />
                      <div className={styles.formRow}>
                        <input
                          type="date"
                          className={styles.dateInput}
                          value={datePass}
                          min="2000-01-01"
                          max="2100-12-31"
                          onChange={(event) => setDatePass(event.target.value)}
                        />
                        {passMode === "manual" ? (
                          <ProctorScoreInput
                            value={scoreInput}
                            onChange={setScoreInput}
                            disabled={submitting}
                          />
                        ) : null}
                      </div>
                      <div className={styles.formRow}>
                        <Button
                          size="sm"
                          disabled={submitting || !datePass}
                          onClick={() => void handlePassHomework()}
                        >
                          {submitting ? "Отправка…" : "Занести"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={resetForm}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingPass(session);
                        setEditingSubmitted(null);
                        setDatePass(todayInputValue());
                        setScoreInput("100");
                        setPassMode("auto");
                      }}
                    >
                      Занести ДЗ
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {stats.pending > 0 ? (
        <div className={styles.bulkBar}>
          <div className={styles.bulkBarTitle}>Сдали все</div>
          <ProctorPassModeToggle
            value={bulkMode}
            onChange={setBulkMode}
            label="Баллы для всех"
          />
          <div className={styles.formRow}>
            <input
              type="date"
              className={styles.dateInput}
              value={bulkDate}
              min="2000-01-01"
              max="2100-12-31"
              onChange={(event) => setBulkDate(event.target.value)}
            />
            {bulkMode === "manual" ? (
              <ProctorScoreInput
                value={bulkScore}
                onChange={setBulkScore}
                disabled={bulkSubmitting}
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={bulkSubmitting || !bulkDate}
              onClick={handlePassAll}
            >
              {bulkSubmitting ? "Занесение…" : `Сдали все (${stats.pending})`}
            </Button>
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <ProctorConfirmDialog
          state={confirmDialog}
          loading={
            confirmDialog.kind === "delete" ? submitting : bulkSubmitting
          }
          onCancel={() => {
            if (submitting || bulkSubmitting) {
              return;
            }
            setConfirmDialog(null);
            setPendingDeleteSession(null);
          }}
          onConfirm={handleConfirmDialog}
        />
      ) : null}
    </div>
  );
}
