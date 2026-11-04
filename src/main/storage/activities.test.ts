import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appendActivities,
  appendToLessonPlan,
  applyScopedReply,
  checkActivities,
  instructionsText,
  lessonPlanSection,
  objectivesFromDocument,
  parseActivities,
  parseMinutes,
  replaceActivity,
} from '@shared/activities'
import { calculationErrors, validateActivitiesInputs } from '@shared/calculation-rules'
import type { TeachingDocument } from '@shared/documents'
import { DEFAULT_TEACHING_DEFAULTS } from '@shared/teaching'
import { renderPromptMarkdown } from '../ai/handoff/prompt'
import { InvalidInputsError, buildDocumentPrompt } from '../ai/prompts/document'
import { DocumentStore, newDocument } from './document-store'
import { validateDocument } from './document-validation'

type Activities = Extract<TeachingDocument, { kind: 'learning-activities' }>

const activity = (n: number, title: string, minutes: number, extra = '') =>
  [
    `## Activity ${n}: ${title}`,
    '',
    '**Activity type:** Pair Activity',
    '**Learning purpose:** Learners practise identifying devices.',
    '**Aligned objectives:** Objective 1',
    `**Estimated duration:** ${minutes} minutes`,
    '',
    '### Materials and Resources',
    '- Picture cards',
    '',
    '### Teacher Instructions',
    '- Pair the learners.',
    '',
    '### Student Instructions',
    `Sort the cards for ${title}.`,
    '',
    '### Procedure',
    '1. Sort the cards (5 min)',
    '2. Share with the class (5 min)',
    '',
    '### Expected Output',
    'A sorted set of cards.',
    '',
    '### Assessment / Evaluation',
    'Check the sorting with a key.',
    extra,
  ].join('\n')

const SAMPLE = [
  '# Learning Activities: Computer Hardware',
  '',
  'Computer Education / ICT · Grade 8 · Quarter 1 · 60 minutes',
  '',
  activity(1, 'Device Hunt', 10),
  '',
  activity(2, 'Sort It Out', 20),
  '',
  activity(3, 'Exit Ticket', 10),
  '',
  '## Time Plan',
  '',
  '| Activity | Minutes |',
  '| --- | --- |',
  '| Total | 40 |',
].join('\n')

function activitiesDoc(overrides: Partial<Activities['inputs']> = {}): Activities {
  const doc = newDocument('learning-activities', DEFAULT_TEACHING_DEFAULTS) as Activities
  doc.inputs = {
    ...doc.inputs,
    topic: 'Computer Hardware',
    competency: 'Identify the components of a computer system',
    ...overrides,
  }
  return doc
}

describe('activity parsing', () => {
  it('splits the document into activities with type, minutes and no missing parts', () => {
    const blocks = parseActivities(SAMPLE)
    expect(blocks.map((b) => b.title)).toEqual(['Device Hunt', 'Sort It Out', 'Exit Ticket'])
    expect(blocks.map((b) => b.minutes)).toEqual([10, 20, 10])
    expect(blocks[0].type).toBe('Pair Activity')
    expect(blocks.every((b) => b.missing.length === 0)).toBe(true)
    // The Time Plan section is not part of the last activity.
    expect(blocks[2].markdown).not.toContain('Time Plan')
  })

  it('reads durations in several forms', () => {
    expect(parseMinutes('15 minutes')).toBe(15)
    expect(parseMinutes('10–15 mins')).toBe(15)
    expect(parseMinutes('1 hour 20 minutes')).toBe(80)
    expect(parseMinutes('2 hours')).toBe(120)
    expect(parseMinutes('about a quarter hour')).toBeNull()
  })

  it('reports the parts an activity is missing', () => {
    const blocks = parseActivities('## Activity 1: Bare\n\n**Activity type:** Review\n\nDo it.')
    expect(blocks[0].missing).toContain('Teacher instructions')
    expect(blocks[0].missing).toContain('Expected output')
    expect(blocks[0].missing).not.toContain('Activity type')
  })

  it('copies the student instructions and procedure for an activity', () => {
    const text = instructionsText(parseActivities(SAMPLE)[1])
    expect(text).toContain('Sort It Out')
    expect(text).toContain('Sort the cards for Sort It Out.')
    expect(text).toContain('1. Sort the cards (5 min)')
    expect(text).not.toContain('Pair the learners')
  })
})

