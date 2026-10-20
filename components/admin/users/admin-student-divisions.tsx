"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import { toClientPagination } from "@/lib/admin/admin-users-utils";
import { coreAll, type CoreUser, type CoreRole } from "@/lib/bff/core-admin";
import { canManageCoreAccess } from "@/lib/bff/core-access";
import { BFF_DEV } from "@/lib/config";
import {
  coreOrganizationAccounts, coreOrganizationCatalog, coreOrganizationAccountMemberships,
  coreOrganizationError, coreOrganizationRoles, pendingCoreOrganizationCommand, recoverCoreOrganizationCommand,
  type CoreOrganizationAccount, type CoreOrganizationCatalog, type CoreOrganizationMemberships,
} from "@/lib/bff/core-organization";
import { assignStudentDivisions, assignStaffAdminDivisions, type DistributionAccountRole, type StudentDivisionProgress } from "@/lib/bff/student-divisions";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import styles from "./admin-student-divisions.module.css";

const PAGE_SIZE = 15;

export function AdminStudentDivisions({ onClose, initialRole = "student" }: { onClose: () => void; initialRole?: DistributionAccountRole }) {
  const { user } = useAuth();
  if (!BFF_DEV || !canManageCoreAccess(user)) return null;
  return <Distribution key={`${user?.account_id}:${user?.organization_id}:${user?.division_id}:${user?.context_revision}:${initialRole}`} onClose={onClose} initialRole={initialRole} />;
}

