"use client";

import attendanceStyles from "@/components/admin/attendance/admin-attendance.module.css";
import zapStyles from "@/components/admin/zaps/admin-zaps.module.css";
import reportStyles from "@/components/admin/attendance/report/report.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { unlinkZapDate } from "@/lib/attendance/attendance-report-api";
import {
  formatZapDateShort,
  getZapDateBadgeTone,
  getZapDateStatusLabel,
  isPdfAttachment,
} from "@/lib/zaps/zap-date-utils";
import { fetchZapById } from "@/lib/zaps/zaps-api";
import type { ZapImageRecord } from "@/lib/zaps/zaps-types";
import { formatZapDateTime, zapStatusLabel } from "@/lib/zaps/zaps-utils";
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

  if (!file?.img_base64) return null;

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
        {!isPdf ? (
          <div className={zapStyles.viewerFooter}>
            <button type="button" onClick={() => setZoom((v) => Math.max(0.5, v - 0.25))}>
              −
            </button>
            <button type="button" onClick={() => setZoom(1)}>
              Сброс
            </button>
            <button type="button" onClick={() => setZoom((v) => Math.min(3, v + 0.25))}>
              +
            </button>
          </div>
        ) : null}
        <div className={zapStyles.viewerFooter}>
          <button
            type="button"
            className={zapStyles.viewerNavBtn}
            disabled={index === 0}
            onClick={onPrev}
          >
            ←
          </button>
          <button
            type="button"
            className={zapStyles.viewerNavBtn}
            disabled={index >= images.length - 1}
            onClick={onNext}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReportZapModalProps {
  zapId: number;
  zapDateId: number | null;
  onClose: () => void;
  onUnlinked: () => void | Promise<void>;
}

export function ReportZapModal({
  zapId,
  zapDateId,
  onClose,
  onUnlinked,
}: ReportZapModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchZapById>> | null>(
    null,
  );
  const [unlinking, setUnlinking] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchZapById(zapId);
      if (!data.status || !data.zap) {
        setDetail(null);
        setError(data.error ?? "Запрос не найден");
        return;
      }
      setDetail(data);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [zapId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnlink = async () => {
    if (!zapDateId) return;
    setUnlinking(true);
    try {
      const result = await unlinkZapDate(zapDateId);
      if (!result.status) {
        window.alert(result.error ?? "Не удалось отвязать дату");
        return;
      }
      await load();
      await onUnlinked();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setUnlinking(false);
    }
  };

  const images = detail?.images ?? [];
  const zap = detail?.zap;

  return (
    <div className={attendanceStyles.modalOverlay} onClick={onClose}>
      <div
        className={attendanceStyles.modal}
        style={{ maxWidth: 520 }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className={attendanceStyles.modalTitle}>Отгул (просмотр)</h3>
        {loading ? (
          <LoadingState label="Загрузка…" variant="compact" />
        ) : error ? (
          <p className={styles.errorText}>{error}</p>
        ) : zap ? (
          <div className={reportStyles.zapModalBody}>
            <p className={reportStyles.popoverMeta}>
              {zap.full_name ?? `Ученик ID ${zap.student_id}`} ·{" "}
              {zapStatusLabel(zap.status)}
            </p>
            <p>{zap.text}</p>
            {zap.answer ? (
              <p className={reportStyles.popoverMeta}>
                <strong>Ответ:</strong> {zap.answer}
              </p>
            ) : null}
            {detail?.dates && detail.dates.length > 0 ? (
              <ul className={reportStyles.zapDatesList}>
                {detail.dates.map((dateItem) => {
                  const tone = getZapDateBadgeTone(dateItem.status);
                  return (
                    <li key={dateItem.id ?? dateItem.date} className={reportStyles.zapDateRow}>
                      <span>{formatZapDateShort(dateItem.date)}</span>
                      <span className={dateStatusClass(tone)}>
                        {getZapDateStatusLabel(
                          dateItem.status,
                          dateItem.status_label,
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {zap.created_at ? (
              <p className={reportStyles.popoverMeta}>
                Создан: {formatZapDateTime(zap.created_at)}
              </p>
            ) : null}
            {images.length > 0 ? (
              <div className={reportStyles.zapAttachments}>
                {images.map((file, index) =>
                  file.img_base64 ? (
                    <button
                      key={index}
                      type="button"
                      className={reportStyles.zapThumb}
                      onClick={() => setViewerIndex(index)}
                    >
                      {isPdfAttachment(file.file_type, file.img_base64) ? (
                        <span>PDF</span>
                      ) : (
                        <img src={file.img_base64} alt="" />
                      )}
                    </button>
                  ) : null,
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={attendanceStyles.modalActions}>
          {zapDateId ? (
            <Button
              type="button"
              variant="ghost"
              className={attendanceStyles.dangerBtn}
              disabled={unlinking || loading}
              onClick={() => void handleUnlink()}
            >
              {unlinking ? "…" : "Убрать дату из отгула"}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>

      {viewerIndex !== null && images.length > 0 ? (
        <ZapAttachmentViewer
          images={images}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() =>
            setViewerIndex((i) =>
              i !== null && i < images.length - 1 ? i + 1 : i,
            )
          }
        />
      ) : null}
    </div>
  );
}
