"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/api/client";
import { queryString } from "@/lib/exams-v2/api";
import { useExamResource } from "@/lib/exams-v2/hooks";
import { issueMessage } from "@/lib/exams-v2/errors";
import type {
  Page,
  Pagination,
  Person,
  Validation,
} from "@/lib/exams-v2/types";
import s from "./exams.module.css";

export function Action({
  primary,
  danger,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${s.button} ${primary ? s.primary : ""} ${danger ? s.danger : ""} ${className}`}
      {...props}
    />
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className={s.label}>
      {label}
      {children}
      {hint && <span className={s.muted}>{hint}</span>}
    </label>
  );
}
export function ErrorNotice({
  error,
  reload,
}: {
  error?: Error | null;
  reload?: () => void;
}) {
  if (!error) return null;
  const api = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className={s.error}>
      {issueMessage({ code: api?.code, message: error.message })}
      {api?.status === 409 && (
        <p>
          Данные изменились. Обновите страницу и проверьте актуальную версию;
          введённые значения не были перезаписаны.
        </p>
      )}
      {api?.correlationId && <small>Код обращения: {api.correlationId}</small>}
      {reload && (
        <div>
          <Action onClick={reload}>Обновить данные</Action>
        </div>
      )}
    </div>
  );
}
export function MutationNotice({
  mutation,
  reload,
}: {
  mutation: {
    error: Error | null;
    uncertain: boolean;
    busy: boolean;
    retry: () => Promise<void>;
    dismiss: () => void;
  };
  reload?: () => void;
}) {
  return (
    <>
      <ErrorNotice error={mutation.error} reload={reload} />
      {mutation.uncertain && (
        <div className={s.warning} role="alert">
          <p>
            Ответ на предыдущую команду не получен. Она могла сохраниться. Не
            создавайте новую: повтор ниже использует прежний ключ и не дублирует
            действие.
          </p>
          <div className={s.row}>
            {reload && (
              <Action disabled={mutation.busy} onClick={reload}>
                Проверить состояние
              </Action>
            )}
            <Action
              disabled={mutation.busy}
              onClick={() => void mutation.retry()}
            >
              Повторить тот же запрос
            </Action>
            <Action disabled={mutation.busy} onClick={mutation.dismiss}>
              Состояние проверено, закрыть
            </Action>
          </div>
        </div>
      )}
    </>
  );
}
export function ValidationList({ items }: { items?: Validation[] }) {
  return items?.length ? (
    <ul className={s.warning}>
      {items.map((item, i) => (
        <li key={`${item.code}:${i}`}>{issueMessage(item)}</li>
      ))}
    </ul>
  ) : null;
}
export function Pager({
  pagination,
  onPage,
  disabled,
}: {
  pagination?: Pagination;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  if (!pagination) return null;
  return (
    <nav className={s.row} aria-label="Страницы">
      <Action
        disabled={disabled || !pagination.hasPrev}
        onClick={() => onPage(pagination.page - 1)}
      >
        Назад
      </Action>
      <span className={s.muted}>
        {pagination.page} / {pagination.totalPages} · Всего {pagination.total}
      </span>
      <Action
        disabled={disabled || !pagination.hasNext}
        onClick={() => onPage(pagination.page + 1)}
      >
        Далее
      </Action>
    </nav>
  );
}
export function Loading({ text = "Загрузка…" }: { text?: string }) {
  return (
    <p role="status" className={s.muted}>
      {text}
    </p>
  );
}
export function Empty({
  children = "Записей пока нет",
}: {
  children?: ReactNode;
}) {
  return <div className={s.empty}>{children}</div>;
}
export function Modal({
  title,
  children,
  onClose,
  busy,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    if (
      !ref.current?.querySelector("form[data-exam-dirty='true']") ||
      window.confirm(
        "В форме есть несохранённые изменения. Закрыть без сохранения?",
      )
    )
      onClose();
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className={s.overlay}>
      <div
        className={s.dialog}
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const elements = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
              ) ?? [],
            );
            const first = elements[0],
              last = elements[elements.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === ref.current)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (
              !e.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === ref.current)
            ) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className={s.header}>
          <h2 id={id}>{title}</h2>
          <Action disabled={busy} onClick={close} aria-label="Закрыть">
            ×
          </Action>
        </div>
        {children}
      </div>
    </div>
  );
}

export function UnsavedExamChanges() {
  useEffect(() => {
    const dirty = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const form = target.closest<HTMLElement>("form[data-exam-editor]");
      if (form) form.dataset.examDirty = "true";
    };
    const leave = (event: BeforeUnloadEvent) => {
      if (document.querySelector("[data-exam-dirty='true']")) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    document.addEventListener("change", dirty);
    document.addEventListener("input", dirty);
    window.addEventListener("beforeunload", leave);
    return () => {
      document.removeEventListener("change", dirty);
      document.removeEventListener("input", dirty);
      window.removeEventListener("beforeunload", leave);
    };
  }, []);
  return null;
}
export function PersonPicker({
  kind,
  value,
  onChange,
  label,
  disabled,
  exclude = [],
}: {
  kind: "students" | "examinators";
  value: Person | null;
  onChange: (value: Person | null) => void;
  label: string;
  disabled?: boolean;
  exclude?: number[];
}) {
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const resource = useExamResource<Page<Person>>(
    open
      ? `/api/exams/lookups/${kind}${queryString({ search: submitted, page, limit: 20 })}`
      : null,
  );
  return (
    <div className={s.stack}>
      <span className={s.label}>{label}</span>
      {value ? (
        <div className={s.row}>
          <span>
            {value.fullName} · ID {value.id}
            {value.login && ` · ${value.login}`}
          </span>
          <Action
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setOpen(true);
            }}
          >
            Изменить
          </Action>
        </div>
      ) : (
        <Action disabled={disabled} onClick={() => setOpen((v) => !v)}>
          Выбрать из списка
        </Action>
      )}
      {open && !value && (
        <div className={s.item}>
          <div className={s.row}>
            <input
              aria-label={`Поиск: ${label}`}
              className={s.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ФИО, ID или логин"
              maxLength={200}
            />
            <Action
              disabled={disabled}
              onClick={() => {
                setPage(1);
                setSubmitted(search.trim());
                resource.reload();
              }}
            >
              Найти
            </Action>
          </div>
          <ErrorNotice error={resource.error} reload={resource.reload} />
          {resource.loading && <Loading />}
          <div className={s.lookupList}>
            {resource.data?.items
              .filter((person) => !exclude.includes(person.id))
              .map((person) => (
                <Action
                  key={person.id}
                  disabled={disabled}
                  onClick={() => {
                    onChange(person);
                    setOpen(false);
                  }}
                >
                  {person.fullName} · ID {person.id}
                  {person.login && ` · ${person.login}`}
                </Action>
              ))}
          </div>
          {resource.data?.items.length === 0 && (
            <Empty>Пользователи не найдены</Empty>
          )}
          <Pager pagination={resource.data?.pagination} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
