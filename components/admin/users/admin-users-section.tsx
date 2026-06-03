"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { AdminGroupsTab } from "@/components/admin/users/admin-groups-tab";
import { AdminStaffTab } from "@/components/admin/users/admin-staff-tab";
import { AdminStudentsTab } from "@/components/admin/users/admin-students-tab";
import type { AdminUsersTab } from "@/lib/admin/admin-users-types";
import { useState } from "react";

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
  const [tab, setTab] = useState<AdminUsersTab>("students");
  const active = TABS.find((item) => item.id === tab);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Пользователи</h1>
          <p className={userStyles.hint}>{active?.hint}</p>
        </div>
      </header>

      <div className={userStyles.sectionTabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.directionTab} ${tab === item.id ? styles.directionTabActive : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "students" ? <AdminStudentsTab /> : null}
      {tab === "groups" ? <AdminGroupsTab /> : null}
      {tab === "staff" ? <AdminStaffTab /> : null}
    </div>
  );
}
