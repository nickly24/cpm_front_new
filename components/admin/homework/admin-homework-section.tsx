"use client";

import { AdminHomeworkForm } from "@/components/admin/homework/admin-homework-form";
import { AdminHomeworkWorkspace } from "@/components/admin/homework/admin-homework-workspace";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { Toggle } from "@/components/ui/toggle";
import {
  deleteAdminHomework,
  fetchAdminHomeworkById,
  fetchAdminHomeworks,
  getAdminHomeworkId,
  patchAdminHomeworkPublished,
} from "@/lib/admin/admin-homework-api";
import type {
  AdminHomeworkItem,
  AdminHomeworkStatusFilter,
  AdminHomeworkTypeFilter,
  AdminHomeworkView,
} from "@/lib/admin/admin-homework-types";
import {
  filterHomeworkByStatus,
  formatHomeworkDeadline,
  toUiPagination,
} from "@/lib/admin/admin-homework-utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCallback, useEffect, useMemo, useState } from "react";

const IMMERSIVE_VIEWS: AdminHomeworkView[] = [
  "create",
  "edit",
  "view",
  "workspace",
];

const PAGE_SIZE = 10;

const TYPE_TABS: { id: AdminHomeworkTypeFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "ДЗНВ", label: "ДЗНВ" },
  { id: "ОВ", label: "ОВ" },
];

export function AdminHomeworkSection() {
  const [items, setItems] = useState<AdminHomeworkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AdminHomeworkView>("list");
  const [editing, setEditing] = useState<AdminHomeworkItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<AdminHomeworkTypeFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<AdminHomeworkStatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  const [page, setPage] = useState(1);
  const [serverPagination, setServerPagination] = useState({
    totalPages: 1,
    total: 0,
  });
  const [toggleBusy, setToggleBusy] = useState<number | null>(null);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const { setImmersive } = useCabinetChrome();

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminHomeworks({
        page,
        limit: PAGE_SIZE,
        type: typeFilter === "all" ? undefined : typeFilter,
        search: debouncedSearch,
      });
      const list = res.status && Array.isArray(res.res) ? res.res : [];
      setItems(list);
      const ui = toUiPagination(res.pagination);
      setServerPagination({
        totalPages: ui.totalPages,
        total: ui.total,
      });
    } catch (err) {
      setItems([]);
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить задания",
      );
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, debouncedSearch]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    setImmersive(IMMERSIVE_VIEWS.includes(view));
    return () => setImmersive(false);
  }, [view, setImmersive]);

  const filteredItems = useMemo(
    () => filterHomeworkByStatus(items, statusFilter),
    [items, statusFilter],
  );

  const openEdit = async (id: number, mode: "edit" | "view") => {
    try {
      const hw = await fetchAdminHomeworkById(id);
      setEditing(hw);
      setView(mode);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось открыть задание",
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Удалить домашнее задание и все сессии студентов?")) {
      return;
    }
    try {
      await deleteAdminHomework(id);
      await loadList();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const handleTogglePublished = async (id: number, published: boolean) => {
    setToggleBusy(id);
    try {
      await patchAdminHomeworkPublished(id, published);
      setItems((prev) =>
        prev.map((h) =>
          getAdminHomeworkId(h) === id ? { ...h, published } : h,
        ),
      );
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось изменить видимость",
      );
    } finally {
      setToggleBusy(null);
    }
  };

  if (view === "workspace" && workspaceId != null) {
    return (
      <AdminHomeworkWorkspace
        homeworkId={workspaceId}
        onBack={() => {
          setView("list");
          setWorkspaceId(null);
        }}
        onEdit={(hw) => {
          setEditing(hw);
          setView("edit");
        }}
      />
    );
  }

  if (view === "create" || view === "edit" || view === "view") {
    return (
      <AdminHomeworkForm
        mode={view}
        editingHomework={editing}
        onBack={() => {
          setView("list");
          setEditing(null);
        }}
        onSaved={() => {
          setView("list");
          setEditing(null);
          loadList();
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Домашние задания</h1>
        <Button type="button" onClick={() => setView("create")}>
          + Создать задание
        </Button>
      </header>

      <div className={styles.directionTabs}>
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.directionTab} ${typeFilter === tab.id ? styles.directionTabActive : ""}`}
            onClick={() => setTypeFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.filters}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Поиск по названию…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as AdminHomeworkStatusFilter)
          }
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="ended">Дедлайн прошёл</option>
          <option value="hidden">Скрытые</option>
        </select>
      </div>

      {error ? <div className={styles.stateBox}>{error}</div> : null}

      {loading ? (
        <LoadingState
          label="Загрузка заданий…"
          variant="block"
          className={styles.stateBox}
        />
      ) : filteredItems.length === 0 ? (
        <div className={styles.stateBox}>Задания не найдены</div>
      ) : (
        <>
          <div className={styles.cardsGrid}>
            {filteredItems.map((hw) => {
              const id = getAdminHomeworkId(hw);
              const published = hw.published !== false;

              return (
                <article key={id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>{hw.name}</h3>
                    {published ? (
                      <span
                        className={styles.cardVisibilityDot}
                        title="Видно студентам"
                        aria-label="Видно студентам"
                      />
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeEnded}`}>
                        Скрыто
                      </span>
                    )}
                  </div>

                  <dl className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <dt>Тип</dt>
                      <dd className={styles.infoValue}>{hw.type}</dd>
                    </div>
                    <div className={styles.infoRow}>
                      <dt>Дедлайн</dt>
                      <dd className={styles.infoValue}>
                        {formatHomeworkDeadline(String(hw.deadline))}
                      </dd>
                    </div>
                  </dl>

                  <div className={styles.togglesRow}>
                    <Toggle
                      id={`admin-hw-published-${id}`}
                      label="Видимость для студентов"
                      variant="success"
                      checked={published}
                      disabled={toggleBusy === id}
                      onChange={(checked) =>
                        handleTogglePublished(id, checked)
                      }
                    />
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                      onClick={() => {
                        setWorkspaceId(id);
                        setView("workspace");
                      }}
                    >
                      Открыть
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => openEdit(id, "edit")}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => handleDelete(id)}
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {serverPagination.totalPages > 1 ? (
            <nav className={styles.pagination} aria-label="Страницы">
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Назад
              </button>
              {Array.from(
                { length: serverPagination.totalPages },
                (_, i) => i + 1,
              ).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pageNum} ${page === p ? styles.pageNumActive : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page >= serverPagination.totalPages}
                onClick={() =>
                  setPage((p) =>
                    Math.min(serverPagination.totalPages, p + 1),
                  )
                }
              >
                Вперёд →
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
