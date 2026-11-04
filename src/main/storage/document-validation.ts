import {
  DOCUMENT_LIMITS,
  type ActivitiesInputs,
  type AnnotationInputs,
  type AssessmentInputs,
  type ContentSource,
  type DocumentRequestRecord,
  type DocumentVersion,
  type LessonPlanInputs,
  type ObjectivesInputs,
  type DocumentScope,
  type PerformanceTaskInputs,
  type ReviewInputs,
  type RubricInputs,
  type RubricTaskContext,
  type TaskGrouping,
  type TeachingDocument,
  type TosAllocation,
} from '@shared/documents'
import {
  ACTIVITY_CATEGORY_IDS,
  ACTIVITY_DIFFICULTY_IDS,
  ACTIVITY_LIMITS,
  LEARNING_ENVIRONMENT_IDS,
  type ActivityScope,
} from '@shared/activities'
import { ANNOTATION_LIMITS, type AnnotationSource } from '@shared/annotation'
import {
  REVIEW_DEPTH_IDS,
  REVIEW_FOCUS_IDS,
  REVIEW_LIMITS,
  REVISION_TARGET_IDS,
  type ReviewScope,
  type ReviewSource,
  type RevisedLessonPlan,
} from '@shared/review'
import { RUBRIC_LIMITS, type RubricData } from '@shared/rubric'
import { TOS_LIMITS, type TosInputs, type TosTable } from '@shared/tos'
import {
  BLOOM_GROUP_IDS,
  BLOOM_LEVEL_IDS,
  CURRICULUM_IDS,
  DIFFICULTIES,
  QUESTION_TYPE_IDS,
  LEARNING_DOMAIN_IDS,
  LESSON_PLAN_FORMAT_IDS,
  TEACHING_LANGUAGES,
  type BloomDistribution,
  type BloomGroup,
  type BloomLevel,
  type BloomMode,
  type CurriculumFramework,
  type Difficulty,
  type LearningDomain,
  type LessonPlanFormat,
  type QuestionType,
  type TeachingLanguage,
} from '@shared/teaching'
import { arr, bool, id, isoDate, obj, str, validateAttachment, validateHandoff } from './validation'

/**
 * Structural validation for documents saved from the renderer. Drafts may be
 * incomplete (empty fields are allowed); field-level rules are enforced when
 * a prompt is built (see shared/document-rules.ts).
 */

const L = DOCUMENT_LIMITS

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (!allowed.includes(value as T)) throw new Error(`Invalid data: ${path} is not a valid option`)
  return value as T
}

