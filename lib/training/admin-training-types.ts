export type AdminTrainingSectionKind = "manual" | "test";

export interface AdminTrainingSectionRow {
  kind: AdminTrainingSectionKind;
  id?: number;
  test_id?: string;
  name: string;
  direction_id: number;
  cards_count: number;
  visible?: boolean;
  source_test_title?: string;
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

export function adminSectionKey(section: AdminTrainingSectionRow): string {
  if (section.kind === "test") {
    return `test:${section.test_id ?? section.name}`;
  }
  return `manual:${section.id ?? section.name}`;
}

export function normalizeAdminSection(
  section: AdminTrainingSectionRow,
): AdminTrainingSectionRow {
  if (section.kind) return section;
  return { ...section, kind: "manual" };
}
