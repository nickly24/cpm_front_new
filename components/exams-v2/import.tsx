"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessSection } from "@/lib/auth/admin-access";
import { importPrefix, parseExamImport, queryString } from "@/lib/exams-v2/api";
import { useExamMutation, useExamResource } from "@/lib/exams-v2/hooks";
import type {
  ImportCommit,
  ImportKind,
  ImportRow,
  ImportSession,
} from "@/lib/exams-v2/types";
import {
  Action,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  MutationNotice,
  Pager,
  ValidationList,
} from "./shared";
import type { AdminPanelProps } from "./admin-settings";
import s from "./exams.module.css";

const hints: Record<ImportKind, string> = {
  questions:
    "Колонки: part_code, question_text, answer_text (или «Часть», «Вопрос», «Эталонный ответ»).",
  outside:
    "Колонки: student_id и/или student_login, points, grade, examinator. Оценка 0–5, баллы произвольные неотрицательные.",
  assignments:
    "Колонки: student_id и/или student_login; examinator_1_id…examinator_6_id и/или examinator_1_login…examinator_6_login; replacement_limit. Не менее одного экзаменатора. Старые examinator_N означают логин, не ID.",
};
const labels: Record<string, string> = {
  studentId: "ID студента",
  studentLogin: "Логин студента",
  partCode: "Часть",
  questionText: "Вопрос",
  answerText: "Эталонный ответ",
  points: "Баллы",
  grade: "Оценка",
  examinator: "Имя экзаменатора",
  commissionMemberIds: "ID комиссии (через запятую)",
  commissionMemberLogins: "Логины комиссии (через запятую)",
  replacementLimit: "Лимит замен",
};