function int(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid data: ${path} must be a whole number from ${min} to ${max}`)
  }
  return value
}

function list<T extends string>(value: unknown, allowed: readonly T[], path: string): T[] {
  const items = arr(value, path, allowed.length).map((v, i) => oneOf(v, allowed, `${path}[${i}]`))
  return [...new Set(items)]
}

const CURRICULA: readonly CurriculumFramework[] = CURRICULUM_IDS
const SOURCES: readonly ContentSource[] = ['provider', 'pasted', 'edited', 'computed', 'imported']
const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as Difficulty[]

function lessonPlanInputs(value: unknown): LessonPlanInputs {
  const o = obj(value, 'inputs')
  return {
    subject: str(o.subject, 'inputs.subject', L.fieldMaxChars),
    gradeLevel: str(o.gradeLevel, 'inputs.gradeLevel', L.fieldMaxChars),
    quarter: int(o.quarter, 'inputs.quarter', 0, 99),
    week: int(o.week, 'inputs.week', 0, 99),
    topic: str(o.topic, 'inputs.topic', L.fieldMaxChars),
    competency: str(o.competency, 'inputs.competency', L.competencyMaxChars),
    competencyCode: str(o.competencyCode, 'inputs.competencyCode', 100),
    durationMinutes: int(o.durationMinutes, 'inputs.durationMinutes', 0, 1_000),
    sessions: int(o.sessions, 'inputs.sessions', 0, 99),
    format: oneOf<LessonPlanFormat>(o.format, LESSON_PLAN_FORMAT_IDS, 'inputs.format'),
    curriculum: oneOf(o.curriculum, CURRICULA, 'inputs.curriculum'),
    language: oneOf<TeachingLanguage>(o.language, TEACHING_LANGUAGES, 'inputs.language'),
    instructions: str(o.instructions, 'inputs.instructions', L.instructionsMaxChars),
  }
}

function objectivesInputs(value: unknown): ObjectivesInputs {
  const o = obj(value, 'inputs')
  return {
    subject: str(o.subject, 'inputs.subject', L.fieldMaxChars),
    gradeLevel: str(o.gradeLevel, 'inputs.gradeLevel', L.fieldMaxChars),
    topic: str(o.topic, 'inputs.topic', L.fieldMaxChars),
    competency: str(o.competency, 'inputs.competency', L.competencyMaxChars),
    competencyCode: str(o.competencyCode, 'inputs.competencyCode', 100),
    durationMinutes: int(o.durationMinutes, 'inputs.durationMinutes', 0, 1_000),
    bloomLevels: list<BloomLevel>(o.bloomLevels, BLOOM_LEVEL_IDS, 'inputs.bloomLevels'),
    domains: list<LearningDomain>(o.domains, LEARNING_DOMAIN_IDS, 'inputs.domains'),
    objectivesPerLevel: int(o.objectivesPerLevel, 'inputs.objectivesPerLevel', 0, 99),
    curriculum: oneOf(o.curriculum, CURRICULA, 'inputs.curriculum'),
    language: oneOf<TeachingLanguage>(o.language, TEACHING_LANGUAGES, 'inputs.language'),
    instructions: str(o.instructions, 'inputs.instructions', L.instructionsMaxChars),
  }
}

function activitiesInputs(value: unknown): ActivitiesInputs {
  const o = obj(value, 'inputs')
  return {
    subject: str(o.subject, 'inputs.subject', L.fieldMaxChars),
    gradeLevel: str(o.gradeLevel, 'inputs.gradeLevel', L.fieldMaxChars),
    quarter: int(o.quarter, 'inputs.quarter', 0, 99),
    topic: str(o.topic, 'inputs.topic', L.fieldMaxChars),
    competency: str(o.competency, 'inputs.competency', L.competencyMaxChars),
    competencyCode: str(o.competencyCode, 'inputs.competencyCode', 100),
    objectives: str(o.objectives, 'inputs.objectives', ACTIVITY_LIMITS.objectivesMaxChars),
    durationMinutes: int(o.durationMinutes, 'inputs.durationMinutes', 0, 10_000),
    activityCount: int(o.activityCount, 'inputs.activityCount', 0, 999),
    classSize: int(o.classSize, 'inputs.classSize', 0, 9_999),
    resources: str(o.resources, 'inputs.resources', L.instructionsMaxChars),
    environment: oneOf(o.environment, LEARNING_ENVIRONMENT_IDS, 'inputs.environment'),
    categories: list(o.categories, ACTIVITY_CATEGORY_IDS, 'inputs.categories'),
    difficulty: oneOf(o.difficulty, ACTIVITY_DIFFICULTY_IDS, 'inputs.difficulty'),
    curriculum: oneOf(o.curriculum, CURRICULA, 'inputs.curriculum'),
    language: oneOf<TeachingLanguage>(o.language, TEACHING_LANGUAGES, 'inputs.language'),
    instructions: str(o.instructions, 'inputs.instructions', L.instructionsMaxChars),
  }
}

function version(value: unknown, path: string): DocumentVersion {
  const o = obj(value, path)
  return {
    content: str(o.content, `${path}.content`, L.contentMaxChars),
    source: oneOf(o.source, SOURCES, `${path}.source`),
    createdAt: isoDate(o.createdAt, `${path}.createdAt`),
  }
}

function requestRecord(value: unknown, path: string): DocumentRequestRecord {
  const o = obj(value, path)
  const record: DocumentRequestRecord = {
    id: id(o.id, `${path}.id`),
    action: oneOf(o.action, ['generate', 'revise'] as const, `${path}.action`),
    providerId: str(o.providerId, `${path}.providerId`, 64, false),
    createdAt: isoDate(o.createdAt, `${path}.createdAt`),
    status: oneOf(o.status, ['awaiting-reply', 'completed'] as const, `${path}.status`),
  }
  if (o.instruction !== undefined) {
    record.instruction = str(o.instruction, `${path}.instruction`, L.instructionsMaxChars)
  }
  if (o.scope !== undefined) record.scope = documentScope(o.scope, `${path}.scope`)
  if (o.handoff !== undefined) record.handoff = validateHandoff(o.handoff, `${path}.handoff`)
  return record
}

/** A request scope for learning activities (one activity, or a number of alternatives). */
export function activityScope(value: unknown, path: string): ActivityScope {
  const o = obj(value, path)
  if (o.type === 'activity') {
    return { type: 'activity', index: int(o.index, `${path}.index`, 1, 99) }
  }
  if (o.type === 'alternatives') {
    return {
      type: 'alternatives',
      count: int(o.count, `${path}.count`, 1, ACTIVITY_LIMITS.maxAlternatives),
    }
  }
  throw new Error(`Invalid data: ${path}.type is not a valid option`)
}

/** A request scope for a lesson plan review (a revised lesson plan). */
export function reviewScope(value: unknown, path: string): ReviewScope {
  const o = obj(value, path)
  if (o.type !== 'revision') throw new Error(`Invalid data: ${path}.type is not a valid option`)
  const target = oneOf(o.target, REVISION_TARGET_IDS, `${path}.target`)
  const scope: ReviewScope = {
    type: 'revision',
    target,
    base: oneOf(o.base, ['original', 'revision'] as const, `${path}.base`),
  }
  if (o.sections !== undefined) {
    scope.sections = str(o.sections, `${path}.sections`, REVIEW_LIMITS.sectionsMaxChars)
  }
  if (target === 'sections' && !scope.sections?.trim()) {
    throw new Error('Name the sections to improve.')
  }
  return scope
}

/** Any request scope (activities or review revision). */
export function documentScope(value: unknown, path: string): DocumentScope {
  return obj(value, path).type === 'revision'
    ? reviewScope(value, path)
    : activityScope(value, path)
}

export function validateDocument(value: unknown): TeachingDocument {
  const o = obj(value, 'document')
  const base = {
    id: id(o.id, 'id'),
    title: str(o.title, 'title', L.titleMaxChars),
    createdAt: isoDate(o.createdAt, 'createdAt'),
    updatedAt: isoDate(o.updatedAt, 'updatedAt'),
    references: arr(o.references, 'references', L.referencesPerDocument).map((a, i) =>
      validateAttachment(a, `references[${i}]`),
    ),
    content: str(o.content, 'content', L.contentMaxChars),
    contentSource:
      o.contentSource === null ? null : oneOf(o.contentSource, SOURCES, 'contentSource'),
    versions: arr(o.versions, 'versions', L.versionsKept).map((v, i) =>
      version(v, `versions[${i}]`),
    ),
    requests: arr(o.requests, 'requests', L.requestsKept).map((r, i) =>
      requestRecord(r, `requests[${i}]`),
    ),
  }
  if (o.kind === 'lesson-plan')
    return { ...base, kind: 'lesson-plan', inputs: lessonPlanInputs(o.inputs) }
  if (o.kind === 'learning-objectives') {
    return { ...base, kind: 'learning-objectives', inputs: objectivesInputs(o.inputs) }
  }
  if (o.kind === 'learning-activities') {
    return { ...base, kind: 'learning-activities', inputs: activitiesInputs(o.inputs) }
  }
  if (o.kind === 'assessment') {
    return { ...base, kind: 'assessment', inputs: assessmentInputs(o.inputs) }
  }
  if (o.kind === 'tos') {
    const inputs = tosInputs(o.inputs)
    return { ...base, kind: 'tos', inputs, table: o.table === null ? null : tosTable(o.table) }
  }
  if (o.kind === 'performance-task') {
    return { ...base, kind: 'performance-task', inputs: performanceTaskInputs(o.inputs) }
  }
  if (o.kind === 'rubric') {
    return { ...base, kind: 'rubric', inputs: rubricInputs(o.inputs), rubric: rubricData(o.rubric) }
  }
  if (o.kind === 'annotation') {
    return { ...base, kind: 'annotation', inputs: annotationInputs(o.inputs) }
  }
  if (o.kind === 'lesson-plan-review') {
    return {
      ...base,
      kind: 'lesson-plan-review',
      inputs: reviewInputs(o.inputs),
      revisions: arr(o.revisions, 'revisions', REVIEW_LIMITS.revisionsKept).map((r, i) =>
        revisedPlan(r, `revisions[${i}]`),
      ),
    }
  }
  throw new Error('Invalid data: unknown document kind')
}

// ── Performance task & rubric ──────────────────────────────────────────────

const GROUPINGS: readonly TaskGrouping[] = ['individual', 'pairs', 'small-groups']

function performanceTaskInputs(value: unknown): PerformanceTaskInputs {
  const o = obj(value, 'inputs')
  return {
    subject: str(o.subject, 'inputs.subject', L.fieldMaxChars),
    gradeLevel: str(o.gradeLevel, 'inputs.gradeLevel', L.fieldMaxChars),
    competency: str(o.competency, 'inputs.competency', L.competencyMaxChars),
    competencyCode: str(o.competencyCode, 'inputs.competencyCode', 100),
    topic: str(o.topic, 'inputs.topic', L.fieldMaxChars),
    days: int(o.days, 'inputs.days', 0, 999),
    minutesPerDay: int(o.minutesPerDay, 'inputs.minutesPerDay', 0, 1_000),
    resources: str(o.resources, 'inputs.resources', L.instructionsMaxChars),
    expectedOutput: str(o.expectedOutput, 'inputs.expectedOutput', L.instructionsMaxChars),
    grouping: oneOf(o.grouping, GROUPINGS, 'inputs.grouping'),
    curriculum: oneOf(o.curriculum, CURRICULA, 'inputs.curriculum'),
    language: oneOf<TeachingLanguage>(o.language, TEACHING_LANGUAGES, 'inputs.language'),
    instructions: str(o.instructions, 'inputs.instructions', L.instructionsMaxChars),
  }
}

function rubricInputs(value: unknown): RubricInputs {
  const o = obj(value, 'inputs')
  const levelCount = o.levelCount
  if (levelCount !== 4 && levelCount !== 5)
    throw new Error('Invalid data: inputs.levelCount must be 4 or 5')
  let task: RubricTaskContext | null = null
  if (o.task !== null && o.task !== undefined) {
    const t = obj(o.task, 'inputs.task')
    task = {
      sourceId: id(t.sourceId, 'inputs.task.sourceId'),
      title: str(t.title, 'inputs.task.title', L.titleMaxChars),
      text: str(t.text, 'inputs.task.text', 20_000),
    }
  }
  return {
    subject: str(o.subject, 'inputs.subject', L.fieldMaxChars),
    gradeLevel: str(o.gradeLevel, 'inputs.gradeLevel', L.fieldMaxChars),
    taskTitle: str(o.taskTitle, 'inputs.taskTitle', L.fieldMaxChars),
    competency: str(o.competency, 'inputs.competency', L.competencyMaxChars),
    competencyCode: str(o.competencyCode, 'inputs.competencyCode', 100),
    levelCount,
    criteriaCount: int(o.criteriaCount, 'inputs.criteriaCount', 0, 99),
    targetTotal:
      o.targetTotal === null ? null : int(o.targetTotal, 'inputs.targetTotal', 0, 100_000),
    curriculum: oneOf(o.curriculum, CURRICULA, 'inputs.curriculum'),
    language: oneOf<TeachingLanguage>(o.language, TEACHING_LANGUAGES, 'inputs.language'),
    instructions: str(o.instructions, 'inputs.instructions', L.instructionsMaxChars),
    task,
  }
}

/** Numbers are only type-checked here; their maths is checked by checkRubric before saving. */
function num(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid data: ${path} must be a number`)
  }
  return value
}

