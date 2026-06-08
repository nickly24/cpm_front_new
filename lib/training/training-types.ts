export interface TrainingCard {
  id: number;
  question: string;
  answer: string;
  theme_id: number;
  is_learned?: boolean;
}

export interface TrainingTopic {
  id: number;
  name: string;
  section_id: number;
  total_cards: number;
  learned_cards: number;
  progress_percent: number;
}

export interface TrainingSection {
  id: number;
  name: string;
  sort_order: number;
  topics: TrainingTopic[];
  total_cards: number;
  learned_cards: number;
  progress_percent: number;
}

export interface TrainingSectionMeta {
  id: number;
  name: string;
  sort_order: number;
}

export interface TrainingTreeResponse {
  success: boolean;
  sections: TrainingSection[];
}

export interface TrainingSectionsResponse {
  success: boolean;
  sections: TrainingSectionMeta[];
}

/** Backend may return a bare array or { success, themes } */
export type ThemesApiPayload =
  | TrainingThemeRow[]
  | { success?: boolean; themes?: TrainingThemeRow[] };

export interface TrainingThemeRow {
  id: number;
  name: string;
  section_id?: number | null;
}

export interface AllCardsByThemeResponse {
  success: boolean;
  student_id: number;
  theme_id: number;
  cards: TrainingCard[];
  total_cards: number;
  learned_cards: number;
  remaining_cards: number;
}

export interface CardsToLearnResponse {
  success: boolean;
  student_id: number;
  theme_id: number;
  cards_to_learn: TrainingCard[];
  count: number;
}

export interface LearnedQuestionsResponse {
  success: boolean;
  student_id: number;
  theme_id: number;
  learned_questions: TrainingCard[];
  count: number;
}

export interface AddLearnedPayload {
  student_id: number;
  question_id: number;
}

export interface AddLearnedResponse {
  success: boolean;
  message?: string;
}

export interface RemoveLearnedResponse {
  success: boolean;
  message?: string;
}