describe('activities written with bold labels instead of subheadings', () => {
  const bulleted = [
    '## Activity 1: Quick Draw',
    '',
    '- **Activity type:** Hands-on Activity',
    '- **Estimated duration:** 12 minutes',
    '- **Student instructions:** Draw the parts you see.',
    '  Label each part.',
    '- **Procedure:**',
    '  1. Draw (8 min)',
    '- **Expected output:** A labelled drawing.',
  ].join('\n')

  it('reads bulleted labels and stops copying at the next label', () => {
    const [b] = parseActivities(bulleted)
    expect(b.type).toBe('Hands-on Activity')
    expect(b.minutes).toBe(12)
    const text = instructionsText(b)
    expect(text).toContain('Draw the parts you see.\n  Label each part.')
    expect(text).toContain('1. Draw (8 min)')
    expect(text).not.toContain('A labelled drawing')
  })
})

describe('regenerating and adding activities', () => {
  it('replaces only the chosen activity and keeps the others unchanged', () => {
    const reply = activity(2, 'Hardware Bingo', 15)
    const next = replaceActivity(SAMPLE, 2, reply)
    const blocks = parseActivities(next)
    expect(blocks.map((b) => b.title)).toEqual(['Device Hunt', 'Hardware Bingo', 'Exit Ticket'])
    expect(blocks[0].markdown).toBe(parseActivities(SAMPLE)[0].markdown)
    expect(blocks[2].markdown).toBe(parseActivities(SAMPLE)[2].markdown)
    expect(next).toContain('## Time Plan')
    expect(next.startsWith('# Learning Activities: Computer Hardware')).toBe(true)
  })

  it('renumbers a replacement written with the wrong number and strips a code fence', () => {
    const reply = '```markdown\n' + activity(7, 'Hardware Bingo', 15) + '\n```'
    const next = applyScopedReply(SAMPLE, { type: 'activity', index: 1 }, reply)
    expect(next).toContain('## Activity 1: Hardware Bingo')
    expect(next).not.toContain('Activity 7')
    expect(next).not.toContain('```')
  })

  it('adds alternatives after the last activity, before the time plan, numbered on', () => {
    const reply = [activity(4, 'Card Relay', 10), '', activity(5, 'Role Play', 10)].join('\n')
    const next = appendActivities(SAMPLE, reply)
    expect(parseActivities(next).map((b) => `${b.position}:${b.title}`)).toEqual([
      '1:Device Hunt',
      '2:Sort It Out',
      '3:Exit Ticket',
      '4:Card Relay',
      '5:Role Play',
    ])
    expect(next.indexOf('## Activity 5: Role Play')).toBeLessThan(next.indexOf('## Time Plan'))
  })

  it('refuses a reply without an activity heading and a position that no longer exists', () => {
    expect(() => replaceActivity(SAMPLE, 2, 'Here is a better idea: …')).toThrow(/activity heading/)
    expect(() => replaceActivity(SAMPLE, 9, activity(9, 'X', 5))).toThrow(/no longer exists/)
  })

  it('builds a lesson-plan section from selected activities with demoted headings', () => {
    const blocks = parseActivities(SAMPLE)
    const section = lessonPlanSection([blocks[0], blocks[2]], 'Activities — Grade 8')
    expect(section.startsWith('## Learning Activities')).toBe(true)
    expect(section).toContain('### Activity 1: Device Hunt')
    expect(section).toContain('### Activity 2: Exit Ticket')
    expect(section).toContain('#### Teacher Instructions')
    expect(section).not.toContain('Sort It Out')
    const plan = appendToLessonPlan('# DLL\n\n## IV. Procedures\n\nExisting text.\n', section)
    expect(
      plan.startsWith('# DLL\n\n## IV. Procedures\n\nExisting text.\n\n## Learning Activities'),
    ).toBe(true)
  })
})

