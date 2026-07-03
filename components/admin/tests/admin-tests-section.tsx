"use client";

import { AdminExternalTestDeleteDialog } from "@/components/admin/tests/admin-external-test-delete-dialog";
import { AdminExternalTestForm } from "@/components/admin/tests/admin-external-test-form";
import { AdminTestDraftEditor } from "@/components/admin/tests/admin-test-draft-editor";
import { AdminTestForm } from "@/components/admin/tests/admin-test-form";
import { AdminTestWorkspace } from "@/components/admin/tests/admin-test-workspace";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { Toggle } from "@/components/ui/toggle";
import {
  deleteAdminTest,
  deleteExternalAdminTest,
  fetchAdminDirections,
  fetchAdminTestById,
  fetchAdminTestsByDirection,
  getAdminTestId,
  getAdminTestTitle,
  isAdminExternalTest,
  patchAdminTestFields,
} from "@/lib/admin/admin-tests-api";
import {
  createAdminTestDraft,
  createAdminTestDraftFromTest,
  fetchAdminTestDrafts,
} from "@/lib/admin/admin-test-drafts-api";
import type { AdminTestDraft } from "@/lib/admin/admin-test-drafts-types";
import type {
  AdminTestDetail,
  AdminTestListItem,
  AdminTestStatusFilter,
  AdminTestsView,
  Direction,
  TestsDateFilter,
} from "@/lib/admin/admin-tests-types";
import {
  filterAdminTestsByDate,
  filterAdminTestsBySearch,
  filterAdminTestsByStatus,
  formatAdminTestDate,
  getAdminTestStatus,
  getAdminTestStatusLabel,
} from "@/lib/admin/admin-tests-utils";
import { useCallback, useEffect, useMemo, useState } from "react";

const IMMERSIVE_VIEWS: AdminTestsView[] = [
  "create",
  "createExternal",
  "edit",
  "view",
  "workspace",
  "draftEditor",
];

const PAGE_SIZE = 6;

function statusBadgeClass(status: ReturnType<typeof getAdminTestStatus>) {
  if (status === "upcoming") return styles.badgeUpcoming;
  if (status === "ended") return styles.badgeEnded;
  if (status === "external") return styles.badgeExternal;
  return styles.badgeActive;
}

