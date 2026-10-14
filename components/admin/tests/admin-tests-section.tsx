"use client";

import { BFF_DEV } from "@/lib/config";
import { domain } from "@/lib/bff/client";
import { testsCatalog, testsAction } from "@/lib/bff/tests-admin";
import { useContextGuard } from "@/lib/bff/use-context-guard";

import { EditOnly, ReadOnlyControl, useAdminSectionAccess } from "@/components/admin/admin-section-access";

import { AdminTestCalculationSettings } from "@/components/admin/tests/admin-test-calculation-settings";
import { AdminCreateTestMenu } from "@/components/admin/tests/admin-create-test-menu";
import { AdminDirectionCombobox } from "@/components/admin/tests/admin-direction-combobox";
import { AdminExternalTestDeleteDialog } from "@/components/admin/tests/admin-external-test-delete-dialog";
import { AdminExternalTestForm } from "@/components/admin/tests/admin-external-test-form";
import { AdminExternalTestWorkspace } from "@/components/admin/tests/admin-external-test-workspace";
import { AdminTestCardActions } from "@/components/admin/tests/admin-test-card-actions";
import {
  AdminTestCardSchedule,
  AdminTestStatusBadge,
} from "@/components/admin/tests/admin-test-card-meta";
import { AdminTestDraftPreview } from "./admin-test-draft-preview";
import { AdminTestDraftEditor } from "@/components/admin/tests/admin-test-draft-editor";
import { AdminTestForm } from "@/components/admin/tests/admin-test-form";
import { AdminTestWorkspace } from "@/components/admin/tests/admin-test-workspace";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { Button } from "@/components/ui/button";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { FilterPopover } from "@/components/ui/filter-popover";
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
  "externalWorkspace",
  "draftEditor",
];

const PAGE_SIZE = 6;

