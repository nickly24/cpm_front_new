"use client";

import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  createAdminTest,
  updateAdminTest,
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
  testDetailToFormData,
} from "@/lib/admin/admin-tests-utils";
import { useEffect, useState } from "react";

type FormMode = "create" | "edit" | "view";

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
  const [showQuestionPopup, setShowQuestionPopup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTest && (mode === "edit" || mode === "view")) {
      setTestData(testDetailToFormData(editingTest));
    } else if (mode === "create") {
      const base = emptyAdminTestForm();
      if (defaultDirection) {
        base.direction = defaultDirection;
      }
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
    setCurrentQuestion({
      ...defaultQuestion(testData.questions.length + 1),
      type,
      correctAnswers: type === "text" ? [""] : [],
      answers:
        type === "text"
          ? []
          : [
              { id: "a", text: "", isCorrect: false },
              { id: "b", text: "", isCorrect: false },
            ],
    });
    setShowQuestionPopup(true);
  };

  const editQuestion = (question: AdminTestQuestion, index: number) => {
    setCurrentQuestion({
      ...question,
      questionId: question.questionId || index + 1,
      answers: question.answers?.map(({ pointValue: _pv, ...a }) => a) ?? [],
      correctAnswers: question.correctAnswers || [],
    });
    setShowQuestionPopup(true);
  };

  const saveQuestion = () => {
    const questionToAdd: AdminTestQuestion = { ...currentQuestion };
    if (questionToAdd.type === "text") {
      questionToAdd.answers = [];
    } else {
      questionToAdd.correctAnswers = [];
    }

    const existingIndex = testData.questions.findIndex(
      (q) => q.questionId === questionToAdd.questionId,
    );

    setTestData((prev) => ({
      ...prev,
      questions:
        existingIndex >= 0
          ? prev.questions.map((q, i) =>
              i === existingIndex ? questionToAdd : q,
            )
          : [...prev.questions, questionToAdd],
    }));

    setCurrentQuestion(defaultQuestion(testData.questions.length + 2));
    setShowQuestionPopup(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (testData.questions.length === 0) {
      setError("Добавьте хотя бы один вопрос");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (mode === "edit" && editingTest) {
        await updateAdminTest(editingTest._id, testData);
      } else {
        await createAdminTest(testData);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось сохранить тест",
      );
    } finally {
      setSaving(false);
    }
  };

  const questionTypeLabel = (type: AdminTestQuestionType) => {
    if (type === "single") return "Одиночный выбор";
    if (type === "multiple") return "Множественный выбор";
    return "Текстовый ответ";
  };

  const wrapClass = embedded
    ? styles.embeddedFormInner
    : `${styles.fullscreenShell} ${styles.formWrap}`;

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

      {error ? <p className={styles.errorText}>{error}</p> : null}

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
              disabled={isReadOnly}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Направление</span>
            <select
              className={styles.input}
              name="direction"
              value={testData.direction}
              onChange={handleFieldChange}
              required
              disabled={isReadOnly}
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
                required
                disabled={isReadOnly}
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
                required
                disabled={isReadOnly}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Время на выполнение (мин)</span>
            <input
              className={styles.input}
              type="number"
              name="timeLimitMinutes"
              min={1}
              value={testData.timeLimitMinutes}
              onChange={handleFieldChange}
              required
              disabled={isReadOnly}
            />
          </label>

          {!isReadOnly ? (
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
                {!isReadOnly ? (
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

          {!isReadOnly ? (
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
          <Button type="submit" disabled={saving || testData.questions.length === 0}>
            {saving
              ? "Сохранение…"
              : mode === "edit"
                ? "Сохранить изменения"
                : "Создать тест"}
          </Button>
        ) : null}
      </form>

      {showQuestionPopup && !isReadOnly ? (
        <QuestionPopup
          question={currentQuestion}
          onChange={setCurrentQuestion}
          onSave={saveQuestion}
          onClose={() => setShowQuestionPopup(false)}
        />
      ) : null}
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
    const newId = String.fromCharCode(97 + question.answers.length);
    onChange({
      ...question,
      answers: [...question.answers, { id: newId, text: "", isCorrect: false }],
    });
  };

  return (
    <div className={styles.popupOverlay} onClick={onClose} role="presentation">
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
            <button type="button" className={styles.linkBtn} onClick={addAnswer}>
              + Вариант
            </button>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Правильные ответы</span>
            {question.correctAnswers.map((answer, index) => (
              <input
                key={index}
                className={styles.input}
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
            ))}
            <button
              type="button"
              className={styles.linkBtn}
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
              !question.text ||
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
    </div>
  );
}
