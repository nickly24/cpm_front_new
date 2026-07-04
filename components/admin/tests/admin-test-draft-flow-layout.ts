import type { DraftCanvasModel, DraftQuestionNode } from "@/lib/admin/admin-test-drafts-types";

export const CARD_WIDTH = 420;
export const CARD_MIN_HEIGHT = 160;
export const CARD_GAP = 150;
export const GRID_X = CARD_WIDTH + CARD_GAP;
export const GRID_START_X = 120;
export const GRID_START_Y = 120;
export const FLOW_CONNECTOR_Y_OFFSET = 27;
export const INSERT_PLUS_SIZE = 44;
export const INSERT_HIT_PADDING = 10;
export const INSERT_HIT_SIZE = INSERT_PLUS_SIZE + INSERT_HIT_PADDING * 2;
export const INSERT_SPREAD_OFFSET = 18;

export function slotX(index: number) {
  return GRID_START_X + index * GRID_X;
}

export function slotIndexFromX(x: number, maxIndex: number) {
  return targetSlotIndex(x, maxIndex + 1);
}

export function targetSlotIndex(anchorX: number, questionCount: number) {
  return clamp(
    Math.floor((anchorX - GRID_START_X + GRID_X / 2) / GRID_X),
    0,
    Math.max(0, questionCount - 1),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function sortQuestions(canvas: DraftCanvasModel) {
  return [...canvas.questions].sort((a, b) => {
    const ap = canvas.layout[a.id] ?? { x: 0, y: 0 };
    const bp = canvas.layout[b.id] ?? { x: 0, y: 0 };
    return ap.y - bp.y || ap.x - bp.x;
  });
}

export function linearizeLayout(questions: DraftQuestionNode[]) {
  return Object.fromEntries(
    questions.map((question, index) => [
      question.id,
      {
        x: slotX(index),
        y: GRID_START_Y,
      },
    ]),
  );
}

export function reorderQuestionsAsBlock(
  canvas: DraftCanvasModel,
  movingIds: string[],
  anchorQuestionId: string,
  anchorX: number,
) {
  const ordered = sortQuestions(canvas);
  const movingSet = new Set(movingIds);
  const movingQuestions = ordered.filter((question) => movingSet.has(question.id));
  if (movingQuestions.length === 0) return ordered;

  const remainingQuestions = ordered.filter((question) => !movingSet.has(question.id));
  const anchorOffset = Math.max(
    0,
    movingQuestions.findIndex((question) => question.id === anchorQuestionId),
  );
  const anchorGridIndex = targetSlotIndex(anchorX, ordered.length);
  const insertIndex = Math.max(
    0,
    Math.min(remainingQuestions.length, anchorGridIndex - anchorOffset),
  );

  return [
    ...remainingQuestions.slice(0, insertIndex),
    ...movingQuestions,
    ...remainingQuestions.slice(insertIndex),
  ];
}

export type InsertSlot = {
  id: string;
  insertIndex: number;
  x: number;
  y: number;
  height: number;
  width: number;
};

export type QuestionCardMetric = {
  x: number;
  centerY: number;
  height: number;
  width: number;
};

function connectorY(
  questionId: string,
  layout: DraftCanvasModel["layout"],
) {
  const pos = layout[questionId] ?? { x: GRID_START_X, y: GRID_START_Y };
  return pos.y + FLOW_CONNECTOR_Y_OFFSET;
}

function metricForQuestion(
  questionId: string,
  layout: DraftCanvasModel["layout"],
  metrics?: Map<string, QuestionCardMetric>,
): QuestionCardMetric {
  const fromDom = metrics?.get(questionId);
  if (fromDom) return fromDom;
  const pos = layout[questionId] ?? { x: GRID_START_X, y: GRID_START_Y };
  return {
    x: pos.x,
    centerY: pos.y + CARD_MIN_HEIGHT / 2,
    height: CARD_MIN_HEIGHT,
    width: CARD_WIDTH,
  };
}

export function buildInsertSlots(
  questions: DraftQuestionNode[],
  layout: DraftCanvasModel["layout"],
  metrics?: Map<string, QuestionCardMetric>,
) {
  const slots: InsertSlot[] = [];

  if (questions.length === 0) {
    slots.push({
      id: "insert-start",
      insertIndex: 0,
      x: slotX(0) - CARD_GAP / 2,
      y: GRID_START_Y + FLOW_CONNECTOR_Y_OFFSET,
      height: INSERT_HIT_SIZE,
      width: INSERT_HIT_SIZE,
    });
    return slots;
  }

  const ordered = [...questions].sort((a, b) => {
    const ap = layout[a.id] ?? { x: 0, y: 0 };
    const bp = layout[b.id] ?? { x: 0, y: 0 };
    return ap.x - bp.x;
  });

  const firstMetric = metricForQuestion(ordered[0].id, layout, metrics);
  slots.push({
    id: `insert-before-${ordered[0].id}`,
    insertIndex: 0,
    x: firstMetric.x - CARD_GAP / 2,
    y: connectorY(ordered[0].id, layout),
    height: INSERT_HIT_SIZE,
    width: INSERT_HIT_SIZE,
  });

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const leftMetric = metricForQuestion(ordered[index].id, layout, metrics);
    const rightMetric = metricForQuestion(ordered[index + 1].id, layout, metrics);
    const gapCenterX = leftMetric.x + leftMetric.width + (rightMetric.x - (leftMetric.x + leftMetric.width)) / 2;
    slots.push({
      id: `insert-between-${ordered[index].id}-${ordered[index + 1].id}`,
      insertIndex: index + 1,
      x: gapCenterX,
      y: connectorY(ordered[index].id, layout),
      height: INSERT_HIT_SIZE,
      width: INSERT_HIT_SIZE,
    });
  }

  const last = ordered[ordered.length - 1];
  const lastMetric = metricForQuestion(last.id, layout, metrics);
  slots.push({
    id: `insert-after-${last.id}`,
    insertIndex: ordered.length,
    x: lastMetric.x + lastMetric.width + CARD_GAP / 2,
    y: connectorY(last.id, layout),
    height: INSERT_HIT_SIZE,
    width: INSERT_HIT_SIZE,
  });

  return slots;
}

export type FlowLink = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function buildFlowLinks(
  questions: DraftQuestionNode[],
  layout: DraftCanvasModel["layout"],
  metrics?: Map<string, QuestionCardMetric>,
) {
  const links: FlowLink[] = [];
  const ordered = [...questions].sort((a, b) => {
    const ap = layout[a.id] ?? { x: 0, y: 0 };
    const bp = layout[b.id] ?? { x: 0, y: 0 };
    return ap.x - bp.x;
  });

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const leftMetric = metricForQuestion(ordered[index].id, layout, metrics);
    const rightMetric = metricForQuestion(ordered[index + 1].id, layout, metrics);
    const linkY = connectorY(ordered[index].id, layout);
    links.push({
      id: `link-${ordered[index].id}-${ordered[index + 1].id}`,
      x1: leftMetric.x + leftMetric.width,
      y1: linkY,
      x2: rightMetric.x,
      y2: linkY,
    });
  }

  return links;
}
