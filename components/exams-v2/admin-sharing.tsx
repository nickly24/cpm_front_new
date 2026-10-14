"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useExamMutation } from "@/lib/exams-v2/hooks";
import type { ExamSummary } from "@/lib/exams-v2/types";
import { Action, Field, MutationNotice } from "./shared";
import s from "./exams.module.css";
export function ExamSharing({ exam, actor, canEdit, canEditContent, changed, copied }: {
    exam: ExamSummary;
    actor: string;
    canEdit: boolean;
    canEditContent: boolean;
    changed: () => void;
    copied: (id: number) => void;
}) {
    const { user } = useAuth();
    const [notice, setNotice] = useState("");
    const [target, setTarget] = useState(String(user?.division_id ?? "")), [name, setName] = useState(exam.name ?? "");
    const divisions = user?.organizations?.find(o => o.id === user.organization_id)?.divisions ?? [];
    const admin = user?.organization_admin === true;
    const mutation = useExamMutation<{
        exam?: ExamSummary;
    }>(`${actor}:sharing:${exam.id}`, result => { changed(); if (result.exam) {
        setNotice(`Независимая копия создана: ID ${result.exam.id}.`);
        if (result.exam.connected)
            copied(result.exam.id);
        else
            setNotice(`Независимая копия создана: ID ${result.exam.id}. Для настройки переключите кабинет на выбранное подразделение.`);
    } });
    const command = (action: string, method: "POST" | "PUT" | "DELETE", body: Record<string, unknown>) => void mutation.execute({ path: `/api/exams/${exam.id}/${action}`, method, body: { expected_revision: exam.version, ...body } });
    const busy = mutation.busy || mutation.uncertain;
    return <section className={s.panel}>
    <h2>Банк организации и подразделения</h2>
    <p className={s.muted}>Владелец: {divisions.find(d => d.id === exam.ownerDivisionId)?.name ?? `Подразделение ${exam.ownerDivisionId}`} · {exam.inBank ? "Доступен в банке" : "Закрыт для банка"}{exam.originExamId ? ` · Копия экзамена ${exam.originExamId}` : ""}</p>
    <p className={s.muted}>Подключён: {(exam.connectedDivisionIds ?? []).map(id => divisions.find(d => d.id === id)?.name ?? `Подразделение ${id}`).join(", ") || "—"}. Настройки, комиссии и результаты ведутся отдельно в каждом подразделении.</p>
    {canEditContent && <form className={s.row} data-exam-editor onSubmit={e => { e.preventDefault(); command("metadata", "PUT", { name: name.trim() }); }}><Field label="Название экзамена"><input className={s.input} value={name} required maxLength={250} disabled={busy} onChange={e => setName(e.target.value)}/></Field><Action type="submit" disabled={busy || !name.trim()}>Сохранить название</Action></form>}
    {canEdit && <div className={s.stack}>
      <div className={s.row}>
        {canEditContent && <Action disabled={busy} onClick={() => command("bank", "PUT", { in_bank: !exam.inBank })}>{exam.inBank ? "Закрыть банк" : "Открыть в банк"}</Action>}
        <Field label="Подразделение для подключения или копии"><select className={s.select} value={target} disabled={busy || !admin} onChange={e => setTarget(e.target.value)}>{(admin ? divisions : divisions.filter(d => d.id === user?.division_id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        {admin && <Action disabled={busy || !target || (exam.connectedDivisionIds ?? []).includes(Number(target))} onClick={() => command("connections", "POST", { division_id: Number(target) })}>Подключить подразделение</Action>}
        <Action disabled={busy || !target} onClick={() => command("copy", "POST", { division_id: Number(target) })}>Независимая копия</Action>
      </div>
      <p className={s.muted}>Копия получает собственный банк вопросов и настройки. Комиссии, назначения, попытки и результаты не копируются.</p>
      <div className={s.row}>{(exam.connectedDivisionIds ?? []).filter(id => id !== exam.ownerDivisionId && (admin || id === user?.division_id)).map(id => <Action key={id} danger disabled={busy} onClick={() => { if (window.confirm("Отключить подразделение? Операция доступна, если в нём нет назначений, попыток и результатов."))
            command(`connections/${id}`, "DELETE", {}); }}>Отключить {divisions.find(d => d.id === id)?.name ?? id}</Action>)}</div>
    </div>}
    {notice && <p className={s.success}>{notice}</p>}
    <MutationNotice mutation={mutation} reload={changed}/>
  </section>;
}