function rubricData(value: unknown): RubricData {
  const o = obj(value, 'rubric')
  const D = RUBRIC_LIMITS.descriptorMaxChars
  return {
    type: oneOf(o.type, ['analytic', 'holistic'] as const, 'rubric.type'),
    levels: arr(o.levels, 'rubric.levels', 5).map((l, i) => {
      const v = obj(l, `rubric.levels[${i}]`)
      return {
        id: id(v.id, `rubric.levels[${i}].id`),
        label: str(v.label, `rubric.levels[${i}].label`, 80),
        score: num(v.score, `rubric.levels[${i}].score`),
      }
    }),
    criteria: arr(o.criteria, 'rubric.criteria', RUBRIC_LIMITS.maxCriteria).map((c, i) => {
      const v = obj(c, `rubric.criteria[${i}]`)
      return {
        id: id(v.id, `rubric.criteria[${i}].id`),
        name: str(v.name, `rubric.criteria[${i}].name`, 200),
        weight: num(v.weight, `rubric.criteria[${i}].weight`),
        descriptors: arr(v.descriptors, `rubric.criteria[${i}].descriptors`, 5).map((d, k) =>
          str(d, `rubric.criteria[${i}].descriptors[${k}]`, D),
        ),
      }
    }),
    holistic: arr(o.holistic, 'rubric.holistic', 5).map((h, i) => {
      const v = obj(h, `rubric.holistic[${i}]`)
      return {
        id: id(v.id, `rubric.holistic[${i}].id`),
        label: str(v.label, `rubric.holistic[${i}].label`, 80),
        minPoints: num(v.minPoints, `rubric.holistic[${i}].minPoints`),
        maxPoints: num(v.maxPoints, `rubric.holistic[${i}].maxPoints`),
        description: str(v.description, `rubric.holistic[${i}].description`, D * 2),
      }
    }),
  }
}

