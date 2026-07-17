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
  ChevronRight,
  FileQuestion,
  Redo2,
  Save,
  Settings,
  Scissors,
  Trash2,
  Undo2,
  CircleDot,
  GripVertical,
  ListChecks,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminAnswerBulkSplitModal } from "@/components/admin/tests/admin-answer-bulk-split-modal";
import { AdminAnswerSplitModal } from "@/components/admin/tests/admin-answer-split-modal";
import { AdminTestDraftFlowOverlay } from "@/components/admin/tests/admin-test-draft-flow-overlay";
import { AdminTestChangeHistoryPanel } from "@/components/admin/tests/admin-test-change-history-panel";
import { AdminTestDraftQuestionSearch } from "@/components/admin/tests/admin-test-draft-question-search";
import {
  CARD_MIN_HEIGHT,
  CARD_WIDTH,
  GRID_START_X,
  GRID_START_Y,
  GRID_X,
  linearizeLayout,
  reorderQuestionsAsBlock,
  slotX,
  sortQuestions,
} from "@/components/admin/tests/admin-test-draft-flow-layout";
import styles from "@/components/admin/tests/admin-test-draft-editor.module.css";
import { canvasStateToTestFormData, parseQuestionIdFromCanvasId } from "@/lib/admin/admin-test-canvas-adapter";
import {
  deleteAdminTestDraft,
  lockAdminTestDraft,
  publishAdminTestDraft,
  unlockAdminTestDraft,
  updateAdminTestDraft,
} from "@/lib/admin/admin-test-drafts-api";
import { updateAdminTest } from "@/lib/admin/admin-tests-api";
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
import {
  applyAnswerSplitToQuestion,
  applyBulkAnswerSplit,
  findBulkSplitCandidates,
  type BulkSplitCandidate,
  type BulkSplitPreviewRow,
} from "@/lib/admin/admin-answer-split";
import { convertQuestionAnswersOnTypeChange } from "@/lib/admin/admin-test-draft-convert";
import type { AdminTestQuestionType } from "@/lib/admin/admin-tests-types";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

const CLIPBOARD_KEY = "application/x-cpm-test-draft";

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

function questionSnapshot(question: DraftQuestionNode) {
  return JSON.stringify({
    id: question.id,
    type: question.type,
    text: question.text,
    points: question.points,
    answers: question.answers.map((answer) => ({
      id: answer.id,
      kind: answer.kind,
      text: answer.text,
      isCorrect: answer.isCorrect,
    })),
  });
}

function normalizeCanvas(canvas?: DraftCanvasModel): DraftCanvasModel {
  const questions = canvas?.questions ?? [];
  const ordered = sortQuestions({ questions, layout: canvas?.layout ?? {} });
  return {
    questions: ordered,
    layout: linearizeLayout(ordered),
  };
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

const QUESTION_TEXT_PLACEHOLDER = "Текст вопроса";
const ANSWER_TEXT_PLACEHOLDER = "Вариант ответа";
const TEXT_ANSWER_PLACEHOLDER = "Текстовый ответ";
const AREA_SELECT_DRAG_THRESHOLD = 4;
const DEFAULT_NEW_QUESTION_TYPE: AdminTestQuestionType = "single";

function questionEditDraft(text: string) {
  return text.trim() ? text : QUESTION_TEXT_PLACEHOLDER;
}

function answerEditDraft(text: string, kind: DraftAnswerNode["kind"]) {
  if (text.trim()) return text;
  return kind === "textAnswer" ? TEXT_ANSWER_PLACEHOLDER : ANSWER_TEXT_PLACEHOLDER;
}

const QUESTION_TYPE_OPTIONS: Array<{
  type: AdminTestQuestionType;
  label: string;
  description: string;
  Icon: typeof CircleDot;
}> = [
  {
    type: "single",
    label: "Один ответ",
    description: "Студент выбирает один правильный вариант",
    Icon: CircleDot,
  },
  {
    type: "multiple",
    label: "Несколько",
    description: "Можно отметить несколько правильных вариантов",
    Icon: ListChecks,
  },
  {
    type: "text",
    label: "Текстовый",
    description: "Студент вводит ответ текстом",
    Icon: Type,
  },
];

function QuestionPointsBadge({
  points,
  onChange,
}: {
  points: number;
  onChange: (points: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(points));

  useEffect(() => {
    if (!editing) setDraft(String(points));
  }, [editing, points]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : points);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className={styles.questionPointsEdit} data-question-meta="true">
        <input
          type="number"
          min={1}
          className={styles.questionPointsInput}
          value={draft}
          autoFocus
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setDraft(String(points));
              setEditing(false);
            }
          }}
        />
        <span className={styles.questionPointsSuffix}>б.</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={styles.questionPoints}
      data-question-meta="true"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
    >
      <span className={styles.questionPointsValue}>{points}</span>
      <span className={styles.questionPointsSuffix}>б.</span>
    </button>
  );
}

