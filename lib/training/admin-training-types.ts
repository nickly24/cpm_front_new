export interface AdminTrainingTopicRow {
  id: number;
  name: string;
  section_id: number;
  cards_count: number;
}

export interface AdminTrainingSectionRow {
  id: number;
  name: string;
  sort_order: number;
  topics: AdminTrainingTopicRow[];
  topics_count: number;
  cards_count: number;
}

export interface AdminTrainingCatalogResponse {
  success: boolean;
  sections: AdminTrainingSectionRow[];
  error?: string;
}

export interface AdminTrainingCardRow {
  id: number;
  question: string;
  answer: string;
  theme_id: number;
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
  section_id?: number;
  theme_id?: number;
  card_id?: number;
}