// ── Assessment & TOS ───────────────────────────────────────────────────────

const MODES: readonly BloomMode[] = ['grouped', 'levels']

function percent(value: unknown, path: string): number {
  return int(value, path, 0, 100)
}

function distribution(value: unknown, path: string): BloomDistribution {
  const o = obj(value, path)
  const g = obj(o.groups, `${path}.groups`)
  const l = obj(o.levels, `${path}.levels`)
  const groups = Object.fromEntries(
    BLOOM_GROUP_IDS.map((k) => [k, percent(g[k], `${path}.groups.${k}`)]),
  ) as Record<BloomGroup, number>
  const levels = Object.fromEntries(
    BLOOM_LEVEL_IDS.map((k) => [k, percent(l[k], `${path}.levels.${k}`)]),
  ) as Record<BloomLevel, number>
  return { mode: oneOf(o.mode, MODES, `${path}.mode`), groups, levels }
}

function cells(value: unknown, path: string, max: number): number[] {
  return arr(value, path, BLOOM_LEVEL_IDS.length).map((v, i) => int(v, `${path}[${i}]`, 0, max))
}

function tosAllocation(value: unknown): TosAllocation {
  const o = obj(value, 'inputs.tos')
  return {
    sourceId: id(o.sourceId, 'inputs.tos.sourceId'),
    title: str(o.title, 'inputs.tos.title', L.titleMaxChars),
    mode: oneOf(o.mode, MODES, 'inputs.tos.mode'),
    rows: arr(o.rows, 'inputs.tos.rows', TOS_LIMITS.maxCompetencies).map((r, i) => {
      const row = obj(r, `inputs.tos.rows[${i}]`)
      return {
        competency: str(row.competency, `inputs.tos.rows[${i}].competency`, L.competencyMaxChars),
        code: str(row.code, `inputs.tos.rows[${i}].code`, 100),
        cells: cells(row.cells, `inputs.tos.rows[${i}].cells`, TOS_LIMITS.maxItems),
      }
    }),
  }
}