export function AdminTestsSection() {
  const searchParams = useSearchParams();
  const { canEdit } = useAdminSectionAccess("tests");
  const openedFromUrlRef = useRef(false);
  const catalogGeneration = useRef(0);
  const [catalogMode, setCatalogMode] = useState<"division"|"bank">("division");
  const [relation, setRelation] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState("false");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [divisions, setDivisions] = useState<{id:number;name:string}[]>([]);
  const [actionBusy, setActionBusy] = useState<string|null>(null);
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
    const generation=++catalogGeneration.current;
    if (!direction && !BFF_DEV) {
      setTests([]);
      return;
    }

    setLoadingTests(true);
    setError(null);

    try {
      const data = BFF_DEV ? await testsCatalog({bank:catalogMode==="bank",direction,relation,ownerDivisionId:ownerFilter,archived:archiveFilter}) : await fetchAdminTestsByDirection(direction);
      if(generation!==catalogGeneration.current)return;
      setTests(Array.isArray(data) ? data : []);
    } catch (err) {
      if(generation!==catalogGeneration.current)return;
      setTests([]);
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить тесты",
      );
    } finally {
      if(generation===catalogGeneration.current)setLoadingTests(false);
    }
  }, [catalogMode, relation, ownerFilter, archiveFilter]);

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const data = await fetchAdminTestDrafts("active");
      setDrafts(Array.isArray(data) ? data : []);
    } catch (err) {
      setDrafts([]);
      setError(err instanceof Error ? err.message : "Не удалось загрузить черновики");
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
        if (list.length > 0 && !BFF_DEV) {
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
    if(BFF_DEV) void domain<{id:number;name:string}[]>("/core/divisions").then(setDivisions).catch(() => {});
    const draftTimer = window.setTimeout(() => {
      loadDrafts();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(draftTimer);
    };
  }, [loadDrafts]);

  useEffect(() => {
    if (directionName || BFF_DEV) {
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
  }, [searchTerm, statusFilter, dateFilter, directionName, catalogMode, relation, archiveFilter, ownerFilter]);

  useContextGuard(["create","createExternal","edit","draftEditor"].includes(view) || actionBusy!==null || externalDeleting);

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
        BFF_DEV ? "Архивировать общий тест? Прохождение закроется во всех подключённых подразделениях. Тест можно восстановить." : "Удалить тест? Будут удалены связанные сессии. Действие необратимо.",
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
      const saved=await patchAdminTestFields(testId, { published });
      if(BFF_DEV)patchTestInList(testId,{revision:saved.revision});
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
      const saved=await patchAdminTestFields(testId, { visible });
      if(BFF_DEV)patchTestInList(testId,{revision:saved.revision});
    } catch (err) {
      patchTestInList(testId, { visible: !visible });
      window.alert(
        err instanceof Error ? err.message : "Не удалось изменить доступ к ответам",
      );
    } finally {
      setToggleBusy(null);
    }
  };

  const runCatalogAction = async (test: AdminTestListItem, action: Parameters<typeof testsAction>[1]) => {
    const label = {attach:"Подключить общий тест к текущему подразделению? Настройки будут скрытыми.",copy:"Создать независимую копию со всеми вопросами? Новая копия будет скрытой.",detach:"Снять подключение в текущем подразделении?",archive:"Архивировать тест во всех подразделениях?",restore:"Восстановить тест?", "bank-open":"Открыть тест в банке организации?", "bank-close":"Закрыть тест в банке? Существующие подключения сохранятся."}[action];
    if(!window.confirm(label)) return;
    setActionBusy(test.id);
    try {await testsAction(test.id,action,test.revision);await loadTests(directionName);}
    catch(err){window.alert(err instanceof Error?err.message:"Не удалось изменить тест");}
    finally{setActionBusy(null);}
  };

  const clearFilters = () => {
    setSearchTerm("");
    setRelation("all");setOwnerFilter("");setArchiveFilter("false");
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

  if (view === "externalWorkspace" && workspaceTestId) {
    return <AdminExternalTestWorkspace testId={workspaceTestId} onBack={() => { setView("list"); setWorkspaceTestId(null); void loadTests(directionName); }} />;
  }

  if (view === "draftEditor" && editingDraft) {
    if (!canEdit) return <AdminTestDraftPreview draft={editingDraft} onBack={() => { setView("list"); setEditingDraft(null); }} />;
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
                <EditOnly><Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void openNewDraft();
                  }}
                >
                  <Plus size={15} aria-hidden />
                  Новый драфт
                </Button></EditOnly>
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
                      <EditOnly><button
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
                      </button></EditOnly>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </DismissibleOverlay>
      ) : null}

      <header className={styles.listPageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Тесты</h1>
          <p className={styles.pageDescription}>Создавайте тесты и управляйте доступом учеников.</p>
        </div>
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
          <EditOnly><AdminCreateTestMenu
            onCreateTest={() => {
              setEditingTest(null);
              setView("create");
            }}
            onCreateExternal={() => {
              setEditingTest(null);
              setView("createExternal");
            }}
          /></EditOnly>
        </div>
      </header>

      {BFF_DEV ? <AdminTestCalculationSettings /> : null}
      {BFF_DEV ? <nav className={styles.workspaceTabs} aria-label="Область тестов">
        <button type="button" className={`${styles.workspaceTab} ${catalogMode==="division"?styles.workspaceTabActive:""}`} onClick={()=>setCatalogMode("division")}>Тесты подразделения</button>
        <button type="button" className={`${styles.workspaceTab} ${catalogMode==="bank"?styles.workspaceTabActive:""}`} onClick={()=>setCatalogMode("bank")}>Банк организации</button>
      </nav> : null}
      <div className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          {BFF_DEV ? <label className={styles.dateField}><span className={styles.fieldLabel}>Направление</span><select className={styles.filterSelect} value={directionName} onChange={e=>setDirectionName(e.target.value)} disabled={loadingDirections}><option value="">Все направления</option>{directions.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}</select></label> : loadingDirections ? (
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

          {BFF_DEV ? <>
            <label className={styles.dateField}><span className={styles.fieldLabel}>Связь с подразделением</span><select className={styles.filterSelect} value={relation} onChange={e=>setRelation(e.target.value)}><option value="all">Все</option><option value="owned">Свои</option><option value="attached">Подключённые</option><option value="copy">Независимые копии</option></select></label>
            <label className={styles.dateField}><span className={styles.fieldLabel}>Владелец</span><select className={styles.filterSelect} value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)}><option value="">Все подразделения</option>{divisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className={styles.dateField}><span className={styles.fieldLabel}>Архив</span><select className={styles.filterSelect} value={archiveFilter} onChange={e=>setArchiveFilter(e.target.value)}><option value="false">Действующие</option><option value="true">Архивные</option><option value="all">Все</option></select></label>
          </> : null}
          <FilterPopover
            activeCount={Number(statusFilter !== "all") + Number(Boolean(dateFilter.startDate)) + Number(Boolean(dateFilter.endDate))}
            onReset={() => {
              setStatusFilter("all");
              setDateFilter({ startDate: "", endDate: "" });
            }}
          >
            <label className={styles.dateField}>
              <span className={styles.fieldLabel}>Статус</span>
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AdminTestStatusFilter)}
              >
                {([
                  ["all", "Все статусы"],
                  ["active", "Активные"],
                  ["upcoming", "Скоро"],
                  ["ended", "Завершённые"],
                  ...(BFF_DEV ? [["hidden", "Скрытые"], ["archived", "Архивные"], ["bank", "В банке"], ["external", "Вне системы"]] as const : [["external", "Вне системы"]] as const),
                ] as const).map(([key, label]) => (
                  <option key={key} value={key}>{label} · {countByStatus(key)}</option>
                ))}
              </select>
            </label>
            <div className={styles.filterFieldsGrid}>
              <label className={styles.listDateField}>
                <span className={styles.listFieldLabel}>С даты</span>
                <input
                  type="date"
                  className={styles.listDateInput}
                  value={dateFilter.startDate}
                  max={dateFilter.endDate || undefined}
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
                  min={dateFilter.startDate || undefined}
                  onChange={(e) =>
                    setDateFilter((f) => ({ ...f, endDate: e.target.value }))
                  }
                />
              </label>
            </div>
          </FilterPopover>
        </div>
      </div>

      {!loadingTests && !error ? <p className={styles.resultsSummary}>Найдено тестов: <strong>{filteredTests.length}</strong>{filteredTests.length !== tests.length ? ` из ${tests.length}` : ""}</p> : null}

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
              <EditOnly><Button type="button" size="sm" onClick={() => setView("create")}>
                Создать первый тест
              </Button></EditOnly>
              {!BFF_DEV ? <EditOnly><button
                type="button"
                className={styles.headerGhostBtn}
                onClick={() => setView("createExternal")}
              >
                Вне системы
              </button></EditOnly> : null}
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

                  {BFF_DEV ? <p className={styles.panelHint}>{external ? `${test.directionName} · внешний тест выбранного подразделения` : <>{test.directionName} · владелец: {test.ownerDivisionName}<br />{test.isArchived?"Архивирован":test.isOwner?"Свой тест":test.isAttached?"Общее подключение":"Доступен в банке"}{test.origin?" · независимая копия":""} · {test.questionCount} вопросов</>}</p> : null}
                  <AdminTestCardSchedule
                    external={external}
                    date={test.date}
                    startDate={test.startDate}
                    endDate={test.endDate}
                    timeLimitMinutes={test.timeLimitMinutes}
                  />

                  {!external && (!BFF_DEV || (test.isAttached && !test.isArchived)) ? (
                    <div className={styles.togglesRow}>
                      <ReadOnlyControl><Toggle
                        id={`admin-test-published-${testId}`}
                        label="Видимость теста"
                        variant="success"
                        checked={published}
                        disabled={toggleBusy === `${testId}-published` || (BFF_DEV && !test.actions?.can_edit_settings)}
                        onChange={(checked) =>
                          handleTogglePublished(testId, checked)
                        }
                      /></ReadOnlyControl>
                      <ReadOnlyControl><Toggle
                        id={`admin-test-visible-${testId}`}
                        label="Показ ответов студентам"
                        variant="success"
                        checked={visible}
                        disabled={toggleBusy === `${testId}-visible` || (BFF_DEV && !test.actions?.can_edit_settings)}
                        onChange={(checked) =>
                          handleToggleVisible(testId, checked)
                        }
                      /></ReadOnlyControl>
                    </div>
                  ) : external ? (
                    <p className={styles.externalNotice}>
                      {BFF_DEV ? "Результаты внешнего теста хранятся в выбранном подразделении." : "Внешний тест CPM-LMS — редактирование недоступно."}
                    </p>
                  ) : null}

                  <AdminTestCardActions
                    external={external}
                    canEditClassic={!BFF_DEV || Boolean(test.actions?.can_edit_metadata||test.actions?.can_edit_settings)}
                    canEditNew={!BFF_DEV || Boolean(test.actions?.can_edit_metadata)}
                    canDelete={external && BFF_DEV ? Boolean(test.externalActions?.can_delete) : !BFF_DEV}
                    canOpenExternal={external && BFF_DEV}
                    onOpen={() => { if (external && BFF_DEV) { setWorkspaceTestId(testId); setView("externalWorkspace"); } else openWorkspace(testId); }}
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
                  {BFF_DEV ? <div className={styles.listCardActions}>
                    {test.actions?.can_attach ? <Button size="sm" variant="ghost" disabled={actionBusy===test.id} onClick={()=>void runCatalogAction(test,"attach")}>Подключить</Button> : null}
                    {test.actions?.can_copy ? <Button size="sm" variant="ghost" disabled={actionBusy===test.id} onClick={()=>void runCatalogAction(test,"copy")}>Независимая копия</Button> : null}
                    {test.actions?.can_detach ? <Button size="sm" variant="ghost" disabled={actionBusy===test.id} onClick={()=>void runCatalogAction(test,"detach")}>Снять подключение</Button> : null}
                    {test.actions?.can_manage_bank ? <Button size="sm" variant="ghost" disabled={actionBusy===test.id} onClick={()=>void runCatalogAction(test,test.bankAvailable?"bank-close":"bank-open")}>{test.bankAvailable?"Закрыть банк":"Открыть в банк"}</Button> : null}
                    {test.actions?.can_archive ? <Button size="sm" variant="ghost" disabled={actionBusy===test.id} onClick={()=>void runCatalogAction(test,test.isArchived?"restore":"archive")}>{test.isArchived?"Восстановить":"Архивировать"}</Button> : null}
                  </div> : null}
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
