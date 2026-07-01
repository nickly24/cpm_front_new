"use client";

import styles from "@/components/admin/upload/admin-upload.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  commitTestImport,
  previewTestImport,
} from "@/lib/admin/admin-upload-api";
import { fetchAdminDirections } from "@/lib/admin/admin-tests-api";
import { downloadTestImportSample } from "@/lib/admin/admin-upload-export";
import {
  ADMIN_TEST_IMPORT_ACCEPT,
  formatUploadFileSize,
  type TestImportPreviewResponse,
} from "@/lib/admin/admin-upload-types";
import { CheckCircle2, Code2, Download, FileJson, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const FIELD_ROWS = [
  ["title", "string", "Название теста. Обязательное поле."],
  ["direction", "string", "Название существующего направления в CPM."],
  ["startDate", "string", "Дата начала в формате YYYY-MM-DDTHH:mm."],
  ["endDate", "string", "Дата окончания в формате YYYY-MM-DDTHH:mm."],
  ["timeLimitMinutes", "number", "Время на выполнение в минутах, целое число больше 0."],
  ["published", "boolean", "Показывать тест студентам в списке."],
  ["visible", "boolean", "Показывать правильные ответы после сдачи."],
  ["questions", "array", "Массив вопросов. Минимум один вопрос."],
  ["questions[].questionId", "number", "Уникальный номер вопроса внутри теста."],
  ["questions[].type", "single | multiple | text", "Тип вопроса."],
  ["questions[].text", "string", "Текст вопроса."],
  ["questions[].points", "number", "Баллы за вопрос, целое число больше 0."],
  ["answers[].id", "string", "ID варианта: a, b, c или другой уникальный код."],
  ["answers[].text", "string", "Текст варианта ответа."],
  ["answers[].isCorrect", "boolean", "Правильный ли вариант."],
  ["correctAnswers", "string[]", "Правильные текстовые ответы для type=text."],
];

const TYPE_EXAMPLES = [
  {
    title: "single",
    description: "Один правильный вариант. Ровно один answers[].isCorrect должен быть true.",
    code: `{
  "questionId": 1,
  "type": "single",
  "text": "Что выведет print(2 + 2)?",
  "points": 1,
  "answers": [
    { "id": "a", "text": "3", "isCorrect": false },
    { "id": "b", "text": "4", "isCorrect": true }
  ]
}`,
  },
  {
    title: "multiple",
    description: "Несколько правильных вариантов. Минимум один answers[].isCorrect должен быть true.",
    code: `{
  "questionId": 2,
  "type": "multiple",
  "text": "Какие типы данных есть в Python?",
  "points": 2,
  "answers": [
    { "id": "a", "text": "str", "isCorrect": true },
    { "id": "b", "text": "list", "isCorrect": true },
    { "id": "c", "text": "varchar", "isCorrect": false }
  ]
}`,
  },
  {
    title: "text",
    description: "Текстовый или числовой ответ. Числа пишутся строкой, например \"42\".",
    code: `{
  "questionId": 3,
  "type": "text",
  "text": "Как называется функция вывода в консоль?",
  "points": 1,
  "answers": [],
  "correctAnswers": ["print", "print()"]
}`,
  },
];

function isJsonFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".json") || file.type === "application/json";
}

function formatBoolean(value: boolean): string {
  return value ? "да" : "нет";
}

interface AdminTestUploadPanelProps {
  onImported?: () => void;
}

