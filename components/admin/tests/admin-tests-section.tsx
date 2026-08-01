"use client";

import { AdminCreateTestMenu } from "@/components/admin/tests/admin-create-test-menu";
import { AdminDirectionCombobox } from "@/components/admin/tests/admin-direction-combobox";
import { AdminExternalTestDeleteDialog } from "@/components/admin/tests/admin-external-test-delete-dialog";
import { AdminExternalTestForm } from "@/components/admin/tests/admin-external-test-form";
import { AdminTestCardActions } from "@/components/admin/tests/admin-test-card-actions";
import {
  AdminTestCardSchedule,
  AdminTestStatusBadge,
} from "@/components/admin/tests/admin-test-card-meta";
import { AdminTestDraftEditor } from "@/components/admin/tests/admin-test-draft-editor";
import { AdminTestForm } from "@/components/admin/tests/admin-test-form";
import { AdminTestWorkspace } from "@/components/admin/tests/admin-test-workspace";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { Button } from "@/components/ui/button";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
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
import { testDetailToCanvasState } from "@/lib/admin/admin-test-canvas-adapter";
import {
  createAdminTestDraft,
  deleteAdminTestDraft,
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
  getAdminTestStatus,
} from "@/lib/admin/admin-tests-utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileStack, Plus, Trash2, X } from "lucide-react";

const IMMERSIVE_VIEWS: AdminTestsView[] = [
  "create",
  "createExternal",
  "edit",
  "view",
  "workspace",
  "draftEditor",
];

const PAGE_SIZE = 6;