function assessmentInputs(value: unknown): AssessmentInputs {
  const o = obj(value, 'inputs')
  const questionTypes = arr(o.questionTypes, 'inputs.questionTypes', QUESTION_TYPE_IDS.length).map(
    (q, i) => {
      const item = obj(q, `inputs.questionTypes[${i}]`)
      return {
        type: oneOf<QuestionType>(item.type, QUESTION_TYPE_IDS, `inputs.questionTypes[${i}].type`),
        count: int(item.count, `inputs.questionTypes[${i}].count`, 0, 999),
      }
    },
  )
  if (new Set(questionTypes.map((q) => q.type)).size !== questionTypes.length) {
    throw new Error('Invalid data: inputs.questionTypes lists a type twice')
  }
  return {
    subject: str(o.subject, 'inputs.subject', L.fieldMaxChars),
    gradeLevel: str(o.gradeLevel, 'inputs.gradeLevel', L.fieldMaxChars),
    topic: str(o.topic, 'inputs.topic', L.fieldMaxChars),
    competency: str(o.competency, 'inputs.competency', L.competencyMaxChars),
    competencyCode: str(o.competencyCode, 'inputs.competencyCode', 100),
    itemCount: int(o.itemCount, 'inputs.itemCount', 0, 999),
    difficulty: oneOf<Difficulty>(o.difficulty, DIFFICULTY_IDS, 'inputs.difficulty'),
    questionTypes,
    distribution: distribution(o.distribution, 'inputs.distribution'),
    includeExplanations: bool(o.includeExplanations, 'inputs.includeExplanations'),
    curriculum: oneOf(o.curriculum, CURRICULA, 'inputs.curriculum'),
    language: oneOf<TeachingLanguage>(o.language, TEACHING_LANGUAGES, 'inputs.language'),
    instructions: str(o.instructions, 'inputs.instructions', L.instructionsMaxChars),
    tos: o.tos === null || o.tos === undefined ? null : tosAllocation(o.tos),
  }
}

