"use client";

import { AdminCardsUploadPreview } from "@/components/admin/upload/admin-cards-upload-preview";
import styles from "@/components/admin/upload/admin-upload.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchAdminDirections } from "@/lib/admin/admin-tests-api";
import type { Direction } from "@/lib/admin/admin-tests-types";
import {
  commitCardImportSession,
  parseCardImportFile,
  updateCardImportSession,
} from "@/lib/admin/admin-upload-api";
import { downloadCardsImportTemplate } from "@/lib/admin/admin-upload-export";
import {
  ADMIN_UPLOAD_ACCEPT,
  formatUploadFileSize,
  type CardImportPreview,
  type CardImportPreviewCard,
  type UserImportJob,
} from "@/lib/admin/admin-upload-types";
import { fetchAdminTrainingCatalog } from "@/lib/training/admin-training-api";
import type {
  AdminTrainingDirectionRow,
  AdminTrainingSectionRow,
} from "@/lib/training/admin-training-types";
import { FileSpreadsheet, FileUp, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface AdminCardsUploadPanelProps {
  onCommitted: (job: UserImportJob) => void;
}

function isXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || file.type.includes("spreadsheetml");
}

export function AdminCardsUploadPanel({ onCommitted }: AdminCardsUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  const [directions, setDirections] = useState<Direction[]>([]);
  const [sections, setSections] = useState<AdminTrainingSectionRow[]>([]);
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [sectionMode, setSectionMode] = useState<"existing" | "new">("existing");
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [newThemeName, setNewThemeName] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [preview, setPreview] = useState<CardImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      setCatalogLoading(true);
      setError(null);
      try {
        const [directionsResponse, catalogDirections] = await Promise.all([
          fetchAdminDirections(),
          fetchAdminTrainingCatalog(),
        ]);
        if (!mounted) {
          return;
        }
        setDirections(directionsResponse ?? []);
        const manualSections = catalogDirections.flatMap(
          (direction: AdminTrainingDirectionRow) =>
            (direction.sections ?? direction.topics ?? [])
              .filter(
                (section: AdminTrainingSectionRow) =>
                  section.kind === "manual" && section.id != null,
              )
              .map((section: AdminTrainingSectionRow) => ({
                ...section,
                direction_id: direction.id,
              })),
        );
        setSections(manualSections);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить каталог");
        }
      } finally {
        if (mounted) {
          setCatalogLoading(false);
        }
      }
    }
    void loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const manualSectionsForDirection = useMemo(() => {
    if (!selectedDirectionId) {
      return [];
    }
    const directionId = Number(selectedDirectionId);
    return sections.filter((section) => section.direction_id === directionId);
  }, [sections, selectedDirectionId]);

  const canUploadFile =
    Boolean(selectedDirectionId) &&
    (sectionMode === "existing"
      ? Boolean(selectedThemeId)
      : Boolean(newThemeName.trim()));

  const resetUpload = () => {
    setFile(null);
    setSessionId(null);
    setSourceFilename(null);
    setPreview(null);
    setError(null);
  };

  const persistPreview = useCallback(
    async (nextPreview: CardImportPreview) => {
      if (!sessionId) {
        return;
      }
      setSaving(true);
      try {
        const response = await updateCardImportSession(sessionId, nextPreview);
        setPreview(response.preview);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка сохранения preview");
      } finally {
        setSaving(false);
      }
    },
    [sessionId],
  );

  const handleCardChange = (
    row: number,
    patch: Partial<Pick<CardImportPreviewCard, "question" | "answer" | "action">>,
  ) => {
    if (!preview) {
      return;
    }

    const cards = preview.cards.map((card) => {
      if (card.row !== row) {
        return card;
      }
      return { ...card, ...patch };
    });

    const nextPreview = { ...preview, cards };
    setPreview(nextPreview);

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void persistPreview(nextPreview);
    }, 450);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleParse = async (nextFile: File) => {
    if (!isXlsxFile(nextFile)) {
      window.alert("Выберите файл .xlsx");
      return;
    }
    if (!selectedDirectionId) {
      window.alert("Выберите направление");
      return;
    }
    if (sectionMode === "existing" && !selectedThemeId) {
      window.alert("Выберите раздел");
      return;
    }
    if (sectionMode === "new" && !newThemeName.trim()) {
      window.alert("Укажите название нового раздела");
      return;
    }

    setParsing(true);
    setError(null);
    try {
      const response = await parseCardImportFile(
        nextFile,
        Number(selectedDirectionId),
        sectionMode === "new"
          ? { createNewTheme: true, newThemeName: newThemeName.trim() }
          : { themeId: Number(selectedThemeId) },
      );
      if (!response.status) {
        throw new Error("Не удалось разобрать файл");
      }
      setFile(nextFile);
      setSessionId(response.session_id);
      setSourceFilename(nextFile.name);
      setPreview(response.preview);
    } catch (err) {
      resetUpload();
      setError(err instanceof Error ? err.message : "Ошибка разбора файла");
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async () => {
    if (!sessionId || !preview) {
      return;
    }
    setCommitting(true);
    setError(null);
    try {
      await updateCardImportSession(sessionId, preview);
      const response = await commitCardImportSession(sessionId);
      onCommitted(response.job);
      resetUpload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить импорт");
    } finally {
      setCommitting(false);
    }
  };

  if (preview && sessionId) {
    return (
      <>
        {error ? <div className={testStyles.stateBox}>{error}</div> : null}
        <AdminCardsUploadPreview
          preview={preview}
          sourceFilename={sourceFilename}
          saving={saving}
          committing={committing}
          onCardChange={handleCardChange}
          onCommit={() => void handleCommit()}
          onReset={resetUpload}
        />
      </>
    );
  }

  return (
    <div className={styles.main}>
      <div className={styles.mainHeader}>
        <div>
          <h2 className={styles.mainTitle}>Карточки</h2>
          <p className={styles.mainDesc}>
            Импорт manual-карточек в существующий или новый раздел выбранного
            направления. Новый раздел создаётся при запуске загрузки.
          </p>
        </div>
      </div>

      {error ? <div className={testStyles.stateBox}>{error}</div> : null}

      <div className={styles.metaGrid}>
        <label className={styles.fieldGroup}>
          <span className={styles.blockTitle}>Направление</span>
          <select
            className={testStyles.searchInput}
            value={selectedDirectionId}
            disabled={catalogLoading}
            onChange={(event) => {
              setSelectedDirectionId(event.target.value);
              setSelectedThemeId("");
              resetUpload();
            }}
          >
            <option value="">Выберите направление</option>
            {directions.map((direction) => (
              <option key={direction.id} value={direction.id}>
                {direction.name}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.fieldGroup}>
          <span className={styles.blockTitle}>Раздел</span>
          <div className={styles.radioRow}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="section-mode"
                checked={sectionMode === "existing"}
                onChange={() => {
                  setSectionMode("existing");
                  resetUpload();
                }}
              />
              Существующий
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="section-mode"
                checked={sectionMode === "new"}
                onChange={() => {
                  setSectionMode("new");
                  setSelectedThemeId("");
                  resetUpload();
                }}
              />
              Новый
            </label>
          </div>
          {sectionMode === "existing" ? (
            <select
              className={testStyles.searchInput}
              value={selectedThemeId}
              disabled={!selectedDirectionId || catalogLoading}
              onChange={(event) => {
                setSelectedThemeId(event.target.value);
                resetUpload();
              }}
            >
              <option value="">
                {selectedDirectionId
                  ? "Выберите раздел"
                  : "Сначала выберите направление"}
              </option>
              {manualSectionsForDirection.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                  {section.cards_count != null ? ` (${section.cards_count})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className={testStyles.searchInput}
              placeholder="Название нового раздела"
              value={newThemeName}
              disabled={!selectedDirectionId || catalogLoading}
              onChange={(event) => {
                setNewThemeName(event.target.value);
                resetUpload();
              }}
            />
          )}
        </div>
      </div>

      {sectionMode === "existing" &&
      selectedDirectionId &&
      manualSectionsForDirection.length === 0 ? (
        <div className={styles.notice}>
          В этом направлении нет manual-разделов. Выберите режим «Новый» или
          создайте раздел в «Карточки».
        </div>
      ) : null}

      <section className={styles.instructions} aria-labelledby="cards-upload-instructions">
        <h3 id="cards-upload-instructions" className={styles.blockTitle}>
          Формат файла
        </h3>
        <p className={styles.hint}>
          Первая строка — заголовки «Вопрос» и «Ответ». Каждая следующая строка — одна карточка.
          Несколько вариантов ответа пишите в одной ячейке через ;, / или запятую — текст
          сохранится целиком.
        </p>
      </section>

      <input
        ref={inputRef}
        type="file"
        className={styles.fileInput}
        accept={ADMIN_UPLOAD_ACCEPT}
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) {
            void handleParse(next);
          }
        }}
      />

      {parsing ? (
        <LoadingState label="Разбор файла…" variant="block" className={testStyles.stateBox} />
      ) : file ? (
        <div className={styles.fileRow}>
          <div className={styles.fileInfo}>
            <FileSpreadsheet className={styles.fileIcon} size={22} aria-hidden />
            <div className={styles.fileMeta}>
              <p className={styles.fileName}>{file.name}</p>
              <p className={styles.fileSize}>{formatUploadFileSize(file.size)}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={resetUpload}>
            <X size={16} aria-hidden />
            Убрать
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={canUploadFile ? 0 : -1}
          className={`${styles.dropzone} ${!canUploadFile ? styles.dropzoneDisabled : ""}`.trim()}
          onClick={() => {
            if (canUploadFile) {
              inputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if (!canUploadFile) {
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <span className={styles.dropzoneIcon}>
            <Upload size={24} aria-hidden />
          </span>
          <p className={styles.dropzoneTitle}>
            {canUploadFile
              ? "Перетащите .xlsx или выберите файл"
              : sectionMode === "new"
                ? "Сначала выберите направление и укажите название раздела"
                : "Сначала выберите направление и раздел"}
          </p>
          <p className={styles.dropzoneText}>Колонки: Вопрос, Ответ</p>
        </div>
      )}

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={downloadCardsImportTemplate}>
          Скачать шаблон
        </Button>
        <Button type="button" disabled={!canUploadFile || parsing}>
          <FileUp size={16} aria-hidden />
          {canUploadFile ? "Выберите файл выше" : "Заполните параметры импорта"}
        </Button>
      </div>
    </div>
  );
}
