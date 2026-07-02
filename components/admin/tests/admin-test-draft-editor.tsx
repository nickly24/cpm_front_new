"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Background,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  FileQuestion,
  Hand,
  MousePointer2,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/admin/tests/admin-test-draft-editor.module.css";
import {
  lockAdminTestDraft,
  publishAdminTestDraft,
  unlockAdminTestDraft,
  updateAdminTestDraft,
} from "@/lib/admin/admin-test-drafts-api";
import type {
  AdminTestDraft,
  DraftAnswerNode,
  DraftCanvasModel,
  DraftClipboardPayload,
  DraftQuestionNode,
  DraftValidationError,
  AutosaveState,
  Direction,
} from "@/lib/admin/admin-test-drafts-types";
import type { AdminTestQuestionType } from "@/lib/admin/admin-tests-types";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

const GRID_X = 360;
const GRID_START_X = 120;
const GRID_START_Y = 120;
const CLIPBOARD_KEY = "application/x-cpm-test-draft";
type InteractionMode = "select" | "pan";

const issueBadgeBaseStyle: CSSProperties = {
  position: "absolute",
  right: -10,
  top: -10,
  zIndex: 7,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  border: "2px solid #fff",
  borderRadius: 999,
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.18)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
};

const issuePopoverStyle: CSSProperties = {
  position: "absolute",
  right: -10,
  top: 20,
  zIndex: 8,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  width: 270,
  maxHeight: 220,
  padding: 8,
  overflowY: "auto",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  borderRadius: 12,
  background: "rgba(255, 255, 255, 0.98)",
  boxShadow: "0 20px 44px rgba(15, 23, 42, 0.18)",
};

