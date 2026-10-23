"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { domain } from "@/lib/bff/client";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import {
  studentImportDownload,
  studentImportError,
  studentImportPath,
  studentUploadPath,
  studentReasons,
  type StudentImportDraft,
  type StudentImportRow,
  type StudentImportJob,
  type StudentImportIssue,
} from "@/lib/bff/student-import";
import s from "./student-import.module.css";
const columns: [keyof StudentImportRow, string][] = [
  ["full_name", "ФИО *"],
  ["profile_id", "ID для посещаемости"],
  ["school", "Школа"],
  ["class", "Класс"],
  ["login", "Логин"],
];
const json = (value: unknown) => JSON.stringify(value);
export function StudentImport() {
  const { user } = useAuth();
  const org = user?.organizations?.find((o) => o.id === user.organization_id);
  const [division, setDivision] = useState("");
  const [draft, setDraft] = useState<StudentImportDraft | null>(null);
  const [rows, setRows] = useState<StudentImportRow[]>([]);
  const [recent, setRecent] = useState<
    { id: string; state: string; created_at: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [showPasswords, setShowPasswords] = useState(false);
  const [job, setJob] = useState<StudentImportJob | null>(null);
  const [commandIssues, setCommandIssues] = useState<StudentImportIssue[]>([]);
  const running = useRef(false);
  const stop = useRef(false);
  const epoch = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useContextGuard(busy || dirty);
  useEffect(
    () => () => {
      epoch.current++;
      stop.current = true;
    },
    [],
  );
  const base = studentImportPath(Number(division)),
    uploads = studentUploadPath(Number(division));
  useEffect(() => {
    const generation = ++epoch.current;
    queueMicrotask(() => {
      if (epoch.current !== generation) return;
      setDraft(null);
      setRows([]);
      setError("");
      setRecent([]);
      setJob(null);
      setDirty(false);
      setCommandIssues([]);
      if (!division) return;
      void domain<typeof recent>(studentImportPath(Number(division)))
        .then((v) => {
          if (epoch.current === generation) setRecent(v);
        })
        .catch((e) => {
          if (epoch.current === generation) setError(studentImportError(e));
        });
    });
  }, [division]);
  const accept = (d: StudentImportDraft) => {
    setDraft(d);
    setRows(d.rows);
    setDirty(false);
    setPage((p) => Math.min(p, Math.max(0, Math.ceil(d.rows.length / 50) - 1)));
  };
  const act = async (fn: (generation: number) => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    const g = epoch.current;
    try {
      await fn(g);
    } catch (e) {
      if (g === epoch.current) {
        setError(studentImportError(e));
        const details = (e as { issues?: StudentImportIssue[] }).issues;
        if (details) setCommandIssues(details);
        if (draft && !dirty) {
          try {
            const current = await review(draft.id);
            if (g === epoch.current) accept(current);
          } catch {}
        }
      }
    } finally {
      if (g === epoch.current) setBusy(false);
      running.current = false;
    }
  };
  const review = async (id: string) =>
    domain<StudentImportDraft>(`${base}/${id}/review`, { method: "POST" });
  const open = (id: string) =>
    void act(async (g) => {
      const d = await review(id);
      let recoveredJob: StudentImportJob | null = null;
      const last = d.batches.at(-1);
      if (last) {
        try {
          recoveredJob = await domain<StudentImportJob>(
            `${uploads}/sessions/${last.upload_session_id}/job`,
          );
        } catch (e) {
          if ((e as { status?: number }).status !== 404) throw e;
        }
      }
      if (g === epoch.current) {
        accept(d);
        setJob(recoveredJob);
        setStatus(
          "Сохранённый импорт восстановлен. Новых пользователей это чтение не создаёт.",
        );
      }
    });
  const upload = () =>
    void act(async (g) => {
      const f = input.current?.files?.[0];
      if (!f) return;
      if (f.size > 6 * 1024 * 1024)
        throw new Error(
          "Файл больше 6 МиБ. Разделите таблицу на несколько файлов.",
        );
      setStatus("Разбираем Excel и предлагаем реквизиты…");
      const bytes = new Uint8Array(await f.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const value = await domain<StudentImportDraft>(base, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: json({ workbook_base64: btoa(binary) }),
      });
      const d = await review(value.id);
      if (g === epoch.current) {
        accept(d);
        setStatus(
          "Предпросмотр: пользователи ещё не созданы. Исправьте таблицу и подтвердите.",
        );
      }
    });
  const save = () =>
    void act(async (g) => {
      if (!draft) return;
      setStatus("Проверяем изменённую таблицу…");
      await domain(`${base}/${draft.id}`, {
        method: "PUT",
        body: json({
          expected_revision: draft.revision,
          rows: rows.map(({ password, ...row }) => {
            void password;
            return row;
          }),
        }),
      });
      const d = await review(draft.id);
      if (g === epoch.current) {
        accept(d);
        setStatus(
          d.issues.length
            ? "Исправьте отмеченные ячейки."
            : "Таблица проверена. Можно подтвердить создание.",
        );
      }
    });
  const poll = async (id: string, g: number) => {
    for (;;) {
      const j = await domain<StudentImportJob>(`${uploads}/jobs/${id}`);
      if (g !== epoch.current) throw new Error("Кабинет изменился");
      setJob(j);
      if (
        !["queued", "running", "retry", "authorizing"].includes(j.status) ||
        stop.current
      )
        return j;
      await new Promise((r) => setTimeout(r, 1000));
    }
  };
  const run = () =>
    void act(async (g) => {
      if (!draft || dirty || draft.issues.length) return;
      stop.current = false;
      let d = draft;
      if (d.state === "preview") {
        await domain(`${base}/${d.id}/freeze`, {
          method: "POST",
          body: json({ expected_revision: d.revision }),
        });
        d = await review(d.id);
        if (g !== epoch.current) return;
        accept(d);
      }
      for (let i = 0; i < d.batch_count; i++) {
        if (stop.current || g !== epoch.current) break;
        setStatus(
          `Порция ${i + 1} из ${d.batch_count}: подготовка и создание…`,
        );
        const session = await domain<{ id: string; revision: number }>(
          `${uploads}/student-imports/${d.id}/batches/${i}`,
          {
            method: "POST",
            headers: { "Idempotency-Key": `student-batch:${d.id}:${i}` },
            body: json({ expected_revision: d.revision }),
          },
        );
        if (stop.current || g !== epoch.current) break;
        let j = await domain<StudentImportJob>(
          `${uploads}/sessions/${session.id}/commit`,
          {
            method: "POST",
            headers: { "Idempotency-Key": `student-confirm:${d.id}:${i}` },
            body: json({
              expected_revision: session.revision,
              confirmed: true,
            }),
          },
        );
        j = await poll(j.id, g);
        const updated = await review(d.id);
        if (g !== epoch.current) return;
        accept(updated);
        if (j.status !== "completed") {
          setStatus(
            "Следующие порции не запущены. Проверьте исход текущей порции.",
          );
          return;
        }
      }
      if (g === epoch.current)
        setStatus(
          stop.current
            ? "Запуск следующих порций приостановлен. Уже отправленная порция может завершиться."
            : "Все порции подтверждены. Скачайте итоговые реквизиты.",
        );
    });
  const recover = () =>
    void act(async (g) => {
      if (!job) return;
      setStatus("Проверяем исходную квитанцию без повторного создания…");
      await domain(`${uploads}/jobs/${job.id}/recover`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: json({ confirmed: true }),
      });
      stop.current = false;
      await poll(job.id, g);
      if (draft) {
        const d = await review(draft.id);
        if (g === epoch.current) accept(d);
      }
      setStatus(
        "Проверка завершена. Продолжение следующих порций — отдельной кнопкой.",
      );
    });
  const created =
    draft?.batches.reduce(
      (n, b) =>
        n +
        (b.status === "completed"
          ? Math.min(
              draft.batch_size,
              draft.rows.length - b.batch_index * draft.batch_size,
            )
          : 0),
      0,
    ) ?? 0;
  const pending = (draft?.rows.length ?? 0) - created;
  const editable = draft?.state === "preview";
  const issues = [...(draft?.issues ?? []), ...commandIssues];
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const change = (row: number, key: keyof StudentImportRow, value: string) => {
    setRows((v) => v.map((u) => (u.row === row ? { ...u, [key]: value } : u)));
    setDirty(true);
    setError("Проверьте изменённую таблицу перед подтверждением.");
  };
  return (
    <section className={s.page} aria-label="Импорт учеников Excel">
      <header className={s.header}>
        <div>
          <h2>Импорт учеников</h2>
          <p className={s.hint}>
            Excel → проверка и редактирование → создание → файл с реквизитами.
          </p>
        </div>
      </header>
      <label className={s.field}>
        Подразделение назначения *
        <select
          aria-label="Подразделение назначения"
          value={division}
          disabled={busy || !!draft}
          onChange={(e) => setDivision(e.target.value)}
        >
          <option value="">Выберите подразделение</option>
          {org?.divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      {!draft && (
        <>
          <p className={s.hint}>
            Обязательно только ФИО. Школа, класс и ID для посещаемости могут
            быть пустыми. Логины и пароли система предложит сама. До 6 МиБ
            файла, до 32 МиБ после распаковки.
          </p>
          <div className={s.actions}>
            <Button
              variant="secondary"
              disabled={!division || busy}
              onClick={() =>
                void act(async () => studentImportDownload(`${base}/template`))
              }
            >
              Скачать Excel-шаблон
            </Button>
            <label className={s.field}>
              Таблица учеников (.xlsx)
              <input
                ref={input}
                type="file"
                accept=".xlsx"
                disabled={!division || busy}
              />
            </label>
            <Button disabled={!division || busy} onClick={upload}>
              Разобрать Excel
            </Button>
          </div>
          {recent.length > 0 && (
            <div className={s.panel}>
              <strong>Мои сохранённые импорты (до истечения выдачи)</strong>
              <div className={s.recent}>
                {recent.map((v) => (
                  <Button
                    key={v.id}
                    variant="ghost"
                    disabled={busy}
                    onClick={() => open(v.id)}
                  >
                    {new Date(v.created_at).toLocaleString("ru-RU")} ·{" "}
                    {v.state === "preview" ? "Предпросмотр" : "Подтверждён"}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {draft && (
        <>
          <div className={s.notice}>
            <strong>
              {org?.divisions.find((v) => v.id === draft.division_id)?.name} ·{" "}
              {rows.length} учеников · версия {draft.revision}
            </strong>
            <p>
              Выдача реквизитов доступна вам до{" "}
              {new Date(draft.expires_at).toLocaleString("ru-RU")}. Пароли
              хранятся зашифрованно. Сохраните итоговый файл до этого срока;
              позднее потребуется отдельный сброс пароля.
            </p>
            <p>При закрытии страницы отправленная порция может завершиться. Остальные порции останутся в сохранённом импорте: откройте его и нажмите «Продолжить оставшиеся порции».</p>
            <p>
              ID для посещаемости — постоянный ID профиля/QR. ID аккаунта будет
              отдельно в результате. Школа — существующее полное или краткое
              название, без создания дублей.
            </p>
          </div>
          <div className={s.toolbar}>
            <div className={s.actions}>
              <label>
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                />{" "}
                Показать предложенные пароли
              </label>
              <span className={s.hint}>
                Логин можно исправить: 3–50 латинских букв, цифр, . _ -
              </span>
            </div>
            <div className={s.pages}>
              <Button
                variant="ghost"
                disabled={page === 0 || busy}
                onClick={() => setPage((v) => v - 1)}
              >
                Назад
              </Button>
              <span>
                {page + 1} / {pages} · строки {page * 50 + 1}–
                {Math.min(rows.length, (page + 1) * 50)}
              </span>
              <Button
                variant="ghost"
                disabled={page + 1 >= pages || busy}
                onClick={() => setPage((v) => v + 1)}
              >
                Далее
              </Button>
            </div>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Строка</th>
                  {columns.map(([k, v]) => (
                    <th key={k}>{v}</th>
                  ))}
                  <th>Пароль</th>
                  <th>Результат строки</th>
                  {editable && <th>Действие</th>}
                </tr>
              </thead>
              <tbody>
                {rows.slice(page * 50, (page + 1) * 50).map((u) => (
                  <tr key={u.row}>
                    <td>{u.row}</td>
                    {columns.map(([key, label]) => {
                      const cellIssues = issues.filter(
                        (x) => x.row === u.row && x.field === key,
                      );
                      return (
                        <td
                          key={key}
                          className={`${s.cell} ${key === "full_name" ? s.name : ""}`}
                        >
                          <input
                            aria-label={`${label}, строка ${u.row}`}
                            aria-invalid={cellIssues.length > 0}
                            value={String(u[key] ?? "")}
                            disabled={busy || !editable}
                            onChange={(e) => change(u.row, key, e.target.value)}
                          />
                          {cellIssues.map((v, i) => (
                            <p className={s.error} key={i}>
                              {studentReasons[v.reason] ?? "Проверьте значение"}
                            </p>
                          ))}
                        </td>
                      );
                    })}
                    <td className={s.password}>
                      {showPasswords ? u.password : "••••••••••••"}
                    </td>
                    <td>
                      {draft.batches.find(
                        (b) =>
                          b.batch_index ===
                          Math.floor(
                            draft.rows.findIndex((v) => v.row === u.row) /
                              draft.batch_size,
                          ),
                      )?.status === "completed"
                        ? "Создан"
                        : issues.some((v) => v.row === u.row)
                          ? "Отказ проверки"
                          : "Ещё не подтверждено создание"}
                    </td>
                    {editable && (
                      <td>
                        <Button
                          variant="ghost"
                          disabled={busy || rows.length === 1}
                          onClick={() => {
                            setRows((v) => v.filter((x) => x.row !== u.row));
                            setDirty(true);
                          }}
                        >
                          Удалить строку
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.stats}>
            <span>
              Создано: <strong>{created}</strong>
            </span>
            <span>
              Не подтверждено создание: <strong>{pending}</strong>
            </span>
            <span>
              Отказов проверки строк:{" "}
              <strong>{new Set(issues.map((v) => v.row)).size}</strong>
            </span>
            <span>
              Порций по {draft.batch_size}: {draft.batch_count}
            </span>
          </div>
          <progress
            className={s.progress}
            max={draft.rows.length}
            value={created}
          />
          {job && (
            <p role="status">
              Текущая порция:{" "}
              {job.status === "completed"
                ? "создание подтверждено"
                : job.status === "running" || job.status === "queued"
                  ? "в обработке"
                  : "исход требует проверки"}
              .{" "}
              {job.status === "outcome_unknown" &&
                "Данные могли сохраниться; повторное создание не выполняется."}
            </p>
          )}
          <div className={s.actions}>
            {editable && (
              <>
                <Button
                  variant="secondary"
                  disabled={busy || !dirty}
                  onClick={save}
                >
                  Проверить изменения
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => open(draft.id)}
                >
                  Загрузить сохранённую таблицу
                </Button>
              </>
            )}
            <Button
              disabled={
                busy ||
                dirty ||
                issues.length > 0 ||
                created === draft.rows.length
              }
              onClick={run}
            >
              {editable
                ? "Подтвердить создание"
                : "Продолжить оставшиеся порции"}
            </Button>
            {busy && (
              <Button
                variant="secondary"
                onClick={() => {
                  stop.current = true;
                  setStatus(
                    "Запуск следующих порций остановится после текущего запроса.",
                  );
                }}
              >
                Приостановить следующие порции
              </Button>
            )}
            {job?.capabilities?.recover_receipt && (
              <Button variant="secondary" disabled={busy} onClick={recover}>
                Проверить квитанцию без повторного создания
              </Button>
            )}
            {draft.state === "frozen" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void act(async () =>
                    studentImportDownload(`${base}/${draft.id}/export`, "POST"),
                  )
                }
              >
                Скачать итоговый Excel
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={busy || dirty}
              onClick={() => {
                setDraft(null);
                setRows([]);
                setJob(null);
                setCommandIssues([]);
                setStatus("");
                setRecent([]);
              }}
            >
              Закрыть (импорт сохранён)
            </Button>
            {editable && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await domain(`${base}/${draft.id}/cancel`, {
                      method: "POST",
                    });
                    setDraft(null);
                    setRows([]);
                    setDirty(false);
                    setStatus("Отменено. Пользователи не создавались.");
                  })
                }
              >
                Отменить импорт
              </Button>
            )}
          </div>
          {issues.length > 0 && (
            <div role="alert" className={s.error}>
              Ошибок: {issues.length}. Исправьте отмеченные ячейки и нажмите
              «Проверить изменения».{" "}
              {issues.slice(0, 8).map((v, i) => (
                <p key={i}>
                  Строка {v.row}:{" "}
                  {studentReasons[v.reason] ?? "Проверьте значение"}
                </p>
              ))}
            </div>
          )}
        </>
      )}
      {(status || busy) && (
        <p role="status">
          {status}
          {busy ? " · Выполняется…" : ""}
        </p>
      )}
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
    </section>
  );
}