function inputValue(value: unknown): string {
  return Array.isArray(value)
    ? value.join(", ")
    : value == null
      ? ""
      : String(value);
}
export function importCellValue(
  key: string,
  value: string,
  previous: unknown,
): unknown {
  if (
    Array.isArray(previous) ||
    key === "commissionMemberIds" ||
    key === "commissionMemberLogins"
  )
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) =>
        key.endsWith("Ids") ? (/^[1-9]\d*$/.test(v) ? Number(v) : v) : v,
      );
  if (
    ["studentId", "points", "grade", "replacementLimit"].includes(key) ||
    /Id$/.test(key)
  )
    return value === ""
      ? null
      : Number.isFinite(Number(value))
        ? Number(value)
        : value;
  return value;
}
function PreviewEditor({
  sessionId,
  prefix,
  storageKey,
  reset,
  ...props
}: AdminPanelProps & {
  sessionId: number;
  prefix: string;
  storageKey: string;
  reset: () => void;
}) {
  const [page, setPage] = useState(1);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [changes, setChanges] = useState<
    Record<string, { input: Record<string, unknown>; excluded: boolean }>
  >({});
  const [result, setResult] = useState<ImportCommit | null>(null);
  const resource = useExamResource<{ session: ImportSession }>(
    `${prefix}/sessions/${sessionId}${queryString({ page, limit: 20, onlyErrors })}`,
  );
  const session = resource.data?.session;
  const committedResult = result ?? session?.commitResult;
  const mutation = useExamMutation<{
    session?: ImportSession;
    result?: ImportCommit;
  }>(`${props.actor}:import:${prefix}:${sessionId}`, (data) => {
    if (data.result) {
      setResult(data.result);
      props.onChanged();
    }
    setChanges({});
    resource.reload();
  });
  const dirty = Object.keys(changes).length > 0;
  const disabled =
    !props.canEdit ||
    mutation.busy ||
    mutation.uncertain ||
    session?.status === "committed";
  const change = (
    row: ImportRow,
    patch: Partial<{ input: Record<string, unknown>; excluded: boolean }>,
  ) =>
    setChanges((old) => ({
      ...old,
      [row.rowId]: {
        input: old[row.rowId]?.input ?? row.input,
        excluded: old[row.rowId]?.excluded ?? row.excluded,
        ...patch,
      },
    }));
  return (
    <div className={s.stack} data-exam-dirty={dirty ? "true" : undefined}>
      <div className={s.header}>
        <h3>Предпросмотр загрузки #{sessionId}</h3>
        <Action
          disabled={mutation.busy || mutation.uncertain || dirty}
          onClick={() => {
            try {
              sessionStorage.removeItem(storageKey);
            } catch {
              /* Storage may be unavailable. */
            }
            reset();
          }}
        >
          Новая загрузка
        </Action>
      </div>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      <MutationNotice mutation={mutation} reload={resource.reload} />
      {resource.loading && <Loading />}
      {committedResult && (
        <div className={s.success}>
          Импорт завершён.{" "}
          {Object.entries(committedResult.counts)
            .filter(([, count]) => count > 0)
            .map(([key, count]) => `${key}: ${count}`)
            .join(" · ")}
        </div>
      )}
      {session && (
        <>
          <p className={s.muted}>
            Всего: {session.summary.total} · Включено:{" "}
            {session.summary.included} · Исключено: {session.summary.excluded} ·
            Ошибок: {session.summary.errors} · Конфликтов:{" "}
            {session.summary.conflicts}
          </p>
          {session.status === "committed" && (
            <p className={s.success}>
              Загрузка уже применена. Повторно записи создаваться не будут.
            </p>
          )}
          <div className={s.row}>
            <label>
              <input
                type="checkbox"
                checked={onlyErrors}
                disabled={dirty}
                onChange={(e) => {
                  setOnlyErrors(e.target.checked);
                  setPage(1);
                }}
              />{" "}
              Только ошибки
            </label>
            <Action onClick={resource.reload} disabled={dirty || mutation.busy}>
              Проверить сохранённое превью
            </Action>
          </div>
          {session.rows.map((row) => {
            const local = changes[row.rowId] ?? row;
            return (
              <article
                className={`${s.item} ${local.excluded ? s.excluded : ""}`}
                key={row.rowId}
              >
                <div className={s.header}>
                  <strong>
                    Строка {row.sourceRow}
                    {local.excluded ? " · исключена" : ""}
                  </strong>
                  <Action
                    disabled={disabled}
                    onClick={() => change(row, { excluded: !local.excluded })}
                  >
                    {local.excluded ? "Вернуть строку" : "Исключить строку"}
                  </Action>
                </div>
                <div className={s.grid}>
                  {Object.entries(local.input).map(([key, value]) => (
                    <Field
                      key={key}
                      label={
                        labels[key] ??
                        (/^examinator[1-6](Id|Login)$/.test(key)
                          ? `${key.endsWith("Id") ? "ID" : "Логин"} экзаменатора ${key.match(/[1-6]/)?.[0]}`
                          : key)
                      }
                    >
                      {key === "questionText" || key === "answerText" ? (
                        <textarea
                          className={s.textarea}
                          value={inputValue(value)}
                          disabled={disabled || local.excluded}
                          onChange={(e) =>
                            change(row, {
                              input: { ...local.input, [key]: e.target.value },
                            })
                          }
                        />
                      ) : (
                        <input
                          className={s.input}
                          value={inputValue(value)}
                          disabled={disabled || local.excluded}
                          onChange={(e) =>
                            change(row, {
                              input: {
                                ...local.input,
                                [key]: importCellValue(
                                  key,
                                  e.target.value,
                                  value,
                                ),
                              },
                            })
                          }
                        />
                      )}
                    </Field>
                  ))}
                </div>
                <ValidationList items={row.errors} />
                <ValidationList items={row.warnings} />
                {row.errors.length > 0 && (
                  <p className={s.muted}>
                    Исправьте поля или исключите строку. После сохранения ошибки
                    будут проверены заново.
                  </p>
                )}
              </article>
            );
          })}
          {!session.rows.length && <Empty>Строк по фильтру нет</Empty>}
          <Pager
            pagination={session.pagination}
            onPage={setPage}
            disabled={dirty || mutation.busy}
          />
          {dirty && (
            <p className={s.warning}>
              Есть изменения. Сначала сохраните их — затем переходите между
              страницами и применяйте импорт.
            </p>
          )}
          <div className={s.row}>
            {props.canEdit && (
              <>
                <Action
                  disabled={disabled || session.rows.length === 0}
                  onClick={() =>
                    void mutation.execute({
                      path: `${prefix}/sessions/${sessionId}`,
                      method: "PUT",
                      body: {
                        expectedPreviewVersion: session.previewVersion,
                        changes: dirty
                          ? Object.entries(changes).map(([rowId, value]) => ({
                              rowId,
                              ...value,
                            }))
                          : session.rows.map(({ rowId, input, excluded }) => ({
                              rowId,
                              input,
                              excluded,
                            })),
                      },
                    })
                  }
                >
                  {dirty
                    ? "Сохранить исправления"
                    : "Перепроверить строки страницы"}
                </Action>
                <Action
                  disabled={disabled || !dirty}
                  onClick={() => setChanges({})}
                >
                  Отменить правки
                </Action>
                <Action
                  primary
                  disabled={
                    disabled ||
                    dirty ||
                    session.summary.included === 0 ||
                    session.summary.errors > 0 ||
                    session.summary.conflicts > 0
                  }
                  onClick={() =>
                    void mutation.execute({
                      path: `${prefix}/sessions/${sessionId}/commit`,
                      method: "POST",
                      body: { expectedPreviewVersion: session.previewVersion },
                    })
                  }
                >
                  Применить импорт целиком
                </Action>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function ExamImportWorkspace({
  kind,
  ...props
}: AdminPanelProps & { kind: ImportKind }) {
  const storageKey = `exam-import:${props.actor}:${props.examId}:${kind}`;
  const [sessionId, setSessionId] = useState<number | null>(() => {
    try {
      const value = sessionStorage.getItem(storageKey);
      return value && /^[1-9]\d*$/.test(value) ? Number(value) : null;
    } catch {
      return null;
    }
  });
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const running = useRef(false);
  const parse = async () => {
    if (!file || running.current || !props.canEdit) return;
    if (
      !file.name.toLowerCase().endsWith(".xlsx") ||
      file.size > 10 * 1024 * 1024
    ) {
      setError(new Error("Нужен файл .xlsx размером не более 10 МиБ."));
      return;
    }
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      key.current ??= crypto.randomUUID();
      const response = await parseExamImport(
        props.examId,
        kind,
        file,
        key.current,
      );
      setSessionId(response.session.id);
      try {
        sessionStorage.setItem(storageKey, String(response.session.id));
      } catch {
        /* Session remains usable in memory. */
      }
      key.current = null;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Не удалось разобрать файл"),
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <div className={s.panel}>
      <h3>Импорт из Excel</h3>
      <p className={s.muted}>{hints[kind]}</p>
      <p className={s.muted}>
        Один непустой лист, до 5000 строк и 10 МиБ. Формулы не поддерживаются.
        ID и логин — разные колонки; ФИО не используется как идентификатор.
        Импорт добавляет записи, не перезаписывая существующие.
      </p>
      {sessionId ? (
        <PreviewEditor
          key={sessionId}
          {...props}
          sessionId={sessionId}
          prefix={importPrefix(props.examId, kind)}
          storageKey={storageKey}
          reset={() => {
            setSessionId(null);
            setFile(null);
          }}
        />
      ) : (
        <>
          <Field label="Файл .xlsx">
            <input
              className={s.input}
              type="file"
              accept=".xlsx"
              disabled={!props.canEdit || busy}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
                key.current = null;
              }}
            />
          </Field>
          <ErrorNotice error={error} />
          <Action
            primary
            disabled={!props.canEdit || busy || !file}
            onClick={() => void parse()}
          >
            {busy
              ? "Разбираем файл…"
              : error
                ? "Повторить разбор тем же запросом"
                : "Показать предпросмотр"}
          </Action>
        </>
      )}
    </div>
  );
}

export function ExamImport(props: AdminPanelProps & { kind: ImportKind }) {
  const { user } = useAuth();
  if (!canAccessSection(user, "exams") || !canAccessSection(user, "upload"))
    return (
      <Empty>
        Для импорта нужны права просмотра разделов «Экзамены» и «Загрузка».
      </Empty>
    );
  const canEdit =
    props.canEdit &&
    canAccessSection(user, "exams", "edit") &&
    canAccessSection(user, "upload", "edit");
  return <ExamImportWorkspace {...props} canEdit={canEdit} />;
}
