/**
 * Validation for the calculation-heavy tools: Assessment Builder (question
 * type totals, Bloom's distribution), Table of Specifications (row and column
 * totals), Performance Tasks and Rubrics (points and total score). Pure —
 * shared by the UI and the main process.
 */
import {
  codeError,
  compact,
  intIn,
  maxLen,
  required,
  validateLessonPlanInputs,
  validateObjectivesInputs,
  type ContentWarning,
  type FieldErrors,
} from './document-rules'
import {
  DOCUMENT_LIMITS,
  type ActivitiesInputs,
  type AnnotationInputs,
  type AssessmentInputs,
  type PerformanceTaskInputs,
  type ReviewInputs,
  type RubricInputs,
  type TeachingDocument,
} from './documents'
import { REVIEW_DEPTH_IDS, REVIEW_FOCUS_IDS, REVIEW_LIMITS } from './review'
import {
  ACTIVITY_CATEGORY_IDS,
  ACTIVITY_DIFFICULTY_IDS,
  ACTIVITY_LIMITS,
  LEARNING_ENVIRONMENT_IDS,
} from './activities'
import { ANNOTATION_LENGTHS, ANNOTATION_LIMITS } from './annotation'
import { RUBRIC_LIMITS, checkRubric, type RubricType } from './rubric'
import {
  BLOOM_GROUPS,
  BLOOM_LEVELS,
  BLOOM_LEVEL_IDS,
  DIFFICULTIES,
  LESSON_PLAN_FORMATS,
  QUESTION_TYPES,
  type Difficulty,
} from './teaching'
import {
  TOS_LIMITS,
  checkTosTable,
  distributionColumns,
  distributionCounts,
  distributionError,
  type TosInputs,
} from './tos'

const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as Difficulty[]

// ── Assessments ────────────────────────────────────────────────────────────

/** Item counts per Bloom column for an assessment (from its TOS when attached). */
export function assessmentColumnCounts(i: AssessmentInputs): number[] {
  const tos = i.tos
  if (tos) {
    const columns = distributionColumns(tos.mode).length
    return Array.from({ length: columns }, (_, j) =>
      tos.rows.reduce((a, r) => a + (r.cells[j] ?? 0), 0),
    )
  }
  return distributionCounts(i.itemCount, i.distribution)
}

export function questionTypeTotal(i: AssessmentInputs): number {
  return i.questionTypes.reduce((a, q) => a + (Number.isInteger(q.count) ? q.count : 0), 0)
}

export function tosAllocationTotal(i: AssessmentInputs): number | null {
  return i.tos ? i.tos.rows.reduce((a, r) => a + r.cells.reduce((x, y) => x + y, 0), 0) : null
}

export function validateAssessmentInputs(i: AssessmentInputs): FieldErrors<AssessmentInputs> {
  const typesUsed = i.questionTypes.filter((q) => q.count > 0)
  const typeTotal = questionTypeTotal(i)
  const tosTotal = tosAllocationTotal(i)
  return compact<AssessmentInputs>({
    subject:
      required(i.subject, 'Subject') ?? maxLen(i.subject, DOCUMENT_LIMITS.fieldMaxChars, 'Subject'),
    gradeLevel: required(i.gradeLevel, 'Grade level'),
    topic: required(i.topic, 'Topic') ?? maxLen(i.topic, DOCUMENT_LIMITS.fieldMaxChars, 'Topic'),
    competency: maxLen(i.competency, DOCUMENT_LIMITS.competencyMaxChars, 'Learning competency'),
    competencyCode: codeError(i.competencyCode),
    itemCount:
      intIn(i.itemCount, 1, DOCUMENT_LIMITS.maxAssessmentItems, 'Number of questions') ??
      (tosTotal !== null && tosTotal !== i.itemCount
        ? `The attached TOS has ${tosTotal} items; the number of questions must match.`
        : undefined),
    difficulty: DIFFICULTY_IDS.includes(i.difficulty) ? undefined : 'Choose a difficulty.',
    questionTypes:
      typesUsed.length === 0
        ? 'Choose at least one question type.'
        : i.questionTypes.some((q) => !Number.isInteger(q.count) || q.count < 0)
          ? 'Question counts must be whole numbers.'
          : typeTotal !== i.itemCount
            ? `Question types add up to ${typeTotal} item${typeTotal === 1 ? '' : 's'}; the test has ${i.itemCount}.`
            : undefined,
    distribution: i.tos ? undefined : distributionError(i.distribution),
    instructions: maxLen(
      i.instructions,
      DOCUMENT_LIMITS.instructionsMaxChars,
      'Additional instructions',
    ),
  })
}

