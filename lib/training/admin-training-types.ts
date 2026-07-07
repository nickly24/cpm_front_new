export interface AdminTrainingSectionRow {
  id: number;
  name: string;
  direction_id: number;
  cards_count: number;
  /** @deprecated */
  section_id?: number;
}

export interface AdminTrainingDirectionRow {
  id: number;
  name: string;
  sections: AdminTrainingSectionRow[];
  topics: AdminTrainingSectionRow[];
  topics_count: number;
  cards_count: number;
}

export interface AdminTrainingCatalogResponse {
  success: boolean;
  directions: AdminTrainingDirectionRow[];
  /** @deprecated */
  sections?: AdminTrainingDirectionRow[];
  error?: string;
}

export interface AdminTrainingCardRow {
  id: number;
  question: string;
  answer: string;
  theme_id: number;
  sort_order?: number;
}

export interface AdminCardsByThemeResponse {
  success: boolean;
  theme_id: number;
  cards: AdminTrainingCardRow[];
  count: number;
  error?: string;
}

export interface TrainingMutationResponse {
  success: boolean;
  error?: string;
  theme_id?: number;
  card_id?: number;
  direction_id?: number;
}
