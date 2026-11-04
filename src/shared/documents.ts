/**
 * Teaching documents (lesson plans, objectives, learning activities,
 * assessments, TOS, performance tasks, rubrics) created by the
 * planning tools and stored locally as JSON files.
 */
import type {
  ActivityCategory,
  ActivityDifficulty,
  ActivityScope,
  LearningEnvironment,
} from './activities'
import type { AnnotationLength, AnnotationPerspective, AnnotationSource } from './annotation'
import type {
  ReviewDepth,
  ReviewFocus,
  ReviewScope,
  ReviewSource,
  RevisedLessonPlan,
} from './review'
import type { Attachment, HandoffRecord } from './conversations'
import type { RubricData, RubricLevelCount } from './rubric'
import type { TosInputs, TosTable } from './tos'
import type {
  BloomDistribution,
  BloomLevel,
  BloomMode,
  Difficulty,
  QuestionType,
  CurriculumFramework,
  LearningDomain,
  LessonPlanFormat,
  TeachingLanguage,
} from './teaching'

export type DocumentKind =
  | 'lesson-plan'
  | 'learning-objectives'
  | 'learning-activities'
  | 'assessment'
  | 'tos'
  | 'performance-task'
  | 'rubric'
  | 'annotation'
  | 'lesson-plan-review'

export const DOCUMENT_KINDS: Record<DocumentKind, { label: string; path: string }> = {
  'lesson-plan': { label: 'Lesson plan', path: '/lesson-planner' },
  'learning-objectives': { label: 'Learning objectives', path: '/learning-objectives' },
  'learning-activities': { label: 'Learning activities', path: '/learning-activities' },
  assessment: { label: 'Assessment', path: '/assessments' },
  tos: { label: 'Table of specifications', path: '/table-of-specifications' },
  'performance-task': { label: 'Performance task', path: '/performance-tasks' },
  rubric: { label: 'Rubric', path: '/rubrics' },
  annotation: { label: 'DLL annotation', path: '/dll-annotation' },
  'lesson-plan-review': { label: 'Lesson plan review', path: '/lesson-reviewer' },
}

/**
 * A request scope: one learning activity / alternatives (learning activities),
 * or a revised lesson plan (lesson plan reviews).
 */
export type DocumentScope = ActivityScope | ReviewScope

export interface ReviewInputs {
  /** Filled from the plan when known; optional. */
  subject: string
  gradeLevel: string
  planType: LessonPlanFormat
  depth: ReviewDepth
  focus: ReviewFocus
  /** The school's own formatting requirements (optional). */
  formatRequirements: string
  curriculum: CurriculumFramework
  /** Language of the review report. */
  language: TeachingLanguage
  instructions: string
  /** The lesson plan under review (full text). */
  source: ReviewSource | null
}

export interface AnnotationInputs {
  subject: string
  gradeLevel: string
  /** What the annotation should highlight, e.g. a PPST indicator or observation focus. */
  focus: string
  /** Exact number of paragraphs (1–5). */
  paragraphs: number
  length: AnnotationLength
  perspective: AnnotationPerspective
  language: TeachingLanguage
  instructions: string
  /** The DLL being annotated (full extracted text). */
  source: AnnotationSource | null
}

export type TaskGrouping = 'individual' | 'pairs' | 'small-groups'

export const TASK_GROUPINGS: Record<TaskGrouping, string> = {
  individual: 'Individual',
  pairs: 'Pairs',
  'small-groups': 'Small groups',
}

export interface PerformanceTaskInputs {
  subject: string
  gradeLevel: string
  competency: string
  competencyCode: string
  topic: string
  /** Number of class days the task runs. */
  days: number
  /** Class time per day, in minutes. */
  minutesPerDay: number
  /** What the school/learners actually have (equipment, materials, internet…). */
  resources: string
  /** What learners will produce. Empty = let the AI propose one. */
  expectedOutput: string
  grouping: TaskGrouping
  curriculum: CurriculumFramework
  language: TeachingLanguage
  instructions: string
}

/** Context copied from a performance task when building its rubric. */
export interface RubricTaskContext {
  sourceId: string
  title: string
  /** The task text (truncated), sent to the AI as context. */
  text: string
}

export interface RubricInputs {
  subject: string
  gradeLevel: string
  /** What the rubric assesses, e.g. the performance task or product. */
  taskTitle: string
  competency: string
  competencyCode: string
  levelCount: RubricLevelCount
  /** How many criteria to ask the AI for. */
  criteriaCount: number
  /** Required for holistic; optional target for analytic. */
  targetTotal: number | null
  curriculum: CurriculumFramework
  language: TeachingLanguage
  instructions: string
  task: RubricTaskContext | null
}

export interface LessonPlanInputs {
  subject: string
  gradeLevel: string
  /** 1–4 */
  quarter: number
  /** 1–12 */
  week: number
  topic: string
  competency: string
  /** Only ever what the teacher typed — never generated. Empty when unknown. */
  competencyCode: string
  /** Minutes per session. */
  durationMinutes: number
  sessions: number
  format: LessonPlanFormat
  curriculum: CurriculumFramework
  language: TeachingLanguage
  instructions: string
}