/**
 * Non-blocking advice: Bloom's levels the chosen question types can't really
 * assess (e.g. Evaluating items when only True/False is selected).
 */
export function assessmentWarnings(i: AssessmentInputs): string[] {
  const order = BLOOM_LEVEL_IDS
  const counts = assessmentColumnCounts(i)
  const mode = i.tos ? i.tos.mode : i.distribution.mode
  // The lowest Bloom level that each column's items need.
  const columnLevel =
    mode === 'grouped'
      ? BLOOM_GROUPS.map((g) => order.indexOf(g.levels[0]))
      : order.map((_, k) => k)
  for (let level = order.length - 1; level >= 0; level--) {
    const needed = counts.reduce((a, n, j) => (columnLevel[j] >= level ? a + n : a), 0)
    if (needed === 0) continue
    const capable = i.questionTypes.reduce(
      (a, q) => (order.indexOf(QUESTION_TYPES[q.type].highestLevel) >= level ? a + q.count : a),
      0,
    )
    if (needed > capable) {
      const suggestion =
        level <= order.indexOf('evaluating')
          ? 'essay, problem-solving or multiple-choice'
          : 'essay or problem-solving'
      return [
        `${needed} item${needed === 1 ? '' : 's'} target ${BLOOM_LEVELS[level].label} or higher, but only ${capable} of your questions use a type that can assess that level. Add ${suggestion} items, or lower the higher-order share.`,
      ]
    }
  }
  return []
}

/**
 * Check that the "Answer key" section lists every item from 1 to `itemCount`
 * exactly once (table rows like "| 3 | B |" or list items like "3. B").
 */
