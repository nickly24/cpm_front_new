export type CardStatus = "unlearned" | "learned" | "answer_changed";

export type SectionKind = "manual" | "test";

export type StudyFilter = "all" | "unlearned" | "learned" | "stale";

export interface SectionStats {
  total: number;
  learned: number;
  answer_changed: number;
  unlearned: number;
  progress_percent?: number;
}

export interface TrainingCard {
  card_ref: string;
  card_id?: number;
  question_id?: number;
  question: string;
  answer: string;
  sort_order?: number;
  content_fingerprint: string;
  status: CardStatus;
  /** @deprecated use status */
  is_learned?: boolean;
}

export interface StudyBatch {
  index: number;
  from: number;
  to: number;
  size: number;
  stats: SectionStats;
}

export interface StudySettings {
  batch_size: number;
  last_batch_index: number | null;
  study_mode: StudyFilter;
}

export interface TrainingSectionNode {
  kind: SectionKind;
  refId: string;
  name: string;
  sourceTestTitle?: string;
  stats: SectionStats;
  total_cards: number;
  learned_cards: number;
  answer_changed_cards?: number;
  progress_percent: number;
}

/** Направление (бывш. training section / тема) */
export interface TrainingDirection {
  id: number;
  name: string;
  sections: TrainingSectionNode[];
  /** @deprecated use sections */
  topics?: TrainingSectionNode[];
  total_cards: number;
  learned_cards: number;
  answer_changed_cards?: number;
  progress_percent: number;
}

/** @deprecated use TrainingDirection */
export type TrainingSection = TrainingDirection;

/** @deprecated use TrainingSectionNode */
export type TrainingTopic = TrainingSectionNode & {
  id?: number | string;
  section_id?: number;
  direction_id?: number;
};

export interface TrainingTreeResponse {
  success: boolean;
  student_id: number;
  directions: TrainingDirection[];
  /** @deprecated */
  sections?: TrainingDirection[];
}

export interface SectionStudyViewResponse {
  success: boolean;
  student_id: number;
  section_kind: SectionKind;
  section_ref_id: string;
  section_name: string;
  cards: TrainingCard[];
  stats: SectionStats;
  batches: StudyBatch[];
  settings: StudySettings;
}

export interface SectionBatchResponse {
  success: boolean;
  student_id: number;
  section_kind: SectionKind;
  section_ref_id: string;
  batch_index: number;
  batch: StudyBatch;
  study_mode: StudyFilter;
  cards: TrainingCard[];
  count: number;
}

export interface MarkCardLearnedPayload {
  student_id: number;
  section_kind: SectionKind;
  section_ref_id: string;
  card_ref: string;
  content_fingerprint: string;
}

export interface MarkCardLearnedResponse {
  success: boolean;
  card_ref?: string;
  status?: CardStatus;
  error?: string;
}

export interface StudySettingsPayload {
  batch_size?: number;
  last_batch_index?: number | null;
  study_mode?: StudyFilter;
}

export interface StudySettingsResponse {
  success: boolean;
  settings?: StudySettings;
  error?: string;
}

export const BATCH_SIZE_PRESETS = [10, 20, 30] as const;

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  unlearned: "Не выучено",
  learned: "Выучено",
  answer_changed: "Поменялся ответ",
};

export const STUDY_FILTER_LABELS: Record<StudyFilter, string> = {
  all: "Весь батч",
  unlearned: "Невыученные",
  learned: "Повторить выученные",
  stale: "Поменялся ответ",
};
