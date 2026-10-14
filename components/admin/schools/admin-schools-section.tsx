"use client";

import { CoreEditOnly } from "@/components/admin/users/core-access";

import { CoreCreateRecovery } from "@/components/admin/users/core-access";
import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { AdminSchoolPanel } from "@/components/admin/schools/admin-school-panel";
import { AdminSchoolWorkspace } from "@/components/admin/schools/admin-school-workspace";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchAdminSchools,
  updateAdminSchool,
} from "@/lib/admin/admin-schools-api";
import type { AdminSchool, AdminSchoolsTab } from "@/lib/admin/admin-schools-types";
import { AdminSchoolsUnassignedTab } from "@/components/admin/schools/admin-schools-unassigned-tab";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { BFF_DEV } from "@/lib/config";
import { coreCan } from "@/lib/bff/core-admin";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TABS: { id: AdminSchoolsTab; label: string }[] = [
  { id: "catalog", label: "Справочник" },
  { id: "unassigned", label: "Без школы" },
];

export function AdminSchoolsSection() {
  const {user}=useAuth();
  const loadSerial=useRef(0);
  const [tab, setTab] = useState<AdminSchoolsTab>("catalog");
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [panelMode, setPanelMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<AdminSchool | null>(null);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const serial=++loadSerial.current;
    setLoading(true);
    setError(null);
    try {
      const data=await fetchAdminSchools();
      if(serial!==loadSerial.current)return;
      setSchools(data);
    } catch (err) {
      if(serial!==loadSerial.current)return;
      setSchools([]);
      setError(err instanceof Error ? err.message : "Не удалось загрузить школы");
    } finally {
      if(serial===loadSerial.current)setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(()=>{void load();});
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) {
      return schools;
    }
    return schools.filter(
      (school) =>
        school.name.toLowerCase().includes(q) ||
        (school.short_name ?? "").toLowerCase().includes(q) ||
        String(school.school_id).includes(q),
    );
  }, [schools, debouncedSearch]);

  const handleToggleActive = async (school: AdminSchool) => {
    try {
      await updateAdminSchool(school.school_id, { is_active: !school.is_active });
      setSchools((prev) =>
        prev.map((item) =>
          item.school_id === school.school_id
            ? { ...item, is_active: !item.is_active }
            : item,
        ),
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  if (workspaceId != null) {
    return (
      <AdminSchoolWorkspace
        schoolId={workspaceId}
        onBack={() => {
          setWorkspaceId(null);
          load();
        }}
      />
    );
  }

  if (panelMode) {
    return (
      <AdminSchoolPanel
        mode={panelMode}
        school={editing}
        onClose={() => {
          setPanelMode(null);
          setEditing(null);
        }}
        onSaved={async () => {
          setPanelMode(null);
          setEditing(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <CoreCreateRecovery onRecovered={load} />
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Школы</h1>
          <p className={userStyles.hint}>
            {BFF_DEV ? "Справочник общий для организации. Состав школ показан по выбранному подразделению." : "Справочник школ и привязка учеников. Группы CPM настраиваются в разделе «Пользователи»."}
          </p>
        </div>
        {tab === "catalog" ? (
          <CoreEditOnly fullAdmin><Button type="button" onClick={() => setPanelMode("create")}>
            + Добавить школу
          </Button></CoreEditOnly>
        ) : null}
      </header>

      <div className={userStyles.sectionTabs}>
        {TABS.filter(t=>t.id!=="unassigned"||!BFF_DEV||coreCan("users",false,user)).map((item) => (
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

      {tab === "unassigned" ? (
        <AdminSchoolsUnassignedTab schools={schools.filter((s) => s.is_active)} onChanged={load} />
      ) : (
        <>
          <div className={styles.filters}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Поиск школы…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {error ? <div className={styles.stateBox}>{error}</div> : null}

          {loading ? (
            <LoadingState label="Загрузка школ…" variant="block" className={styles.stateBox} />
          ) : filtered.length === 0 ? (
            <div className={styles.stateBox}>Школы не найдены</div>
          ) : (
            <div className={styles.cardsGrid}>
              {filtered.map((school) => (
                <article key={school.school_id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>{school.name}</h3>
                    {!school.is_active ? (
                      <span className={`${userStyles.metaTag} ${userStyles.inactiveBadge}`}>
                        Неактивна
                      </span>
                    ) : null}
                  </div>

                  <dl className={styles.infoList}>
                    {school.short_name ? (
                      <div className={styles.infoRow}>
                        <dt>Короткое имя</dt>
                        <dd className={styles.infoValue}>{school.short_name}</dd>
                      </div>
                    ) : null}
                    <div className={styles.infoRow}>
                      <dt>Учеников</dt>
                      <dd className={styles.infoValue}>{school.student_count === undefined && BFF_DEV ? "недоступно" : school.student_count ?? 0}</dd>
                    </div>
                  </dl>

                  {school.notes ? (
                    <p className={userStyles.hint}>{school.notes}</p>
                  ) : null}

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      disabled={BFF_DEV && !coreCan("users",false,user)}
                      onClick={() => setWorkspaceId(school.school_id)}
                    >
                      Состав
                    </button>
                    <CoreEditOnly fullAdmin><button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        setEditing(school);
                        setPanelMode("edit");
                      }}
                    >
                      Изменить
                    </button></CoreEditOnly>
                    <CoreEditOnly fullAdmin><button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleToggleActive(school)}
                    >
                      {school.is_active ? "Деактивировать" : "Активировать"}
                    </button></CoreEditOnly>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
