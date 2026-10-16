"use client";

import { Grid2X2, LockKeyhole, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./test-player.module.css";

export interface QuestionPage {
  id: number;
  status: "empty" | "answered" | "correct" | "incorrect";
  disabled?: boolean;
}

export function QuestionPagination({ pages, currentIndex, onSelect, disabled = false }: {
  pages: QuestionPage[];
  currentIndex: number;
  onSelect: (index: number) => void | Promise<void>;
  disabled?: boolean;
  summary: string;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const labels = { empty: "Без ответа", answered: "Ответ зафиксирован", correct: "Верно", incorrect: "Неверно" };
  return <>
    <div className={styles.pageBar}>
      <div><strong aria-live="polite">Вопрос {currentIndex + 1} <span>из {pages.length}</span></strong></div>
      <button type="button" className={styles.mapButton} onClick={() => setOpen(true)} disabled={disabled} aria-haspopup="dialog"><Grid2X2 size={17} />Все вопросы</button>
    </div>
    <dialog ref={dialog} className={styles.questionDialog} aria-labelledby={titleId} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <div className={styles.dialogHead}><h2 id={titleId}>Вопросы теста</h2><button type="button" className={styles.iconButton} onClick={() => setOpen(false)} aria-label="Закрыть вопросы"><X size={20} /></button></div>

      <nav className={styles.questionGrid} aria-label="Вопросы теста">
        {pages.map((page, index) => <button type="button" key={page.id} disabled={disabled || page.disabled} aria-label={`Вопрос ${index + 1}. ${page.disabled ? "Пока недоступен" : labels[page.status]}`} aria-current={index === currentIndex ? "step" : undefined} className={`${styles.questionNumber} ${styles[page.status]}`} onClick={() => { void Promise.resolve(onSelect(index)).then(() => setOpen(false)); }}>{index + 1}{page.disabled ? <LockKeyhole size={10} aria-hidden /> : null}</button>)}
      </nav>

    </dialog>
  </>;
}
