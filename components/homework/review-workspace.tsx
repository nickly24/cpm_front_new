"use client";

import { useAuth } from "@/contexts/AuthContext";
import { canAccessSection, isAdminCabinet } from "@/lib/auth/admin-access";
import { homeworkFilesApi } from "@/lib/homework-files/api";
import type { HomeworkWorkspace } from "@/lib/homework-files/types";
import { useHomeworkDialog } from "@/lib/homework-files/use-dialog";
import { HomeworkPdfViewer } from "./homework-pdf-viewer";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, CheckCircle2, Download, ExternalLink, FileText, RotateCcw, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { homeworkDate, homeworkFileSize, parseHomeworkScore, staffError, submissionLabels, type StaffHomeworkIdentity } from "./staff-homework-utils";
import styles from "./review-queue.module.css";

interface ReviewWorkspaceProps {
  work: StaffHomeworkIdentity;
  onClose: () => void;
  onChanged: (message?: string) => void | Promise<void>;
}

export function ReviewWorkspace({ work, onClose, onChanged }: ReviewWorkspaceProps) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<HomeworkWorkspace | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"grade" | "revision">("grade");
  const [autoScore, setAutoScore] = useState(false);
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");
  const [resubmitConfirm, setResubmitConfirm] = useState(false);
  const [mobilePane, setMobilePane] = useState<"file" | "review">("review");
  const dialog = useRef<HTMLDivElement>(null);
  const operation = useRef(false);
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => { if (resubmitConfirm) { confirmation.current?.focus(); confirmation.current?.scrollIntoView({ block: "nearest" }); } }, [resubmitConfirm]);
  useHomeworkDialog(dialog, () => { if (!operation.current) onClose(); });

  const load = useCallback(async () => {
    const data = await homeworkFilesApi.workspace(work.homework_id, work.student_id);
    setWorkspace(data);
    if (data.legacy_result?.result != null && data.submission.state === "graded") setScore(String(data.legacy_result.result));
    if (data.submission.has_file) {
      const file = await homeworkFilesApi.fileUrl(work.id);
      setPdfUrl(file.url);
    } else setPdfUrl(null);
  }, [work.homework_id, work.id, work.student_id]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => void load().catch((reason) => { if (active) setError(staffError(reason)); }).finally(() => { if (active) setLoading(false); }), 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [load]);

  const state = workspace?.submission.state ?? "submitted";
  const reviewer = workspace?.submission.reviewer;
  const mine = reviewer?.id === user?.id && reviewer?.role === user?.role;
  const admin = isAdminCabinet(user?.role);
  const editable = Boolean(workspace) && (user?.role === "proctor" ? true : canAccessSection(user, state === "graded" ? "homework-archive" : "review-queue", "edit"));
  const canReview = editable && state === "in_review" && mine;
  const suggested = workspace?.suggested_score;
  const file = workspace?.submission.current_file;
  const validScore = parseHomeworkScore(score);

  const action = async (name: string, payload: object = {}) => {
    if (operation.current) return;
    operation.current = true; setBusy(name); setError(null); setNotice(null);
    let saved = false;
    try {
      await homeworkFilesApi.transition(work.id, name, payload);
      saved = true;
      setResubmitConfirm(false);
      const message = name === "grade" ? "Работа проверена. Оценка сохранена." : name === "request-revision" ? "Работа возвращена ученику на доработку." : name === "resubmit" ? "Пересдача открыта. Ученик может прикрепить новую работу." : name === "edit-grade" ? "Оценка обновлена." : "Статус работы обновлён.";
      setNotice(message);
      const inaccessibleDestination = user?.role === "staff_admin" && (name === "resubmit" || (name === "grade" && !canAccessSection(user, "homework-archive")));
      if (inaccessibleDestination) { await onChanged(message); onClose(); return; }
      await load();
      await onChanged(message);
    } catch (reason) {
      setError(saved ? `Изменение сохранено, но не удалось обновить экран: ${staffError(reason)}` : staffError(reason));
      // A competing reviewer may have changed the state since this panel opened.
      await load().catch(() => undefined);
    } finally { operation.current = false; setBusy(null); }
  };

  const saveGrade = () => {
    const useAuto = autoScore && state !== "graded";
    if (!useAuto && validScore === null) { setError("Введите целый балл от 0 до 100."); return; }
    if (useAuto && suggested == null) { setError("Не удалось рассчитать балл. Укажите его вручную."); return; }
    void action(state === "graded" ? "edit-grade" : "grade", useAuto ? {} : { result: validScore });
  };

  const sendRevision = () => {
    const message = comment.trim();
    if (!message || message.length > 1000) { setError("Опишите, что исправить: от 1 до 1000 символов."); return; }
    void action("request-revision", { message });
  };

  const download = async () => {
    if (operation.current) return;
    setBusy("download"); setError(null);
    try {
      const { url } = await homeworkFilesApi.fileUrl(work.id, false, true);
      const anchor = document.createElement("a"); anchor.href = url; anchor.rel = "noopener"; anchor.download = ""; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    } catch (reason) { setError(staffError(reason)); } finally { setBusy(null); }
  };

  return createPortal(<div className={styles.backdrop}>
    <div ref={dialog} tabIndex={-1} className={styles.workspace} role="dialog" aria-modal="true" aria-labelledby="review-workspace-title" aria-busy={loading || Boolean(busy)}>
      <header className={styles.workspaceHeader}>
        <button aria-label="К списку" className={styles.backButton} disabled={Boolean(busy)} onClick={onClose}><ArrowLeft size={18} /><span>К списку</span></button>
        <div className={styles.workspaceTitle}><span>{work.group_name ?? "Без группы"}</span><h2 id="review-workspace-title">{work.student_name}</h2><p>{work.homework_name}</p></div>
        <span className={styles.badge} data-state={state}>{submissionLabels[state]}</span>
      </header>
      {loading ? <div className={styles.loading}><Spinner /><span>Открываем работу…</span></div> : <>
        {error ? <div className={styles.workspaceError} role="alert">{error}</div> : null}
        <nav className={styles.mobilePaneTabs} aria-label="Область работы"><button aria-pressed={mobilePane === "file"} onClick={() => setMobilePane("file")}>Файл работы</button><button aria-pressed={mobilePane === "review"} onClick={() => setMobilePane("review")}>{state === "graded" ? "Результат" : "Проверка"}</button></nav>
        <div className={styles.workspaceBody} data-pane={mobilePane}>
          <section className={styles.pdfPane} aria-label="Файл ученика">
            <div className={styles.pdfToolbar}><div><FileText size={18} /><span>{file ? `${file.page_count} стр. · ${homeworkFileSize(file.size_bytes)}` : "Работа ученика"}</span></div><div>{pdfUrl ? <><a href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /><span>Открыть PDF</span></a><button disabled={Boolean(busy)} onClick={() => void download()} aria-label="Скачать PDF"><Download size={17} /></button></> : null}</div></div>
            {pdfUrl ? <HomeworkPdfViewer url={pdfUrl} filename={file?.filename} onRefresh={() => { void load().catch((reason) => setError(staffError(reason))); }} /> : <div className={styles.empty}><FileText /><h3>Файл недоступен</h3><p>{state === "none" ? "Ожидаем новую работу ученика." : "Обновите работу или попробуйте открыть её позже."}</p><button onClick={() => { setError(null); void load().catch((reason) => setError(staffError(reason))); }}>Обновить</button></div>}
          </section>
          <aside className={styles.reviewPane}>
            {notice ? <div className={styles.success} role="status"><CheckCircle2 size={18} />{notice}</div> : null}
            <div className={styles.detailBlock}><span className={styles.eyebrow}>Сведения о работе</span><dl className={styles.details}><div><dt>Отправлено</dt><dd>{homeworkDate(workspace?.submission.submitted_at_utc)}</dd></div><div><dt>Срок сдачи</dt><dd>{homeworkDate(workspace?.homework.deadline, false)}</dd></div><div><dt>Проверяет</dt><dd><UserRound size={14} />{mine ? "Вы" : reviewer?.full_name || (reviewer ? "Другой проверяющий" : "Ещё не назначен")}</dd></div></dl></div>
            {workspace?.submission.revision_comment ? <div className={styles.revisionNote}><b>Комментарий к доработке</b><p>{workspace.submission.revision_comment}</p></div> : null}
            {!workspace ? <button onClick={() => { setError(null); void load().catch((reason) => setError(staffError(reason))); }}>Повторить загрузку</button> : null}
            {state === "submitted" ? <div className={styles.detailBlock}><h3>Готово к проверке</h3><p className={styles.hint}>Возьмите работу, чтобы поставить оценку или отправить замечания ученику.</p>{editable ? <button className={styles.primary} disabled={Boolean(busy)} onClick={() => void action("claim")}>{busy === "claim" ? <Spinner size="sm" /> : <CheckCircle2 size={18} />}Взять на проверку</button> : null}</div> : null}
            {state === "in_review" && !mine && reviewer ? <div className={styles.revisionNote}><b>Работа уже на проверке</b><p>{reviewer.full_name || "Другой проверяющий"} занимается этой работой.</p>{admin && editable ? <button disabled={Boolean(busy)} onClick={() => void action("takeover")}>Назначить проверку себе</button> : null}</div> : null}
            {canReview ? <div className={styles.detailBlock}>
              <div className={styles.segmented}><button disabled={Boolean(busy)} aria-pressed={mode === "grade"} onClick={() => setMode("grade")}>Оценить</button><button disabled={Boolean(busy)} aria-pressed={mode === "revision"} onClick={() => setMode("revision")}>На доработку</button></div>
              {mode === "grade" ? <div className={styles.formStack}>
                <h3>Результат проверки</h3>
                {suggested != null ? <label className={styles.checkbox}><input disabled={Boolean(busy)} type="checkbox" checked={autoScore} onChange={(event) => setAutoScore(event.target.checked)} /><span>Рассчитать по сроку сдачи<b>{suggested} из 100 баллов</b></span></label> : null}
                {!autoScore ? <label className={styles.field}>Оценка<input aria-label="Оценка" disabled={Boolean(busy)} value={score} inputMode="numeric" placeholder="От 0 до 100" onChange={(event) => setScore(event.target.value)} aria-invalid={Boolean(score) && validScore === null} /><small>Целое число от 0 до 100</small></label> : <p className={styles.hint}>Балл рассчитан по дате отправки ученика. После сохранения работа попадёт в архив.</p>}
                <button className={styles.primary} disabled={Boolean(busy) || (!autoScore && validScore === null)} onClick={saveGrade}>{busy === "grade" ? <Spinner size="sm" /> : <CheckCircle2 size={18} />}Сохранить оценку{autoScore ? ` · ${suggested}` : validScore !== null ? ` · ${validScore}` : ""}</button>
              </div> : <div className={styles.formStack}><label className={styles.field}>Что нужно исправить<textarea aria-label="Что нужно исправить" disabled={Boolean(busy)} rows={6} value={comment} maxLength={1000} placeholder="Укажите страницы и объясните, что нужно доработать…" onChange={(event) => setComment(event.target.value)} /><small>{comment.length} / 1000 · комментарий увидит ученик</small></label><button className={styles.primary} disabled={Boolean(busy) || !comment.trim()} onClick={sendRevision}>{busy === "request-revision" ? <Spinner size="sm" /> : <RotateCcw size={18} />}Отправить на доработку</button></div>}
              <button className={styles.quietButton} disabled={Boolean(busy)} onClick={() => void action("release")}>Вернуть в очередь</button>
            </div> : null}
            {state === "revision_requested" ? <p className={styles.hint}>Ожидаем исправленный файл. После повторной отправки работа вернётся в очередь.</p> : null}
            {state === "graded" ? <div className={styles.detailBlock}><span className={styles.eyebrow}>Итог проверки</span><div className={styles.scoreResult}>{workspace?.legacy_result?.result ?? "—"}<small> / 100</small></div><p className={styles.hint}>Оценка сохранена. Файл доступен в архиве.</p>{editable ? <div className={styles.formStack}><label className={styles.field}>Изменить оценку<input aria-label="Изменить оценку" disabled={Boolean(busy)} inputMode="numeric" value={score} onChange={(event) => setScore(event.target.value)} aria-invalid={Boolean(score) && validScore === null} /><small>Целое число от 0 до 100</small></label><button disabled={Boolean(busy) || validScore === null || validScore === workspace?.legacy_result?.result} onClick={saveGrade}>{busy === "edit-grade" ? <Spinner size="sm" /> : null}Сохранить изменение</button>{resubmitConfirm ? <div ref={confirmation} tabIndex={-1} className={styles.confirmCard} role="alert"><h3>Открыть новую пересдачу?</h3><p>Итоговый PDF и оценка будут удалены. Ученик сможет заново прикрепить и отправить работу.</p><button className={styles.dangerButton} disabled={Boolean(busy)} onClick={() => void action("resubmit")}>{busy === "resubmit" ? <Spinner size="sm" /> : null}Удалить результат и открыть пересдачу</button><button disabled={Boolean(busy)} onClick={() => setResubmitConfirm(false)}>Отмена</button></div> : <button className={styles.quietButton} disabled={Boolean(busy)} onClick={() => setResubmitConfirm(true)}><RotateCcw size={17} />Открыть пересдачу</button>}</div> : null}</div> : null}
          </aside>
        </div>
      </>}
    </div>
  </div>, document.body);
}