export function AdminTestUploadPanel({ onImported }: AdminTestUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rawPayload, setRawPayload] = useState<unknown | null>(null);
  const [preview, setPreview] = useState<TestImportPreviewResponse | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [createdTestId, setCreatedTestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleDirection, setSampleDirection] = useState("Python");

  useEffect(() => {
    let active = true;
    fetchAdminDirections()
      .then((directions) => {
        const firstDirection = directions.find((direction) => direction.name)?.name;
        if (active && firstDirection) {
          setSampleDirection(firstDirection);
        }
      })
      .catch(() => {
        /* sample keeps fallback direction */
      });
    return () => {
      active = false;
    };
  }, []);

  const reset = () => {
    setFile(null);
    setRawPayload(null);
    setPreview(null);
    setError(null);
    setCreatedTestId(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleFile = async (nextFile: File) => {
    if (!isJsonFile(nextFile)) {
      window.alert("Выберите файл .json");
      return;
    }

    setParsing(true);
    setError(null);
    setCreatedTestId(null);
    try {
      const text = await nextFile.text();
      const payload = JSON.parse(text) as unknown;
      const response = await previewTestImport(payload);
      setFile(nextFile);
      setRawPayload(payload);
      setPreview(response);
    } catch (err) {
      setFile(null);
      setRawPayload(null);
      setPreview(null);
      setError(
        err instanceof SyntaxError
          ? "JSON не распознан. Проверьте синтаксис файла."
          : err instanceof Error
            ? err.message
            : "Не удалось разобрать JSON",
      );
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async () => {
    if (!rawPayload || !preview || preview.errors.length > 0) {
      return;
    }

    setCommitting(true);
    setError(null);
    try {
      const response = await commitTestImport(rawPayload);
      if (!response.status || !response.testId) {
        throw new Error(response.error ?? "Не удалось создать тест");
      }
      setCreatedTestId(response.testId);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать тест");
    } finally {
      setCommitting(false);
    }
  };

  const canCommit = Boolean(preview && preview.errors.length === 0 && rawPayload && !committing);

  return (
    <div className={styles.main}>
      <div className={styles.mainHeader}>
        <div>
          <h2 className={styles.mainTitle}>Тесты из JSON</h2>
          <p className={styles.mainDesc}>
            Импорт одного внутреннего теста CPM с предпросмотром и строгой проверкой структуры.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => downloadTestImportSample(sampleDirection)}
        >
          <Download size={16} aria-hidden />
          Скачать пример JSON
        </Button>
      </div>

      <section className={styles.instructions} aria-labelledby="test-import-instructions">
        <h3 id="test-import-instructions" className={styles.blockTitle}>
          Инструкция по мапингу
        </h3>
        <ol className={styles.instructionsList}>
          <li>Скачайте пример JSON и оставьте корневой объект теста без оберток.</li>
          <li>Замените title, direction, даты и настройки видимости.</li>
          <li>Для каждого вопроса задайте questionId, type, text, points и ответы.</li>
          <li>Для числового ответа используйте type=text и correctAnswers со строковым значением 42.</li>
          <li>После загрузки проверьте preview. Тест создается только если ошибок нет.</li>
        </ol>
      </section>

      <div className={styles.mappingTableWrap}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Поле</th>
              <th>Тип</th>
              <th>Как заполнять</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_ROWS.map(([field, type, description]) => (
              <tr key={field}>
                <td>
                  <code>{field}</code>
                </td>
                <td>{type}</td>
                <td>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.exampleGrid}>
        {TYPE_EXAMPLES.map((example) => (
          <section key={example.title} className={styles.exampleCard}>
            <div className={styles.exampleHead}>
              <Code2 size={16} aria-hidden />
              <h3>{example.title}</h3>
            </div>
            <p>{example.description}</p>
            <pre className={styles.codeBlock}>{example.code}</pre>
          </section>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        className={styles.fileInput}
        accept={ADMIN_TEST_IMPORT_ACCEPT}
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) {
            void handleFile(next);
          }
        }}
      />

      {error ? <div className={testStyles.stateBox}>{error}</div> : null}

      {parsing ? (
        <LoadingState label="Разбор JSON…" variant="block" className={testStyles.stateBox} />
      ) : file ? (
        <div className={styles.fileRow}>
          <div className={styles.fileInfo}>
            <FileJson className={styles.fileIcon} size={22} aria-hidden />
            <div className={styles.fileMeta}>
              <p className={styles.fileName}>{file.name}</p>
              <p className={styles.fileSize}>{formatUploadFileSize(file.size)}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <X size={16} aria-hidden />
            Другой файл
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className={styles.dropzone}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <span className={styles.dropzoneIcon}>
            <Upload size={24} aria-hidden />
          </span>
          <p className={styles.dropzoneTitle}>Перетащите .json или выберите файл</p>
          <p className={styles.dropzoneText}>
            Один файл должен содержать один тест со всеми вопросами.
          </p>
        </div>
      )}

      {preview ? (
        <section className={styles.previewWrap}>
          <div className={styles.previewHeader}>
            <div>
              <h2 className={styles.mainTitle}>Предпросмотр теста</h2>
              <p className={styles.mainDesc}>
                {preview.preview.title || "Без названия"} · {preview.preview.direction || "без направления"}
              </p>
            </div>
            <div className={styles.actions}>
              <Button type="button" variant="ghost" onClick={reset}>
                Сбросить
              </Button>
              <Button type="button" disabled={!canCommit} onClick={() => void handleCommit()}>
                {committing ? "Создание…" : "Создать тест"}
              </Button>
            </div>
          </div>

          <div className={styles.summaryGrid}>
            <span className={styles.statPill}>
              Вопросов: <strong>{preview.summary.questionsTotal}</strong>
            </span>
            <span className={styles.statPill}>
              Баллов: <strong>{preview.summary.totalPoints}</strong>
            </span>
            <span className={styles.statPill}>
              single: <strong>{preview.summary.singleCount}</strong>
            </span>
            <span className={styles.statPill}>
              multiple: <strong>{preview.summary.multipleCount}</strong>
            </span>
            <span className={styles.statPill}>
              text: <strong>{preview.summary.textCount}</strong>
            </span>
            {preview.summary.errorsCount > 0 ? (
              <span className={`${styles.statPill} ${styles.statPillDanger}`}>
                Ошибок: <strong>{preview.summary.errorsCount}</strong>
              </span>
            ) : null}
          </div>

          <div className={styles.testMetaGrid}>
            <span>Начало: {preview.preview.startDate || "—"}</span>
            <span>Окончание: {preview.preview.endDate || "—"}</span>
            <span>Время: {preview.preview.timeLimitMinutes} мин</span>
            <span>В списке студентов: {formatBoolean(preview.preview.published)}</span>
            <span>Ответы после сдачи: {formatBoolean(preview.preview.visible)}</span>
          </div>

          {preview.errors.length > 0 ? (
            <div className={styles.errorList}>
              <h3 className={styles.blockTitle}>Ошибки валидации</h3>
              <ul>
                {preview.errors.map((item, index) => (
                  <li key={`${item.path}-${index}`}>
                    <code>{item.path}</code> — {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={styles.notice}>
              <CheckCircle2 size={18} aria-hidden />
              <strong>JSON прошёл проверку.</strong> Можно создавать тест.
            </div>
          )}

          <div className={styles.previewTableWrap}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Тип</th>
                  <th>Вопрос</th>
                  <th>Баллы</th>
                  <th>Ответы</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.questions.map((question, index) => (
                  <tr key={`${question.questionId}-${index}`}>
                    <td>{question.questionId}</td>
                    <td>{question.type}</td>
                    <td>{question.text || "—"}</td>
                    <td>{question.points}</td>
                    <td>
                      {question.type === "text"
                        ? (question.correctAnswers ?? []).join(", ") || "—"
                        : (question.answers ?? [])
                            .map((answer) =>
                              answer.isCorrect ? `${answer.id}: ${answer.text} ✓` : `${answer.id}: ${answer.text}`,
                            )
                            .join("; ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {createdTestId ? (
            <div className={styles.notice}>
              <CheckCircle2 size={18} aria-hidden />
              <strong>Тест создан.</strong> ID: {createdTestId}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
