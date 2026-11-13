"use client";

import { useState } from "react";
import type { OvState, OvStatus } from "@/lib/exams-v2/types";
import { Action, Field } from "./shared";
import s from "./exams.module.css";

export const OV_LABELS: Record<OvStatus, string> = {
  accepted: "OV приняты без замечаний",
  remarks: "Есть замечания",
  missing: "OV отсутствует",
};
export interface OvUpdate {
  expectedOvRevision: number;
  ovStatus: OvStatus | null;
  ovComment: string | null;
}

export function OvSummary({ value }: { value: OvState }) {
  return (
    <div className={s.ovSummary}>
      <span className={s.muted}>Сданы OV</span>
      <strong>{value.ovStatus ? OV_LABELS[value.ovStatus] : "Не указано"}</strong>
      {value.ovStatus === "remarks" && value.ovComment && <p className={s.text}>{value.ovComment}</p>}
    </div>
  );
}

/** Key this editor by attempt ID and persisted OV revision. A dirty draft pauses sync. */
export function OvEditor({ value, canEdit, disabled, saving, onSave, onDirtyChange }: {
  value: OvState;
  canEdit: boolean;
  disabled: boolean;
  saving?: boolean;
  onSave: (update: OvUpdate) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [status, setStatus] = useState<OvStatus | null>(value.ovStatus ?? null);
  const [comment, setComment] = useState(value.ovComment ?? "");
  const savedComment = value.ovStatus === "remarks" ? value.ovComment ?? "" : "";
  const effectiveComment = status === "remarks" ? comment : "";
  const dirty = status !== (value.ovStatus ?? null) || effectiveComment !== savedComment;
  const change = (nextStatus: OvStatus | null, nextComment: string) => {
    setStatus(nextStatus);
    setComment(nextComment);
    onDirtyChange?.(nextStatus !== (value.ovStatus ?? null) || nextComment !== savedComment);
  };
  if (!canEdit) return <section className={s.panel}><OvSummary value={value} /></section>;
  return (
    <section className={s.panel} aria-labelledby="ov-heading">
      <div className={s.header}>
        <h3 id="ov-heading">Сданы OV</h3>
        <span className={s.muted}>{dirty ? "Не сохранено" : "Сохранено"}</span>
      </div>
      <form
        data-exam-editor
        data-exam-dirty={dirty ? "true" : undefined}
        className={s.stack}
        onSubmit={event => {
          event.preventDefault();
          if (disabled || !dirty) return;
          onSave({ expectedOvRevision: value.ovRevision ?? 0, ovStatus: status, ovComment: status === "remarks" ? comment.trim() || null : null });
        }}
      >
        <Field label="Статус OV">
          <select className={s.select} value={status ?? ""} disabled={disabled} onChange={event => change(event.target.value ? event.target.value as OvStatus : null, "")}>
            <option value="">Не указано</option>
            {Object.entries(OV_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
        {status === "remarks" && <Field label="Комментарий к замечаниям · необязательно">
          <textarea className={s.textarea} value={comment} maxLength={2000} disabled={disabled} rows={3} onChange={event => change(status, event.target.value)} />
        </Field>}
        <p className={s.muted}>Отметка относится только к этой сдаче. Её можно оставить пустой.</p>
        <div className={s.row}>
          <Action primary type="submit" disabled={disabled || !dirty}>{saving ? "Сохраняем…" : "Сохранить OV"}</Action>
          {dirty && <Action disabled={disabled} onClick={() => change(value.ovStatus ?? null, savedComment)}>Отменить</Action>}
        </div>
      </form>
    </section>
  );
}
