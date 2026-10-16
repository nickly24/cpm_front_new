"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, ChevronDown, Check, ArrowUpLeft } from "lucide-react";
import type { Direction, TestStatusFilter } from "@/lib/student/tests-types";
import { TESTS_STATUS_FILTER_OPTIONS } from "./tests-filter-options";
import styles from "./tests-search.module.css";

export type TestsSearchValues = { query: string; direction: string; status: TestStatusFilter };
type Props = {
  initial: TestsSearchValues; directions: Direction[]; titles: string[]; loading: boolean;
  onApply: (values: TestsSearchValues) => void; onClose: () => void;
};

export function TestsSearchScreen({ initial, directions, titles, loading, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initial);
  const [expanded, setExpanded] = useState<"direction" | "status" | null>(null);
  const effectiveDirection = values.direction || directions[0]?.name || "";
  const query = values.query.trim().toLocaleLowerCase("ru");
  const suggestedTitles = query ? titles.filter(title => title.toLocaleLowerCase("ru").includes(query)).slice(0, 6) : [];
  const suggestedDirections = query ? directions.filter(item => item.name.toLocaleLowerCase("ru").includes(query)) : [];
  const suggestedStatuses = query ? TESTS_STATUS_FILTER_OPTIONS.filter(item => item.value !== "all" && `${item.label} ${item.hint}`.toLocaleLowerCase("ru").includes(query)) : [];
  useEffect(() => {
    const element = dialog.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const update = () => {
      if (!element) return;
      const viewport = window.visualViewport;
      element.style.height = viewport ? `${viewport.height}px` : "100dvh";
      element.style.top = viewport ? `${viewport.offsetTop}px` : "0px";
    };
    element?.showModal(); update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      element?.close(); document.body.style.overflow = previous;
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  const chooseDirection = (name: string, suggestion = false) => { setValues(current => ({ ...current, direction: name, query: suggestion ? "" : current.query })); setExpanded(null); input.current?.blur(); };
  const chooseStatus = (status: TestStatusFilter, suggestion = false) => { setValues(current => ({ ...current, status, query: suggestion ? "" : current.query })); setExpanded(null); input.current?.blur(); };
  return <dialog ref={dialog} className={styles.screen} aria-label="Настройки поиска тестов" onCancel={onClose}>
    <header className={styles.header}><button type="button" onClick={onClose}>Закрыть</button><h2>Изменить поиск</h2><span/></header>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); onApply({ ...values, direction: effectiveDirection }); }}>
      <div className={styles.results}>
        <label className={styles.inputWrap}><Search size={21} aria-hidden/><input ref={input} type="search" value={values.query} onChange={event => { setValues(current => ({ ...current, query: event.target.value })); setExpanded(null); }} placeholder="Название, направление, статус" aria-label="Поиск тестов" autoComplete="off" enterKeyHint="search"/>{values.query ? <button type="button" aria-label="Очистить поиск" onClick={() => { setValues(current => ({ ...current, query: "" })); input.current?.focus(); }}><X size={18}/></button> : null}</label>
        {suggestedTitles.length || suggestedDirections.length || suggestedStatuses.length ? <section className={styles.suggestions} aria-label="Подсказки поиска">
          {suggestedTitles.map(title => <button type="button" key={title} className={styles.result} onClick={() => { setValues(current => ({ ...current, query: title })); input.current?.blur(); }}><Search size={18}/><span>{title}<small>Название теста</small></span></button>)}
          {suggestedDirections.map(item => <button type="button" key={item.id} className={styles.result} onClick={() => chooseDirection(item.name, true)}><ArrowUpLeft size={18}/><span>{item.name}<small>Направление</small></span></button>)}
          {suggestedStatuses.map(item => <button type="button" key={item.value} className={styles.result} onClick={() => chooseStatus(item.value, true)}><item.icon size={18}/><span>{item.label}<small>Статус</small></span></button>)}
        </section> : null}
        <button type="button" className={styles.field} aria-expanded={expanded === "direction"} onClick={() => { input.current?.blur(); setExpanded(expanded === "direction" ? null : "direction"); }}><span><small>Направление</small>{effectiveDirection || "Все направления"}</span><ChevronDown size={20}/></button>
        {expanded === "direction" ? <div className={styles.choices} role="group" aria-label="Направление">{loading ? <p role="status">Загрузка направлений…</p> : directions.map(item => <button type="button" key={item.id} aria-pressed={values.direction === item.name} onClick={() => chooseDirection(item.name)}><span>{item.name}</span>{values.direction === item.name ? <Check size={18}/> : null}</button>)}</div> : null}
        <button type="button" className={styles.field} aria-expanded={expanded === "status"} onClick={() => { input.current?.blur(); setExpanded(expanded === "status" ? null : "status"); }}><span><small>Статус</small>{TESTS_STATUS_FILTER_OPTIONS.find(item => item.value === values.status)?.label || "Все"}</span><ChevronDown size={20}/></button>
        {expanded === "status" ? <div className={styles.choices} role="group" aria-label="Статус">{TESTS_STATUS_FILTER_OPTIONS.map(item => <button type="button" key={item.value} aria-pressed={values.status === item.value} onClick={() => chooseStatus(item.value)}><item.icon size={19}/><span>{item.value === "all" ? "Все статусы" : item.label}<small>{item.hint}</small></span>{values.status === item.value ? <Check size={18}/> : null}</button>)}</div> : null}
      </div>
      <div className={styles.footer}><button type="submit" disabled={!effectiveDirection || loading}>Найти тесты</button><button type="button" className={styles.reset} onClick={() => { setValues({ query: "", direction: directions[0]?.name || "", status: "all" }); setExpanded(null); }}>Сбросить параметры</button></div>
    </form>
  </dialog>;
}
