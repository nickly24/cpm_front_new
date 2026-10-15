"use client";
import { BFF_DEV } from "@/lib/config";
import { useContextGuard } from "@/lib/bff/use-context-guard";

import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import { AdminTestSaveRecalcDialog } from "@/components/admin/tests/admin-test-save-recalc-dialog";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { Toggle } from "@/components/ui/toggle";
import {
  createAdminTest,
  updateAdminTest,
  type AdminTestUpdateRecalc,
} from "@/lib/admin/admin-tests-api";
import type {
  AdminTestAnswer,
  AdminTestDetail,
  AdminTestFormData,
  AdminTestQuestion,
  AdminTestQuestionType,
  Direction,
} from "@/lib/admin/admin-tests-types";
import {
  emptyAdminTestForm,
  nextQuestionId,
  testDetailToFormData,
} from "@/lib/admin/admin-tests-utils";
import { useEffect, useState } from "react";
import { testTextAnswerIssue, textAnswerIssue } from "@/lib/admin/admin-test-text-answers";

type FormMode = "create" | "edit" | "view";
type QuestionEditorMode = "add" | "edit";

interface AdminTestFormProps {
  mode: FormMode;
  directions: Direction[];
  editingTest?: AdminTestDetail | null;
  defaultDirection?: string;
  embedded?: boolean;
  onBack: () => void;
  onSaved: () => void;
}

const defaultQuestion = (nextId: number): AdminTestQuestion => ({
  questionId: nextId,
  type: "single",
  text: "",
  points: 1,
  answers: [
    { id: "a", text: "", isCorrect: false },
    { id: "b", text: "", isCorrect: false },
  ],
  correctAnswers: [],
});

function buildNewQuestion(
  type: AdminTestQuestionType,
  questionId: number,
): AdminTestQuestion {
  return {
    ...defaultQuestion(questionId),
    type,
    correctAnswers: type === "text" ? [""] : [],
    answers:
      type === "text"
        ? []
        : [
            { id: "a", text: "", isCorrect: false },
            { id: "b", text: "", isCorrect: false },
          ],
  };
}

