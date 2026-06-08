"use client";

import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import zapStyles from "@/components/admin/zaps/admin-zaps.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchZapById, processZap, retryZapDate } from "@/lib/zaps/zaps-api";
import {
  formatZapDateShort,
  getZapDateBadgeTone,
  getZapDateStatusLabel,
  isPdfAttachment,
} from "@/lib/zaps/zap-date-utils";
import type { ZapDateItem, ZapImageRecord } from "@/lib/zaps/zaps-types";
import {
  canRetryZapDate,
  formatZapDateTime,
  zapStatusLabel,
} from "@/lib/zaps/zaps-utils";
import { useCallback, useEffect, useState } from "react";

function dateStatusClass(tone: ReturnType<typeof getZapDateBadgeTone>): string {
  if (tone === "success") return zapStyles.dateStatusLinked;
  if (tone === "warning") return zapStyles.dateStatusWarn;
  if (tone === "danger") return zapStyles.dateStatusError;
  return "";
}

function ZapAttachmentViewer({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: ZapImageRecord[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const file = images[index];
  const [zoom, setZoom] = useState(1);
  const isPdf = file
    ? isPdfAttachment(file.file_type, file.img_base64)
    : false;

  if (!file?.img_base64) {
    return null;
  }

  return (
    <div className={zapStyles.viewerOverlay} onClick={onClose}>
      <div
        className={`${zapStyles.viewerModal} ${isPdf ? zapStyles.viewerModalPdf : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={zapStyles.viewerHeader}>
          <span>
            Файл {index + 1} из {images.length}
          </span>
          {isPdf ? (
            <span className={zapStyles.metaMuted}>PDF документ</span>
          ) : (
            <div className={zapStyles.zoomControls}>
              <button
                type="button"
                disabled={zoom <= 0.5}
                onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                disabled={zoom >= 3}
                onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
              >
                +
              </button>
              <button type="button" onClick={() => setZoom(1)}>
                Сброс
              </button>
            </div>
          )}
          <button
            type="button"
            className={zapStyles.viewerCloseBtn}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className={zapStyles.viewerContent}>
          {isPdf ? (
            <iframe
              className={zapStyles.viewerPdfFrame}
              src={file.img_base64}
              title="PDF"
            />
          ) : (
            <img
              src={file.img_base64}
              alt={`Вложение ${index + 1}`}
              style={{ transform: `scale(${zoom})` }}
            />
          )}
        </div>
        <div className={zapStyles.viewerFooter}>
          <button
            type="button"
            className={zapStyles.viewerNavBtn}
            disabled={index === 0}
            onClick={onPrev}
          >
            ← Предыдущий
          </button>
          <button
            type="button"
            className={zapStyles.viewerNavBtn}
            disabled={index >= images.length - 1}
            onClick={onNext}
          >
            Следующий →
          </button>
        </div>
      </div>
    </div>
  );
}

interface AdminZapDetailProps {
  zapId: number;
  onBack: () => void;
  onProcessed: () => void;
}

export function AdminZapDetail({
  zapId,
  onBack,
  onProcessed,
}: AdminZapDetailProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zap, setZap] = useState<Awaited<ReturnType<typeof fetchZapById>> | null>(
    null,
  );
  const [action, setAction] = useState<"apr" | "dec">("apr");
  const [answer, setAnswer] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchZapById(zapId);
      if (!data.status || !data.zap) {
        setZap(null);
        setError(data.error ?? "Запрос не найден");
        return;
      }
      setZap(data);
    } catch (err) {
      setZap(null);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [zapId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleProcess = async () => {
    if (!answer.trim()) {
      setProcessError("Укажите ответ для ученика");
      return;
    }

    setProcessing(true);
    setProcessError(null);
    try {
      const result = await processZap({
        zap_id: zapId,
        status: action,
        answer: answer.trim(),
      });
      if (!result.status) {
        setProcessError(result.error ?? "Не удалось обработать запрос");
        return;
      }
      onProcessed();
      if (action === "dec") {
        onBack();
        return;
      }
      await loadDetail();
    } catch (err) {
      setProcessError(
        err instanceof Error ? err.message : "Ошибка при обработке запроса",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryDate = async (row: ZapDateItem) => {
    if (row.id == null) {
      setError("Не удалось определить дату для повторной привязки");
      return;
    }
    setRetryingId(row.id);
    try {
      const result = await retryZapDate(row.id);
      if (!result.status) {
        setError(result.error ?? "Не удалось повторить привязку");
        return;
      }
      await loadDetail();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка повторной привязки",
      );
    } finally {
      setRetryingId(null);
    }
  };

  const images = zap?.images ?? [];
  const dates = zap?.dates ?? [];
  const zapInfo = zap?.zap;
  const isPending = zapInfo?.status === "set";

  const statusBadgeClass = (status: string) => {
    if (status === "set") return zapStyles.badgePending;
    if (status === "apr") return zapStyles.badgeApproved;
    if (status === "dec") return zapStyles.badgeRejected;
    return zapStyles.badgeNeutral;
  };

  return (
    <div className={styles.page}>
      <AdminFullscreenBack onBack={onBack} label="Назад к списку" />

      {loading ? <LoadingState label="Загрузка запроса…" /> : null}
      {error && !loading ? <p className={zapStyles.errorText}>{error}</p> : null}

      {zapInfo && !loading ? (
        <article className={zapStyles.detailCard}>
          <div>
            <h2 className={styles.detailSectionTitle}>
              Запрос #{zapInfo.id}
            </h2>
            <p className={zapStyles.pageSubtitle}>
              {formatZapDateTime(zapInfo.created_at)}
            </p>
            <span className={statusBadgeClass(zapInfo.status)}>
              {zapStatusLabel(zapInfo.status)}
            </span>
          </div>

          <div className={zapStyles.infoBlock}>
            <h3 className={styles.detailSectionTitle}>Ученик</h3>
            <p className={zapStyles.infoLine}>
              <strong>{zapInfo.full_name ?? "—"}</strong>
            </p>
            <p className={zapStyles.infoLine}>
              ID: <strong>{zapInfo.student_id}</strong>
            </p>
          </div>

          <div>
            <h3 className={styles.detailSectionTitle}>Текст запроса</h3>
            <div className={zapStyles.textBlock}>{zapInfo.text}</div>
          </div>

          {images.length > 0 ? (
            <div>
              <h3 className={styles.detailSectionTitle}>Вложения</h3>
              <div className={zapStyles.attachmentsGrid}>
                {images.map((image, index) =>
                  image.img_base64 ? (
                    <button
                      key={index}
                      type="button"
                      className={zapStyles.attachmentThumb}
                      onClick={() => setViewerIndex(index)}
                    >
                      {isPdfAttachment(image.file_type, image.img_base64) ? (
                        <div className={zapStyles.pdfThumb}>
                          <span aria-hidden>📄</span>
                          <span>PDF</span>
                        </div>
                      ) : (
                        <img src={image.img_base64} alt={`Файл ${index + 1}`} />
                      )}
                    </button>
                  ) : null,
                )}
              </div>
            </div>
          ) : null}

          {zapInfo.answer ? (
            <div>
              <h3 className={styles.detailSectionTitle}>Ответ администратора</h3>
              <div className={zapStyles.textBlock}>{zapInfo.answer}</div>
            </div>
          ) : null}

          {dates.length > 0 ? (
            <div>
              <h3 className={styles.detailSectionTitle}>Даты отгула</h3>
              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Статус</th>
                      <th aria-label="Действия" />
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map((row, index) => (
                      <tr key={row.id ?? `${row.date}-${index}`}>
                        <td>{formatZapDateShort(row.date)}</td>
                        <td>
                          <span
                            className={dateStatusClass(
                              getZapDateBadgeTone(row.status),
                            )}
                          >
                            {getZapDateStatusLabel(row.status, row.status_label)}
                          </span>
                          {row.error_message ? (
                            <p className={zapStyles.metaMuted}>
                              {row.error_message}
                            </p>
                          ) : null}
                        </td>
                        <td>
                          {canRetryZapDate(zapInfo.status, row.status) &&
                          row.id != null ? (
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={retryingId === row.id}
                              onClick={() => void handleRetryDate(row)}
                            >
                              {retryingId === row.id
                                ? "Привязка…"
                                : "Привязать снова"}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {isPending ? (
            <div className={zapStyles.processBlock}>
              <h3 className={styles.detailSectionTitle}>Обработка запроса</h3>
              <div className={zapStyles.actionRow}>
                <button
                  type="button"
                  className={`${zapStyles.actionBtn} ${action === "apr" ? zapStyles.actionBtnActive : ""}`}
                  onClick={() => setAction("apr")}
                >
                  Одобрить
                </button>
                <button
                  type="button"
                  className={`${zapStyles.actionBtn} ${action === "dec" ? zapStyles.actionBtnActive : ""}`}
                  onClick={() => setAction("dec")}
                >
                  Отклонить
                </button>
              </div>
              <label className={zapStyles.filterLabel} htmlFor="zap-answer">
                Ответ ученику
              </label>
              <textarea
                id="zap-answer"
                className={zapStyles.answerArea}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Введите ответ…"
                rows={4}
              />
              {processError ? (
                <p className={zapStyles.errorText}>{processError}</p>
              ) : null}
              <div>
                <Button
                  type="button"
                  disabled={processing}
                  onClick={() => void handleProcess()}
                >
                  {processing ? "Обработка…" : "Обработать запрос"}
                </Button>
              </div>
            </div>
          ) : null}
        </article>
      ) : null}

      {viewerIndex != null && images[viewerIndex]?.img_base64 ? (
        <ZapAttachmentViewer
          images={images}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex((value) => Math.max(0, (value ?? 0) - 1))}
          onNext={() =>
            setViewerIndex((value) =>
              Math.min(images.length - 1, (value ?? 0) + 1),
            )
          }
        />
      ) : null}
    </div>
  );
}