export function AdminTestsSection() {
  const [directions, setDirections] = useState<Direction[]>([]);
  const [directionName, setDirectionName] = useState("");
  const [tests, setTests] = useState<AdminTestListItem[]>([]);
  const [drafts, setDrafts] = useState<AdminTestDraft[]>([]);
  const [loadingDirections, setLoadingDirections] = useState(true);
  const [loadingTests, setLoadingTests] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AdminTestsView>("list");
  const [editingTest, setEditingTest] = useState<AdminTestDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminTestStatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<TestsDateFilter>({
    startDate: "",
    endDate: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);
  const [workspaceTestId, setWorkspaceTestId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<AdminTestDraft | null>(null);
  const [externalDeleteTarget, setExternalDeleteTarget] =
    useState<AdminTestListItem | null>(null);
  const [externalDeleting, setExternalDeleting] = useState(false);
  const [externalDeleteError, setExternalDeleteError] = useState<string | null>(
    null,
  );
  const { setImmersive } = useCabinetChrome();

  const loadTests = useCallback(async (direction: string) => {
    if (!direction) {
      setTests([]);
      return;
    }

    setLoadingTests(true);
    setError(null);

    try {
      const data = await fetchAdminTestsByDirection(direction);
      setTests(Array.isArray(data) ? data : []);
    } catch (err) {
      setTests([]);
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить тесты",
      );
    } finally {
      setLoadingTests(false);
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const data = await fetchAdminTestDrafts("active");
      setDrafts(Array.isArray(data) ? data : []);
    } catch {
      setDrafts([]);
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDirections() {
      setLoadingDirections(true);
      try {
        const data = await fetchAdminDirections();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setDirections(list);
        if (list.length > 0) {
          setDirectionName(list[0].name);
        }
      } catch (err) {
        if (!cancelled) {
          setDirections([]);
          setError(
            err instanceof Error
              ? err.message
              : "Не удалось загрузить направления",
          );
        }
      } finally {
        if (!cancelled) setLoadingDirections(false);
      }
    }

    loadDirections();
    const draftTimer = window.setTimeout(() => {
      loadDrafts();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(draftTimer);
    };
  }, [loadDrafts]);

  useEffect(() => {
    if (directionName) {
      loadTests(directionName);
    }
  }, [directionName, loadTests]);

  useEffect(() => {
    setImmersive(IMMERSIVE_VIEWS.includes(view));
    return () => setImmersive(false);
  }, [view, setImmersive]);

  const filteredTests = useMemo(() => {
    let list = tests;
    list = filterAdminTestsBySearch(list, searchTerm);
    list = filterAdminTestsByStatus(list, statusFilter);
    list = filterAdminTestsByDate(list, dateFilter);
    return list;
  }, [tests, searchTerm, statusFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
  const paginatedTests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTests.slice(start, start + PAGE_SIZE);
  }, [filteredTests, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, directionName]);

  const openWorkspace = (testId: string) => {
    setWorkspaceTestId(testId);
    setView("workspace");
  };

  const openNewDraft = async () => {
    try {
      const draft = await createAdminTestDraft({
        direction: directionName,
      });
      setEditingDraft(draft);
      setView("draftEditor");
      await loadDrafts();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось создать драфт",
      );
    }
  };

  const openDraftFromTest = async (testId: string) => {
    try {
      const draft = await createAdminTestDraftFromTest(testId);
      setEditingDraft(draft);
      setView("draftEditor");
      await loadDrafts();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось создать драфт из теста",
      );
    }
  };

  const openTest = async (testId: string, mode: "edit") => {
    try {
      const detail = await fetchAdminTestById(testId);
      setEditingTest(detail);
      setView(mode);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось загрузить тест",
      );
    }
  };

  const handleDelete = async (testId: string) => {
    if (
      !window.confirm(
        "Удалить тест? Будут удалены связанные сессии. Действие необратимо.",
      )
    ) {
      return;
    }

    try {
      const res = await deleteAdminTest(testId);
      window.alert(`Тест удалён. Сессий: ${res.deletedSessions ?? 0}`);
      await loadTests(directionName);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Ошибка при удалении",
      );
    }
  };

  const openExternalDeleteDialog = (test: AdminTestListItem) => {
    setExternalDeleteError(null);
    setExternalDeleteTarget(test);
  };

  const closeExternalDeleteDialog = () => {
    if (externalDeleting) {
      return;
    }
    setExternalDeleteTarget(null);
    setExternalDeleteError(null);
  };

  const handleExternalDeleteConfirm = async () => {
    if (!externalDeleteTarget) {
      return;
    }

    setExternalDeleting(true);
    setExternalDeleteError(null);

    try {
      const res = await deleteExternalAdminTest(getAdminTestId(externalDeleteTarget));
      setExternalDeleteTarget(null);
      await loadTests(directionName);
      window.alert(
        `Внешний тест удалён. Результатов: ${res.resultsDeleted ?? 0}`,
      );
    } catch (err) {
      setExternalDeleteError(
        err instanceof Error ? err.message : "Ошибка при удалении",
      );
    } finally {
      setExternalDeleting(false);
    }
  };

  const patchTestInList = (testId: string, patch: Partial<AdminTestListItem>) => {
    setTests((prev) =>
      prev.map((t) => (getAdminTestId(t) === testId ? { ...t, ...patch } : t)),
    );
  };

  const handleTogglePublished = async (testId: string, published: boolean) => {
    setToggleBusy(`${testId}-published`);
    patchTestInList(testId, { published });
    try {
      await patchAdminTestFields(testId, { published });
    } catch (err) {
      patchTestInList(testId, { published: !published });
      window.alert(
        err instanceof Error ? err.message : "Не удалось изменить видимость",
      );
    } finally {
      setToggleBusy(null);
    }
  };

  const handleToggleVisible = async (testId: string, visible: boolean) => {
    setToggleBusy(`${testId}-visible`);
    patchTestInList(testId, { visible });
    try {
      await patchAdminTestFields(testId, { visible });
    } catch (err) {
      patchTestInList(testId, { visible: !visible });
      window.alert(
        err instanceof Error ? err.message : "Не удалось изменить доступ к ответам",
      );
    } finally {
      setToggleBusy(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter({ startDate: "", endDate: "" });
  };

  const countByStatus = (status: AdminTestStatusFilter) => {
    if (status === "all") return tests.length;
    return tests.filter((t) => getAdminTestStatus(t) === status).length;
  };

  if (view === "workspace" && workspaceTestId) {
    return (
      <AdminTestWorkspace
        testId={workspaceTestId}
        directions={directions}
        onBack={() => {
          setView("list");
          setWorkspaceTestId(null);
        }}
        onEdit={(test) => {
          setEditingTest(test);
          setView("edit");
        }}
      />
    );
  }

  if (view === "draftEditor" && editingDraft) {
    return (
      <AdminTestDraftEditor
        draft={editingDraft}
        directions={directions}
        onBack={() => {
          setView("list");
          setEditingDraft(null);
          loadDrafts();
        }}
        onPublished={(testId) => {
          setView("list");
          setEditingDraft(null);
          loadDrafts();
          loadTests(directionName);
          openWorkspace(testId);
        }}
      />
    );
  }

  if (view === "create" || view === "edit" || view === "view") {
    return (
      <AdminTestForm
        mode={view}
        directions={directions}
        editingTest={editingTest}
        defaultDirection={directionName}
        onBack={() => {
          setView("list");
          setEditingTest(null);
        }}
        onSaved={() => {
          setView("list");
          setEditingTest(null);
          loadTests(directionName);
        }}
      />
    );
  }

  if (view === "createExternal") {
    return (
      <AdminExternalTestForm
        directions={directions}
        defaultDirection={directionName}
        onBack={() => setView("list")}
        onSaved={(savedDirectionName) => {
          setView("list");
          if (savedDirectionName && savedDirectionName !== directionName) {
            setDirectionName(savedDirectionName);
          } else {
            loadTests(directionName);
          }
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      {externalDeleteTarget ? (
        <AdminExternalTestDeleteDialog
          test={externalDeleteTarget}
          deleting={externalDeleting}
          deleteError={externalDeleteError}
          onCancel={closeExternalDeleteDialog}
          onConfirm={() => {
            void handleExternalDeleteConfirm();
          }}
        />
      ) : null}

      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Управление тестами</h1>
        <div className={styles.headerActions}>
          <Button
            type="button"
            onClick={() => {
              setEditingTest(null);
              setView("create");
            }}
          >
            + Создать тест
          </Button>
          <Button type="button" variant="secondary" onClick={openNewDraft}>
            Попробовать новый интерфейс
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditingTest(null);
              setView("createExternal");
            }}
          >
            + Создать вне системы
          </Button>
        </div>
      </header>

      <section className={styles.draftsPanel}>
        <div className={styles.draftsPanelHead}>
          <div>
            <h2>Драфты нового редактора</h2>
            <p>Общие наброски тестов с автосохранением</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={loadDrafts}>
            Обновить
          </Button>
        </div>
        {loadingDrafts ? (
          <p className={styles.panelHint}>Загрузка драфтов...</p>
        ) : drafts.length === 0 ? (
          <p className={styles.panelHint}>Активных драфтов пока нет</p>
        ) : (
          <div className={styles.draftsList}>
            {drafts.map((draft) => (
              <button
                key={draft.id}
                type="button"
                className={styles.draftItem}
                onClick={() => {
                  setEditingDraft(draft);
                  setView("draftEditor");
                }}
              >
                <strong>{draft.title || "Без названия"}</strong>
                <span>
                  {draft.canvas?.questions?.length ?? 0} вопросов ·{" "}
                  {draft.direction || "направление не выбрано"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {loadingDirections ? (
        <LoadingState
          label="Загрузка направлений…"
          variant="block"
          className={styles.stateBox}
        />
      ) : directions.length === 0 ? (
        <div className={styles.stateBox}>Направления не найдены</div>
      ) : (
        <div className={styles.directionTabs}>
          {directions.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`${styles.directionTab} ${directionName === d.name ? styles.directionTabActive : ""}`}
              onClick={() => setDirectionName(d.name)}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      <div className={styles.filters}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Поиск тестов…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className={styles.dateRow}>
          <label className={styles.dateField}>
            <span className={styles.fieldLabel}>С даты</span>
            <input
              type="date"
              className={styles.dateInput}
              value={dateFilter.startDate}
              onChange={(e) =>
                setDateFilter((f) => ({ ...f, startDate: e.target.value }))
              }
            />
          </label>
          <label className={styles.dateField}>
            <span className={styles.fieldLabel}>По дату</span>
            <input
              type="date"
              className={styles.dateInput}
              value={dateFilter.endDate}
              onChange={(e) =>
                setDateFilter((f) => ({ ...f, endDate: e.target.value }))
              }
            />
          </label>
          <button
            type="button"
            className={styles.clearBtn}
            disabled={
              !searchTerm &&
              !dateFilter.startDate &&
              !dateFilter.endDate &&
              statusFilter === "all"
            }
            onClick={clearFilters}
          >
            Очистить фильтры
          </button>
        </div>

        <div className={styles.statusFilters}>
          {(
            [
              ["all", "Все"],
              ["active", "Активные"],
              ["upcoming", "Скоро"],
              ["ended", "Завершённые"],
              ["external", "Вне системы"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`${styles.filterChip} ${statusFilter === key ? styles.filterChipActive : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              {label} ({countByStatus(key)})
            </button>
          ))}
        </div>
      </div>

      {loadingTests ? (
        <LoadingState
          label="Загрузка тестов…"
          variant="block"
          className={styles.stateBox}
        />
      ) : error ? (
        <div className={styles.stateBox}>
          <p className={styles.errorText}>{error}</p>
          <Button type="button" variant="ghost" onClick={() => loadTests(directionName)}>
            Повторить
          </Button>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className={styles.stateBox}>
          <p>{tests.length === 0 ? "Тестов пока нет" : "По фильтрам ничего не найдено"}</p>
          {tests.length === 0 ? (
            <div className={styles.emptyActions}>
              <Button type="button" onClick={() => setView("create")}>
                Создать первый тест
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setView("createExternal")}
              >
                Создать вне системы
              </Button>
            </div>
          ) : (
            <button type="button" className={styles.clearBtn} onClick={clearFilters}>
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.cardsGrid}>
            {paginatedTests.map((test) => {
              const testId = getAdminTestId(test);
              const external = isAdminExternalTest(test);
              const status = getAdminTestStatus(test);
              const published = test.published ?? true;
              const visible = test.visible ?? false;

              return (
                <article
                  key={testId}
                  className={`${styles.card} ${external ? styles.cardExternal : ""}`}
                >
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>{getAdminTestTitle(test)}</h3>
                    <span className={`${styles.badge} ${statusBadgeClass(status)}`}>
                      {getAdminTestStatusLabel(status)}
                    </span>
                  </div>

                  <dl className={styles.infoList}>
                    {external ? (
                      <div className={styles.infoRow}>
                        <dt>Дата</dt>
                        <dd className={styles.infoValue}>
                          {formatAdminTestDate(test.date)}
                        </dd>
                      </div>
                    ) : (
                      <>
                        <div className={styles.infoRow}>
                          <dt>Время</dt>
                          <dd className={styles.infoValue}>
                            {test.timeLimitMinutes ?? "—"} мин
                          </dd>
                        </div>
                        <div className={styles.infoRow}>
                          <dt>Начало</dt>
                          <dd className={styles.infoValue}>
                            {formatAdminTestDate(test.startDate)}
                          </dd>
                        </div>
                        <div className={styles.infoRow}>
                          <dt>Окончание</dt>
                          <dd className={styles.infoValue}>
                            {formatAdminTestDate(test.endDate)}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>

                  {!external ? (
                    <div className={styles.togglesRow}>
                      <Toggle
                        id={`admin-test-published-${testId}`}
                        label="Видимость теста"
                        variant="success"
                        checked={published}
                        disabled={toggleBusy === `${testId}-published`}
                        onChange={(checked) =>
                          handleTogglePublished(testId, checked)
                        }
                      />
                      <Toggle
                        id={`admin-test-visible-${testId}`}
                        label="Показ ответов студентам"
                        variant="success"
                        checked={visible}
                        disabled={toggleBusy === `${testId}-visible`}
                        onChange={(checked) =>
                          handleToggleVisible(testId, checked)
                        }
                      />
                    </div>
                  ) : (
                    <p className={styles.externalNotice}>
                      Внешний тест CPM-LMS — редактирование и переключатели недоступны.
                    </p>
                  )}

                  <div className={styles.cardActions}>
                    {external ? (
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => openExternalDeleteDialog(test)}
                      >
                        Удалить
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                          onClick={() => openWorkspace(testId)}
                        >
                          Открыть
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => openTest(testId, "edit")}
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => openDraftFromTest(testId)}
                        >
                          Драфт в новом редакторе
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => handleDelete(testId)}
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 ? (
            <nav className={styles.pagination} aria-label="Страницы">
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Назад
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`${styles.pageNum} ${currentPage === page ? styles.pageNumActive : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
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