function tosInputs(value: unknown): TosInputs {
  const o = obj(value, 'inputs')
  const competencies = arr(o.competencies, 'inputs.competencies', TOS_LIMITS.maxCompetencies).map(
    (c, i) => {
      const row = obj(c, `inputs.competencies[${i}]`)
      const hours = row.hours
      if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0 || hours > 10_000) {
        throw new Error(`Invalid data: inputs.competencies[${i}].hours must be a number`)
      }
      return {
        id: id(row.id, `inputs.competencies[${i}].id`),
        competency: str(
          row.competency,
          `inputs.competencies[${i}].competency`,
          L.competencyMaxChars,
        ),
        code: str(row.code, `inputs.competencies[${i}].code`, 100),
        hours,
      }
    },
  )
  if (new Set(competencies.map((c) => c.id)).size !== competencies.length) {
    throw new Error('Invalid data: duplicate competency ids')
  }
  return {
    examTitle: str(o.examTitle, 'inputs.examTitle', L.fieldMaxChars),
    subject: str(o.subject, 'inputs.subject', L.fieldMaxChars),
    gradeLevel: str(o.gradeLevel, 'inputs.gradeLevel', L.fieldMaxChars),
    quarter: int(o.quarter, 'inputs.quarter', 0, 99),
    totalItems: int(o.totalItems, 'inputs.totalItems', 0, 9_999),
    distribution: distribution(o.distribution, 'inputs.distribution'),
    competencies,
  }
}

function tosTable(value: unknown): TosTable {
  const o = obj(value, 'table')
  return {
    mode: oneOf(o.mode, MODES, 'table.mode'),
    rows: arr(o.rows, 'table.rows', TOS_LIMITS.maxCompetencies).map((r, i) => {
      const row = obj(r, `table.rows[${i}]`)
      return {
        competencyId: id(row.competencyId, `table.rows[${i}].competencyId`),
        cells: cells(row.cells, `table.rows[${i}].cells`, 9_999),
      }
    }),
    edited: bool(o.edited, 'table.edited'),
  }
}

// ── DLL annotation ─────────────────────────────────────────────────────────