function QuestionTypePicker({
  type,
  onChange,
}: {
  type: AdminTestQuestionType;
  onChange: (type: AdminTestQuestionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = QUESTION_TYPE_OPTIONS.find((option) => option.type === type) ?? QUESTION_TYPE_OPTIONS[0];
  const CurrentIcon = current.Icon;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as HTMLElement)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`${styles.questionTypePicker} nopan`} data-question-meta="true">
      <button
        type="button"
        className={`${styles.questionTypePickerButton} ${open ? styles.questionTypePickerButtonOpen : ""}`}
        aria-label={`Тип вопроса: ${current.label}`}
        aria-expanded={open}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <CurrentIcon size={22} strokeWidth={2} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className={styles.questionTypeMenu}
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {QUESTION_TYPE_OPTIONS.map((option) => {
            const OptionIcon = option.Icon;
            const active = option.type === type;
            return (
              <button
                key={option.type}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`${styles.questionTypeOption} ${active ? styles.questionTypeOptionActive : ""}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(option.type);
                  setOpen(false);
                }}
              >
                <span className={styles.questionTypeOptionIcon}>
                  <OptionIcon size={18} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className={styles.questionTypeOptionCopy}>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
                {active ? <Check size={16} className={styles.questionTypeOptionCheck} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AnswerCorrectMark({
  questionType,
  isCorrect,
  onToggle,
}: {
  questionType: AdminTestQuestionType;
  isCorrect: boolean;
  onToggle: () => void;
}) {
  if (questionType === "text") {
    return (
      <span className={styles.answerTextTypeMark} aria-label="Текстовый ответ" title="Текстовый ответ">
        T
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.answerCorrectMark} ${isCorrect ? styles.answerCorrectMarkActive : ""}`}
      aria-label={isCorrect ? "Правильный ответ" : "Отметить как правильный"}
      aria-pressed={isCorrect}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {isCorrect ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
    </button>
  );
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

function AnswerInsertSlot({
  label,
  onAdd,
  suppressed = false,
}: {
  label: string;
  onAdd: () => void;
  suppressed?: boolean;
}) {
  return (
    <div
      className={`${styles.answerInsertZone} ${suppressed ? styles.answerInsertZoneSuppressed : ""}`}
      data-answer-insert="true"
    >
      <button
        type="button"
        className={`nopan ${styles.answerInsertButton}`}
        aria-label={label}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onAdd();
        }}
      >
        <span className={styles.answerInsertChip}>
          <span className={styles.answerInsertPlus}>+</span>
        </span>
      </button>
    </div>
  );
}

function InlineTextEditor({
  editing,
  value,
  draft,
  placeholder,
  className,
  inputClassName,
  interactive = true,
  selectAllOnFocus = false,
  onStartEdit,
  onDraftChange,
  onCommit,
}: {
  editing: boolean;
  value: string;
  draft: string;
  placeholder: string;
  className: string;
  inputClassName: string;
  interactive?: boolean;
  selectAllOnFocus?: boolean;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus();
    if (selectAllOnFocus) {
      inputRef.current.select();
      return;
    }
    const length = inputRef.current.value.length;
    inputRef.current.setSelectionRange(length, length);
  }, [editing, selectAllOnFocus]);

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        data-inline-editable="true"
        className={`${className} ${inputClassName}`}
        value={draft}
        rows={1}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={onCommit}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCommit();
          }
        }}
      />
    );
  }

  if (!interactive) {
    return <span className={className}>{value || placeholder}</span>;
  }

  return (
    <span
      data-inline-editable="true"
      className={`${className} ${styles.inlineTextDisplay}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onStartEdit();
      }}
    >
      {value || placeholder}
    </span>
  );
}

function SortableAnswer({
  answer,
  questionType,
  selected,
  previewSelected,
  editing,
  copied,
  dragAnswerIds,
  editDraft,
  onSelect,
  onStartEdit,
  onDraftChange,
  onCommitEdit,
  onToggleCorrect,
  onSplit,
}: {
  answer: DraftAnswerNode;
  questionType: AdminTestQuestionType;
  selected: boolean;
  previewSelected: boolean;
  editing: boolean;
  copied: boolean;
  dragAnswerIds: string[];
  editDraft: string;
  onSelect: (additive: boolean) => void;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onCommitEdit: () => void;
  onToggleCorrect: () => void;
  onSplit: () => void;
}) {
  const placeholder =
    answer.kind === "textAnswer" ? TEXT_ANSWER_PLACEHOLDER : ANSWER_TEXT_PLACEHOLDER;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: answer.id,
    disabled: editing,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleNativeDragStart = (event: ReactDragEvent<HTMLDivElement>) => {
    if (editing) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
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
          <span>${answer.text || placeholder}</span>
          <strong>${dragAnswerIds.length}</strong>
        </div>
      `;
      document.body.appendChild(preview);
      event.dataTransfer.setDragImage(preview, 18, 18);
      window.setTimeout(() => preview.remove(), 0);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-answer-chip="true"
      data-answer-id={answer.id}
      className={`${styles.answerChip} nopan ${selected ? styles.answerChipSelected : ""} ${previewSelected ? styles.answerChipPreviewSelected : ""} ${editing ? styles.answerChipEditing : ""} ${copied ? styles.answerChipCopied : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        if (editing) return;
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
          onSelect(true);
          return;
        }
        if (selected) {
          onStartEdit();
          return;
        }
        onSelect(false);
      }}
    >
      <button
        type="button"
        className={styles.answerReorderHandle}
        aria-label="Переставить внутри вопроса"
        disabled={editing}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...(!editing ? listeners : {})}
      >
        <GripVertical size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <AnswerCorrectMark
        questionType={questionType}
        isCorrect={answer.isCorrect}
        onToggle={onToggleCorrect}
      />
      <div
        className={styles.answerDragBody}
        draggable={!editing}
        onDragStart={handleNativeDragStart}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <InlineTextEditor
          editing={editing}
          value={answer.text}
          draft={editDraft}
          placeholder={placeholder}
          className={styles.answerText}
          inputClassName={styles.answerTextInput}
          interactive={false}
          selectAllOnFocus={editing && !answer.text.trim()}
          onStartEdit={onStartEdit}
          onDraftChange={onDraftChange}
          onCommit={onCommitEdit}
        />
      </div>
      {selected && !editing ? (
        <button
          type="button"
          className={styles.answerSplitButton}
          aria-label="Разобрать ответ"
          title="Разобрать ответ"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onSplit();
          }}
        >
          <Scissors size={13} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
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
    onAddAnswer: (questionId: string) => void;
    onSplitAnswer: (questionId: string, answerId: string) => void;
    onQuestionGrabStart: () => void;
    onQuestionGrabEnd: () => void;
    editingQuestion: boolean;
    editingAnswerId: string | null;
    inlineEditDraft: string;
    onBeginEditQuestion: (questionId: string, text: string) => void;
    onBeginEditAnswer: (questionId: string, answerId: string, text: string, kind: DraftAnswerNode["kind"]) => void;
    onInlineEditDraftChange: (value: string) => void;
    onCommitInlineEdit: () => void;
    onChangeQuestionType: (questionId: string, type: AdminTestQuestionType) => void;
    onUpdateQuestionPoints: (questionId: string, points: number) => void;
    onToggleAnswerCorrect: (questionId: string, answerId: string) => void;
    isQuestionDirty: boolean;
    disableQuestionReorder: boolean;
    areaSelectionPreview: {
      mode: "questions" | "answers";
      questionId: string | null;
      ids: string[];
    } | null;
    selectedQuestionIds: string[];
    shiftKeyHeld: boolean;
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const copied = data.copiedIds.includes(data.question.id);
  const hasDropError = Boolean(data.dropErrorMessage);
  const previewQuestionSelected =
    data.areaSelectionPreview?.mode === "questions" &&
    data.areaSelectionPreview.ids.includes(data.question.id);
  const previewAnswerIds =
    data.areaSelectionPreview?.mode === "answers" &&
    data.areaSelectionPreview.questionId === data.question.id
      ? data.areaSelectionPreview.ids
      : [];
  const questionSelected =
    data.selectedQuestionIds.includes(data.question.id) &&
    data.selectedAnswerIds.length === 0;
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
    element: HTMLDivElement;
  } | null>(null);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      data.onReorderAnswers(data.question.id, String(active.id), String(over.id));
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-answer-chip='true']")) return;
    if (target.closest("[data-inline-editable='true']")) return;
    if (target.closest("[data-answer-insert='true']")) return;
    if (target.closest("[data-question-meta='true']")) return;
    if (data.disableQuestionReorder) {
      event.stopPropagation();
      event.preventDefault();
      data.onSelectQuestion(data.question.id);
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    data.onQuestionGrabStart();

    pointerState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      grabOffsetX: event.clientX - event.currentTarget.getBoundingClientRect().left,
      grabOffsetY: event.clientY - event.currentTarget.getBoundingClientRect().top,
      dragging: false,
      element: event.currentTarget,
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

      if (state.element.hasPointerCapture(upEvent.pointerId)) {
        state.element.releasePointerCapture(upEvent.pointerId);
      }
      data.onQuestionGrabEnd();
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
      className={`nopan ${styles.questionNode} ${questionSelected ? styles.questionNodeSelected : ""} ${copied ? styles.questionNodeCopied : ""} ${hasDropError ? styles.questionNodeDropError : ""} ${previewQuestionSelected ? styles.questionNodePreviewSelected : ""} ${data.isQuestionDirty ? styles.questionNodeDirty : ""}`}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        event.stopPropagation();
        if ((event.target as HTMLElement).closest("[data-inline-editable='true']")) return;
        if ((event.target as HTMLElement).closest("[data-question-meta='true']")) return;
        data.onCommitInlineEdit();
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
        <div className={styles.questionHeadActions}>
          <QuestionPointsBadge
            points={data.question.points}
            onChange={(points) => data.onUpdateQuestionPoints(data.question.id, points)}
          />
          <QuestionTypePicker
            type={data.question.type}
            onChange={(type) => data.onChangeQuestionType(data.question.id, type)}
          />
        </div>
      </div>
      <div className={styles.questionBody}>
        <InlineTextEditor
          editing={data.editingQuestion}
          value={data.question.text}
          draft={data.inlineEditDraft}
          placeholder={QUESTION_TEXT_PLACEHOLDER}
          className={styles.questionText}
          inputClassName={styles.questionTextInput}
          selectAllOnFocus={data.editingQuestion && !data.question.text.trim()}
          onStartEdit={() => data.onBeginEditQuestion(data.question.id, data.question.text)}
          onDraftChange={data.onInlineEditDraftChange}
          onCommit={data.onCommitInlineEdit}
        />
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
                    questionType={data.question.type}
                    selected={data.selectedAnswerIds.includes(answer.id)}
                    previewSelected={previewAnswerIds.includes(answer.id)}
                    editing={data.editingAnswerId === answer.id}
                    copied={data.copiedAnswerIds.includes(answer.id)}
                    dragAnswerIds={
                      data.selectedAnswerIds.includes(answer.id) && data.selectedAnswerIds.length > 0
                        ? data.selectedAnswerIds
                        : [answer.id]
                    }
                    editDraft={data.inlineEditDraft}
                    onSelect={(additive) =>
                      data.onSelectAnswer(
                        data.question.id,
                        answer.id,
                        additive,
                      )
                    }
                    onStartEdit={() =>
                      data.onBeginEditAnswer(
                        data.question.id,
                        answer.id,
                        answer.text,
                        answer.kind,
                      )
                    }
                    onDraftChange={data.onInlineEditDraftChange}
                    onCommitEdit={data.onCommitInlineEdit}
                    onToggleCorrect={() =>
                      data.onToggleAnswerCorrect(data.question.id, answer.id)
                    }
                    onSplit={() => data.onSplitAnswer(data.question.id, answer.id)}
                  />
                ))
              )}
              <AnswerInsertSlot
                label={
                  data.question.type === "text" ? "Добавить текстовый ответ" : "Добавить вариант ответа"
                }
                suppressed={data.shiftKeyHeld}
                onAdd={() => data.onAddAnswer(data.question.id)}
              />
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

const nodeTypes = { question: QuestionNode };

type EditorPersistenceMode = "draft" | "test";

interface AdminTestDraftEditorProps {
  draft: AdminTestDraft;
  directions: Direction[];
  persistenceMode?: EditorPersistenceMode;
  sourceTestId?: string;
  disableQuestionReorder?: boolean;
  onBack: () => void;
  onPublished?: (testId: string) => void;
  onTestSaved?: (testId: string) => void;
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
  persistenceMode = "draft",
  sourceTestId,
  disableQuestionReorder = false,
  onBack,
  onPublished,
  onTestSaved,
}: AdminTestDraftEditorProps) {
  const { user } = useAuth();
  const { screenToFlowPosition, getViewport, setViewport, setCenter } = useReactFlow();
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
  const [areaSelectionPreview, setAreaSelectionPreview] = useState<{
    mode: "questions" | "answers";
    questionId: string | null;
    ids: string[];
  } | null>(null);
  const [shiftKeyHeld, setShiftKeyHeld] = useState(false);
  const [selectedAnswerIds, setSelectedAnswerIds] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<DraftValidationError[]>([]);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("saved");
  const [lockWarning, setLockWarning] = useState<string | null>(null);
  const [copiedIds, setCopiedIds] = useState<string[]>([]);
  const [copiedAnswerIds, setCopiedAnswerIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [answerSplitTarget, setAnswerSplitTarget] = useState<{
    questionId: string;
    answerId: string;
  } | null>(null);
  const [bulkSplitCandidates, setBulkSplitCandidates] = useState<
    BulkSplitCandidate[] | null
  >(null);
  const [history, setHistory] = useState<DraftCanvasModel[]>([normalizeCanvas(initialDraft.canvas)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<"properties" | "history">("properties");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [questionGrabActive, setQuestionGrabActive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [savedDraft, setSavedDraft] = useState<AdminTestDraft>({
    ...normalizedInitialDraft,
  });
  const lastSavedSnapshotRef = useRef(autosaveSnapshot(normalizedInitialDraft));
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollThumbRef = useRef<HTMLDivElement | null>(null);
  const selectionOverlayRef = useRef<HTMLDivElement | null>(null);
  const validationTimerRef = useRef<number | null>(null);
  const syncingHorizontalScrollRef = useRef(false);
  const suppressPaneClickRef = useRef(false);
  const suppressQuestionClickRef = useRef(false);
  const suppressAnswerClickRef = useRef(false);
  const areaSelectionListenersRef = useRef<{
    move: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
  } | null>(null);
  const areaSelectGuardRef = useRef<((event: Event) => void) | null>(null);
  const areaSelectCaptureRef = useRef<{ root: HTMLDivElement; pointerId: number } | null>(null);
  const inlineEditRef = useRef<{
    kind: "question" | "answer";
    questionId: string;
    answerId?: string;
    draft: string;
  } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{
    kind: "question" | "answer";
    questionId: string;
    answerId?: string;
    draft: string;
  } | null>(null);
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
      cardEl: HTMLDivElement;
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
  const isTestPersistence = persistenceMode === "test";
  const canEdit =
    isTestPersistence || !draft.lockedBy || String(draft.lockedBy) === String(user?.id);
  const requireExplicitSave = isTestPersistence;
  const currentAutosaveSnapshot = useMemo(() => autosaveSnapshot(draft), [draft]);
  const hasUnsavedChanges =
    currentAutosaveSnapshot !== autosaveSnapshot(savedDraft);
  const savedQuestionSnapshotById = useMemo(() => {
    const map = new Map<string, string>();
    for (const question of savedDraft.canvas.questions) {
      map.set(question.id, questionSnapshot(question));
    }
    return map;
  }, [savedDraft.canvas.questions]);
  const changedQuestionIds = useMemo(() => {
    const result = new Set<string>();
    for (const question of draft.canvas.questions) {
      const current = questionSnapshot(question);
      const saved = savedQuestionSnapshotById.get(question.id);
      if (!saved || saved !== current) result.add(question.id);
    }
    return result;
  }, [draft.canvas.questions, savedQuestionSnapshotById]);

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
          next.answers = convertQuestionAnswersOnTypeChange(
            question.type,
            patch.type,
            question.answers,
            uid,
          );
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

  const setInlineEditState = useCallback(
    (
      next: {
        kind: "question" | "answer";
        questionId: string;
        answerId?: string;
        draft: string;
      } | null,
    ) => {
      inlineEditRef.current = next;
      setInlineEdit(next);
    },
    [],
  );

  const commitInlineEdit = useCallback(() => {
    const current = inlineEditRef.current;
    if (!current) return;
    if (current.kind === "question") {
      updateQuestion(current.questionId, { text: current.draft });
    } else if (current.answerId) {
      updateAnswer(current.questionId, current.answerId, { text: current.draft });
    }
    setInlineEditState(null);
  }, [setInlineEditState, updateAnswer, updateQuestion]);

  const changeQuestionType = useCallback(
    (questionId: string, type: AdminTestQuestionType) => {
      commitInlineEdit();
      const question = draft.canvas.questions.find((item) => item.id === questionId);
      if (!question || question.type === type) return;

      const convertedAnswers = convertQuestionAnswersOnTypeChange(
        question.type,
        type,
        question.answers,
        uid,
      );
      updateQuestion(questionId, { type });

      const convertedIdSet = new Set(convertedAnswers.map((answer) => answer.id));
      const nextAnswerIds =
        selectedQuestionId === questionId
          ? selectedAnswerIds.filter((id) => convertedIdSet.has(id))
          : [];
      syncSelection([questionId], questionId, nextAnswerIds);
    },
    [
      commitInlineEdit,
      draft.canvas.questions,
      selectedAnswerIds,
      selectedQuestionId,
      syncSelection,
      updateQuestion,
    ],
  );

  const updateQuestionPoints = useCallback(
    (questionId: string, points: number) => {
      commitInlineEdit();
      updateQuestion(questionId, { points });
    },
    [commitInlineEdit, updateQuestion],
  );

  const toggleAnswerCorrect = useCallback(
    (questionId: string, answerId: string) => {
      const question = draft.canvas.questions.find((item) => item.id === questionId);
      if (!question || question.type === "text") return;
      const answer = question.answers.find((item) => item.id === answerId);
      if (!answer || answer.kind !== "answer") return;
      if (question.type === "single") {
        updateAnswer(questionId, answerId, { isCorrect: true });
        return;
      }
      updateAnswer(questionId, answerId, { isCorrect: !answer.isCorrect });
    },
    [draft.canvas.questions, updateAnswer],
  );

  const selectAnswerOnly = useCallback(
    (questionId: string, answerId: string, additive = false) => {
      if (suppressAnswerClickRef.current) {
        suppressAnswerClickRef.current = false;
        return;
      }
      const current = inlineEditRef.current;
      if (
        current &&
        !(
          current.kind === "answer" &&
          current.questionId === questionId &&
          current.answerId === answerId
        )
      ) {
        commitInlineEdit();
      }

      let nextAnswerIds: string[];
      if (!additive || selectedQuestionId !== questionId) {
        nextAnswerIds = [answerId];
      } else if (selectedAnswerIds.includes(answerId)) {
        nextAnswerIds = selectedAnswerIds.filter((id) => id !== answerId);
      } else {
        nextAnswerIds = [...selectedAnswerIds, answerId];
      }

      syncSelection([questionId], questionId, nextAnswerIds);
    },
    [commitInlineEdit, selectedAnswerIds, selectedQuestionId, syncSelection],
  );

  const beginInlineEditQuestion = useCallback(
    (questionId: string, text: string) => {
      commitInlineEdit();
      selectQuestionOnly(questionId);
      setInlineEditState({
        kind: "question",
        questionId,
        draft: questionEditDraft(text),
      });
    },
    [commitInlineEdit, selectQuestionOnly, setInlineEditState],
  );

  const beginInlineEditAnswer = useCallback(
    (questionId: string, answerId: string, text: string, kind: DraftAnswerNode["kind"]) => {
      commitInlineEdit();
      selectAnswerOnly(questionId, answerId, false);
      setInlineEditState({
        kind: "answer",
        questionId,
        answerId,
        draft: answerEditDraft(text, kind),
      });
    },
    [commitInlineEdit, selectAnswerOnly, setInlineEditState],
  );

  const updateInlineEditDraft = useCallback(
    (draft: string) => {
      setInlineEditState(
        inlineEditRef.current ? { ...inlineEditRef.current, draft } : null,
      );
    },
    [setInlineEditState],
  );

  const selectQuestionFromClick = useCallback((questionId: string) => {
    if (suppressQuestionClickRef.current) {
      suppressQuestionClickRef.current = false;
      return;
    }
    const question = draft.canvas.questions.find((item) => item.id === questionId);
    if (question && !question.text.trim()) {
      beginInlineEditQuestion(questionId, question.text);
      return;
    }
    commitInlineEdit();
    selectQuestionOnly(questionId);
  }, [beginInlineEditQuestion, commitInlineEdit, draft.canvas.questions, selectQuestionOnly]);

  const selectAllAnswersInQuestion = useCallback(
    (questionId: string) => {
      const question = draft.canvas.questions.find((item) => item.id === questionId);
      if (!question || question.answers.length === 0) return;
      commitInlineEdit();
      syncSelection(
        [questionId],
        questionId,
        question.answers.map((answer) => answer.id),
      );
    },
    [commitInlineEdit, draft.canvas.questions, syncSelection],
  );

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

  const insertQuestionAt = useCallback((insertIndex: number, type: AdminTestQuestionType) => {
    const created = defaultQuestion(type, { x: 0, y: GRID_START_Y });
    mutateCanvas((canvas) => {
      const ordered = sortQuestions(canvas);
      const nextQuestions = [
        ...ordered.slice(0, insertIndex),
        created.question,
        ...ordered.slice(insertIndex),
      ];
      return {
        questions: nextQuestions,
        layout: linearizeLayout(nextQuestions),
      };
    });
    selectQuestionOnly(created.question.id);
  }, [mutateCanvas, selectQuestionOnly]);

  const appendAnswerToQuestion = useCallback(
    (questionId: string, kind: "answer" | "textAnswer") => {
      const question = draft.canvas.questions.find((item) => item.id === questionId);
      if (!question) return;
      if (question.type === "text" && kind !== "textAnswer") {
        showValidationError({
          targetId: question.id,
          message: "Обычный ответ нельзя добавить в текстовый вопрос",
        });
        return;
      }
      if (question.type !== "text" && kind === "textAnswer") {
        showValidationError({
          targetId: question.id,
          message: "Текстовый ответ можно добавить только в текстовый вопрос",
        });
        return;
      }
      const answer: DraftAnswerNode = {
        id: uid(kind === "textAnswer" ? "text" : "a"),
        kind,
        text: "",
        isCorrect: kind === "textAnswer",
      };
      updateQuestion(questionId, { answers: [...question.answers, answer] });
      selectAnswerOnly(questionId, answer.id, false);
    },
    [draft.canvas.questions, selectAnswerOnly, showValidationError, updateQuestion],
  );

  const addAnswerToQuestion = useCallback(
    (questionId: string) => {
      const question = draft.canvas.questions.find((item) => item.id === questionId);
      if (!question) return;
      appendAnswerToQuestion(questionId, question.type === "text" ? "textAnswer" : "answer");
    },
    [appendAnswerToQuestion, draft.canvas.questions],
  );

  const openAnswerSplit = useCallback((questionId: string, answerId: string) => {
    setAnswerSplitTarget({ questionId, answerId });
  }, []);

  const applyAnswerSplit = useCallback(
    (parts: string[], targetType: AdminTestQuestionType) => {
      if (!answerSplitTarget) {
        return;
      }
      const { questionId, answerId } = answerSplitTarget;
      const question = draft.canvas.questions.find((item) => item.id === questionId);
      if (!question) {
        setAnswerSplitTarget(null);
        return;
      }
      const nextQuestion = applyAnswerSplitToQuestion(
        question,
        answerId,
        parts,
        targetType,
        uid,
      );
      updateQuestion(questionId, {
        type: nextQuestion.type,
        answers: nextQuestion.answers,
      });
      const firstNewId = nextQuestion.answers[0]?.id;
      if (firstNewId) {
        selectAnswerOnly(questionId, firstNewId, false);
      } else {
        selectQuestionOnly(questionId);
      }
      setAnswerSplitTarget(null);
    },
    [
      answerSplitTarget,
      draft.canvas.questions,
      selectAnswerOnly,
      selectQuestionOnly,
      updateQuestion,
    ],
  );

  const openBulkAnswerSplit = useCallback(() => {
    const candidates = findBulkSplitCandidates(draft.canvas.questions);
    if (candidates.length === 0) {
      window.alert("Нет text-вопросов с одним ответом для расшифровки");
      return;
    }
    setBulkSplitCandidates(candidates);
  }, [draft.canvas.questions]);

  const applyBulkAnswerSplitBatch = useCallback(
    (rows: BulkSplitPreviewRow[], targetType: AdminTestQuestionType) => {
      mutateCanvas((canvas) => ({
        ...canvas,
        questions: applyBulkAnswerSplit(canvas.questions, rows, targetType, uid),
      }));
      setBulkSplitCandidates(null);
    },
    [mutateCanvas],
  );

  const addAnswer = useCallback((kind: "answer" | "textAnswer") => {
    if (!selectedQuestion) return;
    appendAnswerToQuestion(selectedQuestion.id, kind);
  }, [appendAnswerToQuestion, selectedQuestion]);

  const deleteSelection = useCallback(() => {
    if (requireExplicitSave) {
      window.alert("Удаление в этом режиме отключено.");
      return;
    }
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
  }, [clearSelection, mutateCanvas, requireExplicitSave, selectQuestionOnly, selectedAnswerIds, selectedQuestion, selectedQuestionId, updateQuestion]);

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

  const beginQuestionGrab = useCallback(() => {
    setQuestionGrabActive(true);
  }, []);

  const endQuestionGrab = useCallback(() => {
    setQuestionGrabActive(false);
  }, []);

  const handleQuestionDragStart = useCallback((questionId: string) => {
    if (disableQuestionReorder) return;
    const groupIds =
      selectedQuestionIds.length > 1 && selectedQuestionIds.includes(questionId)
        ? selectedQuestionIds
        : [questionId];
    const items = groupIds
      .map((id) => {
        const nodeEl = canvasRef.current?.querySelector<HTMLDivElement>(
          `.react-flow__node[data-id="${id}"]`,
        );
        const cardEl = nodeEl?.querySelector<HTMLDivElement>(`[data-question-id="${id}"]`);
        if (!nodeEl || !cardEl) return null;
        return {
          questionId: id,
          baseX: draft.canvas.layout[id]?.x ?? GRID_START_X,
          nodeEl,
          cardEl,
        };
      })
      .filter(
        (
          item,
        ): item is {
          questionId: string;
          baseX: number;
          nodeEl: HTMLDivElement;
          cardEl: HTMLDivElement;
        } => item !== null,
      );
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
  }, [disableQuestionReorder, draft.canvas.layout, selectedQuestionIds]);

  const handleQuestionDragMove = useCallback(
    (
      questionId: string,
      clientX: number,
      clientY: number,
      grabOffsetX: number,
      grabOffsetY: number,
    ) => {
      if (disableQuestionReorder) return;
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
          item.cardEl.style.transform = `translate(${activeSession.pendingDeltaX}px, 0px)`;
        });
      });
    },
    [disableQuestionReorder, screenToFlowPosition],
  );

  const clearDragSessionStyles = useCallback((session: NonNullable<typeof dragSessionRef.current>) => {
    session.items.forEach((item) => {
      item.nodeEl.classList.remove("is-dragging");
      item.nodeEl.classList.remove("is-stack-anchor");
      item.nodeEl.removeAttribute("data-drag-count");
      item.cardEl.style.transform = "";
      item.nodeEl.style.zIndex = "";
    });
  }, []);

  const clearAllCardTransforms = useCallback(() => {
    canvasRef.current?.querySelectorAll<HTMLElement>("[data-question-id]").forEach((cardEl) => {
      cardEl.style.transform = "";
    });
  }, []);

  const handleQuestionDragEnd = useCallback(
    (
      questionId: string,
      clientX: number,
      clientY: number,
      grabOffsetX: number,
      grabOffsetY: number,
    ) => {
      if (disableQuestionReorder) return;
      const flowPosition = screenToFlowPosition({
        x: clientX - grabOffsetX,
        y: clientY - grabOffsetY,
      });
      const session = dragSessionRef.current;
      if (session?.rafId !== null && session?.rafId !== undefined) {
        window.cancelAnimationFrame(session.rafId);
      }

      const prevOrder = sortQuestions(draft.canvas).map((question) => question.id);
      const movingIds =
        session && session.items.length > 0
          ? session.items.map((item) => item.questionId)
          : [questionId];
      const releaseX = session
        ? session.anchorBaseX + session.pendingDeltaX
        : flowPosition.x;
      const nextQuestions = reorderQuestionsAsBlock(
        draft.canvas,
        movingIds,
        questionId,
        releaseX,
      );
      const nextOrder = nextQuestions.map((question) => question.id);

      if (session) {
        clearDragSessionStyles(session);
      }
      clearAllCardTransforms();
      dragSessionRef.current = null;

      if (!sameIds(prevOrder, nextOrder)) {
        mutateCanvas(() => ({
          questions: nextQuestions,
          layout: linearizeLayout(nextQuestions),
        }));
      }
    },
    [
      clearAllCardTransforms,
      clearDragSessionStyles,
      disableQuestionReorder,
      draft.canvas,
      mutateCanvas,
      screenToFlowPosition,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") setShiftKeyHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") setShiftKeyHeld(false);
    };
    const onBlur = () => setShiftKeyHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

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
    setAreaSelectionPreview((prev) => {
      const next = {
        mode: session.mode,
        questionId: session.questionId,
        ids: session.currentIds,
      };
      if (
        prev &&
        prev.mode === next.mode &&
        prev.questionId === next.questionId &&
        sameIds(prev.ids, next.ids)
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const disableAreaSelectGuard = useCallback(() => {
    const onSelectStart = areaSelectGuardRef.current;
    if (onSelectStart) {
      document.removeEventListener("selectstart", onSelectStart);
      areaSelectGuardRef.current = null;
    }
    document.body.style.userSelect = "";
    const capture = areaSelectCaptureRef.current;
    if (capture?.root.hasPointerCapture(capture.pointerId)) {
      capture.root.releasePointerCapture(capture.pointerId);
    }
    areaSelectCaptureRef.current = null;
    window.getSelection()?.removeAllRanges();
  }, []);

  const enableAreaSelectGuard = useCallback(
    (root: HTMLDivElement, pointerId: number) => {
      disableAreaSelectGuard();
      const onSelectStart = (event: Event) => {
        event.preventDefault();
      };
      document.addEventListener("selectstart", onSelectStart);
      document.body.style.userSelect = "none";
      areaSelectGuardRef.current = onSelectStart;
      try {
        root.setPointerCapture(pointerId);
        areaSelectCaptureRef.current = { root, pointerId };
      } catch {
        areaSelectCaptureRef.current = null;
      }
    },
    [disableAreaSelectGuard],
  );

  const cleanupAreaSelectionListeners = useCallback(() => {
    disableAreaSelectGuard();
    const listeners = areaSelectionListenersRef.current;
    if (!listeners) return;
    window.removeEventListener("pointermove", listeners.move);
    window.removeEventListener("pointerup", listeners.up);
    window.removeEventListener("pointercancel", listeners.up);
    areaSelectionListenersRef.current = null;
  }, [disableAreaSelectGuard]);

  useEffect(() => {
    return () => {
      disableAreaSelectGuard();
    };
  }, [disableAreaSelectGuard]);

  const hideAreaSelectionOverlay = useCallback(() => {
    const overlay = selectionOverlayRef.current;
    if (!overlay) return;
    overlay.style.display = "none";
    overlay.classList.remove(styles.selectionOverlayAnswers);
    overlay.style.width = "0px";
    overlay.style.height = "0px";
    setAreaSelectionPreview(null);
  }, []);

  const cancelAreaSelection = useCallback(() => {
    const session = selectionSessionRef.current;
    if (session?.rafId !== null && session?.rafId !== undefined) {
      window.cancelAnimationFrame(session.rafId);
    }

    hideAreaSelectionOverlay();
    cleanupAreaSelectionListeners();
    selectionSessionRef.current = null;
  }, [cleanupAreaSelectionListeners, hideAreaSelectionOverlay]);

  const finishAreaSelection = useCallback(() => {
    const session = selectionSessionRef.current;
    if (!session) return;

    if (session.rafId !== null) {
      window.cancelAnimationFrame(session.rafId);
      session.rafId = null;
      renderSelectionPreview();
    }

    hideAreaSelectionOverlay();
    cleanupAreaSelectionListeners();
    selectionSessionRef.current = null;
    suppressPaneClickRef.current = true;
    suppressQuestionClickRef.current = true;
    window.setTimeout(() => {
      suppressPaneClickRef.current = false;
      suppressQuestionClickRef.current = false;
    }, 120);

    const dragDistance = Math.hypot(
      session.latestX - session.startX,
      session.latestY - session.startY,
    );
    const isClick = dragDistance < AREA_SELECT_DRAG_THRESHOLD;
    const ids = session.currentIds;

    if (ids.length === 0) {
      if (isClick) return;
      if (session.mode === "answers" && session.questionId) {
        syncSelection([session.questionId], session.questionId, []);
      } else {
        clearSelection();
      }
      return;
    }

    if (session.mode === "answers" && session.questionId) {
      syncSelection([session.questionId], session.questionId, ids);
      suppressAnswerClickRef.current = true;
      window.setTimeout(() => {
        suppressAnswerClickRef.current = false;
      }, 120);
      return;
    }

    syncSelection(ids, ids.length === 1 ? ids[0] : null, []);
  }, [clearSelection, cleanupAreaSelectionListeners, hideAreaSelectionOverlay, renderSelectionPreview, syncSelection]);

  const handleAreaSelectionPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.shiftKey) return;
    setShiftKeyHeld(true);

    const target = event.target as HTMLElement;
    if (target.closest(`.${styles.bottomBar}`)) return;
    if (target.closest("[data-answer-chip='true']")) return;
    if (target.closest("[data-answer-insert='true']")) return;
    if (target.closest(".react-flow__controls") || target.closest(".react-flow__minimap")) {
      return;
    }

    const targetQuestion = target.closest<HTMLElement>("[data-question-id]");
    const startQuestionId = targetQuestion?.dataset.questionId ?? null;
    const mode: "questions" | "answers" = startQuestionId ? "answers" : "questions";
    const answerQuestionId = startQuestionId;

    const root = canvasRef.current;
    if (!root) return;

    event.preventDefault();
    cleanupAreaSelectionListeners();
    enableAreaSelectGuard(root, event.pointerId);

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const baseSelectedIds =
      event.metaKey || event.ctrlKey
        ? mode === "answers"
          ? selectedAnswerIds.filter(
              (id) => targetQuestion?.querySelector(`[data-answer-id="${id}"]`) != null,
            )
          : selectedQuestionIds
        : [];

    const activateSession = (clientX: number, clientY: number) => {
      if (selectionSessionRef.current) return;
      selectionSessionRef.current = {
        mode,
        pointerId,
        startX,
        startY,
        latestX: clientX,
        latestY: clientY,
        rafId: null,
        baseSelectedIds,
        currentIds: [...baseSelectedIds],
        questionId: mode === "answers" ? answerQuestionId : null,
        root,
      };
      renderSelectionPreview();
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();

      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!selectionSessionRef.current) {
        if (distance < AREA_SELECT_DRAG_THRESHOLD) return;
        activateSession(moveEvent.clientX, moveEvent.clientY);
      }

      const activeSession = selectionSessionRef.current;
      if (!activeSession) return;
      activeSession.latestX = moveEvent.clientX;
      activeSession.latestY = moveEvent.clientY;
      if (activeSession.rafId !== null) return;
      activeSession.rafId = window.requestAnimationFrame(renderSelectionPreview);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      cleanupAreaSelectionListeners();
      if (!selectionSessionRef.current) return;
      upEvent.preventDefault();
      selectionSessionRef.current.latestX = upEvent.clientX;
      selectionSessionRef.current.latestY = upEvent.clientY;
      finishAreaSelection();
    };

    areaSelectionListenersRef.current = {
      move: handlePointerMove,
      up: handlePointerUp,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }, [
    cleanupAreaSelectionListeners,
    enableAreaSelectGuard,
    finishAreaSelection,
    renderSelectionPreview,
    selectedAnswerIds,
    selectedQuestionIds,
  ]);

  const handlePaneClick = useCallback(() => {
    if (suppressPaneClickRef.current) {
      suppressPaneClickRef.current = false;
      return;
    }
    commitInlineEdit();
    clearSelection();
  }, [clearSelection, commitInlineEdit]);

  const getHorizontalScrollMax = useCallback((zoom: number) => {
    const canvasWidth = canvasRef.current?.clientWidth ?? 0;
    const contentWidth =
      GRID_START_X * 2 +
      Math.max(0, sortedQuestions.length - 1) * GRID_X +
      CARD_WIDTH;
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

  const focusQuestionOnCanvas = useCallback(
    async (questionId: string) => {
      commitInlineEdit();
      selectQuestionOnly(questionId);

      const index = sortedQuestions.findIndex((question) => question.id === questionId);
      const layout = draft.canvas.layout[questionId] ?? {
        x: slotX(Math.max(0, index)),
        y: GRID_START_Y,
      };
      const centerX = layout.x + CARD_WIDTH / 2;
      const centerY = layout.y + CARD_MIN_HEIGHT / 2;
      const zoom = getViewport().zoom;

      await setCenter(centerX, centerY, {
        duration: 450,
        zoom,
        interpolate: "smooth",
      });
      syncHorizontalScrollFromViewport(getViewport());
    },
    [
      commitInlineEdit,
      draft.canvas.layout,
      getViewport,
      selectQuestionOnly,
      setCenter,
      sortedQuestions,
      syncHorizontalScrollFromViewport,
    ],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncHorizontalScrollFromViewport(getViewport());
      renderHorizontalScrollThumb();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [getViewport, renderHorizontalScrollThumb, sortedQuestions.length, syncHorizontalScrollFromViewport]);

  const saveWithConfirm = useCallback(
    async () => {
      if (!canEdit || !isTestPersistence || !sourceTestId) return;
      if (!hasUnsavedChanges) return;

      const errors = validateDraft(draft);
      setValidationErrors(errors);
      if (errors.length > 0) return;

      const confirmed = window.confirm(
        "Вы точно уверены? Данные запишутся в историю, а также обнулят все выученные карточки по изменённым вопросам.",
      );
      if (!confirmed) return;

      setCommitting(true);
      setAutosaveState("saving");
      try {
        await updateAdminTest(sourceTestId, canvasStateToTestFormData(draft));
        setSavedDraft({ ...draft });
        lastSavedSnapshotRef.current = autosaveSnapshot(draft);
        setAutosaveState("saved");
        setHistoryRefreshKey((prev) => prev + 1);
        onTestSaved?.(sourceTestId);
      } catch {
        setAutosaveState("error");
      } finally {
        setCommitting(false);
      }
    },
    [canEdit, draft, hasUnsavedChanges, isTestPersistence, onTestSaved, sourceTestId],
  );

  const nodes: Node[] = useMemo(() => {
    const stableOrdered = sortQuestions(draft.canvas);
    return stableOrdered.map((question, index) => ({
      id: question.id,
      type: "question",
      position: draft.canvas.layout[question.id] ?? {
        x: slotX(index),
        y: GRID_START_Y,
      },
      draggable: false,
      className: "draft-flow-node nopan",
      data: {
        question,
        index,
        selectedAnswerIds,
        copiedIds,
        copiedAnswerIds,
        issues: visibleIssues.filter(
          (issue) => questionIdForIssue(draft.canvas, issue) === question.id,
        ),
        dropErrorMessage:
          validationErrors.find((error) => error.targetId === question.id)?.message ?? null,
        onSelectQuestion: selectQuestionFromClick,
        onSelectAnswer: selectAnswerOnly,
        onQuestionGrabStart: beginQuestionGrab,
        onQuestionGrabEnd: endQuestionGrab,
        onDragStart: handleQuestionDragStart,
        onDragMove: handleQuestionDragMove,
        onDragEnd: handleQuestionDragEnd,
        onReorderAnswers: reorderAnswers,
        onDropAnswer: moveAnswerToQuestion,
        onAddAnswer: addAnswerToQuestion,
        onSplitAnswer: openAnswerSplit,
        editingQuestion:
          inlineEdit?.kind === "question" && inlineEdit.questionId === question.id,
        editingAnswerId:
          inlineEdit?.kind === "answer" && inlineEdit.questionId === question.id
            ? inlineEdit.answerId ?? null
            : null,
        inlineEditDraft:
          inlineEdit &&
          ((inlineEdit.kind === "question" && inlineEdit.questionId === question.id) ||
            (inlineEdit.kind === "answer" && inlineEdit.questionId === question.id))
            ? inlineEdit.draft
            : "",
        onBeginEditQuestion: beginInlineEditQuestion,
        onBeginEditAnswer: beginInlineEditAnswer,
        onInlineEditDraftChange: updateInlineEditDraft,
        onCommitInlineEdit: commitInlineEdit,
        onChangeQuestionType: changeQuestionType,
        onUpdateQuestionPoints: updateQuestionPoints,
        onToggleAnswerCorrect: toggleAnswerCorrect,
        isQuestionDirty: changedQuestionIds.has(question.id),
        disableQuestionReorder,
        areaSelectionPreview,
        selectedQuestionIds,
        shiftKeyHeld,
      },
    }));
  }, [
    addAnswerToQuestion,
    areaSelectionPreview,
    beginInlineEditAnswer,
    beginInlineEditQuestion,
    beginQuestionGrab,
    changeQuestionType,
    commitInlineEdit,
    copiedAnswerIds,
    copiedIds,
    draft.canvas,
    disableQuestionReorder,
    endQuestionGrab,
    handleQuestionDragEnd,
    handleQuestionDragMove,
    handleQuestionDragStart,
    inlineEdit,
    moveAnswerToQuestion,
    openAnswerSplit,
    reorderAnswers,
    selectAnswerOnly,
    selectQuestionFromClick,
    selectedAnswerIds,
    selectedQuestionIds,
    changedQuestionIds,
    shiftKeyHeld,
    toggleAnswerCorrect,
    updateInlineEditDraft,
    updateQuestionPoints,
    validationErrors,
    visibleIssues,
  ]);

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
    if (isTestPersistence) return;

    void lockAdminTestDraft(draft.id)
      .then((res) => {
        const nextDraft = { ...res.draft, canvas: normalizeCanvas(res.draft.canvas) };
        lastSavedSnapshotRef.current = autosaveSnapshot(nextDraft);
        setSavedDraft({ ...nextDraft });
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
  }, [draft.id, isTestPersistence]);

  useEffect(() => {
    if (!canEdit) return;
    if (requireExplicitSave) return;
    if (currentAutosaveSnapshot === lastSavedSnapshotRef.current) return;
    const timeout = window.setTimeout(() => {
      const snapshotAtSaveStart = currentAutosaveSnapshot;
      setAutosaveState("saving");
      updateAdminTestDraft(draft.id, draft)
        .then((saved) => {
          lastSavedSnapshotRef.current = snapshotAtSaveStart;
          const nextDraft = { ...saved, canvas: normalizeCanvas(saved.canvas) };
          setSavedDraft({ ...nextDraft });
          const nextSnapshot = autosaveSnapshot(nextDraft);
          setDraft((prev) => (nextSnapshot === snapshotAtSaveStart ? prev : { ...prev, ...nextDraft }));
          setAutosaveState("saved");
        })
        .catch(() => setAutosaveState("error"));
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [canEdit, currentAutosaveSnapshot, draft, requireExplicitSave]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const isTypingTarget =
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement ||
        active instanceof HTMLSelectElement;

      if (
        (event.code === "KeyA" || event.key.toLowerCase() === "a") &&
        event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        if (isTypingTarget) return;
        if (!selectedQuestionId) return;
        event.preventDefault();
        cancelAreaSelection();
        selectAllAnswersInQuestion(selectedQuestionId);
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      if (isTypingTarget) return;

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
  }, [cancelAreaSelection, copySelection, pasteSelection, redo, selectAllAnswersInQuestion, selectedQuestionId, undo]);

  const publish = async () => {
    if (isTestPersistence) return;
    const errors = validateDraft(draft);
    setValidationErrors(errors);
    if (errors.length > 0) return;
    try {
      await updateAdminTestDraft(draft.id, draft);
      const result = await publishAdminTestDraft(draft.id);
      if (result.testId) onPublished?.(result.testId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось опубликовать драфт";
      setValidationErrors([{ targetId: "publish", message }]);
    }
  };

  const deleteDraft = async () => {
    if (isTestPersistence) return;
    const title = draft.title?.trim() || "Без названия";
    if (
      !window.confirm(
        `Удалить драфт «${title}»? Черновик будет удалён без возможности восстановления.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      await deleteAdminTestDraft(draft.id);
      onBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось удалить драфт";
      window.alert(message);
    } finally {
      setDeleting(false);
    }
  };

  const autosaveLabel = isTestPersistence
    ? hasUnsavedChanges
      ? "Есть несохраненные изменения"
      : "Изменения сохранены"
    : autosaveState === "saving"
      ? "Сохраняем..."
      : autosaveState === "error"
        ? "Ошибка автосейва"
        : "Сохранено";

  const selectedQuestionNumber = selectedQuestionId
    ? parseQuestionIdFromCanvasId(
        selectedQuestionId,
        sortedQuestions.findIndex((question) => question.id === selectedQuestionId),
      )
    : null;

  return (
    <div
      className={styles.editor}
      onClick={() => {
        setContextMenu(null);
      }}
    >
      <div className={styles.mobileBlock}>
        <h1>Визуальный редактор тестов</h1>
        <p>Редактор рассчитан на большой экран, мышь или трекпад. Откройте его на desktop/tablet.</p>
        <Button type="button" onClick={onBack}>Назад</Button>
      </div>

      <main className={styles.canvasShell}>
        {lockWarning ? <div className={styles.lockBanner}>{lockWarning}</div> : null}
        <header className={styles.topbar}>
          <button type="button" className={styles.topbarBack} onClick={onBack} aria-label="Назад">
            <ArrowLeft size={20} />
          </button>
          <div className={styles.titleBlock}>
            <h1>{draft.title || "Без названия"}</h1>
            <p>
              {isTestPersistence ? "Редактирование теста · " : ""}
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openBulkAnswerSplit}
            >
              <Scissors size={16} aria-hidden />
              Расшифровать
            </Button>
            {!isTestPersistence ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.deleteDraftButton}
                disabled={deleting || !canEdit}
                onClick={() => void deleteDraft()}
              >
                <Trash2 size={16} /> {deleting ? "Удаляем..." : "Удалить драфт"}
              </Button>
            ) : null}
            {isTestPersistence ? (
              <Button
                type="button"
                disabled={!canEdit || !hasUnsavedChanges || committing}
                onClick={() => void saveWithConfirm()}
              >
                <Save size={16} /> {committing ? "Сохраняем..." : "Сохранить изменения"}
              </Button>
            ) : (
              <Button type="button" onClick={publish}>
                <Save size={16} /> Сохранить как тест
              </Button>
            )}
          </div>
        </header>

        <div
          ref={canvasRef}
          className={styles.canvas}
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
          {sortedQuestions.length === 0 ? (
            <div className={styles.canvasEmpty}>
              <div className={styles.canvasEmptyCard}>
                <FileQuestion size={36} strokeWidth={1.75} aria-hidden="true" />
                <h2>Начните с первого вопроса</h2>
                <p>Добавьте вопрос на полотно, чтобы собрать тест</p>
                <Button type="button" onClick={() => addQuestion(DEFAULT_NEW_QUESTION_TYPE)}>
                  Добавить вопрос
                </Button>
              </div>
            </div>
          ) : null}
          <div ref={selectionOverlayRef} className={styles.selectionOverlay} />
          <ReactFlow
            style={{ ["--draft-card-width" as string]: `${CARD_WIDTH}px` }}
            nodes={nodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onNodeClick={(_event, node) => {
              selectQuestionFromClick(node.id);
            }}
            onPaneClick={handlePaneClick}
            onMove={(_event, viewport) => syncHorizontalScrollFromViewport(viewport)}
            onMoveEnd={(_event, viewport) => syncHorizontalScrollFromViewport(viewport)}
            selectionOnDrag={false}
            nodesDraggable={false}
            panOnScroll
            panOnScrollSpeed={1.25}
            panOnDrag={!questionGrabActive}
            zoomOnScroll={false}
            zoomOnPinch
            fitView
            snapToGrid={false}
          >
            <Background gap={24} size={1} />
            <AdminTestDraftFlowOverlay
              canvas={draft.canvas}
              hidden={questionGrabActive}
              restrictInsertToEnd={disableQuestionReorder}
              onInsertAt={(insertIndex) =>
                insertQuestionAt(
                  disableQuestionReorder ? sortedQuestions.length : insertIndex,
                  DEFAULT_NEW_QUESTION_TYPE,
                )
              }
            />
            <Controls position="bottom-left" showInteractive={false} />
          </ReactFlow>
          <div className={styles.bottomBar}>
            <AdminTestDraftQuestionSearch
              questions={sortedQuestions}
              onSelect={(questionId) => {
                void focusQuestionOnCanvas(questionId);
              }}
            />
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
                  width: `${Math.max(900, GRID_START_X + Math.max(0, sortedQuestions.length - 1) * GRID_X + CARD_WIDTH + GRID_START_X)}px`,
                }}
              />
            </div>
          </div>
        </div>

        <div
          className={`${styles.historyFab} ${inspectorCollapsed ? "" : styles.historyFabInspectorOpen}`}
        >
          <button type="button" className={styles.historyFabButton} onClick={undo} aria-label="Отменить">
            <Undo2 size={18} />
          </button>
          <button type="button" className={styles.historyFabButton} onClick={redo} aria-label="Повторить">
            <Redo2 size={18} />
          </button>
        </div>
      </main>

      <aside
        className={`${styles.inspectorShell} ${inspectorCollapsed ? styles.inspectorShellCollapsed : styles.inspectorShellOpen}`}
        aria-label="Настройки"
      >
        {inspectorCollapsed ? (
          <button
            type="button"
            className={styles.inspectorToggle}
            onClick={() => setInspectorCollapsed(false)}
            title="Настройки теста"
            aria-label="Открыть настройки"
          >
            <Settings size={18} />
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.inspectorToggle}
              onClick={() => setInspectorCollapsed(true)}
              title="Свернуть панель"
              aria-label="Закрыть настройки"
            >
              <ChevronRight size={18} />
            </button>
            <div className={styles.inspectorPanel}>
              <div className={styles.inspectorHeader}>
                <h2>
                  {isTestPersistence && inspectorTab === "history"
                    ? "История изменений"
                    : selectedQuestion
                      ? "Свойства вопроса"
                      : "Настройки теста"}
                </h2>
                <p>
                  {isTestPersistence && inspectorTab === "history"
                    ? "Сохранённые коммиты с сервера"
                    : selectedAnswer
                      ? "Выбран ответ — редактирование в карточке"
                      : isTestPersistence
                        ? "Изменения сохраняются вручную"
                        : "Автосейв включён"}
                </p>
                {isTestPersistence && sourceTestId ? (
                  <div className={styles.inspectorTabs}>
                    <button
                      type="button"
                      className={`${styles.inspectorTab} ${inspectorTab === "properties" ? styles.inspectorTabActive : ""}`}
                      onClick={() => setInspectorTab("properties")}
                    >
                      Свойства
                    </button>
                    <button
                      type="button"
                      className={`${styles.inspectorTab} ${inspectorTab === "history" ? styles.inspectorTabActive : ""}`}
                      onClick={() => setInspectorTab("history")}
                    >
                      История
                    </button>
                  </div>
                ) : null}
              </div>
              <div className={styles.inspectorBody}>
          {isTestPersistence && inspectorTab === "history" && sourceTestId ? (
            <AdminTestChangeHistoryPanel
              key={`${sourceTestId}-${selectedQuestionNumber ?? "all"}-${historyRefreshKey}`}
              testId={sourceTestId}
              selectedQuestionId={selectedQuestionNumber}
              refreshKey={historyRefreshKey}
              onSelectQuestion={(questionId) => {
                void focusQuestionOnCanvas(questionId);
              }}
            />
          ) : selectedQuestion ? (
            <>
              <label className={styles.field}>
                <span>Тип вопроса</span>
                <select
                  className={styles.select}
                  value={selectedQuestion.type}
                  onChange={(event) =>
                    changeQuestionType(selectedQuestion.id, event.target.value as AdminTestQuestionType)
                  }
                >
                  <option value="single">Одиночный выбор</option>
                  <option value="multiple">Множественный выбор</option>
                  <option value="text">Текстовый ответ</option>
                </select>
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
              {selectedAnswer && selectedAnswer.kind === "answer" ? (
                <label className={styles.switchLabel}>
                  <span>Правильный ответ</span>
                  <input
                    type="checkbox"
                    checked={selectedAnswer.isCorrect}
                    onChange={(event) => updateAnswer(selectedQuestion.id, selectedAnswer.id, { isCorrect: event.target.checked })}
                  />
                </label>
              ) : null}
              {selectedAnswer ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => openAnswerSplit(selectedQuestion.id, selectedAnswer.id)}
                >
                  <Scissors size={16} aria-hidden />
                  Разобрать ответ
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={deleteSelection} disabled={requireExplicitSave}>
                Удалить выбранное
              </Button>
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
            </div>
          </>
        )}
      </aside>

      {contextMenu ? (
        <div className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button type="button" onClick={() => void copySelection()}>Копировать</button>
          <button type="button" onClick={() => void pasteSelection()}>Вставить</button>
          {!requireExplicitSave ? <button type="button" onClick={deleteSelection}>Удалить</button> : null}
        </div>
      ) : null}

      {answerSplitTarget ? (
        <AdminAnswerSplitModal
          sourceText={
            draft.canvas.questions
              .find((question) => question.id === answerSplitTarget.questionId)
              ?.answers.find((answer) => answer.id === answerSplitTarget.answerId)?.text ?? ""
          }
          currentQuestionType={
            draft.canvas.questions.find(
              (question) => question.id === answerSplitTarget.questionId,
            )?.type ?? "text"
          }
          onClose={() => setAnswerSplitTarget(null)}
          onApply={applyAnswerSplit}
        />
      ) : null}

      {bulkSplitCandidates ? (
        <AdminAnswerBulkSplitModal
          candidates={bulkSplitCandidates}
          onClose={() => setBulkSplitCandidates(null)}
          onApply={applyBulkAnswerSplitBatch}
        />
      ) : null}
    </div>
  );
}