export function AdminTestForm({
  mode,
  directions,
  editingTest = null,
  defaultDirection = "",
  embedded = false,
  onBack,
  onSaved,
}: AdminTestFormProps) {
  const isReadOnly = mode === "view";
  const contentReadOnly = isReadOnly || (BFF_DEV && mode === "edit" && !editingTest?.actions?.can_edit_metadata);
  const settingsReadOnly = isReadOnly || (BFF_DEV && mode === "edit" && !editingTest?.actions?.can_edit_settings);
  useContextGuard(!isReadOnly);
  const [testData, setTestData] = useState<AdminTestFormData>(() => {
    const base = emptyAdminTestForm();
    if (defaultDirection) {
      base.direction = defaultDirection;
    }
    return base;
  });
  const [currentQuestion, setCurrentQuestion] = useState<AdminTestQuestion>(
    defaultQuestion(1),
  );
  const [questionEditorMode, setQuestionEditorMode] =
    useState<QuestionEditorMode>("add");
  const [showQuestionPopup, setShowQuestionPopup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveDialog, setSaveDialog] = useState<"confirm" | "result" | null>(
    null,
  );
  const [saveDialogError, setSaveDialogError] = useState<string | null>(null);
  const [saveRecalc, setSaveRecalc] = useState<AdminTestUpdateRecalc | null>(
    null,
  );

  useEffect(() => {
    if (editingTest && (mode === "edit" || mode === "view")) {
      setTestData(testDetailToFormData(editingTest));
    } else if (mode === "create") {
      const base = emptyAdminTestForm();
      if (defaultDirection) {
        base.direction = defaultDirection;
      }
      if(BFF_DEV)base.published=false;
      setTestData(base);
    }
  }, [editingTest, mode, defaultDirection]);

  const title =
    mode === "view"
      ? "Просмотр теста"
      : mode === "edit"
        ? "Редактирование теста"
        : "Создание нового теста";

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setTestData((prev) => ({
      ...prev,
      [name]: name === "timeLimitMinutes" ? Number(value) : value,
    }));
  };

  const openNewQuestion = (type: AdminTestQuestionType) => {
    setQuestionEditorMode("add");
    setCurrentQuestion(
      buildNewQuestion(type, Math.max(nextQuestionId(testData.questions), (testData.maxQuestionId || 0) + 1)),
    );
    setShowQuestionPopup(true);
  };

  const editQuestion = (question: AdminTestQuestion, index: number) => {
    setQuestionEditorMode("edit");
    setCurrentQuestion({
      ...question,
      questionId: question.questionId || index + 1,
      answers: question.answers?.map(({ pointValue: _pv, ...a }) => a) ?? [],
      correctAnswers: question.correctAnswers || [],
    });
    setShowQuestionPopup(true);
  };

  const saveQuestion = () => {
    const draft: AdminTestQuestion = { ...currentQuestion };
    if (textAnswerIssue(draft)) return;
    if (draft.type === "text") {
      draft.answers = [];
    } else {
      draft.correctAnswers = [];
    }

    setTestData((prev) => {
      if (questionEditorMode === "edit") {
        const existingIndex = prev.questions.findIndex(
          (q) => q.questionId === draft.questionId,
        );
        if (existingIndex < 0) {
          // Редактируемый ID пропал — не затираем чужой, добавляем как новый.
          const questionId = Math.max(nextQuestionId(prev.questions), (prev.maxQuestionId || 0) + 1);
          return {
            ...prev,
            questions: [...prev.questions, { ...draft, questionId }],
          };
        }
        return {
          ...prev,
          questions: prev.questions.map((q, i) =>
            i === existingIndex ? draft : q,
          ),
        };
      }

      // add: всегда append со свежим свободным ID (на случай устаревшего popup state)
      const questionId = Math.max(nextQuestionId(prev.questions), (prev.maxQuestionId || 0) + 1);
      return {
        ...prev,
        questions: [...prev.questions, { ...draft, questionId }],
      };
    });

    setQuestionEditorMode("add");
    setCurrentQuestion(
      defaultQuestion(Math.max(nextQuestionId(testData.questions), (testData.maxQuestionId || 0) + 1) + 1),
    );
    setShowQuestionPopup(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (testData.questions.length === 0 && (!BFF_DEV || testData.published)) {
      setError("Добавьте хотя бы один вопрос");
      return;
    }

    setError(null);

    const issue = !contentReadOnly && testTextAnswerIssue(testData.questions);
    if (issue) {
      setError(issue.message);
      editQuestion(testData.questions[issue.questionIndex], issue.questionIndex);
      return;
    }

    if (mode === "edit" && editingTest) {
      setSaveDialogError(null);
      setSaveRecalc(null);
      setSaveDialog("confirm");
      return;
    }

    setSaving(true);
    try {
      await createAdminTest(testData);
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось сохранить тест",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmEditSave = async () => {
    if (!editingTest) return;
    const issue = !contentReadOnly && testTextAnswerIssue(testData.questions);
    if (issue) { setSaveDialogError(issue.message); return; }
    setSaving(true);
    setSaveDialogError(null);
    try {
      const result = await updateAdminTest(editingTest._id, testData);
      setTestData(prev=>({...prev,expectedRevision:result.revision??prev.expectedRevision,maxQuestionId:result.maxQuestionId??prev.maxQuestionId}));
      setSaveRecalc(result.recalc ?? null);
      setSaveDialog("result");
    } catch (err) {
      setSaveDialogError(
        err instanceof Error ? err.message : "Не удалось сохранить тест",
      );
    } finally {
      setSaving(false);
    }
  };

  const closeSaveDialog = () => {
    if (saving) return;
    const wasResult = saveDialog === "result";
    setSaveDialog(null);
    setSaveDialogError(null);
    if (wasResult) {
      onSaved();
    }
  };

  const questionTypeLabel = (type: AdminTestQuestionType) => {
    if (type === "single") return "Одиночный выбор";
    if (type === "multiple") return "Множественный выбор";
    return "Текстовый ответ";
  };

  const wrapClass = embedded
    ? styles.embeddedFormInner
    : styles.fullscreenShell;

  return (
    <div className={wrapClass}>
      {!embedded ? (
        <header className={styles.fullscreenHeader}>
          <div className={styles.fullscreenHeaderContent}>
            <AdminFullscreenBack onBack={onBack} />
            <h1 className={styles.fullscreenTitle}>{title}</h1>
          </div>
        </header>
      ) : (
        <h2 className={styles.formSectionTitle}>{title}</h2>
      )}

      <div className={embedded ? undefined : styles.fullscreenBody}>
        {error ? <p className={styles.errorText} role="alert">{error}</p> : null}

        <form
          className={embedded ? styles.formEmbedded : styles.form}
          onSubmit={handleSubmit}
        >
        <section className={styles.formSection}>
          <h3 className={styles.formSectionTitle}>Основная информация</h3>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Название теста</span>
            <input
              className={styles.input}
              name="title"
              value={testData.title}
              onChange={handleFieldChange}
              required
              disabled={contentReadOnly}
            />
          </label>

          {BFF_DEV ? <label className={styles.field}><span className={styles.fieldLabel}>Описание</span><textarea className={styles.input} maxLength={2000} value={testData.description||""} disabled={contentReadOnly} onChange={e=>setTestData(p=>({...p,description:e.target.value}))} /></label> : null}
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Направление</span>
            <select
              className={styles.input}
              name="direction"
              value={testData.direction}
              onChange={handleFieldChange}
              required
              disabled={contentReadOnly}
            >
              <option value="">Выберите направление</option>
              {directions.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Дата начала</span>
              <input
                className={styles.input}
                type="datetime-local"
                name="startDate"
                value={testData.startDate}
                onChange={handleFieldChange}
                required={!BFF_DEV || testData.published}
                disabled={settingsReadOnly}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Дата окончания</span>
              <input
                className={styles.input}
                type="datetime-local"
                name="endDate"
                value={testData.endDate}
                onChange={handleFieldChange}
                required={!BFF_DEV || testData.published}
                disabled={settingsReadOnly}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Время на выполнение (мин)</span>
            <input
              className={styles.input}
              type="number"
              name="timeLimitMinutes"
              min={BFF_DEV && !testData.published ? 0 : 1}
              max={BFF_DEV ? 1440 : undefined}
              value={testData.timeLimitMinutes}
              onChange={handleFieldChange}
              required
              disabled={settingsReadOnly}
            />
          </label>

          {BFF_DEV ? <label className={styles.field}><span className={styles.fieldLabel}>Проходной процент (необязательно)</span><input className={styles.input} type="number" min={0} max={100} value={testData.passingScore??""} disabled={settingsReadOnly} onChange={e=>setTestData(p=>({...p,passingScore:e.target.value===""?null:Number(e.target.value)}))} /></label> : null}
          {!settingsReadOnly ? (
            <>
              <div className={styles.formToggles}>
                <Toggle
                  label="Видимость теста для студентов"
                  variant="success"
                  checked={testData.published}
                  onChange={(published) =>
                    setTestData((prev) => ({ ...prev, published }))
                  }
                />
                <Toggle
                  label="Показ правильных ответов после сдачи"
                  variant="success"
                  checked={testData.visible}
                  onChange={(visible) =>
                    setTestData((prev) => ({ ...prev, visible }))
                  }
                />
              </div>
              <p className={styles.readonlyFlags}>
                Настройки действуют в выбранном подразделении. Разбор и тренировка доступны при разрешённом просмотре ответов.
              </p>
            </>
          ) : (
            <div className={styles.readonlyFlags}>
              <span>
                Видимость: {testData.published ? "включена" : "скрыт"}
              </span>
              <span>
                Ответы: {testData.visible ? "доступны" : "скрыты"}
              </span>
            </div>
          )}
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.formSectionTitle}>
            Вопросы ({testData.questions.length})
          </h3>

          {testData.questions.map((question, index) => (
            <article key={`${question.questionId}-${index}`} className={styles.questionCard}>
              <div className={styles.questionCardHead}>
                <strong>Вопрос {index + 1}</strong>
                {!contentReadOnly ? (
                  <div className={styles.questionCardActions}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => editQuestion(question, index)}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className={styles.linkBtnDanger}
                      onClick={() =>
                        setTestData((prev) => ({
                          ...prev,
                          questions: prev.questions.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Удалить
                    </button>
                  </div>
                ) : null}
              </div>
              <p className={styles.questionPreviewText}>{question.text}</p>
              <p className={styles.questionMeta}>
                {questionTypeLabel(question.type)} · {question.points} б.
              </p>
            </article>
          ))}

          {!contentReadOnly ? (
            <div className={styles.addQuestionRow}>
              <Button type="button" variant="secondary" size="sm" onClick={() => openNewQuestion("single")}>
                + Одиночный
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => openNewQuestion("multiple")}>
                + Множественный
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => openNewQuestion("text")}>
                + Текстовый
              </Button>
            </div>
          ) : null}
        </section>

        {!isReadOnly ? (
          <Button type="submit" disabled={saving || (!BFF_DEV && testData.questions.length === 0)}>
            {saving
              ? "Сохранение…"
              : mode === "edit"
                ? "Сохранить изменения"
                : "Создать тест"}
          </Button>
        ) : null}
      </form>

        {showQuestionPopup && !contentReadOnly ? (
          <QuestionPopup
            question={currentQuestion}
            onChange={setCurrentQuestion}
            onSave={saveQuestion}
            onClose={() => setShowQuestionPopup(false)}
          />
        ) : null}

        {saveDialog ? (
          <AdminTestSaveRecalcDialog
            mode={saveDialog}
            saving={saving}
            saveError={saveDialogError}
            recalc={saveRecalc}
            onCancel={closeSaveDialog}
            onConfirm={() => void confirmEditSave()}
            onCloseResult={closeSaveDialog}
          />
        ) : null}
      </div>
    </div>
  );
}

function QuestionPopup({
  question,
  onChange,
  onSave,
  onClose,
}: {
  question: AdminTestQuestion;
  onChange: (q: AdminTestQuestion) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const aliasIssue = textAnswerIssue(question);
  const updateAnswer = (
    index: number,
    field: keyof AdminTestAnswer,
    value: string | boolean,
  ) => {
    onChange({
      ...question,
      answers: question.answers.map((answer, i) => {
        if (i !== index) {
          if (question.type === "single" && field === "isCorrect" && value === true) {
            return { ...answer, isCorrect: false };
          }
          return answer;
        }
        return { ...answer, [field]: value };
      }),
    });
  };

  const addAnswer = () => {
    const newId = BFF_DEV ? `option_${crypto.randomUUID()}` : String.fromCharCode(97 + question.answers.length);
    onChange({
      ...question,
      answers: [...question.answers, { id: newId, text: "", isCorrect: false }],
    });
  };

  return (
    <DismissibleOverlay className={styles.popupOverlay} onDismiss={onClose} role="presentation">
      <div
        className={styles.popup}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className={styles.popupHeader}>
          <h4>Редактор вопроса</h4>
          <button type="button" className={styles.popupClose} onClick={onClose}>
            ×
          </button>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Текст вопроса</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={question.text}
            onChange={(e) => onChange({ ...question, text: e.target.value })}
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Баллы</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={BFF_DEV ? 100000 : undefined}
            value={question.points}
            onChange={(e) =>
              onChange({ ...question, points: Number(e.target.value) })
            }
          />
        </label>

        {question.type !== "text" ? (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Варианты ответов</span>
            {question.answers.map((answer, index) => (
              <div key={answer.id} className={styles.answerRow}>
                <input
                  className={styles.input}
                  value={answer.text}
                  onChange={(e) => updateAnswer(index, "text", e.target.value)}
                  placeholder={`Вариант ${answer.id}`}
                  required
                />
                <label className={styles.answerCheck}>
                  <input
                    type="checkbox"
                    checked={answer.isCorrect}
                    onChange={(e) =>
                      updateAnswer(index, "isCorrect", e.target.checked)
                    }
                  />
                  Правильный
                </label>
              </div>
            ))}
            <button type="button" className={styles.linkBtn} disabled={BFF_DEV && question.answers.length>=50} onClick={addAnswer}>
              + Вариант
            </button>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Правильные ответы</span>
            {question.correctAnswers.map((answer, index) => (
              <div key={index} className={styles.answerRow}>
              <input
                className={styles.input}
                aria-label={`Правильный ответ ${index + 1}`}
                aria-invalid={aliasIssue?.answerIndex === index}
                aria-describedby={aliasIssue?.answerIndex === index ? "text-answer-error" : undefined}
                value={answer}
                onChange={(e) =>
                  onChange({
                    ...question,
                    correctAnswers: question.correctAnswers.map((a, i) =>
                      i === index ? e.target.value : a,
                    ),
                  })
                }
              />
              <button type="button" className={styles.linkBtnDanger} aria-label={`Удалить правильный ответ ${index + 1}`} onClick={() => onChange({ ...question, correctAnswers: question.correctAnswers.filter((_, i) => i !== index) })}>Удалить</button>
              </div>
            ))}
            {aliasIssue ? <p id="text-answer-error" className={styles.errorText} role="alert">{aliasIssue.answerIndex === undefined ? "" : `Ответ №${aliasIssue.answerIndex + 1}: `}{aliasIssue.message}</p> : null}
            <button
              type="button"
              className={styles.linkBtn}
              disabled={question.correctAnswers.length >= 50}
              onClick={() =>
                onChange({
                  ...question,
                  correctAnswers: [...question.correctAnswers, ""],
                })
              }
            >
              + Ответ
            </button>
          </div>
        )}

        <div className={styles.popupActions}>
          <Button
            type="button"
            onClick={onSave}
            disabled={
              !question.text || !!aliasIssue ||
              (question.type !== "text" && question.answers.length < 2)
            }
          >
            Сохранить вопрос
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </DismissibleOverlay>
  );
}
