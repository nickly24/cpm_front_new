export type ExamType = "outside_lms" | "classic";
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;
export type Vote = 0 | 0.5 | 1;
export type FractionalMode = "round_up" | "round_down" | "extra_question";
export type SourceMode = "specific_part" | "any_part";
export type HalfMode = "repeat" | "round_up" | "round_down";
export type AttemptStatus =
  | "not_started"
  | "pending_ready"
  | "in_progress"
  | "completed";
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
export interface Page<T> {
  items: T[];
  pagination: Pagination;
}
export interface Validation {
  code: string;
  field?: string;
  message: string;
  details?: Record<string, unknown>;
}
export interface Person {
  id: number;
  fullName: string;
  login?: string | null;
  position?: number;
}
export interface Direction {
  id: number;
  name: string;
}
export interface Capabilities {
  apiVersion: "v2";
  canManageOutside: boolean;
  canCreateClassic: boolean;
  canConductClassic: boolean;
  canReadStudentResults: boolean;
  canReadAdminExams?: boolean;
}
export interface ExamSummary {
  id: number;
  examType: ExamType;
  directionId: number | null;
  directionName: string;
  legacyName: string | null;
  date: string | null;
  startAt: string | null;
  endAt: string | null;
  readiness: "ready" | "incomplete" | "not_applicable";
  version: number;
  createdAt?: string;
  updatedAt?: string;
}
export interface Config {
  examId: number;
  startAt: string | null;
  endAt: string | null;
  fractionalMode: FractionalMode | null;
  tieBreakerSourceMode: SourceMode | null;
  tieBreakerPartId: number | null;
  tieBreakerHalfMode: HalfMode | null;
  configVersion: number;
  updatedAt?: string;
}
export interface Threshold {
  grade: Grade;
  minScore: number;
}
export interface Scoring extends Omit<Config, "examId" | "startAt" | "endAt"> {
  minScore: number;
  maxScore: number;
  thresholds: Threshold[];
  ranges: { grade: Grade; from: number; to: number }[];
}
export interface Part {
  id: number;
  code: string;
  questionWeight: number;
  questionCount: number;
  bankSize: number;
  sortOrder?: number;
  version: number;
}
export interface BankQuestion {
  id: number;
  partId: number;
  partCode: string;
  questionText: string;
  answerText: string;
  version: number;
}
export interface Commission {
  id: number;
  name: string;
  members: Person[];
  assignedStudentsCount: number;
  version: number;
}
export interface Assignment {
  id: number;
  student: Person;
  attemptNo: 1 | 2;
  sourceCommissionId: number | null;
  commissionName: string;
  members: Person[];
  replacementLimit: number;
  privilegeVersion: number;
  status: AttemptStatus;
  attemptId?: number | null;
  version: number;
  historyGeneration: number;
}
export interface Privilege {
  student?: Person;
  replacementLimit: number;
  version: number;
}
export interface Readiness {
  ready?: boolean;
  isReady?: boolean;
  canPrepare?: boolean;
  canStart?: boolean;
  errors?: Validation[];
  reasons?: Validation[];
  issues?: Validation[];
  warnings?: Validation[];
  [key: string]: unknown;
}
export interface OutsideResult {
  id: number;
  studentId: number;
  studentName: string;
  points: number;
  grade: Grade;
  examinator: string | null;
  version: number;
}
export interface VoteEntry {
  examinatorId?: number;
  examinator?: Person;
  fullName?: string;
  value: Vote;
}
export interface Round {
  id: number;
  roundNo: number;
  status: "open" | "disputed" | "consensus" | "voided";
  votesReceived: number;
  votesRequired: number;
  hasVoted: boolean;
  myVote: Vote | null;
  votes?: VoteEntry[];
  consensus?: Vote | null;
}
export interface PresentedQuestion {
  id: number;
  sequenceNo: number;
  purpose: "regular" | "tie_breaker";
  partCode: string;
  questionText: string;
  answerText: string;
  weight: number;
  cycleNo: number;
  status: "open" | "consensus" | "replaced";
  consensus: Vote | null;
  awardedPoints?: number;
  replacesPresentedQuestionId: number | null;
  canReplace?: boolean;
  canGoNext?: boolean;
  round?: Round | null;
  lastCompletedRound?: Round | null;
  completedRoundsCount?: number;
}
export interface AttemptResult {
  attemptId: number;
  attemptNo: 1 | 2;
  rawTotal: number;
  roundedTotal: number;
  maxScore: number;
  grade: Grade;
  hasAppeal: boolean;
  completedAt: string;
  commission?: Person[];
  resultVersion?: number;
  questionCount?: number;
}
export interface Receipt {
  commandId: number;
  outcome: string;
  appliedStateVersion?: number;
  presentedQuestionId?: number;
  resolvedQuestionId?: number;
  consensus?: Vote;
  resolvedQuestion?: { id: number; consensus: Vote; sequenceNo?: number };
  [key: string]: unknown;
}
export interface AttemptState {
  id: number;
  examId: number;
  directionName: string;
  assignmentId: number;
  attemptNo: 1 | 2;
  historyGeneration: number;
  student: Person;
  status: Exclude<AttemptStatus, "not_started">;
  phase: "preparation" | "regular_questions" | "tie_breaker" | "completed";
  stateVersion: number;
  members: (Person & { ready: boolean; readyAt: string | null })[];
  allMembersReady: boolean;
  startedAt: string | null;
  completedAt: string | null;
  currentQuestion: PresentedQuestion | null;
  progress: {
    regularConsensus: number;
    regularRequired: number;
    replacementUsed: number;
    replacementLimit: number;
    parts: {
      sourcePartId: number;
      code: string;
      consensus: number;
      required: number;
    }[];
  };
  result: AttemptResult | null;
  permissions: {
    canReady: boolean;
    canStart: boolean;
    canVote: boolean;
    canReplace: boolean;
    canGoNext: boolean;
  };
  serverNow: string;
}
export interface CommandResult {
  attempt: AttemptState;
  receipt: Receipt;
  replayed: boolean;
  created?: boolean;
}
export interface ExaminerExam {
  id: number;
  directionId: number;
  directionName: string;
  startAt: string | null;
  endAt: string | null;
  readiness: string;
  assignedStudentsCount: number;
}
export interface ExaminerAssignment {
  assignmentId: number;
  attemptNo: 1 | 2;
  student: Person;
  commission: Person[];
  replacementLimit: number;
  status: AttemptStatus;
  attemptId: number | null;
  historyGeneration: number;
  canPrepare: boolean;
  canStart: boolean;
  unavailableReasons: Validation[];
  progress?: { answered: number; required: number };
}
export interface AdminAttempt {
  id: number;
  attemptId?: number;
  student: Person;
  attemptNo: 1 | 2;
  status: AttemptStatus;
  phase?: string;
  grade?: Grade | null;
  result?: AttemptResult | null;
  historyGeneration: number;
  resultVersion?: number;
  members?: Person[];
  commission?: Person[];
  rawTotal?: number;
  roundedTotal?: number;
  maxScore?: number;
  hasAppeal?: boolean;
}
export interface AdminCurrentResult {
  student: Person;
  currentAttemptId: number;
  currentAttemptNo: 1 | 2;
  rawTotal: number;
  roundedTotal: number;
  maxScore: number;
  calculatedGrade: Grade;
  effectiveGrade: Grade;
  hasAppeal: boolean;
  resultVersion: number;
  firstAttemptId: number;
  retakeAssignmentId: number | null;
  retakeStatus: AttemptStatus | null;
  historyGeneration: number;
}
export interface Appeal {
  id: number;
  previousGrade: Grade;
  newGrade: Grade;
  createdAt?: string;
  resultVersion?: number;
}
export interface DeletePreview {
  confirmationToken: string;
  expiresAt: string;
  counts: Record<string, number>;
  version?: number;
  historyGeneration?: number;
}
export interface OutsideStudentResult {
  examId: number;
  examType: "outside_lms";
  directionId: number;
  directionName: string;
  date: string | null;
  points: number;
  grade: Grade;
  examinator: string | null;
  hasAppeal: false;
}
export interface ClassicStudentResult {
  examId: number;
  examType: "classic";
  directionId: number;
  directionName: string;
  startAt: string | null;
  endAt: string | null;
  currentAttempt: AttemptResult;
  hasPreviousAttempt: boolean;
}
export type StudentResult = OutsideStudentResult | ClassicStudentResult;
export interface StudentResultDetail {
  examId: number;
  examType: ExamType;
  directionName: string;
  current: AttemptResult | OutsideStudentResult;
  history: AttemptResult[];
}
export type ImportKind = "questions" | "assignments" | "outside";
export interface ImportRow {
  rowId: string;
  sourceRow: number;
  excluded: boolean;
  input: Record<string, unknown>;
  resolved: Record<string, unknown>;
  action: string;
  errors: Validation[];
  warnings: Validation[];
}
export interface ImportSession {
  id: number;
  examId: number;
  previewVersion: number;
  status: "editable" | "committed";
  expiresAt: string;
  rows: ImportRow[];
  pagination?: Pagination;
  summary: {
    total: number;
    included: number;
    excluded: number;
    creatable: number;
    conflicts: number;
    errors: number;
  };
  commitResult?: ImportCommit;
}
export interface ImportCommit {
  sessionId: number;
  committed: boolean;
  counts: Record<string, number>;
  replayed: boolean;
}
