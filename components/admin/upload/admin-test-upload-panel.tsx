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
import type { Direction } from "@/lib/admin/admin-tests-types";
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

type ImportKind = "json" | "online_test_pad";

interface TestImportMetadata {
  title: string;
  direction: string;
  startDate: string;
  endDate: string;
  timeLimitMinutes: number;
  published: boolean;
  visible: boolean;
}

interface TestImportSource {
  kind: ImportKind;
  payload?: unknown;
  sourceText?: string;
}

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".json") || name.endsWith(".js") || file.type === "application/json";
}

function formatBoolean(value: boolean): string {
  return value ? "да" : "нет";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseDateInput(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 16) : "";
}

function parseTimeLimit(value: unknown, fallback = 30): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function metadataFromPayload(payload: unknown, fallbackDirection: string): TestImportMetadata {
  if (!isRecord(payload)) {
    return {
      title: "",
      direction: fallbackDirection,
      startDate: "",
      endDate: "",
      timeLimitMinutes: 30,
      published: false,
      visible: false,
    };
  }

  return {
    title: typeof payload.title === "string" ? payload.title : "",
    direction: typeof payload.direction === "string" ? payload.direction : fallbackDirection,
    startDate: parseDateInput(payload.startDate),
    endDate: parseDateInput(payload.endDate),
    timeLimitMinutes: parseTimeLimit(payload.timeLimitMinutes),
    published: typeof payload.published === "boolean" ? payload.published : false,
    visible: typeof payload.visible === "boolean" ? payload.visible : false,
  };
}