export function AdminTestsSection() {
  const searchParams = useSearchParams();
  const openedFromUrlRef = useRef(false);
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
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [draftEditorMode, setDraftEditorMode] = useState<"draft" | "testEdit">(
    "draft",
  );
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [externalDeleteTarget, setExternalDeleteTarget] =
    useState<AdminTestListItem | null>(null);
  const [externalDeleting, setExternalDeleting] = useState(false);
  const [externalDeleteError, setExternalDeleteError] = useState<string | null>(
    null,
  );
  const [draftsOpen, setDraftsOpen] = useState(false);
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

  useEffect(() => {
    if (!draftsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDraftsOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [draftsOpen]);

  useEffect(() => {
    if (openedFromUrlRef.current || loadingDirections) return;

    const direction = searchParams.get("direction");
    const testId = searchParams.get("test");
    if (!direction && !testId) return;

    openedFromUrlRef.current = true;
    if (direction) {
      setDirectionName(direction);
    }
    if (testId) {
      setWorkspaceTestId(testId);
      setView("workspace");
    }
  }, [loadingDirections, searchParams]);

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
      setDraftsOpen(false);
      setEditingDraft(draft);
      setDraftEditorMode("draft");
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
      const detail = await fetchAdminTestById(testId);
      setEditingDraft(testDetailToCanvasState(detail));
      setEditingTestId(testId);
      setDraftEditorMode("testEdit");
      setView("draftEditor");
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось открыть тест в редакторе",
      );
    }
  };

  const handleDeleteDraft = async (draft: AdminTestDraft) => {
    const title = draft.title?.trim() || "Без названия";
    if (
      !window.confirm(
        `Удалить драфт «${title}»? Черновик будет удалён без возможности восстановления.`,
      )
    ) {
      return;
    }

    setDeletingDraftId(draft.id);
    try {
      await deleteAdminTestDraft(draft.id);
      if (editingDraft?.id === draft.id) {
        setEditingDraft(null);
        setView("list");
      }
      await loadDrafts();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось удалить драфт",
      );
    } finally {
      setDeletingDraftId(null);
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
          onEditInNew={(testId) => {
            void openDraftFromTest(testId);
          }}
      />
    );
  }

  if (view === "draftEditor" && editingDraft) {
    const isTestEdit = draftEditorMode === "testEdit" && editingTestId;

    return (
      <AdminTestDraftEditor
        draft={editingDraft}
        directions={directions}
        persistenceMode={isTestEdit ? "test" : "draft"}
        sourceTestId={isTestEdit ? editingTestId : undefined}
        disableQuestionReorder={Boolean(isTestEdit)}
        onBack={() => {
          setView("list");
          setEditingDraft(null);
          setEditingTestId(null);
          setDraftEditorMode("draft");
          if (!isTestEdit) {
            loadDrafts();
          }
        }}
        onPublished={(testId) => {
          setView("list");
          setEditingDraft(null);
          setEditingTestId(null);
          setDraftEditorMode("draft");
          loadDrafts();
          loadTests(directionName);
          openWorkspace(testId);
        }}
        onTestSaved={() => {
          loadTests(directionName);
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

      {draftsOpen ? (
        <DismissibleOverlay
          className={styles.draftsOverlay}
          onDismiss={() => setDraftsOpen(false)}
        >
          <aside
            className={styles.draftsDrawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-drafts-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.draftsDrawerHead}>
              <div>
                <h2 id="admin-drafts-title">Драфты</h2>
                <p>Черновики нового редактора с автосохранением</p>
              </div>
              <button
                type="button"
                className={styles.draftsDrawerClose}
                aria-label="Закрыть"
                onClick={() => setDraftsOpen(false)}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <div className={styles.draftsDrawerBody}>
              <div className={styles.draftsDrawerActions}>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void openNewDraft();
                  }}
                >
                  <Plus size={15} aria-hidden />
                  Новый драфт
                </Button>
                <button
                  type="button"
                  className={styles.headerGhostBtn}
                  onClick={() => {
                    void loadDrafts();
                  }}
                >
                  Обновить
                </button>
              </div>
              {loadingDrafts ? (
                <p className={styles.panelHint}>Загрузка драфтов…</p>
              ) : drafts.length === 0 ? (
                <p className={styles.panelHint}>Активных драфтов пока нет</p>
              ) : (
                <div className={styles.draftsList}>
                  {drafts.map((draft) => (
                    <article
                      key={draft.id}
                      className={styles.draftItemCard}
                      onClick={() => {
                        setEditingDraft(draft);
                        setDraftEditorMode("draft");
                        setDraftsOpen(false);
                        setView("draftEditor");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setEditingDraft(draft);
                          setDraftEditorMode("draft");
                          setDraftsOpen(false);
                          setView("draftEditor");
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <strong>{draft.title || "Без названия"}</strong>
                      {draft.source?.kind === "manual_cards" ? (
                        <span className={`${styles.badge} ${styles.badgeUpcoming}`}>
                          Из карточек: {draft.source.themeName || "раздел"}
                        </span>
                      ) : null}
                      <span>
                        {draft.canvas?.questions?.length ?? 0} вопросов ·{" "}
                        {draft.direction || "направление не выбрано"}
                      </span>
                      <button
                        type="button"
                        className={styles.draftDeleteButton}
                        aria-label="Удалить драфт"
                        disabled={deletingDraftId === draft.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteDraft(draft);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </DismissibleOverlay>
      ) : null}

      <header className={styles.listPageHeader}>
        <h1 className={styles.pageTitle}>Управление тестами</h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerGhostBtn}
            onClick={() => {
              setDraftsOpen(true);
              void loadDrafts();
            }}
          >
            <FileStack size={15} aria-hidden />
            Драфты
            {drafts.length > 0 ? (
              <span className={styles.draftsTriggerBadge}>{drafts.length}</span>
            ) : null}
          </button>
          <AdminCreateTestMenu
            onCreateTest={() => {
              setEditingTest(null);
              setView("create");
            }}
            onCreateExternal={() => {
              setEditingTest(null);
              setView("createExternal");
            }}
          />
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          {loadingDirections ? (
            <p className={styles.panelHint}>Загрузка направлений…</p>
          ) : directions.length === 0 ? (
            <p className={styles.panelHint}>Направления не найдены</p>
          ) : (
            <AdminDirectionCombobox
              directions={directions}
              value={directionName}
              onChange={setDirectionName}
              loading={loadingDirections}
            />
          )}

          <label className={styles.searchField}>
            <span className={styles.listFieldLabel}>Поиск</span>
            <input
              type="search"
              className={styles.listSearchInput}
              placeholder="Название теста…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>

          <label className={styles.listDateField}>
            <span className={styles.listFieldLabel}>С даты</span>
            <input
              type="date"
              className={styles.listDateInput}
              value={dateFilter.startDate}
              onChange={(e) =>
                setDateFilter((f) => ({ ...f, startDate: e.target.value }))
              }
            />
          </label>
          <label className={styles.listDateField}>
            <span className={styles.listFieldLabel}>По дату</span>
            <input
              type="date"
              className={styles.listDateInput}
              value={dateFilter.endDate}
              onChange={(e) =>
                setDateFilter((f) => ({ ...f, endDate: e.target.value }))
              }
            />
          </label>
        </div>

        <div className={styles.listStatusFilters}>
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
              className={`${styles.listFilterChip} ${statusFilter === key ? styles.listFilterChipActive : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              {label} ({countByStatus(key)})
            </button>
          ))}
          <button
            type="button"
            className={styles.listClearBtn}
            disabled={
              !searchTerm &&
              !dateFilter.startDate &&
              !dateFilter.endDate &&
              statusFilter === "all"
            }
            onClick={clearFilters}
          >
            Очистить
          </button>
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
              <Button type="button" size="sm" onClick={() => setView("create")}>
                Создать первый тест
              </Button>
              <button
                type="button"
                className={styles.headerGhostBtn}
                onClick={() => setView("createExternal")}
              >
                Вне системы
              </button>
            </div>
          ) : (
            <button type="button" className={styles.listClearBtn} onClick={clearFilters}>
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.listCardsGrid}>
            {paginatedTests.map((test) => {
              const testId = getAdminTestId(test);
              const external = isAdminExternalTest(test);
              const status = getAdminTestStatus(test);
              const published = test.published ?? true;
              const visible = test.visible ?? false;

              return (
                <article
                  key={testId}
                  className={`${styles.listCard} ${external ? styles.listCardExternal : ""}`}
                >
                  <div className={styles.listCardHead}>
                    <AdminTestStatusBadge status={status} />
                    <h3 className={styles.listCardTitle}>{getAdminTestTitle(test)}</h3>
                  </div>

                  <AdminTestCardSchedule
                    external={external}
                    date={test.date}
                    startDate={test.startDate}
                    endDate={test.endDate}
                    timeLimitMinutes={test.timeLimitMinutes}
                  />

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
                      Внешний тест CPM-LMS — редактирование недоступно.
                    </p>
                  )}

                  <AdminTestCardActions
                    external={external}
                    onOpen={() => openWorkspace(testId)}
                    onEditClassic={() => {
                      void openTest(testId, "edit");
                    }}
                    onEditNew={() => {
                      void openDraftFromTest(testId);
                    }}
                    onDelete={() => {
                      if (external) {
                        openExternalDeleteDialog(test);
                      } else {
                        void handleDelete(testId);
                      }
                    }}
                  />
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
