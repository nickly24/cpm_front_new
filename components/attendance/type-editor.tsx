"use client";

import type { FormEvent, ReactNode } from "react";
import type { AttendanceType } from "@/lib/bff/attendance";
import styles from "./workspace.module.css";
import editorStyles from "./type-editor.module.css";

export const emptyAttendanceType = (): AttendanceType => ({ id: 0, division_id: 0, version: 0, code: "", name: "", color: "#23884c", mark: "", sort_order: 10, is_active: true, counts_as_present: false, counts_as_absent: false, is_excused: false, scan_default: false, zap_default: false });

interface TypeEditorProps {
  value: AttendanceType;
  onChange: (value: AttendanceType) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  disabled?: boolean;
  children?: ReactNode;
}

export function AttendanceTypeEditor({ value, onChange, onSubmit, onClose, disabled = false, children }: TypeEditorProps) {
  return <div className={`${styles.modal} ${editorStyles.editor}`}>
    <form role="dialog" aria-modal="true" aria-label="Тип посещения" className={styles.dialog} onSubmit={onSubmit}>
      <h2>{value.id ? "Изменить тип посещения" : "Создать тип посещения"}</h2>
      <div className={styles.grid}>
        <label>Название типа<input required maxLength={100} disabled={disabled} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })}/></label>
        <label>Код типа<input required pattern="[a-z][a-z0-9_]{0,63}" disabled={disabled || !!value.id} value={value.code} onChange={e => onChange({ ...value, code: e.target.value })}/></label>
        <label>Обозначение<input maxLength={8} disabled={disabled} value={value.mark} onChange={e => onChange({ ...value, mark: e.target.value })}/></label>
        <label>Цвет типа<input type="color" disabled={disabled} value={value.color} onChange={e => onChange({ ...value, color: e.target.value })}/></label>
        <label>Порядок<input type="number" min={0} max={10000} disabled={disabled} value={value.sort_order} onChange={e => onChange({ ...value, sort_order: Number(e.target.value) })}/></label>
      </div>
      <div className={styles.checks}>
        {(["is_active", "counts_as_present", "counts_as_absent", "is_excused", "scan_default", "zap_default"] as const).map((key, i) => <label key={key}><input type="checkbox" disabled={disabled} checked={value[key]} onChange={e => onChange({ ...value, [key]: e.target.checked, ...(key === "counts_as_present" && e.target.checked ? { counts_as_absent: false } : {}), ...(key === "counts_as_absent" && e.target.checked ? { counts_as_present: false } : {}) })}/>{["Активен", "Присутствовал", "Отсутствовал", "Уважительная причина", "Для сканирования", "Для отгулов"][i]}</label>)}
      </div>
      <p className={styles.muted}>Изменения применятся к новым отметкам. Ранее записанные название и свойства сохранятся.</p>
      {children}
      <div className={styles.actions}><button className={styles.primary} disabled={disabled}>Сохранить тип</button><button type="button" disabled={disabled} onClick={onClose}>Закрыть</button></div>
    </form>
  </div>;
}
