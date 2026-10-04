"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "@/components/admin/tests/admin-tests.module.css";
import local from "./admin-student-deletion.module.css";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api/client";
import {
  createStudentDeletionJob, fetchStudentDeletionJob, fetchStudentDeletionJobs, fetchStudentDeletionPreview, retryStudentDeletionJob,
} from "@/lib/admin/student-deletion-api";
import {
  DELETION_COUNT_LABELS, deletionCanStart, deletionCountLabel, deletionIsActive, deletionProgress,
  deletionStatusLabel, latestDeletionJob, type DeletionCounts, type DeletionStudent,
  type StudentDeletionJob, type StudentDeletionPreview,
} from "@/lib/admin/student-deletion";
import { useStudentDeletionJobs } from "@/lib/admin/use-student-deletion-jobs";

function JobProgress({ job }: { job: StudentDeletionJob }) {
  const percent = deletionProgress(job);
  return <div aria-live="polite">
    <p><strong>{deletionStatusLabel(job)}</strong> · {percent}%</p>
    <progress className={local.progress} value={percent} max={100} aria-label="Ход удаления" />
    <p className={local.stage}>Этап: {job.stage || "Ожидание начала"}</p>
    <p className={local.hint}>Выполнено {job.completed_units} из {job.total_units} единиц работы</p>
    {job.error ? <p role="alert" className={local.warning}>{job.error}</p> : null}
    {job.status === "failed" ? <p className={local.warning}>Удаление не завершено. Часть данных уже могла быть удалена.
      {job.retryable ? " Можно продолжить эту же операцию." : " Обратитесь к администратору с номером операции."}</p> : null}
    {deletionIsActive(job) ? <p className={local.hint}>Прогресс получен с сервера. Окно можно закрыть: удаление продолжится. Отменить начатую операцию нельзя.</p> : null}
    <p className={local.hint}>Операция: {job.id}</p>
  </div>;
}

interface DialogProps {
  student: DeletionStudent;
  job: StudentDeletionJob | undefined;
  idempotencyKey?: string;
  pollingError?: string;
  onClose: () => void;
  onAccepted: (job: StudentDeletionJob) => void;
  onPending: (studentId: number, key: string) => void;
  onRejected: (studentId: number) => void;
}

