"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminAccessApi, type AccessData, type AccessRole, type AccessUser, type AccessUserInput, type RoleInput } from "@/lib/admin/admin-access-api";
import { Button } from "@/components/ui/button";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { LoadingState } from "@/components/ui/loading-state";
import styles from "./admin-access.module.css";

type Editor = { kind: "role"; id?: number; data: RoleInput } | { kind: "user"; id?: number; data: AccessUserInput };

export function AdminAccessSection() {
  const [data, setData] = useState<AccessData | null>(null);
  const [tab, setTab] = useState<"roles" | "users">("roles");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<{ login: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { setData(await adminAccessApi.list()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось загрузить доступы"); }
  }, []);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const openRole = (role?: AccessRole) => {
    setFormError(null);
    setEditor({ kind: "role", id: role?.id, data: { name: role?.name ?? "", description: role?.description ?? "", permissions: structuredClone(role?.permissions ?? {}) } });
  };
  const openUser = (user?: AccessUser) => {
    setFormError(null);
    setEditor({ kind: "user", id: user?.id, data: { full_name: user?.full_name ?? "", login: user?.login ?? "", role_id: user?.role_id ?? data?.roles[0]?.id ?? 0, is_active: user?.is_active ?? true, password: "" } });
  };
  const permission = (section: string, action: "view" | "edit", checked: boolean) => {
    if (editor?.kind !== "role") return;
    const current = editor.data.permissions[section] ?? { view: false, edit: false };
    const flags = action === "edit" ? { view: current.view || checked, edit: checked } : { view: checked, edit: checked && current.edit };
    setEditor({ ...editor, data: { ...editor.data, permissions: { ...editor.data.permissions, [section]: flags } } });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true); setFormError(null);
    try {
      if (editor.kind === "role") await adminAccessApi.saveRole(editor.data, editor.id);
      else {
        const result = await adminAccessApi.saveUser(editor.data, editor.id);
        setCredentials(result.credentials ?? null); setCopied(false);
      }
      setEditor(null); await load();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Не удалось сохранить"); }
    finally { setBusy(false); }
  };
  const remove = async (kind: "role" | "user", id: number, name: string) => {
    if (!window.confirm(`Удалить ${kind === "role" ? "роль" : "пользователя"} «${name}»?`) || busy) return;
    setBusy(true);
    try { if (kind === "role") await adminAccessApi.deleteRole(id); else await adminAccessApi.deleteUser(id); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось удалить"); }
    finally { setBusy(false); }
  };

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><h1>Доступ и роли</h1><p>Назначайте сотрудникам доступ к разделам административного кабинета.</p></div>
      <Button onClick={() => tab === "roles" ? openRole() : openUser()} disabled={busy || !data || (tab === "users" && !data.roles.length)}>{tab === "roles" ? "+ Создать роль" : "+ Добавить пользователя"}</Button>
    </header>
    <p className={styles.notice}>Управлять ролями и этими пользователями может только главный администратор. Редактирование раздела включает добавление, удаление и остальные действия с его данными.</p>
    <div className={styles.tabs}>
      <button className={tab === "roles" ? styles.active : ""} onClick={() => setTab("roles")}>Роли <span>{data?.roles.length ?? 0}</span></button>
      <button className={tab === "users" ? styles.active : ""} onClick={() => setTab("users")}>Пользователи <span>{data?.users.length ?? 0}</span></button>
    </div>
    {error ? <div role="alert" className={styles.error}>{error} <Button variant="ghost" onClick={() => void load()}>Повторить</Button></div> : null}
    {credentials ? <div className={styles.credentials} role="status"><strong>Учётные данные сохранены</strong><p>Передайте их сотруднику. Пароль показывается только сейчас.</p><dl><dt>Логин</dt><dd>{credentials.login}</dd><dt>Пароль</dt><dd>{credentials.password}</dd></dl><Button onClick={async () => { try { await navigator.clipboard.writeText(`Логин: ${credentials.login}\nПароль: ${credentials.password}`); setCopied(true); } catch { setError("Не удалось скопировать. Скопируйте данные вручную."); } }}>{copied ? "Скопировано" : "Скопировать"}</Button> <Button variant="ghost" onClick={() => setCredentials(null)}>Закрыть</Button></div> : null}
    {!data && !error ? <LoadingState label="Загрузка ролей…" variant="block" /> : null}
    {data && tab === "roles" ? <div className={styles.list}>
      {!data.roles.length ? <div className={styles.empty}><h2>Создайте первую роль</h2><p>Например, «Редактор тестов» или «Оператор посещаемости». Затем назначьте её сотрудникам.</p><Button onClick={() => openRole()}>Создать роль</Button></div> : null}
      {data.roles.map((role) => <article className={styles.card} key={role.id}><div><h2>{role.name}</h2>{role.description ? <p>{role.description}</p> : null}<p className={styles.meta}>Пользователей: {role.users_count} · Просмотр: {Object.values(role.permissions).filter((p) => p.view || p.edit).length} · Редактирование: {Object.values(role.permissions).filter((p) => p.edit).length}</p></div><div className={styles.actions}><Button variant="ghost" onClick={() => openRole(role)}>Настроить</Button><Button variant="ghost" disabled={busy || role.users_count > 0} title={role.users_count ? "Сначала назначьте пользователям другую роль" : undefined} onClick={() => void remove("role", role.id, role.name)}>Удалить</Button></div></article>)}
    </div> : null}
    {data && tab === "users" ? <div className={styles.tableWrap}>
      {!data.users.length ? <div className={styles.empty}><h2>Пользователей с ролями пока нет</h2><p>{data.roles.length ? "Добавьте сотрудника и выберите подготовленную роль." : "Сначала создайте роль на соседней вкладке."}</p></div> : <table className={styles.table}><thead><tr><th>Сотрудник</th><th>Логин</th><th>Роль</th><th>Состояние</th><th>Действия</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td>{user.full_name}</td><td>{user.login}</td><td>{user.role_name}</td><td><span className={user.is_active ? styles.enabled : styles.disabled}>{user.is_active ? "Активен" : "Отключён"}</span></td><td><div className={styles.actions}><Button variant="ghost" onClick={() => openUser(user)}>Изменить</Button><Button variant="ghost" disabled={busy} onClick={() => void remove("user", user.id, user.full_name)}>Удалить</Button></div></td></tr>)}</tbody></table>}
    </div> : null}
    {editor ? <DismissibleOverlay className={styles.overlay} onDismiss={() => { if (!busy) setEditor(null); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="access-editor-title" onClick={(event) => event.stopPropagation()}>
      <div className={styles.dialogHeader}><h2 id="access-editor-title">{editor.kind === "role" ? editor.id ? "Настройка роли" : "Новая роль" : editor.id ? "Редактирование пользователя" : "Новый пользователь"}</h2><Button variant="ghost" disabled={busy} onClick={() => setEditor(null)} aria-label="Закрыть">×</Button></div>
      <form onSubmit={save}>
        <fieldset disabled={busy} className={styles.fields}>
          {editor.kind === "role" ? <>
            <label>Название роли<input autoFocus required maxLength={100} value={editor.data.name} onChange={(e) => setEditor({ ...editor, data: { ...editor.data, name: e.target.value } })} placeholder="Например, Оператор посещаемости" /></label>
            <label>Описание<textarea maxLength={500} value={editor.data.description} onChange={(e) => setEditor({ ...editor, data: { ...editor.data, description: e.target.value } })} rows={2} /></label>
            <p className={styles.meta}>Редактирование автоматически включает просмотр. Без флажков раздел скрыт и недоступен.</p>
            <table className={`${styles.table} ${styles.matrix}`}><thead><tr><th>Раздел</th><th>Просмотр</th><th>Редактирование</th></tr></thead><tbody>{data?.sections.map((section) => {
              const flags = editor.data.permissions[section.id] ?? { view: false, edit: false };
              return <tr key={section.id}><td>{section.label}</td><td><input type="checkbox" aria-label={`${section.label}: просмотр`} checked={flags.view || flags.edit} onChange={(e) => permission(section.id, "view", e.target.checked)} /></td><td><input type="checkbox" aria-label={`${section.label}: редактирование`} checked={flags.edit} onChange={(e) => permission(section.id, "edit", e.target.checked)} /></td></tr>;
            })}</tbody></table>
          </> : <>
            <label>ФИО<input autoFocus required maxLength={100} value={editor.data.full_name} onChange={(e) => setEditor({ ...editor, data: { ...editor.data, full_name: e.target.value } })} /></label>
            <label>Логин<input required maxLength={50} autoComplete="off" value={editor.data.login} onChange={(e) => setEditor({ ...editor, data: { ...editor.data, login: e.target.value } })} /></label>
            <label>Роль<select required value={editor.data.role_id || ""} onChange={(e) => setEditor({ ...editor, data: { ...editor.data, role_id: Number(e.target.value) } })}><option value="" disabled>Выберите роль</option>{data?.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
            <label>{editor.id ? "Новый пароль" : "Пароль"}<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={editor.data.password ?? ""} onChange={(e) => setEditor({ ...editor, data: { ...editor.data, password: e.target.value } })} placeholder={editor.id ? "Оставьте пустым, чтобы сохранить текущий" : "Оставьте пустым для автоматической генерации"} /></label>
            <label className={styles.check}><input type="checkbox" checked={editor.data.is_active} onChange={(e) => setEditor({ ...editor, data: { ...editor.data, is_active: e.target.checked } })} />Аккаунт активен</label>
            {editor.id ? <p className={styles.meta}>После сохранения пользователю потребуется войти заново.</p> : null}
          </>}
        </fieldset>
        {formError ? <p className={styles.error} role="alert">{formError}</p> : null}
        <footer className={styles.footer}><Button type="button" variant="ghost" disabled={busy} onClick={() => setEditor(null)}>Отмена</Button><Button type="submit" disabled={busy}>{busy ? "Сохранение…" : "Сохранить"}</Button></footer>
      </form>
    </section></DismissibleOverlay> : null}
  </div>;
}
