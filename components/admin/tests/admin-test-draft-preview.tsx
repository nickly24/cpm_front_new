"use client";

import type { AdminTestDraft } from "@/lib/admin/admin-test-drafts-types";
import { Button } from "@/components/ui/button";
import styles from "./admin-tests.module.css";

const questionTypes = { single: "Один ответ", multiple: "Несколько ответов", text: "Текстовый ответ" };

/** A read-only draft never mounts the editor, acquires a lock, or autosaves. */
export function AdminTestDraftPreview({ draft, onBack }: { draft: AdminTestDraft; onBack: () => void }) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{draft.title || "Черновик без названия"}</h1>
          <p>{draft.direction || "Направление не выбрано"} · Вопросов: {draft.canvas.questions.length}</p>
        </div>
        <Button variant="ghost" onClick={onBack}>← К тестам</Button>
      </header>
      <div className={styles.cardsGrid}>
        {draft.canvas.questions.map((question, index) => (
          <article className={styles.card} key={question.id}>
            <h2 style={{ whiteSpace: "pre-wrap", fontWeight: 600 }}>{index + 1}. {question.text}</h2>
            <p>Баллы: {question.points} · {questionTypes[question.type]}</p>
            <ul>{question.answers.map((answer) => (
              <li style={{ whiteSpace: "pre-wrap" }} key={answer.id}>{answer.text}{answer.isCorrect ? " — правильный ответ" : ""}</li>
            ))}</ul>
          </article>
        ))}
      </div>
    </div>
  );
}