function extractOnlineTestPadTitle(sourceText: string): string {
  const match = sourceText.match(/"Name"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match) {
    return "";
  }
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

function extractOnlineTestPadTimeLimit(sourceText: string): number {
  if (!/"timelimited"\s*:\s*true/.test(sourceText)) {
    return 30;
  }
  const match = sourceText.match(/"timelimitminutes"\s*:\s*(\d+)/);
  return match ? parseTimeLimit(Number(match[1])) : 30;
}

function applyMetadataToJsonPayload(payload: unknown, metadata: TestImportMetadata): unknown {
  return {
    ...(isRecord(payload) ? payload : {}),
    ...metadata,
  };
}

function buildImportPayload(
  source: TestImportSource | null,
  metadata: TestImportMetadata | null,
): unknown | null {
  if (!source || !metadata) {
    return null;
  }
  if (source.kind === "online_test_pad") {
    return {
      importFormat: "online_test_pad",
      sourceText: source.sourceText ?? "",
      metadata,
    };
  }
  return applyMetadataToJsonPayload(source.payload, metadata);
}

interface AdminTestUploadPanelProps {
  onImported?: () => void;
}

export function AdminTestUploadPanel({ onImported }: AdminTestUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<TestImportSource | null>(null);
  const [metadata, setMetadata] = useState<TestImportMetadata | null>(null);
  const [preview, setPreview] = useState<TestImportPreviewResponse | null>(null);
  const [previewStale, setPreviewStale] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [createdTestId, setCreatedTestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleDirection, setSampleDirection] = useState("Python");
  const [directions, setDirections] = useState<Direction[]>([]);

  useEffect(() => {
    let active = true;
    fetchAdminDirections()
      .then((directions) => {
        const firstDirection = directions.find((direction) => direction.name)?.name;
        if (active) {
          setDirections(directions);
        }
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
    setSource(null);
    setMetadata(null);
    setPreview(null);
    setPreviewStale(false);
    setError(null);
    setCreatedTestId(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const runPreview = async (
    nextSource = source,
    nextMetadata = metadata,
  ) => {
    const payload = buildImportPayload(nextSource, nextMetadata);
    if (!payload) {
      return;
    }
    setError(null);
    try {
      const response = await previewTestImport(payload);
      setPreview(response);
      setPreviewStale(false);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Не удалось проверить файл");
    }
  };

  const handleFile = async (nextFile: File) => {
    if (!isSupportedFile(nextFile)) {
      window.alert("Выберите файл .json или test.js");
      return;
    }

    setParsing(true);
    setError(null);
    setCreatedTestId(null);
    try {
      const text = await nextFile.text();
      const isOnlineTestPad = /(^|\s)var\s+test\s*=/.test(text);
      const nextSource: TestImportSource = isOnlineTestPad
        ? { kind: "online_test_pad", sourceText: text }
        : { kind: "json", payload: JSON.parse(text) as unknown };
      const nextMetadata = isOnlineTestPad
        ? {
            title: extractOnlineTestPadTitle(text),
            direction: sampleDirection,
            startDate: "",
            endDate: "",
            timeLimitMinutes: extractOnlineTestPadTimeLimit(text),
            published: false,
            visible: false,
          }
        : metadataFromPayload(nextSource.payload, sampleDirection);
      setFile(nextFile);
      setSource(nextSource);
      setMetadata(nextMetadata);
      await runPreview(nextSource, nextMetadata);
    } catch (err) {
      setFile(null);
      setSource(null);
      setMetadata(null);
      setPreview(null);
      setError(
        err instanceof SyntaxError
          ? "Файл не распознан. Для JSON проверьте синтаксис, для Online Test Pad выберите test.js."
          : err instanceof Error
            ? err.message
            : "Не удалось разобрать файл",
      );
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async () => {
    const payload = buildImportPayload(source, metadata);
    if (!payload || !preview || preview.errors.length > 0 || previewStale) {
      return;
    }

    setCommitting(true);
    setError(null);
    try {
      const response = await commitTestImport(payload);
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

  const handleMetadataChange = <K extends keyof TestImportMetadata>(
    key: K,
    value: TestImportMetadata[K],
  ) => {
    setMetadata((prev) => (prev ? { ...prev, [key]: value } : prev));
    setPreviewStale(true);
    setCreatedTestId(null);
  };

  const canCommit = Boolean(
    preview &&
      preview.errors.length === 0 &&
      source &&
      metadata &&
      !previewStale &&
      !committing,
  );

  return (
    <div className={styles.main}>
      <div className={styles.mainHeader}>
        <div>
          <h2 className={styles.mainTitle}>Тесты из JSON</h2>
          <p className={styles.mainDesc}>
            Импорт одного внутреннего теста CPM из JSON или test.js Online Test Pad.
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
          <li>Для CPM JSON оставьте корневой объект теста без оберток.</li>
          <li>Для Online Test Pad выберите файл test.js из экспортированной папки.</li>
          <li>Проверьте title, direction, даты и настройки видимости в форме метаданных.</li>
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
          <p className={styles.dropzoneTitle}>Перетащите .json / test.js или выберите файл</p>
          <p className={styles.dropzoneText}>
            Один файл должен содержать один тест со всеми вопросами.
          </p>
        </div>
      )}

      {metadata ? (
        <section className={styles.metaEditor} aria-labelledby="test-import-meta">
          <div className={styles.previewHeader}>
            <div>
              <h3 id="test-import-meta" className={styles.blockTitle}>
                Метаданные теста
              </h3>
              <p className={styles.mainDesc}>
                Эти поля попадут в тест CPM перед созданием.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void runPreview()}
              disabled={parsing || committing}
            >
              {previewStale ? "Обновить preview" : "Проверить ещё раз"}
            </Button>
          </div>

          <div className={styles.metaGrid}>
            <label className={styles.metaField}>
              <span>Название</span>
              <input
                type="text"
                value={metadata.title}
                onChange={(event) => handleMetadataChange("title", event.target.value)}
              />
            </label>
            <label className={styles.metaField}>
              <span>Направление</span>
              <select
                value={metadata.direction}
                onChange={(event) => handleMetadataChange("direction", event.target.value)}
              >
                <option value="">Выберите направление</option>
                {directions.map((direction) => (
                  <option key={direction.id ?? direction.name} value={direction.name}>
                    {direction.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.metaField}>
              <span>Начало</span>
              <input
                type="datetime-local"
                value={metadata.startDate}
                onChange={(event) => handleMetadataChange("startDate", event.target.value)}
              />
            </label>
            <label className={styles.metaField}>
              <span>Окончание</span>
              <input
                type="datetime-local"
                value={metadata.endDate}
                onChange={(event) => handleMetadataChange("endDate", event.target.value)}
              />
            </label>
            <label className={styles.metaField}>
              <span>Время, мин</span>
              <input
                type="number"
                min={1}
                value={metadata.timeLimitMinutes}
                onChange={(event) =>
                  handleMetadataChange("timeLimitMinutes", parseTimeLimit(Number(event.target.value)))
                }
              />
            </label>
            <label className={styles.metaCheck}>
              <input
                type="checkbox"
                checked={metadata.published}
                onChange={(event) => handleMetadataChange("published", event.target.checked)}
              />
              <span>Показать студентам</span>
            </label>
            <label className={styles.metaCheck}>
              <input
                type="checkbox"
                checked={metadata.visible}
                onChange={(event) => handleMetadataChange("visible", event.target.checked)}
              />
              <span>Показывать ответы после сдачи</span>
            </label>
          </div>
        </section>
      ) : null}

      {preview ? (
        <section className={styles.previewWrap}>
          <div className={styles.previewHeader}>
            <div>
              <h2 className={styles.mainTitle}>Предпросмотр теста</h2>
              <p className={styles.mainDesc}>
                {preview.source === "online_test_pad" ? "Online Test Pad" : "CPM JSON"} ·{" "}
                {preview.preview.title || "Без названия"} · {preview.preview.direction || "без направления"}
              </p>
            </div>
            <div className={styles.actions}>
              <Button type="button" variant="ghost" onClick={reset}>
                Сбросить
              </Button>
              <Button type="button" disabled={!canCommit} onClick={() => void handleCommit()}>
                {committing ? "Создание…" : previewStale ? "Обновите preview" : "Создать тест"}
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

          {preview.warnings && preview.warnings.length > 0 ? (
            <div className={styles.warningList}>
              <h3 className={styles.blockTitle}>Предупреждения импорта</h3>
              <ul>
                {preview.warnings.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {previewStale ? (
            <div className={styles.notice}>
              <FileJson size={18} aria-hidden />
              <strong>Метаданные изменены.</strong> Обновите preview перед созданием теста.
            </div>
          ) : null}

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
