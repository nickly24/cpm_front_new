"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BFF_DEV } from "@/lib/config";
import { canManageCoreAccess } from "@/lib/bff/core-access";
import {
  archiveCoreOrganizationCatalog, coreOrganizationAccountMemberships, coreOrganizationAccounts,
  coreOrganizationCatalog, coreOrganizationError, coreOrganizationRoles, dismissCoreOrganizationCommand,
  pendingCoreOrganizationCommand, recoverCoreOrganizationCommand, revokeCoreOrganizationParticipation,
  saveCoreOrganizationName, saveCoreOrganizationParticipation,
  type CoreCatalogKind, type CoreOrganizationAccount, type CoreOrganizationCatalog, type CoreOrganizationMemberships,
} from "@/lib/bff/core-organization";
import type { CoreRole } from "@/lib/bff/core-admin";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { Button } from "@/components/ui/button";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { LoadingState } from "@/components/ui/loading-state";
import styles from "./core-organization.module.css";

export type CoreOrganizationTab = "organizations" | "divisions" | "directions" | "memberships";
type Editor = { kind: CoreCatalogKind; id?: number; name: string } | { kind: "membership"; accountId: number; divisionId: number; roleId: number | null; existing: boolean };
const roleLabels: Record<string, string> = { admin: "Администратор организации", staff_admin: "Сотрудник с ограниченным доступом", student: "Ученик", proctor: "Проктор", examinator: "Экзаменатор", supervisor: "Супервизор" };
const enabled = (value: boolean | number) => value === true || value === 1;
const tabLabels: Record<CoreOrganizationTab, string> = { organizations: "Организация", divisions: "Подразделения", directions: "Направления", memberships: "Участия аккаунтов" };

