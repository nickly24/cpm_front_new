"use client";

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
import { useCallback, useEffect, useMemo, useState } from "react";

const TABS: { id: AdminSchoolsTab; label: string }[] = [
  { id: "catalog", label: "Справочник" },
  { id: "unassigned", label: "Без школы" },
];

export function AdminSchoolsSection() {
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
    setLoading(true);
    setError(null);
    try {
      setSchools(await fetchAdminSchools());
    } catch (err) {
      setSchools([]);
      setError(err instanceof Error ? err.message : "Не удалось загрузить школы");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Школы</h1>
          <p className={userStyles.hint}>
            Справочник школ и привязка учеников. Группы CPM настраиваются в разделе
            «Пользователи».
          </p>
        </div>
        {tab === "catalog" ? (
          <Button type="button" onClick={() => setPanelMode("create")}>
            + Добавить школу
          </Button>
        ) : null}
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
                      <dd className={styles.infoValue}>{school.student_count ?? 0}</dd>
                    </div>
                  </dl>

                  {school.notes ? (
                    <p className={userStyles.hint}>{school.notes}</p>
                  ) : null}

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => setWorkspaceId(school.school_id)}
                    >
                      Состав
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        setEditing(school);
                        setPanelMode("edit");
                      }}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleToggleActive(school)}
                    >
                      {school.is_active ? "Деактивировать" : "Активировать"}
                    </button>
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
