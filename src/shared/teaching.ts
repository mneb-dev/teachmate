/**
 * Teaching vocabulary shared by the UI (forms, hints) and the main process
 * (validation, prompt building). Pure data — no Node or DOM APIs.
 */

// ── Curriculum & defaults ──────────────────────────────────────────────────

export type CurriculumFramework = 'auto' | 'k12' | 'matatag' | 'ilaw'

export const CURRICULUM_FRAMEWORKS: Record<
  CurriculumFramework,
  { label: string; description: string }
> = {
  auto: {
    label: 'Auto (from references)',
    description:
      'Use ILAW or MATATAG if the reference documents follow one; otherwise the DepEd K-12 format.',
  },
  k12: {
    label: 'DepEd K-12',
    description: 'K-12 Basic Education Curriculum (DO 42, s. 2016 formats).',
  },
  matatag: { label: 'MATATAG', description: 'MATATAG curriculum lesson structure.' },
  ilaw: { label: 'ILAW', description: 'ILAW curriculum lesson structure.' },
}

export const CURRICULUM_IDS = Object.keys(CURRICULUM_FRAMEWORKS) as CurriculumFramework[]

export type TeachingLanguage = 'English' | 'Filipino'
export const TEACHING_LANGUAGES: readonly TeachingLanguage[] = ['English', 'Filipino']

export interface TeachingDefaults {
  country: string
  curriculum: CurriculumFramework
  gradeLevel: string
  subject: string
  durationMinutes: number
  language: TeachingLanguage
}

export const DEFAULT_TEACHING_DEFAULTS: TeachingDefaults = {
  country: 'Philippines',
  curriculum: 'auto',
  gradeLevel: 'Grade 8',
  subject: 'Computer Education / ICT',
  durationMinutes: 60,
  language: 'English',
}

// ── Teacher profile (how TeachMate greets the teacher) ─────────────────────

/** How the teacher wants to be addressed: Ma’am, Sir, or by name only. */
export type TeacherTitle = 'maam' | 'sir' | 'none'

export const TEACHER_TITLES: Record<TeacherTitle, { label: string; title: string }> = {
  maam: { label: 'Ma’am', title: 'Ma’am' },
  sir: { label: 'Sir', title: 'Sir' },
  none: { label: 'Name only', title: '' },
}

export const TEACHER_TITLE_IDS = Object.keys(TEACHER_TITLES) as TeacherTitle[]

export interface TeacherProfile {
  /** How the teacher likes to be addressed, e.g. "Liza" or "Dela Cruz". */
  name: string
  title: TeacherTitle
}

export const DEFAULT_TEACHER_PROFILE: TeacherProfile = { name: '', title: 'none' }

export const PROFILE_NAME_MAX = 60