export interface ObjectivesInputs {
  subject: string
  gradeLevel: string
  topic: string
  competency: string
  competencyCode: string
  durationMinutes: number
  bloomLevels: BloomLevel[]
  domains: LearningDomain[]
  /** Objectives to write for each selected Bloom level. */
  objectivesPerLevel: number
  curriculum: CurriculumFramework
  language: TeachingLanguage
  instructions: string
}

export interface ActivitiesInputs {
  subject: string
  gradeLevel: string
  /** 1–4 */
  quarter: number
  topic: string
  competency: string
  /** Only ever what the teacher typed — never generated. Empty when unknown. */
  competencyCode: string
  /** The lesson's objectives, one per line (empty = derive them from the competency). */
  objectives: string
  /** Class time available for the activities, in minutes. */
  durationMinutes: number
  activityCount: number
  classSize: number
  resources: string
  environment: LearningEnvironment
  categories: ActivityCategory[]
  difficulty: ActivityDifficulty
  curriculum: CurriculumFramework
  language: TeachingLanguage
  instructions: string
}

/** Where the current document text came from. */
export type ContentSource = 'provider' | 'pasted' | 'edited' | 'computed' | 'imported'

export interface DocumentVersion {
  content: string
  source: ContentSource
  createdAt: string
}

/** One generate/revise request sent through a provider. */
export interface DocumentRequestRecord {
  id: string
  action: 'generate' | 'revise'
  instruction?: string
  providerId: string
  createdAt: string
  /**
   * Learning activities: the request changes one activity or adds alternatives.
   * Lesson plan reviews: the request produces a revised lesson plan.
   */
  scope?: DocumentScope
  handoff?: HandoffRecord
  /** `awaiting-reply` until content from that request is added to the document. */
  status: 'awaiting-reply' | 'completed'
}

interface DocumentBase {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  references: Attachment[]
  /** Markdown body of the document (empty until content is generated or pasted). */
  content: string
  contentSource: ContentSource | null
  /** Earlier contents, newest first, kept when content is replaced. */
  versions: DocumentVersion[]
  requests: DocumentRequestRecord[]
}

export interface QuestionTypeCount {
  type: QuestionType
  count: number
}

/** A TOS allocation copied into an assessment ("Build assessment from this TOS"). */
export interface TosAllocation {
  sourceId: string
  title: string
  mode: BloomMode
  rows: Array<{ competency: string; code: string; cells: number[] }>
}

export interface AssessmentInputs {
  subject: string
  gradeLevel: string
  topic: string
  competency: string
  competencyCode: string
  /** Total number of test items. */
  itemCount: number
  difficulty: Difficulty
  /** Mix of question types; counts must add up to `itemCount`. */
  questionTypes: QuestionTypeCount[]
  /** Percentages per Bloom column (ignored when `tos` is set). */
  distribution: BloomDistribution
  includeExplanations: boolean
  curriculum: CurriculumFramework
  language: TeachingLanguage
  instructions: string
  tos: TosAllocation | null
}

export type { TosCompetency, TosInputs, TosTable } from './tos'

export type TeachingDocument =
  | (DocumentBase & { kind: 'lesson-plan'; inputs: LessonPlanInputs })
  | (DocumentBase & { kind: 'learning-objectives'; inputs: ObjectivesInputs })
  | (DocumentBase & { kind: 'learning-activities'; inputs: ActivitiesInputs })
  | (DocumentBase & { kind: 'assessment'; inputs: AssessmentInputs })
  | (DocumentBase & { kind: 'tos'; inputs: TosInputs; table: TosTable | null })
  | (DocumentBase & { kind: 'performance-task'; inputs: PerformanceTaskInputs })
  | (DocumentBase & { kind: 'rubric'; inputs: RubricInputs; rubric: RubricData })
  | (DocumentBase & { kind: 'annotation'; inputs: AnnotationInputs })
  | (DocumentBase & {
      kind: 'lesson-plan-review'
      inputs: ReviewInputs
      /** Revised versions of the plan, newest first. The original is never changed. */
      revisions: RevisedLessonPlan[]
    })

export interface DocumentSummary {
  id: string
  kind: DocumentKind
  title: string
  /** e.g. "DLL · Computer Education / ICT · Grade 8" */
  subtitle: string
  createdAt: string
  updatedAt: string
  hasContent: boolean
}

export type DocumentAction = 'generate' | 'revise'

export interface DocumentPromptRequest {
  documentId: string
  action: DocumentAction
  /** Required for `revise`. */
  instruction?: string
  /** Regenerate one activity / add alternatives, or request a revised lesson plan. */
  scope?: DocumentScope
}

export interface DocumentGenerateRequest extends DocumentPromptRequest {
  requestId: string
  providerId: string
}

export interface DocumentPromptPreview {
  markdown: string
  chars: number
}

export const DOCUMENT_LIMITS = {
  titleMaxChars: 160,
  fieldMaxChars: 500,
  competencyMaxChars: 2_000,
  instructionsMaxChars: 4_000,
  contentMaxChars: 400_000,
  referencesPerDocument: 5,
  versionsKept: 10,
  maxAssessmentItems: 100,
  requestsKept: 50,
} as const
