"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { Button } from "@/components/ui/button";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import {
  addAdminStaffUser,
  editAdminStaffUser,
} from "@/lib/admin/admin-users-api";
import type {
  AdminGroupItem,
  AdminStaffRole,
  AdminStaffUser,
} from "@/lib/admin/admin-users-types";
import { BFF_DEV } from "@/lib/config";
import { coreCan, coreFullAdmin, coreRoles, type CoreRole } from "@/lib/bff/core-admin";
import { CoreCreateRecovery } from "./core-access";
import { useAuth } from "@/contexts/AuthContext";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { useEffect, useState } from "react";

interface AdminStaffPanelProps {
  mode: "add" | "edit";
  role: AdminStaffRole;
  user: AdminStaffUser | null;
  groups: AdminGroupItem[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const ROLE_LABELS: Record<AdminStaffRole, string> = {
  proctor: "проктор",
  examinator: "экзаменатор",
  supervisor: "супервайзер",
  staff_admin: "администратор подразделения",
};

export function AdminStaffPanel({
  mode,
  role,
  user,
  groups,
  onClose,
  onSaved,
}: AdminStaffPanelProps) {
  const {user: actor}=useAuth();
  useContextGuard(BFF_DEV);
  const [password,setPassword]=useState("");
  const [roles,setRoles]=useState<CoreRole[]>([]);
  const [roleId,setRoleId]=useState(user?.role_id!=null?String(user.role_id):"");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [login, setLogin] = useState(user?.login ?? "");
  const [groupId, setGroupId] = useState(
    user?.group_id != null ? String(user.group_id) : "none",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    login: string;
    password: string;
  } | null>(null);

  useEffect(()=>{if(BFF_DEV&&role==="staff_admin"&&coreFullAdmin(actor))void coreRoles().then(setRoles).catch(e=>setError(e instanceof Error?e.message:"Ошибка загрузки ролей"));},[role,actor]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Укажите ФИО");
      return;
    }
    if(BFF_DEV&&role==="staff_admin"&&!roleId){setError("Выберите роль подразделения");return;}

    setSubmitting(true);
    try {
      if (mode === "add") {
        const res = await addAdminStaffUser(role, {
          full_name: fullName.trim(),
          ...(BFF_DEV ? {login:login.trim(),password,role_id:role==="staff_admin"?Number(roleId):null} : {}),
          group_id:
            role === "proctor" && groupId !== "none" ? Number(groupId) : null,
        });
        if (!res.status || !res.user_data) {
          throw new Error(res.error || "Не удалось создать пользователя");
        }
        setCredentials({
          login: res.user_data.login,
          password: res.user_data.password,
        });
        return;
      }

      if (!user) {
        return;
      }

      const payload: {
        role: AdminStaffRole;
        user_id: number;
        full_name?: string;
        group_id?: number | null;
        login?: string;
        password?: string;
        role_id?: number | null;
      } = {
        role,
        user_id: user.id,
      };

      if (fullName.trim() !== user.full_name) {
        payload.full_name = fullName.trim();
      }

      if (role === "proctor" && (!BFF_DEV || coreCan("groups",true,actor))) {
        const nextGroup = groupId === "none" ? null : Number(groupId);
        if (nextGroup !== (user.group_id ?? null)) {
          payload.group_id = nextGroup;
        }
      }

      const nextLogin = login.trim();
      if ((!BFF_DEV||coreFullAdmin(actor)) && nextLogin && nextLogin !== (user.login ?? "")) {
        payload.login = nextLogin;
      }

      if(BFF_DEV&&coreFullAdmin(actor)){if(password)payload.password=password;if(role==="staff_admin"&&Number(roleId)!==user.role_id)payload.role_id=Number(roleId);}
      const res = await editAdminStaffUser(payload);
      if (!res.status) {
        throw new Error(res.error || "Не удалось сохранить");
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DismissibleOverlay className={userStyles.overlay} onDismiss={onClose}>
      <div
        className={userStyles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className={userStyles.modalTitle}>
          {mode === "add"
            ? `Новый ${ROLE_LABELS[role]}`
            : `Редактирование: ${ROLE_LABELS[role]}`}
        </h2>

        <form className={userStyles.formGrid} onSubmit={handleSubmit}>
          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>ФИО</span>
            <input
              className={userStyles.fieldInput}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>

          {(!BFF_DEV && mode === "edit") || (BFF_DEV && coreFullAdmin(actor)) ? (
            <label className={userStyles.field}>
              <span className={userStyles.fieldLabel}>Логин</span>
              <input
                className={userStyles.fieldInput}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={user?.login ? undefined : "Нет учётной записи"}
              />
            </label>
          ) : null}

          {BFF_DEV&&coreFullAdmin(actor)?<label className={userStyles.field}><span className={userStyles.fieldLabel}>{mode==="add"?"Пароль":"Новый пароль"}</span><input className={userStyles.fieldInput} type="password" autoComplete="new-password" minLength={8} required={mode==="add"} value={password} onChange={e=>setPassword(e.target.value)} /><span className={userStyles.memberMeta}>Для смены логина укажите новый пароль.</span></label>:null}
          {BFF_DEV&&role==="staff_admin"&&coreFullAdmin(actor)?<label className={userStyles.field}><span className={userStyles.fieldLabel}>Роль подразделения</span><select className={userStyles.fieldSelect} value={roleId} onChange={e=>setRoleId(e.target.value)} required><option value="">Выберите роль</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>:null}
          {role === "proctor" && (!BFF_DEV || coreCan("groups",true,actor)) ? (
            <label className={userStyles.field}>
              <span className={userStyles.fieldLabel}>Группа CPM</span>
              <select
                className={userStyles.fieldSelect}
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="none">Без группы</option>
                {groups.map((group) => (
                  <option key={group.group_id} value={group.group_id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <CoreCreateRecovery onRecovered={onSaved} />
          {error ? <p className={styles.errorText}>{error}</p> : null}

          {credentials ? (
            <div className={userStyles.credentialsBox}>
              <strong>Пользователь создан.</strong>
              <div>Логин: {credentials.login}</div>
              <div>Пароль: {credentials.password}</div>
            </div>
          ) : null}

          <div className={userStyles.modalActions}>
            <Button type="button" variant="ghost" onClick={onClose}>
              {credentials ? "Закрыть" : "Отмена"}
            </Button>
            {credentials ? (
              <Button
                type="button"
                onClick={async () => {
                  await onSaved();
                }}
              >
                К списку
              </Button>
            ) : (
              <Button type="submit" disabled={submitting}>
                {submitting ? "Сохранение…" : mode === "add" ? "Создать" : "Сохранить"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </DismissibleOverlay>
  );
}