/** A title the teacher may have typed in front of their name. */
const TYPED_TITLE = /^(?:ma['’]?am|mam|sir|mr\.?|mrs\.?|ms\.?|miss|teacher|t\.)\s+/i

/** "Ma’am Liza", "Sir Juan", "Ma’am", "Liza", or "Teacher" when nothing is set. */
export function addressTeacher(profile: TeacherProfile): string {
  const title = TEACHER_TITLES[profile.title]?.title ?? ''
  let name = profile.name.replace(/\s+/g, ' ').trim()
  // Don't double a title the teacher typed themselves ("Ma'am Liza" → "Ma’am Liza").
  if (title && TYPED_TITLE.test(name)) name = name.replace(TYPED_TITLE, '').trim()
  return [title, name].filter(Boolean).join(' ') || 'Teacher'
}

/** True when the teacher hasn't set a name or title yet. */
export function isProfileEmpty(profile: TeacherProfile): boolean {
  return !profile.name.trim() && profile.title === 'none'
}

export const GRADE_LEVELS: readonly string[] = [
  'Kindergarten',
  ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`),
]

export const SUBJECT_SUGGESTIONS: readonly string[] = [
  'Computer Education / ICT',
  'Technology and Livelihood Education (TLE)',
  'Science',
  'Mathematics',
  'English',
  'Filipino',
  'Araling Panlipunan',
  'Values Education / GMRC',
  'MAPEH',
  'Music and Arts',
  'Physical Education and Health',
  'Reading and Literacy',
]

// ── Lesson plan formats ────────────────────────────────────────────────────

export type LessonPlanFormat = 'dll' | 'dlp' | 'semi-detailed' | 'multi-day' | 'weekly'

export const LESSON_PLAN_FORMATS: Record<
  LessonPlanFormat,
  { label: string; short: string; description: string; minSessions: number; maxSessions: number }
> = {
  dll: {
    label: 'Daily Lesson Log (DLL)',
    short: 'DLL',
    description: 'Week-at-a-glance log with one column per session.',
    minSessions: 1,
    maxSessions: 5,
  },
  dlp: {
    label: 'Detailed Lesson Plan (DLP)',
    short: 'DLP',
    description: 'Fully scripted plan with teacher and learner activities.',
    minSessions: 1,
    maxSessions: 5,
  },
  'semi-detailed': {
    label: 'Semi-Detailed Lesson Plan',
    short: 'Semi-Detailed',
    description: 'Structured plan with procedures but without scripted dialogue.',
    minSessions: 1,
    maxSessions: 5,
  },
  'multi-day': {
    label: 'Multi-Day Lesson Plan',
    short: 'Multi-Day',
    description: 'One lesson spread across several sessions, day by day.',
    minSessions: 2,
    maxSessions: 10,
  },
  weekly: {
    label: 'Weekly Lesson Plan',
    short: 'Weekly',
    description: 'Overview of the week’s sessions, objectives and assessments.',
    minSessions: 1,
    maxSessions: 5,
  },
}

export const LESSON_PLAN_FORMAT_IDS = Object.keys(LESSON_PLAN_FORMATS) as LessonPlanFormat[]

// ── Bloom's Revised Taxonomy & domains ─────────────────────────────────────

export type BloomLevel =
  'remembering' | 'understanding' | 'applying' | 'analyzing' | 'evaluating' | 'creating'

export const BLOOM_LEVELS: ReadonlyArray<{
  id: BloomLevel
  label: string
  description: string
  verbs: readonly string[]
}> = [
  {
    id: 'remembering',
    label: 'Remembering',
    description: 'Recall facts and basic concepts.',
    verbs: ['define', 'list', 'identify', 'name', 'label', 'recall', 'state', 'recognize'],
  },
  {
    id: 'understanding',
    label: 'Understanding',
    description: 'Explain ideas or concepts.',
    verbs: [
      'explain',
      'describe',
      'summarize',
      'classify',
      'compare',
      'interpret',
      'paraphrase',
      'illustrate',
    ],
  },
  {
    id: 'applying',
    label: 'Applying',
    description: 'Use information in new situations.',
    verbs: ['apply', 'demonstrate', 'use', 'solve', 'execute', 'implement', 'operate', 'compute'],
  },
  {
    id: 'analyzing',
    label: 'Analyzing',
    description: 'Draw connections among ideas.',
    verbs: [
      'analyze',
      'differentiate',
      'organize',
      'distinguish',
      'examine',
      'categorize',
      'troubleshoot',
      'outline',
    ],
  },
  {
    id: 'evaluating',
    label: 'Evaluating',
    description: 'Justify a stand or decision.',
    verbs: [
      'evaluate',
      'justify',
      'critique',
      'assess',
      'judge',
      'defend',
      'recommend',
      'validate',
    ],
  },
  {
    id: 'creating',
    label: 'Creating',
    description: 'Produce new or original work.',
    verbs: ['create', 'design', 'develop', 'compose', 'construct', 'plan', 'produce', 'formulate'],
  },
]

export const BLOOM_LEVEL_IDS = BLOOM_LEVELS.map((b) => b.id)

export type LearningDomain = 'cognitive' | 'psychomotor' | 'affective'

export const LEARNING_DOMAINS: ReadonlyArray<{
  id: LearningDomain
  label: string
  description: string
  verbs: readonly string[]
}> = [
  {
    id: 'cognitive',
    label: 'Cognitive',
    description: 'Knowledge and thinking skills (Bloom’s levels).',
    verbs: [],
  },
  {
    id: 'psychomotor',
    label: 'Psychomotor',
    description: 'Physical and technical skills.',
    verbs: ['perform', 'assemble', 'manipulate', 'operate', 'format', 'type', 'set up', 'execute'],
  },
  {
    id: 'affective',
    label: 'Affective',
    description: 'Attitudes, values and behaviors.',
    verbs: [
      'display',
      'practice',
      'value',
      'cooperate',
      'advocate',
      'demonstrate respect for',
      'adhere to',
      'show willingness to',
    ],
  },
]

export const LEARNING_DOMAIN_IDS = LEARNING_DOMAINS.map((d) => d.id)

/** Verbs that describe internal states and can't be observed or measured directly. */
export const NON_MEASURABLE_VERBS: readonly string[] = [
  'understand',
  'know',
  'learn',
  'appreciate',
  'realize',
  'grasp',
  'comprehend',
  'believe',
  'be aware of',
  'be familiar with',
  'become acquainted with',
]

// ── Assessment ─────────────────────────────────────────────────────────────

export type QuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'identification'
  | 'matching'
  | 'short-answer'
  | 'essay'
  | 'problem-solving'

export const QUESTION_TYPES: Record<
  QuestionType,
  { label: string; description: string; highestLevel: BloomLevel }
> = {
  'multiple-choice': {
    label: 'Multiple choice',
    description: 'Four options (A–D), one correct answer.',
    highestLevel: 'evaluating',
  },
  'true-false': {
    label: 'True or False',
    description: 'Statements that are clearly true or false.',
    highestLevel: 'understanding',
  },
  identification: {
    label: 'Identification',
    description: 'Answer is a single word or term.',
    highestLevel: 'applying',
  },
  matching: {
    label: 'Matching type',
    description: 'Column A items matched to Column B options.',
    highestLevel: 'understanding',
  },
  'short-answer': {
    label: 'Short answer',
    description: 'One to three sentences.',
    highestLevel: 'analyzing',
  },
  essay: {
    label: 'Essay',
    description: 'Extended response scored with a rubric.',
    highestLevel: 'creating',
  },
  'problem-solving': {
    label: 'Problem solving',
    description: 'Realistic problem with a worked solution.',
    highestLevel: 'creating',
  },
}

export const QUESTION_TYPE_IDS = Object.keys(QUESTION_TYPES) as QuestionType[]

export type Difficulty = 'easy' | 'average' | 'difficult' | 'mixed'

export const DIFFICULTIES: Record<Difficulty, { label: string; description: string }> = {
  easy: { label: 'Easy', description: 'Straightforward items for review or diagnostics.' },
  average: { label: 'Average', description: 'Typical of a quiz or unit test.' },
  difficult: { label: 'Difficult', description: 'Challenging items for advanced learners.' },
  mixed: { label: 'Mixed', description: 'Follow the Bloom’s distribution from easy to difficult.' },
}

export type BloomGroup = 'remember-understand' | 'apply-analyze' | 'evaluate-create'

export const BLOOM_GROUPS: ReadonlyArray<{
  id: BloomGroup
  label: string
  short: string
  levels: readonly [BloomLevel, BloomLevel]
}> = [
  {
    id: 'remember-understand',
    label: 'Remembering + Understanding',
    short: 'Easy',
    levels: ['remembering', 'understanding'],
  },
  {
    id: 'apply-analyze',
    label: 'Applying + Analyzing',
    short: 'Average',
    levels: ['applying', 'analyzing'],
  },
  {
    id: 'evaluate-create',
    label: 'Evaluating + Creating',
    short: 'Difficult',
    levels: ['evaluating', 'creating'],
  },
]

export const BLOOM_GROUP_IDS = BLOOM_GROUPS.map((g) => g.id)

/** How a Bloom's distribution is expressed: three grouped columns or all six levels. */
export type BloomMode = 'grouped' | 'levels'

/** Percentages per column for both modes; only the active mode is used. */
export interface BloomDistribution {
  mode: BloomMode
  groups: Record<BloomGroup, number>
  levels: Record<BloomLevel, number>
}

export const DISTRIBUTION_PRESETS: Record<
  BloomMode,
  ReadonlyArray<{ label: string; values: number[] }>
> = {
  grouped: [
    { label: '60 / 30 / 10', values: [60, 30, 10] },
    { label: '50 / 30 / 20', values: [50, 30, 20] },
    { label: '40 / 40 / 20', values: [40, 40, 20] },
  ],
  levels: [
    { label: '30 / 30 / 20 / 10 / 5 / 5', values: [30, 30, 20, 10, 5, 5] },
    { label: '20 / 20 / 20 / 20 / 10 / 10', values: [20, 20, 20, 20, 10, 10] },
    { label: 'Even', values: [17, 17, 17, 17, 16, 16] },
  ],
}

export const DEFAULT_DISTRIBUTION: BloomDistribution = {
  mode: 'grouped',
  groups: { 'remember-understand': 60, 'apply-analyze': 30, 'evaluate-create': 10 },
  levels: {
    remembering: 30,
    understanding: 30,
    applying: 20,
    analyzing: 10,
    evaluating: 5,
    creating: 5,
  },
}