export function AdminStudentDeletionDialog({ student, job, idempotencyKey, pollingError, onClose, onAccepted, onPending, onRejected }: DialogProps) {
  const [preview, setPreview] = useState<StudentDeletionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const keyRef = useRef(idempotencyKey ?? null);
  const inFlight = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const warningId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => { previous?.focus(); };
  }, []);

  useEffect(() => {
    if (job) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setConfirmed(false);
      try {
        // The latest server operation recovers work started in another tab/device.
        const latest = await fetchStudentDeletionJobs(student.id).then(latestDeletionJob).catch(() => null);
        if (cancelled) return;
        if (latest) { onAccepted(latest); return; }
        const data = await fetchStudentDeletionPreview(student.id);
        if (cancelled) return;
        if (data.active_job) onAccepted(data.active_job);
        else setPreview(data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Не удалось проверить данные ученика");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
    // Only job identity matters; polling updates must not restart the preview.
  }, [student.id, job?.id, onAccepted, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPreview = () => {
    setPreview(null);
    setConfirmed(false);
    setError(null);
    setLoading(true);
    setReload((value) => value + 1);
  };

  async function start() {
    if (inFlight.current || !confirmed || !deletionCanStart(preview) || !preview?.confirmation_token) {
      if (confirmed && !deletionCanStart(preview)) {
        setError("Данные или срок подтверждения изменились. Обновите расчёт и подтвердите его заново.");
        setConfirmed(false);
      }
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    // Keep the same key across an uncertain network result and explicit retries.
    keyRef.current ??= crypto.randomUUID();
    onPending(student.id, keyRef.current);
    try {
      onAccepted(await createStudentDeletionJob(student.id, preview.confirmation_token, keyRef.current));
    } catch (cause) {
      if (cause instanceof ApiError && ["preview_changed", "confirmation_expired"].includes(cause.code ?? "")) {
        onRejected(student.id);
        keyRef.current = null;
        setPreview(null);
        setConfirmed(false);
        setReload((value) => value + 1);
        setError("Расчёт изменился или истёк срок подтверждения. Проверьте обновлённые данные и подтвердите удаление заново.");
      } else {
        setError(cause instanceof Error ? cause.message : "Не удалось запустить удаление");
        // The POST may have succeeded before its response was lost. GET is safe.
        try {
          const latest = latestDeletionJob(await fetchStudentDeletionJobs(student.id));
          if (latest) onAccepted(latest);
          else if (cause instanceof ApiError && cause.status && cause.status < 500) onRejected(student.id);
        } catch { /* Keep the durable pending reference for recovery. */ }
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function retry() {
    if (!job || job.status !== "failed" || !job.retryable || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try { onAccepted(await retryStudentDeletionJob(job.id)); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось продолжить удаление");
      // A retry can also be accepted before the response is lost.
      try { onAccepted(await fetchStudentDeletionJob(job.id)); } catch { /* Preserve the last confirmed state. */ }
    }
    finally { inFlight.current = false; setSubmitting(false); }
  }

  const sourceIdentity = job?.student ?? preview?.student ?? student;
  const identity = {
    ...sourceIdentity,
    // Keep the name the administrator confirmed when completed journals redact it.
    name: job?.status === "completed" ? student.name ?? sourceIdentity.name : sourceIdentity.name ?? student.name,
    group_name: job?.status === "completed" ? student.group_name ?? sourceIdentity.group_name : sourceIdentity.group_name,
  };
  return <DismissibleOverlay className={styles.deleteDialogOverlay} onDismiss={onClose}>
    <div ref={dialogRef} tabIndex={-1} className={`${styles.deleteDialog} ${local.dialog}`} role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={job ? undefined : warningId}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key !== "Tab") return;
        const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <h2 id={titleId} className={styles.deleteDialogTitle}>{job ? "Удаление ученика" : "Удалить ученика безвозвратно?"}</h2>
      <div className={`${styles.deleteDialogMeta} ${local.identity}`}>
        <p className={styles.deleteDialogTestName}>{identity.name ?? `Ученик ID ${identity.id}`}</p>
        <p className={styles.deleteDialogTestDate}>ID {identity.id} · {identity.group_name || "Без группы"}</p>
      </div>
      {job ? <JobProgress job={job} /> : <>
        <p id={warningId} className={local.warning}>Учётная запись ученика, его работы, попытки, результаты и известные системе связанные файлы будут удалены из рабочих хранилищ без возможности восстановления в приложении.</p>
        <p className={local.hint}>Общие задания, тесты, экзамены, группы и данные других учеников сохранятся.</p>
        <p className={local.hint}>Останется минимальная техническая запись об операции удаления. Резервные копии и сохранённые версии у провайдера обрабатываются по отдельным правилам хранения; эта операция не подтверждает их физическое стирание.</p>
        {loading ? <LoadingState label="Проверяем связанные данные…" variant="inline" /> : preview ? <>
          <h3>Будет удалено</h3>
          <p className={local.hint}>Файлы и загрузки подсчитаны по известным системе ключам хранения, включая временные и исторические. Некоторые объекты уже могут отсутствовать в хранилище. Подробности ниже показывают отдельные категории и могут пересекаться.</p>
          <dl className={local.counts}>{Object.entries(DELETION_COUNT_LABELS).map(([key, label]) => <div className={local.countRow} key={key}>
            <dt>{label}</dt><dd>{deletionCountLabel(preview.counts?.[key as keyof DeletionCounts])}</dd>
          </div>)}</dl>
          {preview.details?.length ? <details><summary>Подробности связанных данных</summary><dl className={local.counts}>
            {preview.details.map((detail) => <div className={local.countRow} key={detail.key}><dt>{detail.label}</dt><dd>{deletionCountLabel(detail.count)}</dd></div>)}
          </dl></details> : null}
          {preview.blockers?.length ? <div role="alert" className={local.warning}><p>Удаление пока недоступно:</p><ul className={local.blockers}>
            {preview.blockers.map((blocker, index) => <li key={`${index}:${blocker}`}>{blocker}</li>)}
          </ul></div> : null}
          {!deletionCanStart(preview) ? <p className={local.warning}>Для удаления нужен полный актуальный расчёт. Неизвестные значения не означают отсутствие данных.</p> : null}
        </> : null}
        <label className={local.confirmation}><input type="checkbox" checked={confirmed} disabled={loading || submitting || !deletionCanStart(preview)} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>Я проверил имя и объём данных. Понимаю, что удаление необратимо.</span></label>
      </>}
      {error ? <p role="alert" className={local.warning}>{error}</p> : null}
      {pollingError ? <p role="alert" className={local.warning}>Не удалось обновить прогресс: {pollingError}. Показано последнее подтверждённое состояние. Проверка повторится автоматически.</p> : null}
      <div className={styles.deleteDialogActions}>
        <button type="button" className={styles.actionBtn} onClick={onClose}>{job || submitting ? "Закрыть" : "Отмена"}</button>
        {!job ? <>
          <button type="button" className={styles.actionBtn} disabled={loading || submitting} onClick={refreshPreview}>Обновить расчёт</button>
          <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDanger}`} disabled={loading || submitting || !confirmed || !deletionCanStart(preview)} onClick={() => void start()}>
            {submitting ? "Запуск…" : "Удалить безвозвратно"}
          </button>
        </> : job.status === "failed" && job.retryable ? <button type="button" className={styles.actionBtn} disabled={submitting} onClick={() => void retry()}>{submitting ? "Продолжаем…" : "Повторить удаление"}</button> : null}
      </div>
    </div>
  </DismissibleOverlay>;
}

interface ManagerProps {
  owner: string;
  selected: DeletionStudent | null;
  onSelect: (student: DeletionStudent | null) => void;
  onCompleted: (studentId: number) => void;
}

export function AdminStudentDeletionManager({ owner, selected, onSelect, onCompleted }: ManagerProps) {
  const { jobs, saved, errors, storageWarning, acceptJob, rememberPending, forget } = useStudentDeletionJobs(owner, onCompleted);
  const close = useCallback(() => onSelect(null), [onSelect]);
  return <>
    {storageWarning ? <p role="alert" className={local.warning}>{storageWarning}</p> : null}
    {saved.map((record) => {
      const job = jobs.find((entry) => entry.student_id === record.student_id);
      return <section key={record.student_id} className={local.operation} aria-label={`Удаление ученика ${record.student_id}`}>
        <div className={local.operationHeader}>
          <p>{job?.student.name ?? `Ученик ID ${record.student_id}`} · {job ? `${deletionStatusLabel(job)} · ${deletionProgress(job)}%` : "Проверяем состояние операции…"}</p>
          <div>
            <button type="button" className={styles.actionBtn} onClick={() => onSelect(job?.student ?? { id: record.student_id, name: `Ученик ID ${record.student_id}`, group_name: null })}>Подробнее</button>
            {job?.status === "completed" ? <button type="button" className={styles.actionBtn} onClick={() => forget(record.student_id)}>Скрыть</button> : null}
          </div>
        </div>
        {job?.error ? <p role="alert" className={local.warning}>{job.error}</p> : null}
        {errors[record.student_id] ? <p role="alert" className={local.warning}>Статус не обновлён: {errors[record.student_id]}. Проверка повторится автоматически.</p> : null}
      </section>;
    })}
    {selected ? <AdminStudentDeletionDialog key={selected.id} student={selected} job={jobs.find((job) => job.student_id === selected.id)}
      idempotencyKey={saved.find((entry) => entry.student_id === selected.id)?.idempotency_key} pollingError={errors[selected.id]}
      onClose={close} onAccepted={acceptJob} onPending={rememberPending} onRejected={forget} /> : null}
  </>;
}