function Distribution({ onClose, initialRole }: { onClose: () => void; initialRole: DistributionAccountRole }) {
  const [accountRole, setAccountRole] = useState<DistributionAccountRole>(initialRole);
  const staff = accountRole === "staff_admin";
  const [roles, setRoles] = useState<CoreRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [targetRoles, setTargetRoles] = useState<Record<number, string>>({});
  const [catalog, setCatalog] = useState<CoreOrganizationCatalog | null>(null);
  const [accounts, setAccounts] = useState<CoreOrganizationAccount[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(""), [division, setDivision] = useState("all"), [page, setPage] = useState(1);
  const [divisionAccounts, setDivisionAccounts] = useState<Set<number> | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [members, setMembers] = useState<Record<number, CoreOrganizationMemberships>>({});
  const [memberErrors, setMemberErrors] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [editing, setEditing] = useState<number[] | null>(null), [targets, setTargets] = useState<number[]>([]);
  const [busy, setBusy] = useState(false), [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<StudentDivisionProgress | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const alive = useRef(true), writing = useRef(false), dialog = useRef<HTMLDialogElement>(null);
  const pending = pendingCoreOrganizationCommand();
  const singleMemberships = editing?.length === 1 ? members[editing[0]] : undefined;
  const newTargets = targets.filter(id => !singleMemberships?.memberships.some(member => member.division_id === id));
  const invalidStaffRoles = staff && (rolesLoading || !!rolesError || newTargets.some(id => !roles.some(role => role.id === Number(targetRoles[id]))));
  useContextGuard(!!editing || busy || !!pending);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refresh = useCallback(() => {
    setMembers({}); setMemberErrors({}); setError(null);
    setFilterLoading(division !== "all"); setDivisionAccounts(null);
    setVersion(value => value + 1);
  }, [division]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([coreOrganizationCatalog(controller.signal), coreOrganizationAccounts(controller.signal)])
      .then(([nextCatalog, rows]) => {
        if (!controller.signal.aborted) { setCatalog(nextCatalog); setAccounts(rows); setError(null); }
      }).catch(reason => { if (!controller.signal.aborted) setError(coreOrganizationError(reason).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [version]);

  useEffect(() => {
    const controller = new AbortController();
    if (division === "all") return;
    void coreAll<CoreUser>(`/core/divisions/${Number(division)}/users`, { role: accountRole }, controller.signal)
      .then(rows => { if (!controller.signal.aborted) setDivisionAccounts(new Set(rows.map(row => row.account_id))); })
      .catch(reason => { if (!controller.signal.aborted) setError(coreOrganizationError(reason).message); })
      .finally(() => { if (!controller.signal.aborted) setFilterLoading(false); });
    return () => controller.abort();
  }, [division, version, accountRole]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ru");
    return accounts.filter(row => row.role === accountRole && (division === "all" || divisionAccounts?.has(row.account_id)) && `${row.full_name} ${row.login} ${row.account_id}`.toLocaleLowerCase("ru").includes(term));
  }, [accounts, search, division, divisionAccounts, accountRole]);
  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const pageRows = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE);
  const pageIds = pageRows.map(row => row.account_id).join(",");
  // Load only the visible 15 rows, with at most three concurrent reads.
  useEffect(() => {
    const controller = new AbortController(), ids = pageIds ? pageIds.split(",").map(Number) : [];
    let cursor = 0;
    const run = async () => {
      while (cursor < ids.length && !controller.signal.aborted) {
        const id = ids[cursor++];
        try {
          const detail = await coreOrganizationAccountMemberships(id, controller.signal);
          if (!controller.signal.aborted) setMembers(previous => ({ ...previous, [id]: detail }));
        } catch (reason) {
          if (!controller.signal.aborted) setMemberErrors(previous => ({ ...previous, [id]: coreOrganizationError(reason).message }));
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(3, ids.length) }, run));
    return () => controller.abort();
  }, [pageIds, version]);

  useEffect(() => {
    if (!staff || !editing) return;
    const controller = new AbortController();
    void coreOrganizationRoles(controller.signal).then(rows => {
      if (!controller.signal.aborted) { setRoles(rows); setRolesError(null); }
    }).catch(reason => { if (!controller.signal.aborted) setRolesError(coreOrganizationError(reason).message); })
      .finally(() => { if (!controller.signal.aborted) setRolesLoading(false); });
    return () => controller.abort();
  }, [staff, editing, version]);

  useEffect(() => {
    if (!editing) return;
    const node = dialog.current, previous = document.body.style.overflow, focus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden"; node?.showModal();
    return () => { node?.close(); document.body.style.overflow = previous; if (focus?.isConnected) focus.focus(); };
  }, [editing]);

  const open = (ids: number[]) => {
    if (busy || pending || !ids.length) return;
    setEditing([...ids]); setTargets([]); setTargetRoles({}); setRoles([]); setRolesError(null); setRolesLoading(staff); setFormError(null); setProgress(null); setNotice(null);
  };
  const close = () => { if (!writing.current) setEditing(null); };
  const submit = async () => {
    if (!editing || !newTargets.length || writing.current || pending || invalidStaffRoles) return;
    writing.current = true; setBusy(true); setFormError(null);
    try {
      const update = (value: StudentDivisionProgress) => { if (alive.current) setProgress(value); };
      const result = staff
        ? await assignStaffAdminDivisions(editing, newTargets.map(divisionId => ({ divisionId, roleId: Number(targetRoles[divisionId]) })), update, () => alive.current)
        : await assignStudentDivisions(editing, newTargets, update, () => alive.current);
      if (alive.current) { setNotice(`Готово: добавлено участий — ${result.added}, уже были назначены — ${result.existing}.`); setEditing(null); setSelected([]); }
    } catch (reason) { if (alive.current) setFormError(`${coreOrganizationError(reason).message} Выполнение остановлено. Уже сохранённые участия остаются на месте.`); }
    finally {
      writing.current = false;
      if (alive.current) { setBusy(false); refresh(); }
    }
  };
  const recover = async () => {
    if (writing.current) return;
    writing.current = true; setBusy(true); setRecoveryError(null);
    try { await recoverCoreOrganizationCommand(); if (alive.current) { setNotice("Назначение подтверждено. Остальные назначения можно продолжить: существующие будут пропущены."); refresh(); } }
    catch (reason) { if (alive.current) setRecoveryError(coreOrganizationError(reason).message); }
    finally { writing.current = false; if (alive.current) setBusy(false); }
  };
  const selectPage = pageRows.filter(row => row.owner_organization_id === catalog?.organization.id).map(row => row.account_id);
  const allPage = selectPage.length > 0 && selectPage.every(id => selected.includes(id));
  const selectedRows = accounts.filter(row => editing?.includes(row.account_id));

  return <section className={styles.workspace} aria-label="Распределение пользователей по подразделениям">
    <header className={styles.header}><div><h2>{staff ? "Администраторы по подразделениям" : "Ученики по подразделениям"}</h2><p>{catalog?.organization.name ?? "Текущая организация"} · Один аккаунт может состоять в нескольких подразделениях.</p></div><Button variant="ghost" disabled={busy} onClick={onClose}>К списку пользователей</Button></header>
    <div className={styles.toolbar}>
      <label>Кого распределяем<select value={accountRole} disabled={busy || !!editing} onChange={event => {
        setAccountRole(event.target.value as DistributionAccountRole); setSelected([]); setPage(1); setMembers({}); setMemberErrors({});
        setDivisionAccounts(null); setFilterLoading(division !== "all"); setError(null); setNotice(null);
      }}><option value="student">Ученики</option><option value="staff_admin">Администраторы подразделений</option></select></label>
      <label>{staff ? "Поиск администраторов" : "Поиск учеников"}<input type="search" value={search} placeholder="Имя, логин или ID" onChange={event => { setSearch(event.target.value); setPage(1); setSelected([]); }} /></label>
      <label>Подразделение<select value={division} disabled={busy} onChange={event => { setDivision(event.target.value); setDivisionAccounts(null); setFilterLoading(event.target.value !== "all"); setPage(1); setSelected([]); setError(null); }}><option value="all">Вся организация</option>{catalog?.divisions.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <Button variant="ghost" disabled={busy || loading} onClick={refresh}>Обновить</Button>
    </div>
    <div className={styles.selection}><span>Выбрано: <strong>{selected.length}</strong>{selected.length ? " · Выбор сохраняется между страницами" : " · Отметьте пользователей в таблице"}</span><div><Button disabled={busy || !!pending || !selected.length} onClick={() => open(selected)}>Добавить в подразделения</Button>{selected.length ? <Button variant="ghost" disabled={busy} onClick={() => setSelected([])}>Снять выбор</Button> : null}</div></div>
    {pending ? <div className={styles.notice} role="status"><p>Ответ на предыдущее изменение не получен. Сначала проверьте результат — повторной отправки не будет.</p><Button disabled={busy} onClick={() => void recover()}>Проверить результат</Button>{recoveryError ? <p role="alert">{recoveryError}</p> : null}</div> : null}
    {notice ? <p className={styles.success} role="status">{notice}</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {loading || filterLoading ? <p role="status">Загрузка пользователей…</p> : error && (!catalog || division !== "all" && !divisionAccounts) ? null : <>
      <p className={styles.caption}>Найдено: {filtered.length} · Показаны пользователи выбранной организации, без переключения кабинета.</p>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th><input type="checkbox" aria-label={staff ? "Выбрать администраторов на этой странице" : "Выбрать учеников на этой странице"} disabled={busy || !selectPage.length} checked={allPage} onChange={() => setSelected(previous => allPage ? previous.filter(id => !selectPage.includes(id)) : [...new Set([...previous, ...selectPage])])} /></th><th>{staff ? "Администратор" : "Ученик"}</th><th>Подразделения</th><th>Действия</th></tr></thead><tbody>{pageRows.map(row => <tr key={row.account_id}>
        <td><input type="checkbox" aria-label={`Выбрать ${row.full_name}`} disabled={busy || row.owner_organization_id !== catalog?.organization.id} checked={selected.includes(row.account_id)} onChange={() => setSelected(previous => previous.includes(row.account_id) ? previous.filter(id => id !== row.account_id) : [...previous, row.account_id])} /></td>
        <td><strong>{row.full_name}</strong><small>{row.login} · ID {row.account_id}{row.is_active === false || row.is_active === 0 ? " · Заблокирован" : ""}</small></td>
        <td><div className={styles.chips}>{members[row.account_id] ? members[row.account_id].memberships.length ? members[row.account_id].memberships.map(member => <span key={member.division_id} className={styles.chip}>{member.division_name}{staff ? ` · ${member.role_name ?? "Роль не указана"}` : ""}</span>) : <span>Нет подразделений</span> : memberErrors[row.account_id] ? <span className={styles.error}>{memberErrors[row.account_id]}</span> : <span className={styles.caption}>Проверяем участия…</span>}</div></td>
        <td>{row.owner_organization_id === catalog?.organization.id ? <Button size="sm" variant="ghost" disabled={busy || !!pending} onClick={() => open([row.account_id])}>Назначить подразделения</Button> : <span className={styles.caption}>Назначает организация владельца</span>}</td>
      </tr>)}</tbody></table>{!pageRows.length ? <p className={styles.empty}>{staff ? "Администраторы не найдены" : "Ученики не найдены"}</p> : null}</div>
      <AdminListPaginationBar pagination={toClientPagination(visiblePage, PAGE_SIZE, filtered.length)} onPageChange={setPage} />
    </>}
    {editing ? <dialog ref={dialog} className={styles.dialog} aria-labelledby="division-assignment-title" onCancel={event => { event.preventDefault(); close(); }}>
      <h2 id="division-assignment-title">Добавить в подразделения</h2>
      <p>{editing.length === 1 ? selectedRows[0]?.full_name : `Выбрано ${staff ? "администраторов" : "учеников"}: ${editing.length}`}</p>
      <p className={styles.caption}>Отметьте одно или несколько подразделений. Текущие участия, роли, группы и история сохранятся. Новые аккаунты не создаются.</p>
      {staff ? <p className={styles.caption}>Для каждого нового подразделения выберите роль. Существующие роли не будут заменены.</p> : null}
      {staff && rolesLoading ? <p role="status">Загрузка ролей организации…</p> : null}
      {staff && rolesError ? <p className={styles.error} role="alert">{rolesError} Закройте окно и откройте снова для повторной проверки.</p> : null}
      {staff && !rolesLoading && !rolesError && !roles.length ? <p className={styles.notice}>В организации пока нет ролей. Создайте роль в разделе управления доступом, затем вернитесь к назначению.</p> : null}
      <fieldset disabled={busy || !!pending}><legend>Подразделения организации</legend>{catalog?.divisions.map(row => {
        const existing = singleMemberships?.memberships.some(member => member.division_id === row.id);
        return <div key={row.id} className={styles.assignment}>
          <label className={styles.option}><input type="checkbox" checked={!!existing || targets.includes(row.id)} disabled={existing} onChange={() => setTargets(previous => previous.includes(row.id) ? previous.filter(id => id !== row.id) : [...previous, row.id])} /><span>{row.name}{existing ? <small>Уже участвует{staff ? ` · ${singleMemberships?.memberships.find(member => member.division_id === row.id)?.role_name ?? "Роль не указана"}` : ""}</small> : null}</span></label>
          {staff && targets.includes(row.id) && !existing ? <label className={styles.roleField}>Роль в «{row.name}»<select required disabled={rolesLoading || !!rolesError} value={targetRoles[row.id] ?? ""} onChange={event => setTargetRoles(previous => ({ ...previous, [row.id]: event.target.value }))}><option value="">Выберите роль</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label> : null}
        </div>;
      })}{!catalog?.divisions.length ? <p>Сначала создайте подразделение в разделе «Подразделения».</p> : null}</fieldset>
      {progress ? <p role="status">Подтверждено: {progress.added + progress.existing} из {progress.total}. Новых участий: {progress.added}.</p> : null}
      {formError ? <p className={styles.error} role="alert">{formError}</p> : null}
      {pending ? <div className={styles.notice}><p>Назначения приостановлены до проверки ответа сервера.</p><Button disabled={busy} onClick={() => void recover()}>Проверить результат</Button>{recoveryError ? <p role="alert">{recoveryError}</p> : null}</div> : null}
      <footer><Button variant="ghost" disabled={busy} onClick={close}>Закрыть</Button><Button disabled={busy || !!pending || !newTargets.length || invalidStaffRoles} onClick={() => void submit()}>{busy ? "Сохраняем…" : "Добавить в выбранные"}</Button></footer>
    </dialog> : null}
  </section>;
}
