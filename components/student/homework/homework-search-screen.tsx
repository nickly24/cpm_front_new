"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { HomeworkStatusFilter } from "@/lib/student/homework-types";
import styles from "../tests/tests-search.module.css";
export const homeworkStatuses: { value: HomeworkStatusFilter; label: string }[] = [{ value: "all", label: "Все статусы" }, { value: "undone", label: "К сдаче" }, { value: "in_review", label: "На проверке" }, { value: "revision", label: "Доработка" }, { value: "done", label: "Проверено" }];
export type HomeworkSearchValues = { search: string; type: string; status: HomeworkStatusFilter };
export function HomeworkSearchScreen({ initial, types, counts, onApply, onClose }: { initial: HomeworkSearchValues; types: string[]; counts?: Record<HomeworkStatusFilter, number>; onApply: (values: HomeworkSearchValues) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(initial);
  const [expanded, setExpanded] = useState<"type" | "status" | null>(null);
  useEffect(() => {
    const element = dialog.current, previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const update = () => { if (element) { element.style.height = window.visualViewport ? `${window.visualViewport.height}px` : "100dvh"; element.style.top = `${window.visualViewport?.offsetTop || 0}px`; } };
    element?.showModal(); update();
    window.visualViewport?.addEventListener("resize", update); window.visualViewport?.addEventListener("scroll", update); window.addEventListener("resize", update);
    return () => { element?.close(); document.body.style.overflow = previous; window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return <dialog ref={dialog} className={styles.screen} aria-label="Поиск домашних заданий" onCancel={onClose}>
    <header className={styles.header}><button type="button" onClick={onClose}>Закрыть</button><h2>Изменить поиск</h2><span/></header>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); onApply(values); }}><div className={styles.results}>
      <label className={styles.inputWrap}><Search size={21}/><input type="search" maxLength={200} placeholder="Поиск" aria-label="Найти задание" value={values.search} onChange={event => setValues({ ...values, search: event.target.value })} enterKeyHint="search"/></label>
      <button type="button" className={styles.field} aria-expanded={expanded === "status"} onClick={() => setExpanded(expanded === "status" ? null : "status")}><span><small>Статус</small>{homeworkStatuses.find(item => item.value === values.status)?.label}</span><ChevronDown size={20}/></button>
      {expanded === "status" ? <div role="group" aria-label="Статус заданий" className={styles.choices}>{homeworkStatuses.map(item => <button type="button" key={item.value} aria-pressed={values.status === item.value} onClick={() => { setValues({ ...values, status: item.value }); setExpanded(null); }}><span>{item.label}{counts ? ` · ${counts[item.value]}` : ""}</span>{values.status === item.value ? <Check size={18}/> : null}</button>)}</div> : null}
      <button type="button" className={styles.field} aria-expanded={expanded === "type"} onClick={() => setExpanded(expanded === "type" ? null : "type")}><span><small>Тип задания</small>{values.type === "all" ? "Все типы" : values.type}</span><ChevronDown size={20}/></button>
      {expanded === "type" ? <div role="group" aria-label="Тип задания" className={styles.choices}>{["all", ...types].map(name => <button type="button" key={name} aria-pressed={values.type === name} onClick={() => { setValues({ ...values, type: name }); setExpanded(null); }}><span>{name === "all" ? "Все типы" : name}</span>{values.type === name ? <Check size={18}/> : null}</button>)}</div> : null}
    </div><div className={styles.footer}><button type="submit">Найти задания</button><button type="button" className={styles.reset} onClick={() => { setValues({ search: "", type: "all", status: "all" }); setExpanded(null); }}>Сбросить параметры</button></div></form>
  </dialog>;
}
