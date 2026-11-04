/**
 * Lesson Plan Reviewer: review settings, criteria, the reply parser, local
 * checks on a review, revised-plan handling and a line diff for comparing the
 * original with a revised plan. Pure — shared by UI, main and tests.
 */
import type { ContentWarning } from './document-rules'
import type { LessonPlanFormat } from './teaching'

export type ReviewDepth = 'quick' | 'comprehensive'
export type ReviewFocus = 'overall' | 'objectives' | 'activities' | 'assessment' | 'time'
export type ReviewStatus = 'meets' | 'needs-improvement' | 'missing'
export type CriterionLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'

export const REVIEW_DEPTHS: Record<ReviewDepth, { label: string; description: string }> = {
  quick: {
    label: 'Quick review',
    description: 'Status and the main point for each criterion; short lists.',
  },
  comprehensive: {
    label: 'Comprehensive review',
    description: 'Quoted evidence, full explanations and every objective in the alignment table.',
  },
}

export const REVIEW_FOCUSES: Record<ReviewFocus, { label: string; criteria: CriterionLetter[] }> = {
  overall: { label: 'Overall', criteria: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
  objectives: { label: 'Objectives', criteria: ['A', 'B'] },
  activities: { label: 'Activities', criteria: ['C', 'D'] },
  assessment: { label: 'Assessment', criteria: ['E'] },
  time: { label: 'Time allocation', criteria: ['F'] },
}

export const REVIEW_DEPTH_IDS = Object.keys(REVIEW_DEPTHS) as ReviewDepth[]
export const REVIEW_FOCUS_IDS = Object.keys(REVIEW_FOCUSES) as ReviewFocus[]

export const REVIEW_STATUSES: Record<ReviewStatus, string> = {
  meets: 'Meets Expectations',
  'needs-improvement': 'Needs Improvement',
  missing: 'Missing',
}

export interface ReviewCriterion {
  letter: CriterionLetter
  label: string
  questions: string[]
}

export const REVIEW_CRITERIA: ReviewCriterion[] = [
  {
    letter: 'A',
    label: 'Curriculum and Competency Alignment',
    questions: [
      'Are the learning competencies clearly identified?',
      'Are the lesson objectives aligned with the competencies?',
      'Is the content appropriate for the grade level?',
      'Are official curriculum references supported by the supplied documents?',
    ],
  },
  {
    letter: 'B',
    label: 'Learning Objectives',
    questions: [
      'Are objectives clear and measurable?',
      'Are appropriate action verbs used?',
      'Are objectives achievable within the allotted time?',
      'Are cognitive, psychomotor and affective domains addressed where appropriate?',
    ],
  },
  {
    letter: 'C',
    label: 'Learning Activities',
    questions: [
      'Are activities aligned with the objectives?',
      'Are activities learner-centered?',
      'Do activities encourage participation and engagement?',
      'Are instructions clear?',
      'Are activities practical for the classroom?',
    ],
  },
  {
    letter: 'D',
    label: 'Instructional Strategies',
    questions: [
      'Are teaching methods appropriate for the topic?',
      'Are strategies suitable for the learners?',
      'Are opportunities for collaboration, critical thinking and problem-solving included when appropriate?',
    ],
  },
  {
    letter: 'E',
    label: 'Assessment',
    questions: [
      'Does assessment measure the intended learning objectives?',
      'Are assessment methods appropriate?',
      'Are instructions clear?',
      'Is there sufficient evidence of student learning?',
    ],
  },
  {
    letter: 'F',
    label: 'Time Allocation',
    questions: [
      'Is the time distribution realistic?',
      'Are activities achievable within the allotted period?',
      'Is sufficient time allocated for assessment and reflection?',
    ],
  },
  {
    letter: 'G',
    label: 'Learning Resources',
    questions: [
      'Are required materials identified?',
      'Are resources appropriate and accessible?',
      'Are alternative resources considered when necessary?',
    ],
  },
  {
    letter: 'H',
    label: 'Overall Lesson Structure',
    questions: [
      'Are all required sections present?',
      'Is the lesson logically organized?',
      'Are transitions between activities clear?',
      'Is the lesson coherent from introduction to assessment?',
    ],
  },
]

/** Sections commonly found in each plan type — guidance for the reviewer, not an official checklist. */
export const PLAN_TYPE_SECTIONS: Record<LessonPlanFormat, string> = {
  dll: 'I. Objectives (content standards, performance standards, learning competencies/objectives), II. Content, III. Learning Resources, IV. Procedures (from reviewing the previous lesson through evaluating learning and additional activities), V. Remarks, VI. Reflection — usually one column per day.',
  dlp: 'Objectives, Subject Matter / Content (topic, references, materials), Procedure with teacher’s and learners’ activities (preliminary activities, motivation, presentation, discussion, generalization, application), Evaluation, Assignment / Agreement, and Remarks / Reflection.',
  'semi-detailed':
    'Objectives, Subject Matter (topic, references, materials), Procedure (main steps without scripted dialogue), Evaluation and Assignment.',
  'multi-day':
    'Overall objectives, then a plan for each day (that day’s objectives, activities, time and assessment) and how the days build on each other.',
  weekly:
    'Weekly objectives or competencies, a day-by-day plan of activities, assessment across the week, and resources.',
}

export const REVIEW_LIMITS = {
  sourceMaxChars: 200_000,
  minSourceChars: 200,
  formatMaxChars: 4_000,
  sectionsMaxChars: 500,
  revisionsKept: 5,
  notesMaxChars: 20_000,
} as const

/** The lesson plan being reviewed. Its full text is kept with the review. */
export interface ReviewSource {
  origin: 'resource' | 'document' | 'pasted'
  /** Resource or lesson-plan id; null for pasted text. */
  refId: string | null
  title: string
  text: string
  charCount: number
}

// ── Revised lesson plans ───────────────────────────────────────────────────

export type RevisionTarget =
  'sections' | 'objectives' | 'activities' | 'assessment' | 'time' | 'complete'

export const REVISION_TARGETS: Record<
  RevisionTarget,
  { label: string; short: string; task: string }
> = {
  objectives: {
    label: 'Rewrite the objectives',
    short: 'objectives',
    task: 'Rewrite the learning objectives so each one is clear and measurable (one observable action verb), achievable in the allotted time and aligned with the learning competency, covering the cognitive, psychomotor and affective domains where appropriate.',
  },
  activities: {
    label: 'Improve the learning activities',
    short: 'activities',
    task: 'Improve the learning activities so each one is learner-centered, clearly instructed, practical for the classroom and aligned with a stated objective; add collaboration, critical thinking or problem-solving where it fits.',
  },
  assessment: {
    label: 'Improve the assessment',
    short: 'assessment',
    task: 'Improve the assessment so it measures every stated objective with appropriate methods, clear instructions and enough evidence of learning.',
  },
  time: {
    label: 'Improve the time allocation',
    short: 'time allocation',
    task: 'Improve the time allocation: give each part of the lesson realistic minutes that add up to the allotted time stated in the plan, with enough time for assessment and reflection.',
  },
  sections: {
    label: 'Improve selected sections',
    short: 'selected sections',
    task: 'Improve only the sections named below, using the review findings.',
  },
  complete: {
    label: 'Revised complete lesson plan',
    short: 'complete plan',
    task: 'Write a revised complete lesson plan that addresses every critical and recommended improvement in the review.',
  },
}

export const REVISION_TARGET_IDS = Object.keys(REVISION_TARGETS) as RevisionTarget[]

/** A request for a revised lesson plan (applied to `revisions`, never to the original or the report). */
export interface ReviewScope {
  type: 'revision'
  target: RevisionTarget
  /** For `sections`: which sections to improve. */
  sections?: string
  /** Revise the original plan, or build on the latest revised version. */
  base: 'original' | 'revision'
}

export interface RevisedLessonPlan {
  id: string
  target: RevisionTarget
  sections: string
  base: 'original' | 'revision'
  /** The revised lesson plan (Markdown). */
  content: string
  /** "Summary of Changes" from the reply, kept apart from the plan. */
  notes: string
  source: 'provider' | 'pasted' | 'edited'
  createdAt: string
  /** The lesson plan document it was saved as, if any. */
  savedAsId: string | null
}

export function revisionLabel(scope: ReviewScope): string {
  return `Revised lesson plan (${REVISION_TARGETS[scope.target].short})`
}

function unwrapFence(text: string): string {
  const m = text.trim().match(/^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1\s*$/)
  return m ? m[2] : text
}

const NOTES_HEADING = /^#{1,3}\s*(?:summary of changes|changes made|revision notes)\b.*$/im

/** Split a revision reply into the plan and its trailing "Summary of Changes". */
export function splitRevisionReply(reply: string): { content: string; notes: string } {
  const text = unwrapFence(reply.replace(/\r\n?/g, '\n')).trim()
  const m = NOTES_HEADING.exec(text)
  if (!m) return { content: text, notes: '' }
  return {
    content: unwrapFence(text.slice(0, m.index)).trim(),
    notes: text
      .slice(m.index + m[0].length)
      .trim()
      .slice(0, REVIEW_LIMITS.notesMaxChars),
  }
}

/** Add a revised plan (newest first, oldest dropped beyond the limit). */
export function addRevision(
  revisions: RevisedLessonPlan[],
  reply: string,
  source: 'provider' | 'pasted',
  scope: ReviewScope,
  id: string,
  now = new Date().toISOString(),
): RevisedLessonPlan[] {
  const { content, notes } = splitRevisionReply(reply)
  if (!content) throw new Error('The reply contains no lesson plan.')
  const revision: RevisedLessonPlan = {
    id,
    target: scope.target,
    sections: scope.target === 'sections' ? (scope.sections ?? '').trim() : '',
    base: scope.base,
    content,
    notes,
    source,
    createdAt: now,
    savedAsId: null,
  }
  return [revision, ...revisions].slice(0, REVIEW_LIMITS.revisionsKept)
}

// ── Plan type detection ────────────────────────────────────────────────────

/** Guess the plan type from its text (null when unclear). */
export function detectPlanType(text: string): LessonPlanFormat | null {
  const head = text.slice(0, 4_000)
  if (/semi[-\s]?detailed/i.test(head)) return 'semi-detailed'
  if (/daily\s+lesson\s+log|\bDLL\b/i.test(head)) return 'dll'
  if (/detailed\s+lesson\s+plan|\bDLP\b/i.test(head)) return 'dlp'
  if (/weekly\s+(?:home\s+)?(?:learning|lesson)\s+plan|\bWHLP\b|\bWLP\b/i.test(head))
    return 'weekly'
  if (/\bday\s*1\b/i.test(text) && /\bday\s*2\b/i.test(text)) return 'multi-day'
  return null
}

// ── Reading a review ───────────────────────────────────────────────────────

export interface ParsedCriterion {
  letter: CriterionLetter
  label: string
  /** False when the criterion is absent from the review. */
  found: boolean
  status: ReviewStatus | null
  /** The status text as written (for warnings). */
  rawStatus: string
  evidence: string
}

export interface ParsedReview {
  overall: string | null
  criteria: ParsedCriterion[]
  improvements: { critical: number; recommended: number; optional: number }
  /** The four alignment-gap lines: text after the label, or null when absent. */
  gaps: Array<{ label: string; text: string | null; none: boolean }>
  sections: string[]
}

export const ALIGNMENT_GAPS = [
  'Objectives without supporting activities',
  'Activities that do not support any objective',
  'Objectives without corresponding assessment',
  'Assessment items that do not measure the stated objectives',
] as const

export const REVIEW_SECTIONS = [
  'Overall Evaluation',
  'Detailed Evaluation',
  'Objective and Assessment Alignment',
  'Improvement Suggestions',
] as const

/** Lines outside fenced code blocks, with their heading level (0 = not a heading). */
function lines(content: string): Array<{ text: string; level: number; heading: string }> {
  const out: Array<{ text: string; level: number; heading: string }> = []
  let fence: string | null = null
  for (const text of content.replace(/\r\n?/g, '\n').split('\n')) {
    const f = text.match(/^\s*(`{3,}|~{3,})/)
    if (f) {
      if (fence === null) fence = f[1]
      else if (f[1].startsWith(fence[0]) && f[1].length >= fence.length) fence = null
      out.push({ text, level: 0, heading: '' })
      continue
    }
    const h = fence === null ? text.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/) : null
    out.push({ text, level: h ? h[1].length : 0, heading: h ? h[2].replace(/\*\*/g, '') : '' })
  }
  return out
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()

export function parseStatus(text: string): ReviewStatus | null {
  const t = text.toLowerCase()
  if (/meets?\s+expectations?/.test(t)) return 'meets'
  if (/needs?\s+improvement/.test(t)) return 'needs-improvement'
  if (/\bmissing\b/.test(t)) return 'missing'
  return null
}

/** Value of a `**Label:**` line (also "- **Label**: value"). */
function labelValue(text: string, label: RegExp): string | null {
  const m = text.match(/^\s*(?:[-*+]\s+)?\*\*([^*]+?)(?::\*\*|\*\*\s*:)\s*(.*)$/)
  if (!m || !label.test(m[1].trim())) return null
  return m[2].trim()
}

function criterionFor(heading: string): ReviewCriterion | undefined {
  const lead = heading.match(/^([A-H])[.)]\s/)
  if (lead) return REVIEW_CRITERIA.find((c) => c.letter === lead[1])
  const h = norm(heading)
  return REVIEW_CRITERIA.find((c) => h.includes(norm(c.label)))
}

export function parseReview(content: string): ParsedReview {
  const all = lines(content)
  const sections: string[] = []
  const criteria = new Map<CriterionLetter, ParsedCriterion>()
  const improvements = { critical: 0, recommended: 0, optional: 0 }
  const gaps = ALIGNMENT_GAPS.map((label) => ({
    label,
    text: null as string | null,
    none: false,
  }))
  let overall: string | null = null
  let section = ''
  let sub = ''
  let current: ParsedCriterion | null = null

  for (const line of all) {
    if (line.level === 1) continue
    if (line.level === 2) {
      section = norm(line.heading)
      sections.push(line.heading.trim())
      sub = ''
      current = null
      continue
    }
    if (line.level >= 3) {
      sub = norm(line.heading)
      const c = criterionFor(line.heading.trim())
      current = null
      if (c && (section.includes('detailed') || section.includes('evaluation'))) {
        current = {
          letter: c.letter,
          label: c.label,
          found: true,
          status: null,
          rawStatus: '',
          evidence: '',
        }
        criteria.set(c.letter, current)
      }
      continue
    }

    const overallValue = labelValue(line.text, /^overall\s+(assessment|evaluation|rating)$/i)
    if (overallValue !== null && overall === null) overall = overallValue

    if (current) {
      const status = labelValue(line.text, /^status$/i)
      if (status !== null) {
        current.rawStatus = status
        current.status = parseStatus(status)
      }
      const evidence = labelValue(line.text, /^evidence$/i)
      if (evidence !== null) current.evidence = evidence
    }

    if (section.includes('alignment')) {
      for (const g of gaps) {
        const v = labelValue(line.text, new RegExp(`^${g.label.replace(/ /g, '\\s+')}$`, 'i'))
        if (v !== null) {
          g.text = v
          g.none = /^(none|n\/a|none found|none identified|wala)\b/i.test(v.replace(/[*_]/g, ''))
        }
      }
    }

    if (section.includes('improvement') && /^\s*(?:[-*+]|\d+[.)])\s+\S/.test(line.text)) {
      // Count top-level list items only.
      if (/^\s{2,}/.test(line.text)) continue
      if (sub.includes('critical')) improvements.critical++
      else if (sub.includes('optional') || sub.includes('enhancement')) improvements.optional++
      else if (sub.includes('recommended')) improvements.recommended++
    }
  }

  return {
    overall,
    criteria: REVIEW_CRITERIA.map(
      (c) =>
        criteria.get(c.letter) ?? {
          letter: c.letter,
          label: c.label,
          found: false,
          status: null,
          rawStatus: '',
          evidence: '',
        },
    ),
    improvements,
    gaps,
    sections,
  }
}

// ── Checks (TeachMate, not the AI) ─────────────────────────────────────────

export interface ReviewCheckOptions {
  /** The full lesson plan text. */
  sourceText: string
  /** The teacher's instructions (a scoring system may be requested there). */
  instructions: string
  /** Lesson plan text + reference documents: what citations may come from. */
  trustedText: string
}

/** Lower-case words only, for "does this quote appear in the plan?". */
const comparable = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim()

const SCORE = /\b\d+(?:\.\d+)?\s*(?:\/|out of)\s*\d+(?:\.\d+)?\b|\b(?:score|rating)\s*[:=]\s*\d/gi
const COMPLIANCE =
  /\b(?:fully\s+|is\s+|are\s+)?(?:compliant\s+with|in\s+compliance\s+with|complies\s+with|conforms?\s+to|adheres\s+to)\b[^.\n]{0,80}/gi
const DEPED_ORDER =
  /\bDep\s?Ed\s+(?:Order|Memorandum)\s+(?:No\.?\s*)?\d+\s*,?\s*(?:s\.?|series\s+of)\s*\d{4}/gi

export function checkReview(content: string, o: ReviewCheckOptions): ContentWarning[] {
  if (!content.trim()) return []
  const warnings: ContentWarning[] = []
  const review = parseReview(content)
  const sectionsFound = review.sections.map(norm)

  for (const s of REVIEW_SECTIONS) {
    const key = norm(s)
    const alt = key.replace('objective and assessment ', '')
    if (!sectionsFound.some((f) => f.includes(key) || (alt !== key && f.includes(alt)))) {
      warnings.push({
        kind: 'missing-section',
        match: s,
        message: `The review has no “${s}” section.`,
      })
    }
  }

  for (const c of review.criteria) {
    if (!c.found) {
      warnings.push({
        kind: 'missing-section',
        match: c.letter,
        message: `Criterion ${c.letter} (${c.label}) is missing from the detailed evaluation.`,
      })
    } else if (!c.status) {
      warnings.push({
        kind: 'format',
        match: c.rawStatus,
        message: c.rawStatus
          ? `Criterion ${c.letter} has the status “${c.rawStatus}”; use Meets Expectations, Needs Improvement or Missing.`
          : `Criterion ${c.letter} (${c.label}) has no status.`,
      })
    }
  }

  // Scores only when the teacher asked for a scoring system.
  if (!/\b(scor\w*|points?|rating|numerical|grade the plan)\b/i.test(o.instructions)) {
    const source = o.sourceText
    for (const m of content.matchAll(SCORE)) {
      if (source.includes(m[0])) continue
      warnings.push({
        kind: 'format',
        match: m[0],
        message: `The review gives a numerical score (“${m[0].trim()}”). Scores weren’t requested; remove it, or ask for a scoring system in the review instructions.`,
      })
      break
    }
  }

  for (const m of content.matchAll(COMPLIANCE)) {
    const before = content.slice(Math.max(0, m.index - 25), m.index)
    if (/\bnot\s*$|n[’']t\s*$|\bnon-?\s*$|\bfully\s+not\s*$/i.test(before)) continue
    if (/\bnot\b|\bnever\b|\bcannot\b|\bunable\b/i.test(before)) continue
    warnings.push({
      kind: 'unsupported',
      match: m[0],
      message: `The review claims compliance (“…${m[0].trim().slice(0, 70)}”). Keep it only if that standard is in your reference documents.`,
    })
  }

  const trusted = o.trustedText.toLowerCase().replace(/\s+/g, ' ')
  const seenOrders = new Set<string>()
  for (const m of content.matchAll(DEPED_ORDER)) {
    const key = m[0].toLowerCase().replace(/\s+/g, ' ')
    if (seenOrders.has(key) || trusted.includes(key)) continue
    seenOrders.add(key)
    warnings.push({
      kind: 'unsupported',
      match: m[0],
      message: `“${m[0]}” isn’t in the lesson plan or your reference documents. Verify it before relying on it.`,
    })
  }

  // Quoted evidence must come from the lesson plan.
  const plan = comparable(o.sourceText)
  for (const c of review.criteria) {
    for (const q of c.evidence.matchAll(/[“"]([^”"]{12,})[”"]/g)) {
      const quote = comparable(q[1])
      if (quote.split(' ').length < 4 || plan.includes(quote)) continue
      warnings.push({
        kind: 'unsupported',
        match: q[1],
        message: `Evidence quoted for criterion ${c.letter} isn’t in the lesson plan word for word: “${q[1].slice(0, 80)}${q[1].length > 80 ? '…' : ''}”. Check it against the original.`,
      })
    }
  }
  return warnings
}

// ── Comparing the original with a revised plan ─────────────────────────────

export interface DiffLine {
  type: 'same' | 'added' | 'removed'
  text: string
}

/** Comparison key: ignores Markdown markers, spacing and case; null for blank/separator lines. */
function diffKey(line: string): string | null {
  if (/^[\s|:\-–—_*=#]*$/.test(line)) return null
  const key = line
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ x]\]\s+)?)/, '')
    .replace(/[*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return key || null
}

/**
 * Line diff of the original and revised plan (formatting differences are
 * ignored). Returns null when the texts are too large to compare.
 */
export function diffLines(
  original: string,
  revised: string,
  maxCells = 4_000_000,
): DiffLine[] | null {
  const prep = (t: string) =>
    t
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((text) => ({ text: text.trimEnd(), key: diffKey(text) }))
      .filter((l): l is { text: string; key: string } => l.key !== null)
  const a = prep(original)
  const b = prep(revised)

  let start = 0
  while (start < a.length && start < b.length && a[start].key === b[start].key) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1].key === b[endB - 1].key) {
    endA--
    endB--
  }
  const n = endA - start
  const m = endB - start
  if (n * m > maxCells) return null

  // LCS table over the differing middle part.
  const w = m + 1
  const t = new Uint32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i * w + j] =
        a[start + i].key === b[start + j].key
          ? t[(i + 1) * w + j + 1] + 1
          : Math.max(t[(i + 1) * w + j], t[i * w + j + 1])
    }
  }

  const out: DiffLine[] = b.slice(0, start).map((l) => ({ type: 'same', text: l.text }))
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[start + i].key === b[start + j].key) {
      out.push({ type: 'same', text: b[start + j].text })
      i++
      j++
    } else if (i < n && (j === m || t[(i + 1) * w + j] >= t[i * w + j + 1])) {
      out.push({ type: 'removed', text: a[start + i].text })
      i++
    } else {
      out.push({ type: 'added', text: b[start + j].text })
      j++
    }
  }
  for (const l of b.slice(endB)) out.push({ type: 'same', text: l.text })
  return out
}
