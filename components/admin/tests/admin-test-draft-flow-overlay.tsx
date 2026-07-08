"use client";

import styles from "@/components/admin/tests/admin-test-draft-flow-overlay.module.css";
import {
  buildFlowLinks,
  buildInsertSlots,
  CARD_MIN_HEIGHT,
  CARD_WIDTH,
  GRID_START_X,
  GRID_START_Y,
  INSERT_HIT_SIZE,
  INSERT_SPREAD_OFFSET,
  type InsertSlot,
  type QuestionCardMetric,
} from "@/components/admin/tests/admin-test-draft-flow-layout";
import type { DraftCanvasModel } from "@/lib/admin/admin-test-drafts-types";
import { ViewportPortal } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type AdminTestDraftFlowOverlayProps = {
  canvas: DraftCanvasModel;
  hidden?: boolean;
  restrictInsertToEnd?: boolean;
  onInsertAt: (insertIndex: number) => void;
};

const SPREAD_LEFT_CLASS = "flow-insert-spread-left";
const SPREAD_RIGHT_CLASS = "flow-insert-spread-right";

function measureQuestionCards(questions: DraftCanvasModel["questions"], layout: DraftCanvasModel["layout"]) {
  const metrics = new Map<string, QuestionCardMetric>();

  questions.forEach((question) => {
    const cardEl = document.querySelector<HTMLElement>(`[data-question-id="${question.id}"]`);
    const pos = layout[question.id] ?? { x: GRID_START_X, y: GRID_START_Y };
    const height = cardEl?.offsetHeight ?? CARD_MIN_HEIGHT;
    const width = cardEl?.offsetWidth ?? CARD_WIDTH;
    metrics.set(question.id, {
      x: pos.x,
      centerY: pos.y + height / 2,
      height,
      width,
    });
  });

  return metrics;
}

function clearSpreadClasses() {
  document.querySelectorAll<HTMLElement>("[data-question-id]").forEach((cardEl) => {
    cardEl.classList.remove(SPREAD_LEFT_CLASS, SPREAD_RIGHT_CLASS);
  });
}

function getSpreadSets(
  slot: InsertSlot | null,
  questions: DraftCanvasModel["questions"],
  layout: DraftCanvasModel["layout"],
) {
  const spreadLeftIds = new Set<string>();
  const spreadRightIds = new Set<string>();

  const ordered = [...questions].sort((a, b) => {
    const ap = layout[a.id] ?? { x: 0, y: 0 };
    const bp = layout[b.id] ?? { x: 0, y: 0 };
    return ap.x - bp.x;
  });

  if (!slot) {
    return { spreadLeftIds, spreadRightIds, ordered };
  }

  if (slot.insertIndex === 0) {
    spreadRightIds.add(ordered[0].id);
  } else if (slot.insertIndex >= ordered.length) {
    spreadLeftIds.add(ordered[ordered.length - 1].id);
  } else {
    spreadLeftIds.add(ordered[slot.insertIndex - 1].id);
    spreadRightIds.add(ordered[slot.insertIndex].id);
  }

  return { spreadLeftIds, spreadRightIds, ordered };
}

function applySpreadForSlot(
  slot: InsertSlot | null,
  questions: DraftCanvasModel["questions"],
  layout: DraftCanvasModel["layout"],
) {
  clearSpreadClasses();
  const { spreadLeftIds, spreadRightIds } = getSpreadSets(slot, questions, layout);

  const cardFor = (questionId: string) =>
    document.querySelector<HTMLElement>(`[data-question-id="${questionId}"]`);

  spreadLeftIds.forEach((questionId) => {
    cardFor(questionId)?.classList.add(SPREAD_LEFT_CLASS);
  });
  spreadRightIds.forEach((questionId) => {
    cardFor(questionId)?.classList.add(SPREAD_RIGHT_CLASS);
  });
}

export function AdminTestDraftFlowOverlay({
  canvas,
  hidden = false,
  restrictInsertToEnd = false,
  onInsertAt,
}: AdminTestDraftFlowOverlayProps) {
  const questions = canvas.questions;
  const layout = canvas.layout;
  const [metrics, setMetrics] = useState<Map<string, QuestionCardMetric>>(() => new Map());
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);

  useEffect(() => {
    const measure = () => {
      setMetrics(measureQuestionCards(questions, layout));
    };

    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    questions.forEach((question) => {
      const cardEl = document.querySelector(`[data-question-id="${question.id}"]`);
      if (cardEl) observer.observe(cardEl);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [layout, questions]);

  const links = useMemo(
    () => buildFlowLinks(questions, layout, metrics),
    [layout, metrics, questions],
  );
  const slots = useMemo(
    () => buildInsertSlots(questions, layout, metrics),
    [layout, metrics, questions],
  );
  const visibleSlots = useMemo(() => {
    if (!restrictInsertToEnd) return slots;
    return slots.filter((slot) => slot.insertIndex === questions.length);
  }, [questions.length, restrictInsertToEnd, slots]);

  const hoveredSlot = useMemo(
    () => visibleSlots.find((slot) => slot.id === hoveredSlotId) ?? null,
    [hoveredSlotId, visibleSlots],
  );

  const visibleLinks = useMemo(() => {
    const { spreadLeftIds, spreadRightIds, ordered } = getSpreadSets(hoveredSlot, questions, layout);
    if (spreadLeftIds.size === 0 && spreadRightIds.size === 0) return links;

    return links.map((link, linkIndex) => {
      const leftId = ordered[linkIndex]?.id;
      const rightId = ordered[linkIndex + 1]?.id;
      let { x1, x2 } = link;

      if (leftId) {
        if (spreadLeftIds.has(leftId)) x1 -= INSERT_SPREAD_OFFSET;
        if (spreadRightIds.has(leftId)) x1 += INSERT_SPREAD_OFFSET;
      }
      if (rightId) {
        if (spreadLeftIds.has(rightId)) x2 -= INSERT_SPREAD_OFFSET;
        if (spreadRightIds.has(rightId)) x2 += INSERT_SPREAD_OFFSET;
      }

      return { ...link, x1, x2 };
    });
  }, [hoveredSlot, layout, links, questions]);

  useEffect(() => {
    if (hidden) {
      clearSpreadClasses();
      return;
    }
    applySpreadForSlot(hoveredSlot, questions, layout);
    return () => {
      clearSpreadClasses();
    };
  }, [hidden, hoveredSlot, layout, questions]);

  const handleSlotLeave = useCallback(() => {
    setHoveredSlotId(null);
  }, []);

  return (
    <ViewportPortal>
      <div className={`${styles.overlay} ${hidden ? styles.overlayHidden : ""}`} aria-hidden={hidden}>
        <svg className={styles.links}>
          {visibleLinks.map((link) => (
            <line
              key={link.id}
              className={styles.linkLine}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
            />
          ))}
        </svg>

        <div className={styles.slots}>
          {visibleSlots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className={`nopan ${styles.insertSlot} ${hidden ? styles.insertSlotHidden : ""}`}
              style={{
                left: slot.x,
                top: slot.y,
                width: slot.width,
                height: slot.height,
                marginLeft: -(slot.width / 2),
                marginTop: -(slot.height / 2),
              }}
              aria-label="Добавить вопрос"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerEnter={() => setHoveredSlotId(slot.id)}
              onPointerLeave={handleSlotLeave}
              onClick={(event) => {
                event.stopPropagation();
                setHoveredSlotId(null);
                onInsertAt(slot.insertIndex);
              }}
            >
              <span className={styles.insertPlus}>
                <span className={styles.insertPlusIcon}>+</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </ViewportPortal>
  );
}