function annotationInputs(value: unknown): AnnotationInputs {
  const o = obj(value, 'inputs')
  let source: AnnotationSource | null = null
  if (o.source !== null && o.source !== undefined) {
    const v = obj(o.source, 'inputs.source')
    source = {
      origin: oneOf(v.origin, ['resource', 'document'] as const, 'inputs.source.origin'),
      refId: id(v.refId, 'inputs.source.refId'),
      title: str(v.title, 'inputs.source.title', L.titleMaxChars),
      text: str(v.text, 'inputs.source.text', ANNOTATION_LIMITS.sourceMaxChars),
      charCount: int(v.charCount, 'inputs.source.charCount', 0, 100_000_000),
    }
  }
  return {
    subject: str(o.subject, 'inputs.subject', L.fieldMaxChars),
    gradeLevel: str(o.gradeLevel, 'inputs.gradeLevel', L.fieldMaxChars),
    focus: str(o.focus, 'inputs.focus', ANNOTATION_LIMITS.focusMaxChars),
    paragraphs: int(o.paragraphs, 'inputs.paragraphs', 0, 99),
    length: oneOf(o.length, ['short', 'medium', 'long'] as const, 'inputs.length'),
    perspective: oneOf(
      o.perspective,
      ['first-person', 'third-person'] as const,
      'inputs.perspective',
    ),
    language: oneOf<TeachingLanguage>(o.language, TEACHING_LANGUAGES, 'inputs.language'),
    instructions: str(o.instructions, 'inputs.instructions', L.instructionsMaxChars),
    source,
  }
}

// ── Lesson plan review ─────────────────────────────────────────────────────

function reviewInputs(value: unknown): ReviewInputs {
  const o = obj(value, 'inputs')
  let source: ReviewSource | null = null
  if (o.source !== null && o.source !== undefined) {
    const v = obj(o.source, 'inputs.source')
    const origin = oneOf(
      v.origin,
      ['resource', 'document', 'pasted'] as const,
      'inputs.source.origin',
    )
    source = {
      origin,
      refId: origin === 'pasted' ? null : id(v.refId, 'inputs.source.refId'),
      title: str(v.title, 'inputs.source.title', L.titleMaxChars),
      text: str(v.text, 'inputs.source.text', REVIEW_LIMITS.sourceMaxChars),
      charCount: int(v.charCount, 'inputs.source.charCount', 0, 100_000_000),
    }
  }
  return {
    subject: str(o.subject, 'inputs.subject', L.fieldMaxChars),
    gradeLevel: str(o.gradeLevel, 'inputs.gradeLevel', L.fieldMaxChars),
    planType: oneOf<LessonPlanFormat>(o.planType, LESSON_PLAN_FORMAT_IDS, 'inputs.planType'),
    depth: oneOf(o.depth, REVIEW_DEPTH_IDS, 'inputs.depth'),
    focus: oneOf(o.focus, REVIEW_FOCUS_IDS, 'inputs.focus'),
    formatRequirements: str(
      o.formatRequirements,
      'inputs.formatRequirements',
      REVIEW_LIMITS.formatMaxChars,
    ),
    curriculum: oneOf(o.curriculum, CURRICULA, 'inputs.curriculum'),
    language: oneOf<TeachingLanguage>(o.language, TEACHING_LANGUAGES, 'inputs.language'),
    instructions: str(o.instructions, 'inputs.instructions', L.instructionsMaxChars),
    source,
  }
}

function revisedPlan(value: unknown, path: string): RevisedLessonPlan {
  const o = obj(value, path)
  return {
    id: id(o.id, `${path}.id`),
    target: oneOf(o.target, REVISION_TARGET_IDS, `${path}.target`),
    sections: str(o.sections, `${path}.sections`, REVIEW_LIMITS.sectionsMaxChars),
    base: oneOf(o.base, ['original', 'revision'] as const, `${path}.base`),
    content: str(o.content, `${path}.content`, L.contentMaxChars),
    notes: str(o.notes, `${path}.notes`, REVIEW_LIMITS.notesMaxChars),
    source: oneOf(o.source, ['provider', 'pasted', 'edited'] as const, `${path}.source`),
    createdAt: isoDate(o.createdAt, `${path}.createdAt`),
    savedAsId: o.savedAsId === null ? null : id(o.savedAsId, `${path}.savedAsId`),
  }
}