describe('activity checks', () => {
  it('passes a complete set that fits the time', () => {
    expect(checkActivities(SAMPLE, { activityCount: 3, durationMinutes: 60 })).toEqual([])
  })

  it('flags too few activities, missing parts and going over time', () => {
    const content = SAMPLE + '\n\n## Activity 4: Extra\n\n**Estimated duration:** 30 minutes\n'
    const messages = checkActivities(content, { activityCount: 5, durationMinutes: 45 }).map(
      (w) => w.message,
    )
    expect(messages.some((m) => m.includes('4 activities; you asked for 5'))).toBe(true)
    expect(messages.some((m) => m.startsWith('Activity 4 (“Extra”) is missing'))).toBe(true)
    expect(messages.some((m) => m.includes('add up to 70 minutes, but 45'))).toBe(true)
  })

  it('explains when no activity headings are found', () => {
    const [w] = checkActivities('Some text without headings.', {
      activityCount: 3,
      durationMinutes: 60,
    })
    expect(w.message).toMatch(/No activities were found/)
  })
})

describe('activity form validation', () => {
  it('starts from the teaching defaults and needs topic and competency', () => {
    const blank = newDocument('learning-activities', DEFAULT_TEACHING_DEFAULTS) as Activities
    expect(blank.inputs.subject).toBe('Computer Education / ICT')
    expect(blank.inputs.gradeLevel).toBe('Grade 8')
    expect(blank.inputs.durationMinutes).toBe(60)
    const errors = validateActivitiesInputs(blank.inputs)
    expect(Object.keys(errors).sort()).toEqual(['competency', 'topic'])
    expect(validateActivitiesInputs(activitiesDoc().inputs)).toEqual({})
  })

  it('checks categories, ranges and that the activities fit the time', () => {
    const e = validateActivitiesInputs(
      activitiesDoc({ categories: [], classSize: 0, activityCount: 8, durationMinutes: 30 }).inputs,
    )
    expect(e.categories).toMatch(/at least one/)
    expect(e.classSize).toMatch(/Class size/)
    expect(e.activityCount).toMatch(/don’t fit in 30 minutes/)
    expect(
      validateActivitiesInputs(activitiesDoc({ activityCount: 11 }).inputs).activityCount,
    ).toMatch(/1 to 10/)
  })

  it('never blocks saving with calculation errors', () => {
    expect(calculationErrors(activitiesDoc({ categories: [] }))).toEqual([])
  })

  it('reads objectives from a saved objectives table or list', () => {
    const table = [
      '| # | Objective | Bloom’s level | Domain | Evidence |',
      '| --- | --- | --- | --- | --- |',
      '| 1 | Identify the parts of a computer | Remembering | Cognitive | Quiz |',
      '| 2 | **Classify** devices by function | Understanding | Cognitive | Sort |',
    ].join('\n')
    expect(objectivesFromDocument(table)).toEqual([
      'Identify the parts of a computer',
      'Classify devices by function',
    ])
    expect(objectivesFromDocument('1. Identify the parts of a computer\n2. Short')).toEqual([
      'Identify the parts of a computer',
    ])
  })
})