const issuePopoverItemBaseStyle: CSSProperties = {
  padding: "8px 9px",
  borderRadius: 9,
  fontSize: 11,
  lineHeight: 1.3,
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function autosaveSnapshot(draft: AdminTestDraft) {
  return JSON.stringify({
    title: draft.title,
    direction: draft.direction,
    startDate: draft.startDate,
    endDate: draft.endDate,
    timeLimitMinutes: draft.timeLimitMinutes,
    published: draft.published,
    visible: draft.visible,
    canvas: normalizeCanvas(draft.canvas),
  });
}

function normalizeCanvas(canvas?: DraftCanvasModel): DraftCanvasModel {
  const questions = canvas?.questions ?? [];
  const layout = { ...(canvas?.layout ?? {}) };
  questions.forEach((question, index) => {
    if (!layout[question.id]) {
      layout[question.id] = {
        x: GRID_START_X + index * GRID_X,
        y: GRID_START_Y,
      };
    }
  });
  return { questions, layout };
}

function linearizeLayout(questions: DraftQuestionNode[]) {
  return Object.fromEntries(
    questions.map((question, index) => [
      question.id,
      {
        x: GRID_START_X + index * GRID_X,
        y: GRID_START_Y,
      },
    ]),
  );
}

function reorderQuestionsAsBlock(
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
  const anchorGridIndex = Math.round((anchorX - GRID_START_X) / GRID_X);
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

function answerDropError(target: DraftQuestionNode, answers: DraftAnswerNode[]) {
  if (target.type === "text" && answers.some((answer) => answer.kind !== "textAnswer")) {
    return "Обычный ответ нельзя добавить в текстовый вопрос";
  }
  if (target.type !== "text" && answers.some((answer) => answer.kind === "textAnswer")) {
    return "Текстовый ответ можно добавить только в текстовый вопрос";
  }
  if (target.type === "single" && answers.filter((answer) => answer.isCorrect).length > 1) {
    return "В вопрос с одним ответом нельзя перенести несколько правильных ответов";
  }
  return null;
}

function sortQuestions(canvas: DraftCanvasModel) {
  return [...canvas.questions].sort((a, b) => {
    const ap = canvas.layout[a.id] ?? { x: 0, y: 0 };
    const bp = canvas.layout[b.id] ?? { x: 0, y: 0 };
    return ap.y - bp.y || ap.x - bp.x;
  });
}

function labelForType(type: AdminTestQuestionType) {
  if (type === "single") return "Один ответ";
  if (type === "multiple") return "Несколько";
  return "Текстовый";
}

function shortLabelForType(type: AdminTestQuestionType) {
  if (type === "single") return "1";
  if (type === "multiple") return "∞";
  return "T";
}

function defaultQuestion(type: AdminTestQuestionType, position: { x: number; y: number }): {
  question: DraftQuestionNode;
  layout: { x: number; y: number };
} {
  const id = uid("q");
  return {
    question: {
      id,
      type,
      text: "",
      points: 1,
      answers:
        type === "text"
          ? [{ id: uid("text"), kind: "textAnswer", text: "", isCorrect: true }]
          : [
              { id: uid("a"), kind: "answer", text: "", isCorrect: false },
              { id: uid("a"), kind: "answer", text: "", isCorrect: false },
            ],
    },
    layout: {
      x: snap(position.x, GRID_X),
      y: GRID_START_Y,
    },
  };
}

function validateDraft(draft: AdminTestDraft): DraftValidationError[] {
  const errors: DraftValidationError[] = [];
  const questions = draft.canvas.questions;
  if (!draft.title.trim()) errors.push({ targetId: "metadata", message: "Укажите название теста" });
  if (!draft.direction.trim()) errors.push({ targetId: "metadata", message: "Выберите направление" });
  if (!draft.startDate || !draft.endDate) {
    errors.push({ targetId: "metadata", message: "Укажите даты начала и окончания" });
  }
  if (questions.length === 0) {
    errors.push({ targetId: "canvas", message: "Добавьте хотя бы один вопрос" });
  }
  questions.forEach((question, index) => {
    const num = index + 1;
    if (!question.text.trim()) errors.push({ targetId: question.id, message: `Вопрос ${num}: заполните текст` });
    if (question.points < 1) errors.push({ targetId: question.id, message: `Вопрос ${num}: баллы должны быть больше 0` });
    if (question.type === "text") {
      const textAnswers = question.answers.filter((answer) => answer.kind === "textAnswer");
      if (textAnswers.length === 0) errors.push({ targetId: question.id, message: `Вопрос ${num}: добавьте текстовый ответ` });
      textAnswers.forEach((answer) => {
        if (!answer.text.trim()) errors.push({ targetId: answer.id, message: `Вопрос ${num}: заполните текстовый ответ` });
      });
      return;
    }
    const answers = question.answers.filter((answer) => answer.kind === "answer");
    const correct = answers.filter((answer) => answer.isCorrect);
    if (answers.length < 2) errors.push({ targetId: question.id, message: `Вопрос ${num}: минимум два ответа` });
    if (correct.length === 0) errors.push({ targetId: question.id, message: `Вопрос ${num}: отметьте правильный ответ` });
    if (question.type === "single" && correct.length > 1) {
      errors.push({ targetId: question.id, message: `Вопрос ${num}: нужен один правильный ответ` });
    }
    answers.forEach((answer) => {
      if (!answer.text.trim()) errors.push({ targetId: answer.id, message: `Вопрос ${num}: заполните текст ответа` });
    });
  });
  return errors;
}

function validateDraftWarnings(draft: AdminTestDraft): DraftValidationError[] {
  const warnings: DraftValidationError[] = [];
  draft.canvas.questions.forEach((question, index) => {
    const num = index + 1;
    const trimmedQuestion = question.text.trim();
    if (trimmedQuestion && trimmedQuestion.length < 5) {
      warnings.push({
        targetId: question.id,
        message: `Вопрос ${num}: текст выглядит слишком коротким`,
        severity: "warning",
      });
    }
    if (question.type !== "text") {
      const answers = question.answers.filter((answer) => answer.kind === "answer");
      const filledAnswers = answers.filter((answer) => answer.text.trim());
      if (filledAnswers.length === 2) {
        warnings.push({
          targetId: question.id,
          message: `Вопрос ${num}: всего два варианта ответа`,
          severity: "warning",
        });
      }
    }
  });
  return warnings;
}

function issueSeverity(issue: DraftValidationError) {
  return issue.severity ?? "error";
}

function questionIdForIssue(canvas: DraftCanvasModel, issue: DraftValidationError) {
  if (canvas.questions.some((question) => question.id === issue.targetId)) {
    return issue.targetId;
  }
  return (
    canvas.questions.find((question) =>
      question.answers.some((answer) => answer.id === issue.targetId),
    )?.id ?? null
  );
}

function SortableAnswer({
  answer,
  selected,
  copied,
  dragAnswerIds,
  interactionMode,
  onSelect,
}: {
  answer: DraftAnswerNode;
  selected: boolean;
  copied: boolean;
  dragAnswerIds: string[];
  interactionMode: InteractionMode;
  onSelect: (additive: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: answer.id,
    disabled: interactionMode === "pan",
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-answer-chip="true"
      data-answer-id={answer.id}
      className={`${styles.answerChip} ${answer.isCorrect ? styles.answerChipCorrect : ""} ${selected ? styles.answerChipSelected : ""} ${copied ? styles.answerChipCopied : ""}`}
      onPointerDownCapture={(event) => {
        if (interactionMode === "pan") return;
        event.stopPropagation();
        if (selected && !event.shiftKey && !event.metaKey && !event.ctrlKey) return;
        onSelect(event.shiftKey || event.metaKey || event.ctrlKey);
      }}
      onClick={(event) => {
        if (interactionMode === "pan") return;
        event.stopPropagation();
      }}
      draggable={interactionMode === "select"}
      onDragStart={(event) => {
        if (interactionMode === "pan") return;
        event.dataTransfer.setData("application/x-cpm-answer-id", answer.id);
        event.dataTransfer.setData("application/x-cpm-answer-ids", JSON.stringify(dragAnswerIds));
        event.dataTransfer.effectAllowed = "move";
        if (dragAnswerIds.length > 1) {
          const preview = document.createElement("div");
          preview.className = styles.dragStackPreview;
          preview.innerHTML = `
            <div class="${styles.dragStackLayer}"></div>
            <div class="${styles.dragStackLayer}"></div>
            <div class="${styles.dragStackCard}">
              <span>${answer.text || (answer.kind === "textAnswer" ? "Текстовый ответ" : "Вариант ответа")}</span>
              <strong>${dragAnswerIds.length}</strong>
            </div>
          `;
          document.body.appendChild(preview);
          event.dataTransfer.setDragImage(preview, 18, 18);
          window.setTimeout(() => preview.remove(), 0);
        }
      }}
      {...attributes}
      {...listeners}
    >
      <span className={styles.answerDot} />
      <span>{answer.text || (answer.kind === "textAnswer" ? "Текстовый ответ" : "Вариант ответа")}</span>
    </div>
  );
}

function QuestionNode(props: NodeProps) {
  const data = props.data as {
    question: DraftQuestionNode;
    index: number;
    selectedAnswerIds: string[];
    copiedIds: string[];
    copiedAnswerIds: string[];
    dropErrorMessage: string | null;
    issues: DraftValidationError[];
    interactionMode: InteractionMode;
    onSelectQuestion: (questionId: string) => void;
    onSelectAnswer: (questionId: string, answerId: string, additive: boolean) => void;
    onDragStart: (questionId: string) => void;
    onDragMove: (
      questionId: string,
      clientX: number,
      clientY: number,
      grabOffsetX: number,
      grabOffsetY: number,
    ) => void;
    onDragEnd: (
      questionId: string,
      clientX: number,
      clientY: number,
      grabOffsetX: number,
      grabOffsetY: number,
    ) => void;
    onReorderAnswers: (questionId: string, activeId: string, overId: string) => void;
    onDropAnswer: (targetQuestionId: string, answerIds: string[]) => void;
  };
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const copied = data.copiedIds.includes(data.question.id);
  const hasDropError = Boolean(data.dropErrorMessage);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const issueLevel = data.issues.some((issue) => issueSeverity(issue) === "error")
    ? "error"
    : data.issues.length > 0
      ? "warning"
      : null;
  const pointerState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    dragging: boolean;
  } | null>(null);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      data.onReorderAnswers(data.question.id, String(active.id), String(over.id));
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (data.interactionMode === "pan") return;
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-answer-chip='true']")) return;
    event.stopPropagation();

    pointerState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      grabOffsetX: event.clientX - event.currentTarget.getBoundingClientRect().left,
      grabOffsetY: event.clientY - event.currentTarget.getBoundingClientRect().top,
      dragging: false,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = pointerState.current;
      if (!state || moveEvent.pointerId !== state.pointerId) return;

      const distance = Math.hypot(
        moveEvent.clientX - state.startX,
        moveEvent.clientY - state.startY,
      );

      if (!state.dragging && distance >= 4) {
        state.dragging = true;
        data.onDragStart(data.question.id);
      }

      if (state.dragging) {
        moveEvent.preventDefault();
        data.onDragMove(
          data.question.id,
          moveEvent.clientX,
          moveEvent.clientY,
          state.grabOffsetX,
          state.grabOffsetY,
        );
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const state = pointerState.current;
      if (!state || upEvent.pointerId !== state.pointerId) return;

      if (state.dragging) {
        upEvent.preventDefault();
        data.onDragEnd(
          data.question.id,
          upEvent.clientX,
          upEvent.clientY,
          state.grabOffsetX,
          state.grabOffsetY,
        );
      } else {
        data.onSelectQuestion(data.question.id);
      }

      pointerState.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  return (
    <div
      data-question-id={data.question.id}
      className={`${styles.questionNode} ${copied ? styles.questionNodeCopied : ""} ${hasDropError ? styles.questionNodeDropError : ""}`}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        if (data.interactionMode === "pan") return;
        event.stopPropagation();
        data.onSelectQuestion(data.question.id);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const answerId = event.dataTransfer.getData("application/x-cpm-answer-id");
        const rawAnswerIds = event.dataTransfer.getData("application/x-cpm-answer-ids");
        let answerIds = answerId ? [answerId] : [];
        try {
          const parsed = rawAnswerIds ? JSON.parse(rawAnswerIds) : null;
          if (Array.isArray(parsed)) {
            answerIds = parsed.filter((id): id is string => typeof id === "string");
          }
        } catch {
          // Fall back to the single dragged answer id.
        }
        if (answerIds.length > 0) data.onDropAnswer(data.question.id, answerIds);
      }}
    >
      {data.dropErrorMessage ? (
        <div className={styles.dropErrorBubble}>{data.dropErrorMessage}</div>
      ) : null}
      {issueLevel ? (
        <button
          type="button"
          className={`${styles.issueBadge} ${issueLevel === "error" ? styles.issueBadgeError : styles.issueBadgeWarning}`}
          style={{
            ...issueBadgeBaseStyle,
            background: issueLevel === "error" ? "#ef4444" : "#f59e0b",
          }}
          onClick={(event) => {
            event.stopPropagation();
            setIssuesOpen((value) => !value);
          }}
          title="Проблемы вопроса"
        >
          !
        </button>
      ) : null}
      {issuesOpen && data.issues.length > 0 ? (
        <div
          className={styles.issuePopover}
          style={issuePopoverStyle}
          onClick={(event) => event.stopPropagation()}
        >
          {data.issues.map((issue, index) => (
            <div
              key={`${issue.targetId}-${index}`}
              className={`${styles.issuePopoverItem} ${issueSeverity(issue) === "error" ? styles.issuePopoverItemError : styles.issuePopoverItemWarning}`}
              style={{
                ...issuePopoverItemBaseStyle,
                background: issueSeverity(issue) === "error" ? "#fef2f2" : "#fffbeb",
                color: issueSeverity(issue) === "error" ? "#b91c1c" : "#b45309",
              }}
            >
              {issue.message}
            </div>
          ))}
        </div>
      ) : null}
      <div className={styles.questionHead}>
        <span className={styles.questionNumber}>{data.index + 1}</span>
        <strong>{data.question.points} б.</strong>
        <span className={styles.questionType}>{labelForType(data.question.type)}</span>
      </div>
      <div className={styles.questionBody}>
        <p className={styles.questionText}>{data.question.text || "Текст вопроса"}</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={data.question.answers.map((answer) => answer.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={styles.answersList}>
              {data.question.answers.length === 0 ? (
                <p className={styles.dropHint}>Перетащите ответ внутрь вопроса</p>
              ) : (
                data.question.answers.map((answer) => (
                  <SortableAnswer
                    key={answer.id}
                    answer={answer}
                    selected={data.selectedAnswerIds.includes(answer.id)}
                    copied={data.copiedAnswerIds.includes(answer.id)}
                    dragAnswerIds={
                      data.selectedAnswerIds.includes(answer.id) && data.selectedAnswerIds.length > 0
                        ? data.selectedAnswerIds
                        : [answer.id]
                    }
                    interactionMode={data.interactionMode}
                    onSelect={(additive) =>
                      data.onSelectAnswer(
                        data.question.id,
                        answer.id,
                        additive,
                      )
                    }
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

const nodeTypes = { question: QuestionNode };

interface AdminTestDraftEditorProps {
  draft: AdminTestDraft;
  directions: Direction[];
  onBack: () => void;
  onPublished: (testId: string) => void;
}

export function AdminTestDraftEditor(props: AdminTestDraftEditorProps) {
  return (
    <ReactFlowProvider>
      <AdminTestDraftEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function AdminTestDraftEditorInner({
  draft: initialDraft,
  directions,
  onBack,
  onPublished,
}: AdminTestDraftEditorProps) {
  const { user } = useAuth();
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow();
  const normalizedInitialDraft = useMemo(
    () => ({
      ...initialDraft,
      canvas: normalizeCanvas(initialDraft.canvas),
    }),
    [initialDraft],
  );
  const [draft, setDraft] = useState<AdminTestDraft>({
    ...normalizedInitialDraft,
  });
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedAnswerIds, setSelectedAnswerIds] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<DraftValidationError[]>([]);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("saved");
  const [lockWarning, setLockWarning] = useState<string | null>(null);
  const [copiedIds, setCopiedIds] = useState<string[]>([]);
  const [copiedAnswerIds, setCopiedAnswerIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<DraftCanvasModel[]>([normalizeCanvas(initialDraft.canvas)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("select");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [questionTypeMenuOpen, setQuestionTypeMenuOpen] = useState(false);
  const [insertQuestionType, setInsertQuestionType] =
    useState<AdminTestQuestionType>("single");
  const lastSavedSnapshotRef = useRef(autosaveSnapshot(normalizedInitialDraft));
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollThumbRef = useRef<HTMLDivElement | null>(null);
  const selectionOverlayRef = useRef<HTMLDivElement | null>(null);
  const validationTimerRef = useRef<number | null>(null);
  const syncingHorizontalScrollRef = useRef(false);
  const suppressPaneClickRef = useRef(false);
  const suppressQuestionClickRef = useRef(false);
  const selectionSessionRef = useRef<{
    mode: "questions" | "answers";
    pointerId: number;
    startX: number;
    startY: number;
    latestX: number;
    latestY: number;
    rafId: number | null;
    baseSelectedIds: string[];
    currentIds: string[];
    questionId: string | null;
    root: HTMLDivElement;
  } | null>(null);
  const dragSessionRef = useRef<{
    anchorQuestionId: string;
    anchorBaseX: number;
    pendingDeltaX: number;
    items: Array<{
      questionId: string;
      baseX: number;
      nodeEl: HTMLDivElement;
    }>;
    rafId: number | null;
  } | null>(null);

  const sortedQuestions = useMemo(() => sortQuestions(draft.canvas), [draft.canvas]);
  const selectedQuestions = useMemo(
    () => sortedQuestions.filter((question) => selectedQuestionIds.includes(question.id)),
    [selectedQuestionIds, sortedQuestions],
  );
  const selectedQuestion = sortedQuestions.find((question) => question.id === selectedQuestionId) ?? null;
  const selectedAnswers = useMemo(
    () => selectedQuestion?.answers.filter((answer) => selectedAnswerIds.includes(answer.id)) ?? [],
    [selectedAnswerIds, selectedQuestion],
  );
  const selectedAnswer = selectedAnswers.length === 1 ? selectedAnswers[0] : null;
  const localErrors = useMemo(() => validateDraft(draft), [draft]);
  const localWarnings = useMemo(() => validateDraftWarnings(draft), [draft]);
  const visibleIssues = useMemo(
    () =>
      validationErrors.length > 0
        ? validationErrors
        : [...localErrors, ...localWarnings],
    [localErrors, localWarnings, validationErrors],
  );
  const issueCounts = useMemo(
    () => ({
      errors: visibleIssues.filter((issue) => issueSeverity(issue) === "error").length,
      warnings: visibleIssues.filter((issue) => issueSeverity(issue) === "warning").length,
    }),
    [visibleIssues],
  );
  const generalIssues = useMemo(
    () => visibleIssues.filter((issue) => !questionIdForIssue(draft.canvas, issue)),
    [draft.canvas, visibleIssues],
  );
  const canEdit = !draft.lockedBy || String(draft.lockedBy) === String(user?.id);
  const currentAutosaveSnapshot = useMemo(() => autosaveSnapshot(draft), [draft]);

  const syncSelection = useCallback(
    (questionIds: string[], questionId: string | null, answerIds: string[]) => {
      setSelectedQuestionIds((prev) => (sameIds(prev, questionIds) ? prev : questionIds));
      setSelectedQuestionId((prev) => (prev === questionId ? prev : questionId));
      setSelectedAnswerIds((prev) => (sameIds(prev, answerIds) ? prev : answerIds));
    },
    [],
  );

  const clearSelection = useCallback(() => {
    syncSelection([], null, []);
  }, [syncSelection]);

  const selectQuestionOnly = useCallback((questionId: string) => {
    syncSelection([questionId], questionId, []);
  }, [syncSelection]);

  const selectQuestionFromClick = useCallback((questionId: string) => {
    if (suppressQuestionClickRef.current) {
      suppressQuestionClickRef.current = false;
      return;
    }
    selectQuestionOnly(questionId);
  }, [selectQuestionOnly]);

  const selectAnswerOnly = useCallback((questionId: string, answerId: string, additive = false) => {
    setSelectedQuestionIds([questionId]);
    setSelectedQuestionId(questionId);
    setSelectedAnswerIds((prev) => {
      if (!additive || selectedQuestionId !== questionId) return [answerId];
      if (prev.includes(answerId)) return prev.filter((id) => id !== answerId);
      return [...prev, answerId];
    });
  }, [selectedQuestionId]);

  const showValidationError = useCallback((error: DraftValidationError) => {
    if (validationTimerRef.current !== null) {
      window.clearTimeout(validationTimerRef.current);
    }
    setValidationErrors([error]);
    validationTimerRef.current = window.setTimeout(() => {
      setValidationErrors([]);
      validationTimerRef.current = null;
    }, 4000);
  }, []);

  const pushHistory = useCallback((canvas: DraftCanvasModel) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(JSON.parse(JSON.stringify(canvas)) as DraftCanvasModel);
      return next.slice(-60);
    });
    setHistoryIndex((idx) => Math.min(idx + 1, 59));
  }, [historyIndex]);

  const mutateCanvas = useCallback((updater: (canvas: DraftCanvasModel) => DraftCanvasModel) => {
    setDraft((prev) => {
      const nextCanvas = normalizeCanvas(updater(prev.canvas));
      pushHistory(nextCanvas);
      return { ...prev, canvas: nextCanvas };
    });
  }, [pushHistory]);

  const updateQuestion = useCallback((questionId: string, patch: Partial<DraftQuestionNode>) => {
    mutateCanvas((canvas) => ({
      ...canvas,
      questions: canvas.questions.map((question) => {
        if (question.id !== questionId) return question;
        const next = { ...question, ...patch };
        if (patch.type && patch.type !== question.type) {
          next.answers =
            patch.type === "text"
              ? [{ id: uid("text"), kind: "textAnswer", text: "", isCorrect: true }]
              : [
                  { id: uid("a"), kind: "answer", text: "", isCorrect: false },
                  { id: uid("a"), kind: "answer", text: "", isCorrect: false },
                ];
        }
        return next;
      }),
    }));
  }, [mutateCanvas]);

  const updateAnswer = useCallback((questionId: string, answerId: string, patch: Partial<DraftAnswerNode>) => {
    mutateCanvas((canvas) => ({
      ...canvas,
      questions: canvas.questions.map((question) => {
        if (question.id !== questionId) return question;
        let answers = question.answers.map((answer) =>
          answer.id === answerId ? { ...answer, ...patch } : answer,
        );
        if (question.type === "single" && patch.isCorrect) {
          answers = answers.map((answer) => ({
            ...answer,
            isCorrect: answer.id === answerId,
          }));
        }
        return { ...question, answers };
      }),
    }));
  }, [mutateCanvas]);

  const addQuestion = useCallback((type: AdminTestQuestionType, position?: { x: number; y: number }) => {
    const fallback = {
      x: GRID_START_X + draft.canvas.questions.length * GRID_X,
      y: GRID_START_Y,
    };
    const created = defaultQuestion(type, position ?? fallback);
    const nextQuestions = [...draft.canvas.questions, created.question];
    mutateCanvas(() => ({
      questions: nextQuestions,
      layout: linearizeLayout(nextQuestions),
    }));
    selectQuestionOnly(created.question.id);
  }, [draft.canvas.questions, mutateCanvas, selectQuestionOnly]);

  const addAnswer = useCallback((kind: "answer" | "textAnswer") => {
    if (!selectedQuestion) return;
    if (selectedQuestion.type === "text" && kind !== "textAnswer") {
      showValidationError({ targetId: selectedQuestion.id, message: "Обычный ответ нельзя добавить в текстовый вопрос" });
      return;
    }
    if (selectedQuestion.type !== "text" && kind === "textAnswer") {
      showValidationError({ targetId: selectedQuestion.id, message: "Текстовый ответ можно добавить только в текстовый вопрос" });
      return;
    }
    const answer: DraftAnswerNode = {
      id: uid(kind === "textAnswer" ? "text" : "a"),
      kind,
      text: "",
      isCorrect: kind === "textAnswer",
    };
    updateQuestion(selectedQuestion.id, { answers: [...selectedQuestion.answers, answer] });
    selectAnswerOnly(selectedQuestion.id, answer.id, false);
  }, [selectAnswerOnly, selectedQuestion, showValidationError, updateQuestion]);

  const deleteSelection = useCallback(() => {
    if (selectedAnswerIds.length > 0 && selectedQuestion) {
      const selectedAnswerSet = new Set(selectedAnswerIds);
      updateQuestion(selectedQuestion.id, {
        answers: selectedQuestion.answers.filter((answer) => !selectedAnswerSet.has(answer.id)),
      });
      selectQuestionOnly(selectedQuestion.id);
      return;
    }
    if (selectedQuestionId) {
      mutateCanvas((canvas) => {
        const nextQuestions = canvas.questions.filter(
          (question) => question.id !== selectedQuestionId,
        );
        return {
          questions: nextQuestions,
          layout: linearizeLayout(nextQuestions),
        };
      });
      clearSelection();
    }
  }, [clearSelection, mutateCanvas, selectQuestionOnly, selectedAnswerIds, selectedQuestion, selectedQuestionId, updateQuestion]);

  const copySelection = useCallback(async () => {
    if (selectedAnswers.length > 0) {
      const payload: DraftClipboardPayload = {
        source: "cpm-test-draft-editor",
        answers: selectedAnswers,
      };
      const text = JSON.stringify(payload);
      setCopiedIds([]);
      setCopiedAnswerIds(selectedAnswers.map((answer) => answer.id));
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        window.localStorage.setItem(CLIPBOARD_KEY, text);
      }
      return;
    }

    const questions =
      selectedQuestions.length > 0
        ? selectedQuestions
        : selectedQuestion
          ? [selectedQuestion]
          : [];
    if (questions.length === 0) return;
    const payload: DraftClipboardPayload = {
      source: "cpm-test-draft-editor",
      questions,
    };
    const text = JSON.stringify(payload);
    setCopiedIds(questions.map((question) => question.id));
    setCopiedAnswerIds([]);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.localStorage.setItem(CLIPBOARD_KEY, text);
    }
  }, [selectedAnswers, selectedQuestion, selectedQuestions]);

  const pasteSelection = useCallback(async () => {
    let raw = window.localStorage.getItem(CLIPBOARD_KEY) || "";
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      // localStorage fallback above.
    }
    try {
      const payload = JSON.parse(raw) as DraftClipboardPayload;
      if (payload.source !== "cpm-test-draft-editor") return;

      if (Array.isArray(payload.answers) && payload.answers.length > 0) {
        if (!selectedQuestion) return;

        const error = answerDropError(selectedQuestion, payload.answers);
        if (error) {
          showValidationError({ targetId: selectedQuestion.id, message: error });
          return;
        }

        const clones = payload.answers.map((answer) => ({
          ...answer,
          id: uid(answer.kind === "textAnswer" ? "text" : "a"),
        }));
        updateQuestion(selectedQuestion.id, {
          answers: [
            ...(selectedQuestion.type === "single" && clones.some((answer) => answer.isCorrect)
              ? selectedQuestion.answers.map((answer) => ({ ...answer, isCorrect: false }))
              : selectedQuestion.answers),
            ...clones,
          ],
        });
        syncSelection([selectedQuestion.id], selectedQuestion.id, clones.map((answer) => answer.id));
        setCopiedIds([]);
        setCopiedAnswerIds(clones.map((answer) => answer.id));
        setValidationErrors([]);
        return;
      }

      if (!Array.isArray(payload.questions) || payload.questions.length === 0) return;
      const clones = payload.questions.map((question) => ({
        ...question,
        id: uid("q"),
        answers: question.answers.map((answer) => ({ ...answer, id: uid(answer.kind === "textAnswer" ? "text" : "a") })),
      }));
      mutateCanvas((canvas) => {
        const nextQuestions = [...canvas.questions, ...clones];
        return {
          questions: nextQuestions,
          layout: linearizeLayout(nextQuestions),
        };
      });
      syncSelection(clones[0] ? [clones[0].id] : [], clones[0]?.id ?? null, []);
      setCopiedIds(clones.map((question) => question.id));
      setCopiedAnswerIds([]);
    } catch {
      // Ignore non-editor clipboard content.
    }
  }, [mutateCanvas, selectedQuestion, showValidationError, syncSelection, updateQuestion]);

  const moveAnswerToQuestion = useCallback((targetQuestionId: string, answerIds: string[]) => {
    const target = draft.canvas.questions.find((question) => question.id === targetQuestionId);
    if (!target) return;

    const movingIds = answerIds.length > 0 ? answerIds : selectedAnswerIds;
    const movingSet = new Set(movingIds);
    const movingAnswers = draft.canvas.questions.flatMap((question) =>
      question.answers.filter((answer) => movingSet.has(answer.id)),
    );
    const sourceQuestionIds = draft.canvas.questions
      .filter((question) => question.answers.some((answer) => movingSet.has(answer.id)))
      .map((question) => question.id);

    if (movingAnswers.length === 0 || sourceQuestionIds.every((id) => id === target.id)) return;

    const error = answerDropError(target, movingAnswers);
    if (error) {
      showValidationError({ targetId: target.id, message: error });
      return;
    }

    setValidationErrors([]);
    mutateCanvas((canvas) => {
      return {
        ...canvas,
        questions: canvas.questions.map((question) => {
          if (sourceQuestionIds.includes(question.id)) {
            return {
              ...question,
              answers: question.answers.filter((answer) => !movingSet.has(answer.id)),
            };
          }
          if (question.id === target.id) {
            const existingAnswers =
              question.type === "single" && movingAnswers.some((answer) => answer.isCorrect)
                ? question.answers.map((answer) => ({ ...answer, isCorrect: false }))
                : question.answers;
            return { ...question, answers: [...existingAnswers, ...movingAnswers] };
          }
          return question;
        }),
      };
    });
    syncSelection([targetQuestionId], targetQuestionId, movingIds);
  }, [draft.canvas.questions, mutateCanvas, selectedAnswerIds, showValidationError, syncSelection]);

  const reorderAnswers = useCallback((questionId: string, activeId: string, overId: string) => {
    mutateCanvas((canvas) => ({
      ...canvas,
      questions: canvas.questions.map((question) => {
        if (question.id !== questionId) return question;
        const oldIndex = question.answers.findIndex((answer) => answer.id === activeId);
        const newIndex = question.answers.findIndex((answer) => answer.id === overId);
        if (oldIndex < 0 || newIndex < 0) return question;
        return { ...question, answers: arrayMove(question.answers, oldIndex, newIndex) };
      }),
    }));
  }, [mutateCanvas]);

  const handleQuestionDragStart = useCallback((questionId: string) => {
    const groupIds =
      selectedQuestionIds.length > 1 && selectedQuestionIds.includes(questionId)
        ? selectedQuestionIds
        : [questionId];
    const items = groupIds
      .map((id) => {
        const nodeEl = canvasRef.current?.querySelector<HTMLDivElement>(
          `.react-flow__node[data-id="${id}"]`,
        );
        if (!nodeEl) return null;
        return {
          questionId: id,
          baseX: draft.canvas.layout[id]?.x ?? GRID_START_X,
          nodeEl,
        };
      })
      .filter((item): item is { questionId: string; baseX: number; nodeEl: HTMLDivElement } => item !== null);
    if (items.length === 0) return;
    const anchorBaseX =
      items.find((item) => item.questionId === questionId)?.baseX ?? GRID_START_X;
    dragSessionRef.current = {
      anchorQuestionId: questionId,
      anchorBaseX,
      pendingDeltaX: 0,
      items,
      rafId: null,
    };
    items.forEach((item) => {
      item.nodeEl.classList.add("is-dragging");
      item.nodeEl.style.zIndex = "30";
      if (items.length > 1 && item.questionId === questionId) {
        item.nodeEl.classList.add("is-stack-anchor");
        item.nodeEl.setAttribute("data-drag-count", String(items.length));
      }
    });
  }, [draft.canvas.layout, selectedQuestionIds]);

  const handleQuestionDragMove = useCallback(
    (
      questionId: string,
      clientX: number,
      clientY: number,
      grabOffsetX: number,
      grabOffsetY: number,
    ) => {
      const flowPosition = screenToFlowPosition({
        x: clientX - grabOffsetX,
        y: clientY - grabOffsetY,
      });
      const session = dragSessionRef.current;
      if (!session || session.anchorQuestionId !== questionId) return;

      session.pendingDeltaX = flowPosition.x - session.anchorBaseX;

      if (session.rafId !== null) return;

      session.rafId = window.requestAnimationFrame(() => {
        const activeSession = dragSessionRef.current;
        if (!activeSession || activeSession.anchorQuestionId !== questionId) return;
        activeSession.rafId = null;
        activeSession.items.forEach((item) => {
          item.nodeEl.style.transform = `translate(${item.baseX + activeSession.pendingDeltaX}px, ${GRID_START_Y}px)`;
        });
      });
    },
    [screenToFlowPosition],
  );

  const handleQuestionDragEnd = useCallback(
    (
      questionId: string,
      clientX: number,
      clientY: number,
      grabOffsetX: number,
      grabOffsetY: number,
    ) => {
      const flowPosition = screenToFlowPosition({
        x: clientX - grabOffsetX,
        y: clientY - grabOffsetY,
      });
      const session = dragSessionRef.current;
      if (session && session.rafId !== null) {
        window.cancelAnimationFrame(session.rafId);
      }
      if (session) {
        const deltaX = flowPosition.x - session.anchorBaseX;
        session.items.forEach((item) => {
          item.nodeEl.classList.remove("is-dragging");
          item.nodeEl.classList.remove("is-stack-anchor");
          item.nodeEl.removeAttribute("data-drag-count");
          item.nodeEl.style.transform = `translate(${item.baseX + deltaX}px, ${GRID_START_Y}px)`;
          item.nodeEl.style.zIndex = "";
        });
      }
      dragSessionRef.current = null;
      mutateCanvas((canvas) => {
        const movingIds =
          session && session.items.length > 0
            ? session.items.map((item) => item.questionId)
            : [questionId];
        const nextQuestions = reorderQuestionsAsBlock(
          canvas,
          movingIds,
          questionId,
          flowPosition.x,
        );
        return {
          questions: nextQuestions,
          layout: linearizeLayout(nextQuestions),
        };
      });
    },
    [mutateCanvas, screenToFlowPosition],
  );

  useEffect(() => {
    return () => {
      const session = dragSessionRef.current;
      if (session && session.rafId !== null) {
        window.cancelAnimationFrame(session.rafId);
      }
      if (validationTimerRef.current !== null) {
        window.clearTimeout(validationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    if (selectionSessionRef.current) return;

    const selectedSet = new Set(selectedQuestionIds);
    const cards = root.querySelectorAll<HTMLElement>("[data-question-id]");

    cards.forEach((card) => {
      const questionId = card.dataset.questionId ?? "";
      card.classList.toggle(
        styles.questionNodeSelected,
        selectedSet.has(questionId),
      );
    });
  }, [selectedQuestionIds]);

  const renderSelectionPreview = useCallback(() => {
    const session = selectionSessionRef.current;
    if (!session) return;

    session.rafId = null;
    const rootRect = session.root.getBoundingClientRect();
    const left = Math.min(session.startX, session.latestX);
    const top = Math.min(session.startY, session.latestY);
    const right = Math.max(session.startX, session.latestX);
    const bottom = Math.max(session.startY, session.latestY);
    const overlay = selectionOverlayRef.current;

    if (overlay) {
      overlay.style.display = "block";
      overlay.classList.toggle(styles.selectionOverlayAnswers, session.mode === "answers");
      overlay.style.transform = `translate(${left - rootRect.left}px, ${top - rootRect.top}px)`;
      overlay.style.width = `${right - left}px`;
      overlay.style.height = `${bottom - top}px`;
    }

    const ids = new Set(session.baseSelectedIds);
    const selector =
      session.mode === "answers" && session.questionId
        ? `[data-question-id="${session.questionId}"] [data-answer-id]`
        : "[data-question-id]";
    const elements = session.root.querySelectorAll<HTMLElement>(selector);

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const intersects =
        rect.left <= right &&
        rect.right >= left &&
        rect.top <= bottom &&
        rect.bottom >= top;
      const id =
        session.mode === "answers"
          ? element.dataset.answerId ?? ""
          : element.dataset.questionId ?? "";
      if (intersects && id) ids.add(id);
    });

    session.currentIds = Array.from(ids);
    elements.forEach((element) => {
      const id =
        session.mode === "answers"
          ? element.dataset.answerId ?? ""
          : element.dataset.questionId ?? "";
      element.classList.toggle(
        session.mode === "answers"
          ? styles.answerChipSelected
          : styles.questionNodeSelected,
        ids.has(id),
      );
    });
  }, []);

  const finishAreaSelection = useCallback(() => {
    const session = selectionSessionRef.current;
    if (!session) return;

    if (session.rafId !== null) {
      window.cancelAnimationFrame(session.rafId);
      session.rafId = null;
      renderSelectionPreview();
    }

    const overlay = selectionOverlayRef.current;
    if (overlay) {
      overlay.style.display = "none";
      overlay.classList.remove(styles.selectionOverlayAnswers);
      overlay.style.width = "0px";
      overlay.style.height = "0px";
    }

    selectionSessionRef.current = null;
    suppressPaneClickRef.current = true;
    suppressQuestionClickRef.current = true;
    window.setTimeout(() => {
      suppressPaneClickRef.current = false;
      suppressQuestionClickRef.current = false;
    }, 120);
    const ids = session.currentIds;

    if (ids.length === 0) {
      if (session.mode === "answers" && session.questionId) {
        syncSelection([session.questionId], session.questionId, []);
      } else {
        clearSelection();
      }
      return;
    }

    if (session.mode === "answers" && session.questionId) {
      syncSelection([session.questionId], session.questionId, ids);
      return;
    }

    syncSelection(ids, ids.length === 1 ? ids[0] : null, []);
  }, [clearSelection, renderSelectionPreview, syncSelection]);

  const handleAreaSelectionPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionMode === "pan") return;
    if (event.button !== 0 || !event.shiftKey) return;

    const target = event.target as HTMLElement;
    if (target.closest(`.${styles.horizontalScroll}`)) return;
    const targetQuestion = target.closest<HTMLElement>("[data-question-id]");
    const answerQuestionId = targetQuestion?.dataset.questionId ?? null;
    const mode: "questions" | "answers" =
      answerQuestionId && answerQuestionId === selectedQuestionId
        ? "answers"
        : "questions";

    if (mode === "questions" && target.closest(".react-flow__node")) {
      return;
    }
    if (target.closest(".react-flow__controls") || target.closest(".react-flow__minimap")) {
      return;
    }

    const root = canvasRef.current;
    if (!root) return;

    event.preventDefault();
    event.stopPropagation();

    const session = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      latestX: event.clientX,
      latestY: event.clientY,
      rafId: null,
      baseSelectedIds:
        event.metaKey || event.ctrlKey
          ? mode === "answers"
            ? selectedAnswerIds
            : selectedQuestionIds
          : [],
      currentIds:
        event.metaKey || event.ctrlKey
          ? mode === "answers"
            ? selectedAnswerIds
            : selectedQuestionIds
          : [],
      questionId: mode === "answers" ? answerQuestionId : null,
      root,
    };
    selectionSessionRef.current = session;
    renderSelectionPreview();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const activeSession = selectionSessionRef.current;
      if (!activeSession || moveEvent.pointerId !== activeSession.pointerId) return;
      activeSession.latestX = moveEvent.clientX;
      activeSession.latestY = moveEvent.clientY;
      if (activeSession.rafId !== null) return;
      activeSession.rafId = window.requestAnimationFrame(renderSelectionPreview);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const activeSession = selectionSessionRef.current;
      if (!activeSession || upEvent.pointerId !== activeSession.pointerId) return;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      activeSession.latestX = upEvent.clientX;
      activeSession.latestY = upEvent.clientY;
      finishAreaSelection();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }, [finishAreaSelection, interactionMode, renderSelectionPreview, selectedAnswerIds, selectedQuestionId, selectedQuestionIds]);

  const handlePaneClick = useCallback(() => {
    if (suppressPaneClickRef.current) {
      suppressPaneClickRef.current = false;
      return;
    }
    if (interactionMode === "pan") return;
    clearSelection();
  }, [clearSelection, interactionMode]);

  const getHorizontalScrollMax = useCallback((zoom: number) => {
    const canvasWidth = canvasRef.current?.clientWidth ?? 0;
    const contentWidth =
      GRID_START_X * 2 +
      Math.max(0, sortedQuestions.length - 1) * GRID_X +
      300;
    return Math.max(0, contentWidth * zoom - canvasWidth + 240);
  }, [sortedQuestions.length]);

  const renderHorizontalScrollThumb = useCallback(() => {
    const scrollEl = horizontalScrollRef.current;
    const thumbEl = horizontalScrollThumbRef.current;
    if (!scrollEl || !thumbEl) return;
    const trackWidth = scrollEl.clientWidth;
    const maxScrollLeft = scrollEl.scrollWidth - trackWidth;
    const ratio = maxScrollLeft <= 0 ? 0 : scrollEl.scrollLeft / maxScrollLeft;
    const thumbWidth = maxScrollLeft <= 0
      ? trackWidth
      : clamp((trackWidth / scrollEl.scrollWidth) * trackWidth, 54, trackWidth);
    const maxThumbX = Math.max(0, trackWidth - thumbWidth);
    thumbEl.style.width = `${thumbWidth}px`;
    thumbEl.style.transform = `translateX(${maxThumbX * ratio}px)`;
  }, []);

  const syncHorizontalScrollFromViewport = useCallback((viewport: { x: number; zoom: number }) => {
    const scrollEl = horizontalScrollRef.current;
    if (!scrollEl) return;
    const maxViewportOffset = getHorizontalScrollMax(viewport.zoom);
    const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
    const nextScrollLeft =
      maxViewportOffset <= 0 || maxScrollLeft <= 0
        ? 0
        : clamp((-viewport.x / maxViewportOffset) * maxScrollLeft, 0, maxScrollLeft);
    if (Math.abs(scrollEl.scrollLeft - nextScrollLeft) < 1) return;
    syncingHorizontalScrollRef.current = true;
    scrollEl.scrollLeft = nextScrollLeft;
    renderHorizontalScrollThumb();
    window.requestAnimationFrame(() => {
      syncingHorizontalScrollRef.current = false;
    });
  }, [getHorizontalScrollMax, renderHorizontalScrollThumb]);

  const handleHorizontalScroll = useCallback(() => {
    renderHorizontalScrollThumb();
    if (syncingHorizontalScrollRef.current) return;
    const scrollEl = horizontalScrollRef.current;
    if (!scrollEl) return;
    const viewport = getViewport();
    const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
    const maxViewportOffset = getHorizontalScrollMax(viewport.zoom);
    const ratio = maxScrollLeft <= 0 ? 0 : scrollEl.scrollLeft / maxScrollLeft;
    void setViewport({
      ...viewport,
      x: maxViewportOffset <= 0 ? 0 : -maxViewportOffset * ratio,
    });
  }, [getHorizontalScrollMax, getViewport, renderHorizontalScrollThumb, setViewport]);

  const handleHorizontalThumbPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const scrollEl = horizontalScrollRef.current;
    const thumbEl = horizontalScrollThumbRef.current;
    if (!scrollEl || !thumbEl) return;
    const startX = event.clientX;
    const startScrollLeft = scrollEl.scrollLeft;
    const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
    const thumbWidth = thumbEl.offsetWidth;
    const maxThumbX = Math.max(1, scrollEl.clientWidth - thumbWidth);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      scrollEl.scrollLeft = clamp(
        startScrollLeft + (deltaX / maxThumbX) * maxScrollLeft,
        0,
        maxScrollLeft,
      );
      handleHorizontalScroll();
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }, [handleHorizontalScroll]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncHorizontalScrollFromViewport(getViewport());
      renderHorizontalScrollThumb();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [getViewport, renderHorizontalScrollThumb, sortedQuestions.length, syncHorizontalScrollFromViewport]);

  const nodes: Node[] = useMemo(() => {
    const stableOrdered = sortQuestions(draft.canvas);
    return stableOrdered.map((question, index) => ({
      id: question.id,
      type: "question",
      position: draft.canvas.layout[question.id] ?? { x: 0, y: 0 },
      draggable: false,
      className: "draft-flow-node",
      data: {
        question,
        index,
        selectedAnswerIds,
        copiedIds,
        copiedAnswerIds,
        interactionMode,
        issues: visibleIssues.filter(
          (issue) => questionIdForIssue(draft.canvas, issue) === question.id,
        ),
        dropErrorMessage:
          validationErrors.find((error) => error.targetId === question.id)?.message ?? null,
        onSelectQuestion: selectQuestionFromClick,
        onSelectAnswer: selectAnswerOnly,
        onDragStart: handleQuestionDragStart,
        onDragMove: handleQuestionDragMove,
        onDragEnd: handleQuestionDragEnd,
        onReorderAnswers: reorderAnswers,
        onDropAnswer: moveAnswerToQuestion,
      },
    }));
  }, [copiedAnswerIds, copiedIds, draft.canvas, handleQuestionDragEnd, handleQuestionDragMove, handleQuestionDragStart, interactionMode, moveAnswerToQuestion, reorderAnswers, selectAnswerOnly, selectQuestionFromClick, selectedAnswerIds, validationErrors, visibleIssues]);

  const handleNodesChange = useCallback(() => {
    // Positions are controlled by custom drag handlers for smoother motion.
  }, []);

  const undo = useCallback(() => {
    setHistoryIndex((idx) => {
      const next = Math.max(0, idx - 1);
      setDraft((prev) => ({ ...prev, canvas: history[next] ?? prev.canvas }));
      return next;
    });
  }, [history]);

  const redo = useCallback(() => {
    setHistoryIndex((idx) => {
      const next = Math.min(history.length - 1, idx + 1);
      setDraft((prev) => ({ ...prev, canvas: history[next] ?? prev.canvas }));
      return next;
    });
  }, [history]);

  useEffect(() => {
    void lockAdminTestDraft(draft.id)
      .then((res) => {
        const nextDraft = { ...res.draft, canvas: normalizeCanvas(res.draft.canvas) };
        lastSavedSnapshotRef.current = autosaveSnapshot(nextDraft);
        setDraft((prev) => ({ ...prev, ...nextDraft }));
        setLockWarning(null);
      })
      .catch((err: Error & { status?: number }) => {
        setLockWarning(err.message || "Драфт сейчас редактирует другой администратор");
      });
    const interval = window.setInterval(() => {
      void lockAdminTestDraft(draft.id).catch(() => {});
    }, 45000);
    return () => {
      window.clearInterval(interval);
      void unlockAdminTestDraft(draft.id).catch(() => {});
    };
  }, [draft.id]);

  useEffect(() => {
    if (!canEdit) return;
    if (currentAutosaveSnapshot === lastSavedSnapshotRef.current) return;
    const timeout = window.setTimeout(() => {
      const snapshotAtSaveStart = currentAutosaveSnapshot;
      setAutosaveState("saving");
      updateAdminTestDraft(draft.id, draft)
        .then((saved) => {
          lastSavedSnapshotRef.current = snapshotAtSaveStart;
          const nextDraft = { ...saved, canvas: normalizeCanvas(saved.canvas) };
          const nextSnapshot = autosaveSnapshot(nextDraft);
          setDraft((prev) => (nextSnapshot === snapshotAtSaveStart ? prev : { ...prev, ...nextDraft }));
          setAutosaveState("saved");
        })
        .catch(() => setAutosaveState("error"));
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [canEdit, currentAutosaveSnapshot, draft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        void copySelection();
      }
      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        void pasteSelection();
      }
      if (event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copySelection, pasteSelection, redo, undo]);

  const publish = async () => {
    const errors = validateDraft(draft);
    setValidationErrors(errors);
    if (errors.length > 0) return;
    try {
      await updateAdminTestDraft(draft.id, draft);
      const result = await publishAdminTestDraft(draft.id);
      if (result.testId) onPublished(result.testId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось опубликовать драфт";
      setValidationErrors([{ targetId: "publish", message }]);
    }
  };

  const autosaveLabel =
    autosaveState === "saving" ? "Сохраняем..." : autosaveState === "error" ? "Ошибка автосейва" : "Сохранено";

  return (
    <div
      className={`${styles.editor} ${inspectorCollapsed ? styles.editorInspectorCollapsed : ""}`}
      onClick={() => {
        setContextMenu(null);
        setQuestionTypeMenuOpen(false);
      }}
    >
      <div className={styles.mobileBlock}>
        <h1>Визуальный редактор тестов</h1>
        <p>Редактор рассчитан на большой экран, мышь или трекпад. Откройте его на desktop/tablet.</p>
        <Button type="button" onClick={onBack}>Назад</Button>
      </div>

      <aside className={styles.rail} aria-label="Инструменты">
        <button type="button" className={styles.railBack} onClick={onBack} data-tooltip="Назад">
          <ArrowLeft size={20} />
        </button>
        <button
          type="button"
          className={styles.railButton}
          data-tooltip={`Добавить вопрос: ${labelForType(insertQuestionType)}`}
          draggable
          onDragStart={(event) =>
            event.dataTransfer.setData(
              "application/x-cpm-question-type",
              insertQuestionType,
            )
          }
          onClick={() => addQuestion(insertQuestionType)}
        >
          <FileQuestion size={20} />
        </button>
        <div className={styles.railTypePicker} onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className={styles.railTypeButton}
            data-tooltip="Тип нового вопроса"
            onClick={() => setQuestionTypeMenuOpen((value) => !value)}
          >
            <span>{shortLabelForType(insertQuestionType)}</span>
            <ChevronDown size={14} />
          </button>
          {questionTypeMenuOpen ? (
            <div className={styles.railTypeMenu}>
              {(["single", "multiple", "text"] as AdminTestQuestionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`${styles.railTypeOption} ${insertQuestionType === type ? styles.railTypeOptionActive : ""}`}
                  onClick={() => {
                    setInsertQuestionType(type);
                    setQuestionTypeMenuOpen(false);
                  }}
                >
                  <span>{shortLabelForType(type)}</span>
                  <strong>{labelForType(type)}</strong>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" className={styles.railButton} onClick={() => addAnswer("answer")} data-tooltip="Добавить вариант ответа">
          <Check size={20} />
        </button>
        <button type="button" className={styles.railButton} onClick={() => addAnswer("textAnswer")} data-tooltip="Добавить текстовый ответ">
          <Clipboard size={20} />
        </button>
        <div className={styles.railSpacer} />
        <button type="button" className={styles.railButton} onClick={undo} data-tooltip="Отменить">
          <Undo2 size={18} />
        </button>
        <button type="button" className={styles.railButton} onClick={redo} data-tooltip="Повторить">
          <Redo2 size={18} />
        </button>
      </aside>

      <main className={styles.canvasShell}>
        {lockWarning ? <div className={styles.lockBanner}>{lockWarning}</div> : null}
        <header className={styles.topbar}>
          <MousePointer2 size={20} />
          <div className={styles.titleBlock}>
            <h1>{draft.title || "Без названия"}</h1>
            <p>
              {sortedQuestions.length} вопросов ·{" "}
              {draft.direction || "направление не выбрано"}
            </p>
          </div>
          <div className={styles.topbarActions}>
            <span className={styles.saveState}>{autosaveLabel}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void copySelection()}>
              Копировать
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void pasteSelection()}>
              Вставить
            </Button>
            <Button type="button" onClick={publish}>
              <Save size={16} /> Сохранить как тест
            </Button>
          </div>
        </header>

        <div
          ref={canvasRef}
          className={`${styles.canvas} ${interactionMode === "pan" ? styles.canvasPan : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const type = event.dataTransfer.getData("application/x-cpm-question-type") as AdminTestQuestionType;
            if (!type) return;
            addQuestion(type, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({ x: event.clientX, y: event.clientY });
          }}
          onPointerDownCapture={handleAreaSelectionPointerDown}
        >
          <div ref={selectionOverlayRef} className={styles.selectionOverlay} />
          <ReactFlow
            nodes={nodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onNodeClick={(_event, node) => {
              if (interactionMode === "pan") return;
              selectQuestionFromClick(node.id);
            }}
            onPaneClick={handlePaneClick}
            onMoveEnd={(_event, viewport) => syncHorizontalScrollFromViewport(viewport)}
            selectionOnDrag={false}
            panOnDrag={interactionMode === "pan"}
            fitView
            snapToGrid={false}
          >
            <Background gap={24} size={1} />
            <Controls position="bottom-left" showInteractive={false}>
              <ControlButton
                className={interactionMode === "select" ? styles.controlButtonActive : ""}
                title="Курсор"
                onClick={() => setInteractionMode("select")}
              >
                <MousePointer2 size={16} />
              </ControlButton>
              <ControlButton
                className={interactionMode === "pan" ? styles.controlButtonActive : ""}
                title="Рука"
                onClick={() => setInteractionMode("pan")}
              >
                <Hand size={16} />
              </ControlButton>
            </Controls>
          </ReactFlow>
          <div
            ref={horizontalScrollRef}
            className={styles.horizontalScroll}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onScroll={handleHorizontalScroll}
            aria-label="Горизонтальная прокрутка полотна"
          >
            <div
              ref={horizontalScrollThumbRef}
              className={styles.horizontalScrollThumb}
              onPointerDown={handleHorizontalThumbPointerDown}
            />
            <div
              className={styles.horizontalScrollContent}
              style={{
                width: `${Math.max(900, sortedQuestions.length * GRID_X + 420)}px`,
              }}
            />
          </div>
        </div>
      </main>

      <aside className={`${styles.inspector} ${inspectorCollapsed ? styles.inspectorCollapsed : ""}`}>
        <button
          type="button"
          className={styles.inspectorToggle}
          onClick={() => setInspectorCollapsed((value) => !value)}
          title={inspectorCollapsed ? "Развернуть панель" : "Свернуть панель"}
        >
          {inspectorCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
        {inspectorCollapsed ? null : (
          <>
        <div className={styles.inspectorHeader}>
          <h2>{selectedQuestion ? "Свойства вопроса" : "Настройки теста"}</h2>
          <p>{selectedAnswer ? "Выбран ответ внутри вопроса" : "Автосейв включён"}</p>
        </div>
        <div className={styles.inspectorBody}>
          {selectedQuestion ? (
            <>
              <label className={styles.field}>
                <span>Тип вопроса</span>
                <select
                  className={styles.select}
                  value={selectedQuestion.type}
                  onChange={(event) => updateQuestion(selectedQuestion.id, { type: event.target.value as AdminTestQuestionType })}
                >
                  <option value="single">Одиночный выбор</option>
                  <option value="multiple">Множественный выбор</option>
                  <option value="text">Текстовый ответ</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Текст вопроса</span>
                <textarea
                  className={styles.textarea}
                  value={selectedQuestion.text}
                  onChange={(event) => updateQuestion(selectedQuestion.id, { text: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span>Баллы</span>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  value={selectedQuestion.points}
                  onChange={(event) => updateQuestion(selectedQuestion.id, { points: Number(event.target.value) })}
                />
              </label>
              {selectedAnswer ? (
                <>
                  <label className={styles.field}>
                    <span>Текст ответа</span>
                    <textarea
                      className={styles.textarea}
                      value={selectedAnswer.text}
                      onChange={(event) => updateAnswer(selectedQuestion.id, selectedAnswer.id, { text: event.target.value })}
                    />
                  </label>
                  {selectedAnswer.kind === "answer" ? (
                    <label className={styles.switchLabel}>
                      <span>Правильный</span>
                      <input
                        type="checkbox"
                        checked={selectedAnswer.isCorrect}
                        onChange={(event) => updateAnswer(selectedQuestion.id, selectedAnswer.id, { isCorrect: event.target.checked })}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
              <Button type="button" variant="ghost" onClick={deleteSelection}>Удалить выбранное</Button>
            </>
          ) : (
            <>
              <label className={styles.field}>
                <span>Название теста</span>
                <input className={styles.input} value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Направление</span>
                <select className={styles.select} value={draft.direction} onChange={(event) => setDraft((prev) => ({ ...prev, direction: event.target.value }))}>
                  <option value="">Выберите направление</option>
                  {directions.map((direction) => (
                    <option key={direction.id} value={direction.name}>{direction.name}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Дата начала</span>
                <input className={styles.input} type="datetime-local" value={draft.startDate} onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Дата окончания</span>
                <input className={styles.input} type="datetime-local" value={draft.endDate} onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Лимит, минут</span>
                <input className={styles.input} type="number" min={1} value={draft.timeLimitMinutes} onChange={(event) => setDraft((prev) => ({ ...prev, timeLimitMinutes: Number(event.target.value) }))} />
              </label>
              <label className={styles.switchLabel}>
                <span>Видимость теста для студентов</span>
                <input type="checkbox" checked={draft.published} onChange={(event) => setDraft((prev) => ({ ...prev, published: event.target.checked }))} />
              </label>
              <label className={styles.switchLabel}>
                <span>Показ правильных ответов</span>
                <input type="checkbox" checked={draft.visible} onChange={(event) => setDraft((prev) => ({ ...prev, visible: event.target.checked }))} />
              </label>
            </>
          )}

          {visibleIssues.length > 0 ? (
            <div className={styles.issueSummary}>
              {issueCounts.errors > 0 ? (
                <span className={styles.issueSummaryError}>{issueCounts.errors} ошибок</span>
              ) : null}
              {issueCounts.warnings > 0 ? (
                <span className={styles.issueSummaryWarning}>{issueCounts.warnings} предупреждений</span>
              ) : null}
              {generalIssues.map((issue, index) => (
                <p key={`${issue.targetId}-${index}`} className={styles.issueSummaryGeneral}>
                  {issue.message}
                </p>
              ))}
              <p>Детали по вопросам открываются по значкам над карточками.</p>
            </div>
          ) : null}
        </div>
          </>
        )}
      </aside>

      {contextMenu ? (
        <div className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button type="button" onClick={() => void copySelection()}>Копировать</button>
          <button type="button" onClick={() => void pasteSelection()}>Вставить</button>
          <button type="button" onClick={deleteSelection}>Удалить</button>
        </div>
      ) : null}
    </div>
  );
}