export function CoreOrganizationWorkspace({ initialTab = "organizations" }: { initialTab?: CoreOrganizationTab }) {
  const { user } = useAuth();
  const canManage = canManageCoreAccess(user);
  const [tab, setTab] = useState<CoreOrganizationTab>(initialTab === "memberships" && !canManage ? "organizations" : initialTab);
  const [catalog, setCatalog] = useState<CoreOrganizationCatalog | null>(null);
  const [accounts, setAccounts] = useState<CoreOrganizationAccount[] | null>(null);
  const [roles, setRoles] = useState<CoreRole[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [memberships, setMemberships] = useState<CoreOrganizationMemberships | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuChanged, setMenuChanged] = useState(false);
  const loadVersion = useRef(0), memberVersion = useRef(0);
  const pending = BFF_DEV ? pendingCoreOrganizationCommand() : null;
  const disabled = busy || !!pending;
  useContextGuard(BFF_DEV && (!!editor || busy || !!pending));
  const selected = accounts?.find(account => account.account_id === selectedId);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!BFF_DEV) return;
    const version = ++loadVersion.current;
    try {
      const next = await coreOrganizationCatalog(signal);
      if (version === loadVersion.current && !signal?.aborted) { setCatalog(next); setError(null); }
    } catch (reason) { if (version === loadVersion.current && !signal?.aborted) setError(coreOrganizationError(reason).message); }
  }, []);
  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    if (!BFF_DEV || !canManage) return null;
    try {
      const [rows, nextRoles] = await Promise.all([coreOrganizationAccounts(signal), coreOrganizationRoles(signal)]);
      if (!signal?.aborted) { setAccounts(rows); setRoles(nextRoles); return rows; }
    } catch (reason) { if (!signal?.aborted) setError(coreOrganizationError(reason).message); }
    return null;
  }, [canManage]);
  const loadMemberships = useCallback(async (signal?: AbortSignal) => {
    if (!BFF_DEV || !canManage || selectedId === null) return;
    const version = ++memberVersion.current;
    setLoadingMembers(true);
    try {
      const detail = await coreOrganizationAccountMemberships(selectedId, signal);
      if (version === memberVersion.current && !signal?.aborted) setMemberships(detail);
    } catch (reason) {
      if (version === memberVersion.current && !signal?.aborted) { setMemberships(null); setError(coreOrganizationError(reason).message); }
    } finally { if (version === memberVersion.current && !signal?.aborted) setLoadingMembers(false); }
  }, [canManage, selectedId]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { void load(controller.signal); });
    return () => controller.abort();
  }, [load, user?.account_id, user?.organization_id, user?.division_id, user?.context_revision]);
  useEffect(() => {
    if (tab !== "memberships") return;
    const controller = new AbortController(); queueMicrotask(() => { void loadAccounts(controller.signal); });
    return () => controller.abort();
  }, [tab, loadAccounts, user?.organization_id, user?.context_revision]);
  useEffect(() => {
    const controller = new AbortController(); queueMicrotask(() => { void loadMemberships(controller.signal); });
    return () => controller.abort();
  }, [loadMemberships, user?.organization_id, user?.context_revision]);

  const refresh = async () => {
    await load();
    if (tab === "memberships") {
      const rows = await loadAccounts();
      if (rows && selectedId !== null && !rows.some(account => account.account_id === selectedId)) { setSelectedId(null); setMemberships(null); }
      else await loadMemberships();
    }
  };
  const openName = (kind: CoreCatalogKind, id?: number, name = "") => { setFormError(null); setEditor({ kind, id, name }); };
  const openMembership = (divisionId?: number, roleId?: number | null) => {
    if (!selected || !memberships?.can_assign || !catalog) return;
    const available = catalog.divisions.filter(division => !memberships.memberships.some(row => row.division_id === division.id));
    setFormError(null);
    setEditor({ kind: "membership", accountId: selected.account_id, divisionId: divisionId ?? available[0]?.id ?? 0, roleId: selected.role === "staff_admin" ? roleId ?? roles[0]?.id ?? null : null, existing: divisionId !== undefined });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!editor || disabled || !canManage) return;
    setBusy(true); setFormError(null); setSuccess(null);
    try {
      if (editor.kind === "membership") await saveCoreOrganizationParticipation(editor.divisionId, editor.accountId, editor.roleId);
      else await saveCoreOrganizationName(editor.kind, editor.name, editor.id);
      if (editor.kind === "organization" || editor.kind === "division") setMenuChanged(true);
      setEditor(null); setSuccess(editor.kind === "membership" ? "Участие сохранено. Аккаунт и остальные участия сохранены." : "Изменения сохранены."); await refresh();
    } catch (reason) {
      if (pendingCoreOrganizationCommand()) { setEditor(null); setError(coreOrganizationError(reason).message); await refresh(); }
      else setFormError(coreOrganizationError(reason).message);
    } finally { setBusy(false); }
  };
  const archive = async (kind: "division" | "direction", id: number, name: string) => {
    if (disabled || !canManage || !window.confirm(`Архивировать ${kind === "division" ? "подразделение" : "направление"} «${name}»? История сохраняется.`)) return;
    setBusy(true); setSuccess(null);
    try { await archiveCoreOrganizationCatalog(kind, id); if (kind === "division") setMenuChanged(true); await refresh(); setSuccess("Объект архивирован. История сохранена."); }
    catch (reason) { setError(coreOrganizationError(reason).message); }
    finally { setBusy(false); }
  };
  const revoke = async (divisionId: number, name: string) => {
    if (disabled || !canManage || !selected || !window.confirm(`Снять участие «${selected.full_name}» в подразделении «${name}»? Аккаунт и история сохраняются.`)) return;
    setBusy(true); setSuccess(null);
    try { await revokeCoreOrganizationParticipation(divisionId, selected.account_id); await refresh(); setSuccess("Участие снято. Аккаунт и остальные участия сохранены."); }
    catch (reason) { setError(coreOrganizationError(reason).message); }
    finally { setBusy(false); }
  };
  const recover = async () => {
    setBusy(true); setRecoveryError(null);
    try { await recoverCoreOrganizationCommand(); await refresh(); setMenuChanged(true); setSuccess("Изменение подтверждено по актуальным данным."); }
    catch (reason) { setRecoveryError(coreOrganizationError(reason).message); await refresh(); }
    finally { setBusy(false); }
  };
  if (!BFF_DEV) return <div className={styles.page}><h1>Организация</h1><p>Управление организацией доступно в локальном режиме нового сервиса.</p></div>;
  const visibleAccounts = accounts?.filter(account => `${account.full_name} ${account.login} ${account.account_id}`.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))) ?? [];
  const remainingDivisions = catalog?.divisions.filter(division => !memberships?.memberships.some(row => row.division_id === division.id)) ?? [];

  return <div className={styles.page}>
    <header className={styles.header}><div><h1>{tabLabels[tab]}</h1><p>{catalog?.organization.name ?? "Организация выбранного кабинета"}</p></div><Button variant="ghost" disabled={busy} onClick={() => void refresh()}>Обновить</Button></header>
    <p className={styles.notice}>{canManage ? "Организация и направления общие для её подразделений. Участия и административные роли назначаются отдельно в каждом подразделении." : "Справочники доступны для просмотра. Изменения и назначения выполняет администратор организации."}</p>
    <nav className={styles.tabs} aria-label="Управление организацией">
      {(["organizations", "divisions", "directions", ...(canManage ? ["memberships"] : [])] as CoreOrganizationTab[]).map(item => <button key={item} aria-current={tab === item ? "page" : undefined} className={tab === item ? styles.active : ""} disabled={!!editor || busy} onClick={() => { setTab(item); setError(null); setSuccess(null); }}>{tabLabels[item]}</button>)}
    </nav>
    {error ? <div className={styles.error} role="alert">{error}</div> : null}
    {success ? <p className={styles.success} role="status">{success}</p> : null}
    {menuChanged && !pending && !editor ? <p className={styles.notice}>Названия и список кабинетов обновляются при проверке сессии. <Button variant="ghost" disabled={busy} onClick={() => window.location.reload()}>Обновить меню кабинетов</Button></p> : null}
    {pending ? <div className={styles.notice}><p>Ответ на изменение не получен. Новый запрос заблокирован до проверки результата; автоматического повторения нет.</p><Button disabled={busy} onClick={() => void recover()}>{busy ? "Проверка…" : "Проверить результат"}</Button>{recoveryError ? <><p role="alert">{recoveryError}</p><Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Актуальные данные проверены? Если изменение не подтверждено, перед новым запросом убедитесь, что оно не появилось в списке.")) { dismissCoreOrganizationCommand(); setRecoveryError(null); void refresh(); } }}>Продолжить после проверки данных</Button></> : null}</div> : null}
    {!catalog && !error ? <LoadingState label="Загрузка организации…" variant="block" /> : null}
    {catalog && tab === "organizations" ? <article className={styles.card}><div><h2>{catalog.organization.name}</h2><p>Подразделений доступно: {catalog.divisions.length}. Направлений: {catalog.directions.length}.</p><p className={styles.meta}>Администратор управляет своей организацией. Создание организаций здесь не выполняется.</p></div>{canManage ? <Button disabled={disabled} onClick={() => openName("organization", catalog.organization.id, catalog.organization.name)}>Переименовать организацию</Button> : null}</article> : null}
    {catalog && (tab === "divisions" || tab === "directions") ? <>
      <div className={styles.toolbar}><p className={styles.meta}>{tab === "divisions" ? "Показаны активные подразделения, доступные вашему аккаунту." : "Показаны активные направления выбранной организации."}</p>{canManage ? <Button disabled={disabled} onClick={() => openName(tab === "divisions" ? "division" : "direction")}>{tab === "divisions" ? "+ Создать подразделение" : "+ Создать направление"}</Button> : null}</div>
      <div className={styles.list}>{(tab === "divisions" ? catalog.divisions : catalog.directions).map(row => <article className={styles.card} key={row.id}><div><h2>{row.name}</h2>{tab === "divisions" && row.id === user?.division_id ? <span className={styles.enabled}>Выбранный кабинет</span> : null}</div>{canManage ? <div className={styles.actions}><Button variant="ghost" disabled={disabled} onClick={() => openName(tab === "divisions" ? "division" : "direction", row.id, row.name)}>Переименовать</Button><Button variant="ghost" disabled={disabled} onClick={() => void archive(tab === "divisions" ? "division" : "direction", row.id, row.name)}>Архивировать</Button></div> : null}</article>)}</div>
      {!(tab === "divisions" ? catalog.divisions : catalog.directions).length ? <p className={styles.empty}>Доступных {tab === "divisions" ? "подразделений" : "направлений"} пока нет.</p> : null}
      <p className={styles.meta}>{tab === "divisions" ? "Архивирование возможно после снятия участий и проверки защищённой истории владельцем сервиса." : "Архивирование убирает направление из справочника. Существующие материалы и история сохраняются."}</p>
    </> : null}
    {catalog && tab === "memberships" && canManage ? <>
      <div className={styles.toolbar}><label className={styles.search}>Найти существующий аккаунт<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ФИО, логин или ID аккаунта" /></label><p className={styles.meta}>Добавление участия использует существующий аккаунт и сохраняет его профиль. Новые логины и пароли здесь не создаются.</p></div>
      {!accounts ? <LoadingState label="Загрузка аккаунтов организации…" variant="block" /> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Аккаунт</th><th>Логин</th><th>Тип и состояние</th><th>Участия</th></tr></thead><tbody>{visibleAccounts.map(account => <tr key={account.account_id}><td>{account.full_name}<small className={styles.meta}>Аккаунт #{account.account_id}</small></td><td>{account.login}</td><td>{roleLabels[account.role] ?? account.role}<small className={styles.meta}>{enabled(account.is_active) ? "Активен" : "Отключён"}{account.owner_organization_id !== user?.organization_id ? " · Другая организация владелец" : ""}</small></td><td><Button variant="ghost" disabled={busy || !!editor} onClick={() => { if (selectedId === account.account_id) void loadMemberships(); else { setMemberships(null); setSelectedId(account.account_id); } setError(null); }}>{selectedId === account.account_id ? "Обновить участия" : "Посмотреть участия"}</Button></td></tr>)}</tbody></table>{!visibleAccounts.length ? <p className={styles.empty}>Аккаунтов по запросу не найдено.</p> : null}</div>}
      {selected ? <section className={styles.memberPanel} aria-label="Участия выбранного аккаунта"><header className={styles.header}><div><h2>{selected.full_name}</h2><p>{selected.login} · {roleLabels[selected.role] ?? selected.role}</p></div>{memberships?.can_assign && selected.role !== "admin" ? <Button disabled={disabled || loadingMembers || !remainingDivisions.length || selected.role === "staff_admin" && !roles.length} onClick={() => openMembership()}>Добавить участие</Button> : null}</header>
        {loadingMembers ? <LoadingState label="Проверка участий аккаунта…" variant="block" /> : memberships ? <>
          {!memberships.can_assign ? <p className={styles.notice}>{selected.role === "admin" ? "Администратор имеет доступ ко всей организации без назначения отдельных участий." : "Аккаунт принадлежит другой организации. Добавление участия и смена роли недоступны. Снятие участия в вашей организации проверяется отдельно владельцем сервиса."}</p> : null}
          {!enabled(selected.is_active) ? <p className={styles.meta}>Аккаунт отключён. Назначение участия не активирует его и не восстанавливает сессию.</p> : null}
          <div className={styles.list}>{memberships.memberships.map(member => <article className={styles.card} key={member.division_id}><div><h3>{member.division_name}</h3><p>{selected.role === "staff_admin" ? `Роль: ${member.role_name ?? `#${member.role_id ?? "не назначена"}`}` : roleLabels[selected.role] ?? selected.role}{member.group_id !== null ? ` · Группа #${member.group_id}` : ""}</p></div>{memberships.can_assign || member.can_revoke ? <div className={styles.actions}>{memberships.can_assign && selected.role === "staff_admin" ? <Button variant="ghost" disabled={disabled} onClick={() => openMembership(member.division_id, member.role_id)}>Изменить роль</Button> : null}{member.can_revoke ? <Button variant="ghost" disabled={disabled} onClick={() => void revoke(member.division_id, member.division_name)}>Снять участие</Button> : null}</div> : null}</article>)}</div>
          {!memberships.memberships.length ? <p className={styles.empty}>Участий в активных подразделениях этой организации нет.</p> : null}
          <p className={styles.meta}>Снятие участия проверяет наличие последнего доступа, рейтинга и истории. Группа и роль других участий не меняются.</p>
        </> : null}
      </section> : null}
    </> : null}
    {editor ? <DismissibleOverlay className={styles.overlay} onDismiss={() => { if (!busy) setEditor(null); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="organization-editor-title" onClick={event => event.stopPropagation()}><header className={styles.dialogHeader}><h2 id="organization-editor-title">{editor.kind === "membership" ? editor.existing ? "Роль участия" : "Добавление участия" : editor.id ? "Переименование" : editor.kind === "division" ? "Новое подразделение" : "Новое направление"}</h2><Button variant="ghost" disabled={busy} aria-label="Закрыть" onClick={() => setEditor(null)}>×</Button></header><form onSubmit={submit}><fieldset className={styles.fields} disabled={busy}>
      {editor.kind === "membership" ? <><p>{selected?.full_name} · {selected?.login}</p><label>Подразделение<select required disabled={editor.existing} value={editor.divisionId || ""} onChange={event => setEditor({ ...editor, divisionId: Number(event.target.value) })}><option value="" disabled>Выберите подразделение</option>{(editor.existing ? catalog?.divisions ?? [] : remainingDivisions).map(division => <option key={division.id} value={division.id}>{division.name}</option>)}</select></label>{selected?.role === "staff_admin" ? <label>Административная роль<select required value={editor.roleId ?? ""} onChange={event => setEditor({ ...editor, roleId: Number(event.target.value) })}><option value="" disabled>Выберите роль</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label> : <p className={styles.meta}>Тип аккаунта сохраняется: {selected ? roleLabels[selected.role] ?? selected.role : ""}. Административная роль ему не назначается.</p>}<p className={styles.meta}>Владелец повторно проверит аккаунт, подразделение и роль перед сохранением. Группа существующего участия сохраняется.</p></> : <label>Название<input autoFocus required maxLength={editor.kind === "direction" ? 200 : 150} value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} /></label>}
    </fieldset>{formError ? <p role="alert" className={styles.error}>{formError}</p> : null}<footer className={styles.footer}><Button type="button" variant="ghost" disabled={busy} onClick={() => setEditor(null)}>Отмена</Button><Button type="submit" disabled={busy}>{busy ? "Сохранение…" : "Сохранить"}</Button></footer></form></section></DismissibleOverlay> : null}
  </div>;
}