describe('activity prompts', () => {
  const render = (
    doc: TeachingDocument,
    ...rest: Parameters<typeof buildDocumentPrompt> extends [unknown, ...infer R]
      ? Partial<R>
      : never
  ) =>
    renderPromptMarkdown(
      buildDocumentPrompt(doc, rest[0] ?? 'generate', rest[1], rest[2] ?? 'Philippines', rest[3]),
    )

  it('includes the configuration, categories, structure and classroom rules', () => {
    const p = render(
      activitiesDoc({
        objectives: '1. Identify input devices\n- Classify devices by function',
        categories: ['pair', 'inquiry-based', 'differentiated'],
        classSize: 45,
        environment: 'computer-lab',
        resources: '10 computers, no internet',
      }),
    )
    expect(p).toContain('| Number of activities | 3 |')
    expect(p).toContain('| Class size | 45 learners |')
    expect(p).toContain('| Learning environment | Computer laboratory |')
    expect(p).toContain('| Quarter | Quarter 1 |')
    expect(p).toContain('1. Identify input devices')
    expect(p).toContain('2. Classify devices by function')
    expect(p).toContain('**Pair Activity**')
    expect(p).toContain('**Inquiry-Based Learning**')
    expect(p).toContain('**Differentiated Instruction**')
    expect(p).not.toContain('**Group Activity**')
    for (const part of [
      '**Activity type:**',
      '**Learning purpose:**',
      '**Aligned objectives:**',
      '**Estimated duration:**',
      '### Materials and Resources',
      '### Teacher Instructions',
      '### Student Instructions',
      '### Procedure',
      '### Expected Output',
      '### Assessment / Evaluation',
      '### Differentiation',
    ]) {
      expect(p).toContain(part)
    }
    expect(p).toContain('add up to no more than 60 minutes')
    expect(p).toMatch(/Do not require purchases, paid software, internet or expensive equipment/)
    expect(p).toMatch(/Do NOT invent, guess or reconstruct official DepEd/)
    expect(p).toContain('Exactly 3 activities.')
  })

  it('asks the AI to derive objectives when none are given', () => {
    expect(render(activitiesDoc())).toContain('Derive 2–4 measurable objectives')
  })

  it('regenerates one activity with the current set as context', () => {
    const doc = { ...activitiesDoc(), content: SAMPLE }
    const p = render(doc, 'generate', 'No electricity, please.', 'Philippines', {
      type: 'activity',
      index: 2,
    })
    expect(p).toContain('## Task: write a new version of Activity 2')
    expect(p).toContain('(“Sort It Out”)')
    expect(p).toContain('(20 minutes)')
    expect(p).toContain('The teacher asks: No electricity, please.')
    expect(p).toContain('Return ONLY the new Activity 2, starting with "## Activity 2:"')
  })

  it('asks for alternatives numbered after the current activities', () => {
    const doc = { ...activitiesDoc(), content: SAMPLE }
    const p = render(doc, 'generate', undefined, 'Philippines', { type: 'alternatives', count: 2 })
    expect(p).toContain('## Task: write 2 alternative activities')
    expect(p).toContain('## Activity 4: <Activity title>')
    expect(p).toContain('**Can replace:** Activity <number>')
  })

  it('rejects scoped requests for other tools and for activities that do not exist', () => {
    const plan = newDocument('lesson-plan', DEFAULT_TEACHING_DEFAULTS)
    expect(() =>
      buildDocumentPrompt(plan, 'generate', undefined, 'Philippines', {
        type: 'activity',
        index: 1,
      }),
    ).toThrow(InvalidInputsError)
    expect(() =>
      render({ ...activitiesDoc(), content: SAMPLE }, 'generate', undefined, 'Philippines', {
        type: 'activity',
        index: 9,
      }),
    ).toThrow(/no longer exists/)
  })
})

describe('activity storage', () => {
  let dir: string | null = null
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = null
  })

  it('validates request scopes and round-trips through the store', async () => {
    dir = await mkdtemp(join(tmpdir(), 'tm-activities-'))
    const store = new DocumentStore(dir)
    const doc = {
      ...activitiesDoc(),
      content: SAMPLE,
      requests: [
        {
          id: 'req1',
          action: 'generate' as const,
          providerId: 'claude-code-handoff',
          createdAt: new Date().toISOString(),
          status: 'awaiting-reply' as const,
          scope: { type: 'activity' as const, index: 2 },
        },
      ],
    }
    const saved = await store.save(doc)
    const loaded = (await store.get(saved.id)) as Activities
    expect(loaded.inputs).toEqual(doc.inputs)
    expect(loaded.requests[0].scope).toEqual({ type: 'activity', index: 2 })
    expect((await store.list('learning-activities'))[0].subtitle).toContain(
      'Learning activities · 3 activities · 60 min',
    )
    expect(() =>
      validateDocument({ ...doc, requests: [{ ...doc.requests[0], scope: { type: 'all' } }] }),
    ).toThrow(/scope.type/)
    expect(() =>
      validateDocument({ ...doc, inputs: { ...doc.inputs, categories: ['dance'] } }),
    ).toThrow(/categories/)
  })
})