export function checkAnswerKey(content: string, itemCount: number): ContentWarning[] {
  const lines = content.split('\n')
  const start = lines.findIndex((l) => /^#{1,6}\s+.*answer\s*key/i.test(l))
  if (start === -1) {
    return content.trim()
      ? [
          {
            kind: 'answer-key',
            match: '',
            message: 'No “Answer Key” section was found. Add one so the test can be checked.',
          },
        ]
      : []
  }
  const level = (lines[start].match(/^#+/) ?? ['#'])[0].length
  const seen = new Map<number, number>()
  for (const line of lines.slice(start + 1)) {
    const heading = line.match(/^(#+)\s/)
    if (heading && heading[1].length <= level) break
    const m = line.match(/^\s*\|\s*\**(\d{1,3})\**\s*\|/) ?? line.match(/^\s*(\d{1,3})[.)]\s+\S/)
    if (m) seen.set(Number(m[1]), (seen.get(Number(m[1])) ?? 0) + 1)
  }
  const missing = Array.from({ length: itemCount }, (_, k) => k + 1).filter((n) => !seen.has(n))
  const extra = [...seen.keys()].filter((n) => n < 1 || n > itemCount)
  const duplicate = [...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n)
  const list = (ns: number[]) => (ns.length > 8 ? `${ns.slice(0, 8).join(', ')}, …` : ns.join(', '))
  const plural = (ns: number[]) => (ns.length === 1 ? '' : 's')
  const warnings: ContentWarning[] = []
  if (missing.length) {
    warnings.push({
      kind: 'answer-key',
      match: '',
      message: `The answer key is missing item${plural(missing)} ${list(missing)} (the test has ${itemCount} items).`,
    })
  }
  if (extra.length) {
    warnings.push({
      kind: 'answer-key',
      match: '',
      message: `The answer key has item number${plural(extra)} ${list(extra)}, beyond the ${itemCount} items of this test.`,
    })
  }
  if (duplicate.length) {
    warnings.push({
      kind: 'answer-key',
      match: '',
      message: `The answer key lists item${plural(duplicate)} ${list(duplicate)} more than once.`,
    })
  }
  return warnings
}

// ── Table of Specifications ────────────────────────────────────────────────

export interface CompetencyRowErrors {
  competency?: string
  code?: string
  hours?: string
}

export function tosCompetencyErrors(i: TosInputs): CompetencyRowErrors[] {
  return i.competencies.map((c) => {
    const e: CompetencyRowErrors = {}
    if (!c.competency.trim()) e.competency = 'Enter the learning competency.'
    else if (c.competency.length > DOCUMENT_LIMITS.competencyMaxChars) e.competency = 'Too long.'
    const code = codeError(c.code)
    if (code) e.code = code
    if (!Number.isFinite(c.hours) || c.hours <= 0 || c.hours > TOS_LIMITS.maxHours) {
      e.hours = `Hours must be more than 0 and at most ${TOS_LIMITS.maxHours}.`
    } else if (Math.abs(Math.round(c.hours * 100) - c.hours * 100) > 1e-9) {
      e.hours = 'Use at most two decimal places.'
    }
    return e
  })
}

export function validateTosInputs(i: TosInputs): FieldErrors<TosInputs> {
  const badRows = tosCompetencyErrors(i).filter((e) => Object.keys(e).length > 0).length
  return compact<TosInputs>({
    examTitle:
      required(i.examTitle, 'Test title') ??
      maxLen(i.examTitle, DOCUMENT_LIMITS.fieldMaxChars, 'Test title'),
    subject:
      required(i.subject, 'Subject') ?? maxLen(i.subject, DOCUMENT_LIMITS.fieldMaxChars, 'Subject'),
    gradeLevel: required(i.gradeLevel, 'Grade level'),
    quarter: intIn(i.quarter, 1, 4, 'Quarter'),
    totalItems: intIn(i.totalItems, 1, TOS_LIMITS.maxItems, 'Number of test items'),
    distribution: distributionError(i.distribution),
    competencies:
      i.competencies.length === 0
        ? 'Add at least one learning competency.'
        : i.competencies.length > TOS_LIMITS.maxCompetencies
          ? `Use at most ${TOS_LIMITS.maxCompetencies} competencies.`
          : badRows > 0
            ? `Fix ${badRows} competenc${badRows === 1 ? 'y' : 'ies'} below.`
            : undefined,
  })
}

// ── Performance tasks ──────────────────────────────────────────────────────

export function validatePerformanceTaskInputs(
  i: PerformanceTaskInputs,
): FieldErrors<PerformanceTaskInputs> {
  return compact<PerformanceTaskInputs>({
    subject:
      required(i.subject, 'Subject') ?? maxLen(i.subject, DOCUMENT_LIMITS.fieldMaxChars, 'Subject'),
    gradeLevel: required(i.gradeLevel, 'Grade level'),
    competency:
      required(i.competency, 'Learning competency') ??
      maxLen(i.competency, DOCUMENT_LIMITS.competencyMaxChars, 'Learning competency'),
    competencyCode: codeError(i.competencyCode),
    topic:
      required(i.topic, 'Lesson topic') ??
      maxLen(i.topic, DOCUMENT_LIMITS.fieldMaxChars, 'Lesson topic'),
    days: intIn(i.days, 1, 30, 'Number of days'),
    minutesPerDay: intIn(i.minutesPerDay, 10, 300, 'Minutes per day'),
    resources: maxLen(i.resources, DOCUMENT_LIMITS.instructionsMaxChars, 'Available resources'),
    expectedOutput: maxLen(
      i.expectedOutput,
      DOCUMENT_LIMITS.instructionsMaxChars,
      'Expected output',
    ),
    grouping: ['individual', 'pairs', 'small-groups'].includes(i.grouping)
      ? undefined
      : 'Choose how learners work.',
    instructions: maxLen(
      i.instructions,
      DOCUMENT_LIMITS.instructionsMaxChars,
      'Additional instructions',
    ),
  })
}

/** The eight sections every performance task must have, with heading patterns. */
export const PERFORMANCE_TASK_SECTIONS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'Learning Objectives', pattern: /learning\s+objectives?/i },
  { label: 'Real-World Scenario', pattern: /scenario/i },
  { label: 'Student Instructions', pattern: /instructions/i },
  { label: 'Materials Needed', pattern: /materials/i },
  { label: 'Expected Output', pattern: /expected\s+output|product/i },
  { label: 'Submission Requirements', pattern: /submission/i },
  { label: 'Assessment Criteria', pattern: /assessment\s+criteria|criteria/i },
]

/** Warn when a pasted performance task is missing its title or any required section. */
export function checkPerformanceTaskSections(content: string): ContentWarning[] {
  if (!content.trim()) return []
  const headings = content
    .split('\n')
    .filter((l) => /^#{1,6}\s/.test(l))
    .map((l) => l.replace(/^#+\s*/, ''))
  const warnings: ContentWarning[] = []
  if (!/^#\s+\S/m.test(content)) {
    warnings.push({
      kind: 'missing-section',
      match: 'title',
      message: 'The task has no title (a level-1 heading).',
    })
  }
  for (const s of PERFORMANCE_TASK_SECTIONS) {
    if (!headings.some((h) => s.pattern.test(h))) {
      warnings.push({
        kind: 'missing-section',
        match: s.label,
        message: `The “${s.label}” section is missing.`,
      })
    }
  }
  return warnings
}

/** Criterion names listed under the task's "Assessment Criteria" heading (for a rubric). */
export function extractAssessmentCriteria(content: string, max = 8): string[] {
  const lines = content.split('\n')
  const start = lines.findIndex((l) => /^#{1,6}\s+.*criteria/i.test(l))
  if (start === -1) return []
  const level = (lines[start].match(/^#+/) ?? ['#'])[0].length
  const names: string[] = []
  for (const line of lines.slice(start + 1)) {
    const heading = line.match(/^(#+)\s/)
    if (heading && heading[1].length <= level) break
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/) ?? line.match(/^\s*\|\s*([^|]+?)\s*\|/)
    if (!item) continue
    const raw = item[1].trim()
    if (/^(criteri(a|on)|-+)$/i.test(raw.replace(/\*/g, ''))) continue
    const bold = raw.match(/^\*\*(.+?)\*\*/)
    const name = (bold ? bold[1] : raw.split(/\s[—–-]\s|:/)[0])
      .replace(/\*/g, '')
      .replace(/\s*\(\d+%?\)\s*$/, '')
      .trim()
    if (name && name.length <= 80 && !names.includes(name)) names.push(name)
    if (names.length >= max) break
  }
  return names
}

// ── Rubrics ────────────────────────────────────────────────────────────────

export function validateRubricInputs(i: RubricInputs, type: RubricType): FieldErrors<RubricInputs> {
  return compact<RubricInputs>({
    subject:
      required(i.subject, 'Subject') ?? maxLen(i.subject, DOCUMENT_LIMITS.fieldMaxChars, 'Subject'),
    gradeLevel: required(i.gradeLevel, 'Grade level'),
    taskTitle:
      required(i.taskTitle, 'Task or product being assessed') ??
      maxLen(i.taskTitle, DOCUMENT_LIMITS.fieldMaxChars, 'Task or product'),
    competency: maxLen(i.competency, DOCUMENT_LIMITS.competencyMaxChars, 'Learning competency'),
    competencyCode: codeError(i.competencyCode),
    levelCount: i.levelCount === 4 || i.levelCount === 5 ? undefined : 'Choose 4 or 5 levels.',
    criteriaCount: intIn(i.criteriaCount, 1, RUBRIC_LIMITS.maxCriteria, 'Number of criteria'),
    targetTotal:
      i.targetTotal === null
        ? type === 'holistic'
          ? 'A holistic rubric needs a total score.'
          : undefined
        : intIn(i.targetTotal, 1, RUBRIC_LIMITS.maxTotal, 'Total score'),
    instructions: maxLen(
      i.instructions,
      DOCUMENT_LIMITS.instructionsMaxChars,
      'Additional instructions',
    ),
  })
}

// ── DLL annotation ─────────────────────────────────────────────────────────

export function validateAnnotationInputs(i: AnnotationInputs): FieldErrors<AnnotationInputs> {
  return compact<AnnotationInputs>({
    source: !i.source?.text.trim() ? 'Choose or upload the DLL to annotate.' : undefined,
    focus: maxLen(i.focus, ANNOTATION_LIMITS.focusMaxChars, 'Focus'),
    paragraphs: intIn(i.paragraphs, 1, ANNOTATION_LIMITS.maxParagraphs, 'Number of paragraphs'),
    length: i.length in ANNOTATION_LENGTHS ? undefined : 'Choose a paragraph length.',
    instructions: maxLen(
      i.instructions,
      DOCUMENT_LIMITS.instructionsMaxChars,
      'Additional instructions',
    ),
  })
}

// ── Learning activities ────────────────────────────────────────────────────

export function validateActivitiesInputs(i: ActivitiesInputs): FieldErrors<ActivitiesInputs> {
  const A = ACTIVITY_LIMITS
  const count = intIn(i.activityCount, 1, A.maxActivities, 'Number of activities')
  const duration = intIn(i.durationMinutes, A.minDuration, A.maxDuration, 'Duration')
  return compact<ActivitiesInputs>({
    subject:
      required(i.subject, 'Subject') ?? maxLen(i.subject, DOCUMENT_LIMITS.fieldMaxChars, 'Subject'),
    gradeLevel: required(i.gradeLevel, 'Grade level'),
    quarter: intIn(i.quarter, 1, 4, 'Quarter'),
    topic:
      required(i.topic, 'Lesson topic') ??
      maxLen(i.topic, DOCUMENT_LIMITS.fieldMaxChars, 'Lesson topic'),
    competency:
      required(i.competency, 'Learning competency') ??
      maxLen(i.competency, DOCUMENT_LIMITS.competencyMaxChars, 'Learning competency'),
    competencyCode: codeError(i.competencyCode),
    objectives: maxLen(i.objectives, A.objectivesMaxChars, 'Learning objectives'),
    durationMinutes: duration,
    activityCount:
      count ??
      (!duration && i.durationMinutes < i.activityCount * A.minMinutesPerActivity
        ? `${i.activityCount} activities don’t fit in ${i.durationMinutes} minutes; allow at least ${A.minMinutesPerActivity} minutes per activity.`
        : undefined),
    classSize: intIn(i.classSize, 1, A.maxClassSize, 'Class size'),
    resources: maxLen(i.resources, DOCUMENT_LIMITS.instructionsMaxChars, 'Available resources'),
    environment: LEARNING_ENVIRONMENT_IDS.includes(i.environment)
      ? undefined
      : 'Choose a learning environment.',
    categories:
      i.categories.length === 0
        ? 'Choose at least one activity category.'
        : i.categories.some((c) => !ACTIVITY_CATEGORY_IDS.includes(c))
          ? 'Unknown activity category.'
          : undefined,
    difficulty: ACTIVITY_DIFFICULTY_IDS.includes(i.difficulty)
      ? undefined
      : 'Choose a difficulty level.',
    instructions: maxLen(
      i.instructions,
      DOCUMENT_LIMITS.instructionsMaxChars,
      'Additional instructions',
    ),
  })
}

// ── Lesson plan review ─────────────────────────────────────────────────────

export function validateReviewInputs(i: ReviewInputs): FieldErrors<ReviewInputs> {
  const text = i.source?.text.trim() ?? ''
  return compact<ReviewInputs>({
    source: !i.source
      ? 'Upload, choose or paste the lesson plan to review.'
      : text.length < REVIEW_LIMITS.minSourceChars
        ? `The lesson plan is too short to review (at least ${REVIEW_LIMITS.minSourceChars} characters).`
        : maxLen(i.source.text, REVIEW_LIMITS.sourceMaxChars, 'The lesson plan'),
    subject: maxLen(i.subject, DOCUMENT_LIMITS.fieldMaxChars, 'Subject'),
    gradeLevel: maxLen(i.gradeLevel, DOCUMENT_LIMITS.fieldMaxChars, 'Grade level'),
    planType: LESSON_PLAN_FORMATS[i.planType] ? undefined : 'Choose the type of lesson plan.',
    depth: REVIEW_DEPTH_IDS.includes(i.depth) ? undefined : 'Choose a review depth.',
    focus: REVIEW_FOCUS_IDS.includes(i.focus) ? undefined : 'Choose a review focus.',
    formatRequirements: maxLen(
      i.formatRequirements,
      REVIEW_LIMITS.formatMaxChars,
      'Formatting requirements',
    ),
    instructions: maxLen(
      i.instructions,
      DOCUMENT_LIMITS.instructionsMaxChars,
      'Additional instructions',
    ),
  })
}

/** Field errors for any document kind (used by the forms and before building a prompt). */
export function documentInputErrors(doc: TeachingDocument): Record<string, string | undefined> {
  switch (doc.kind) {
    case 'lesson-plan':
      return validateLessonPlanInputs(doc.inputs)
    case 'learning-objectives':
      return validateObjectivesInputs(doc.inputs)
    case 'learning-activities':
      return validateActivitiesInputs(doc.inputs)
    case 'assessment':
      return validateAssessmentInputs(doc.inputs)
    case 'tos':
      return validateTosInputs(doc.inputs)
    case 'performance-task':
      return validatePerformanceTaskInputs(doc.inputs)
    case 'rubric':
      return validateRubricInputs(doc.inputs, doc.rubric.type)
    case 'annotation':
      return validateAnnotationInputs(doc.inputs)
    case 'lesson-plan-review':
      return validateReviewInputs(doc.inputs)
  }
}

/**
 * Calculation problems that block saving: question-type totals and Bloom's
 * percentages for assessments; inputs plus every row/column total for a TOS.
 */
export function calculationErrors(doc: TeachingDocument): string[] {
  if (doc.kind === 'rubric') {
    const e = validateRubricInputs(doc.inputs, doc.rubric.type)
    const inputErrors = [e.levelCount, e.targetTotal].filter((m): m is string => m !== undefined)
    if (inputErrors.length > 0) return inputErrors
    return checkRubric(doc.rubric, doc.inputs.levelCount, doc.inputs.targetTotal).errors
  }
  if (doc.kind === 'assessment') {
    const e = validateAssessmentInputs(doc.inputs)
    const counted =
      e.questionTypes && !e.questionTypes.startsWith('Choose') ? e.questionTypes : undefined
    return [counted, e.distribution, e.itemCount].filter((m): m is string => m !== undefined)
  }
  if (doc.kind === 'tos') {
    const e = validateTosInputs(doc.inputs)
    // Only numbers block saving; an unfinished competency name doesn't.
    const hourErrors = tosCompetencyErrors(doc.inputs).map((r, i) =>
      r.hours ? `Row ${i + 1}: ${r.hours}` : undefined,
    )
    const countError =
      doc.inputs.competencies.length === 0 ||
      doc.inputs.competencies.length > TOS_LIMITS.maxCompetencies
        ? e.competencies
        : undefined
    const inputErrors = [e.totalItems, e.distribution, countError, ...hourErrors].filter(
      (m): m is string => m !== undefined,
    )
    if (inputErrors.length > 0) return inputErrors
    if (!doc.table) return []
    const check = checkTosTable(doc.inputs, doc.table)
    return [
      ...check.errors,
      ...check.rowErrors.filter((m): m is string => m !== null),
      ...check.columnErrors.filter((m): m is string => m !== null),
    ]
  }
  return []
}
