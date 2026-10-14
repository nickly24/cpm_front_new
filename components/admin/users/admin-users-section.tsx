"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { AdminGroupsTab } from "@/components/admin/users/admin-groups-tab";
import { AdminStaffTab } from "@/components/admin/users/admin-staff-tab";
import { AdminStudentsTab } from "@/components/admin/users/admin-students-tab";
import type { AdminUsersTab } from "@/lib/admin/admin-users-types";
import { useState } from "react";
import { BFF_DEV } from "@/lib/config";
import { coreCan } from "@/lib/bff/core-admin";
import { useAuth } from "@/contexts/AuthContext";

const TABS: { id: AdminUsersTab; label: string; hint: string }[] = [
  {
    id: "students",
    label: "Ученики",
    hint: "Создание, редактирование, группы. Школа — в разделе «Школы».",
  },
  {
    id: "groups",
    label: "Группы",
    hint: "Состав групп, прокторы, непривязанные пользователи.",
  },
  {
    id: "staff",
    label: "Персонал",
    hint: "Прокторы, экзаменаторы, супервайзеры.",
  },
];

export function AdminUsersSection() {
  const {user}=useAuth();
  const available=TABS.filter(item=>!BFF_DEV || coreCan("users",false,user) || item.id==="groups" && coreCan("groups",false,user));
  const [tab, setTab] = useState<AdminUsersTab>(()=>available[0]?.id??"students");
  const activeTab=available.some(item=>item.id===tab)?tab:available[0]?.id;
  const active = available.find((item) => item.id === activeTab);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Пользователи</h1>
          <p className={userStyles.hint}>{active?.hint}</p>
        </div>
      </header>

      <div className={userStyles.sectionTabs}>
        {available.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.directionTab} ${activeTab === item.id ? styles.directionTabActive : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === "students" ? <AdminStudentsTab /> : null}
      {activeTab === "groups" ? <AdminGroupsTab /> : null}
      {activeTab === "staff" ? <AdminStaffTab /> : null}
    </div>
  );
}
