import type { PreparedPrompt } from '@shared/ai'
import { ANNOTATION_LENGTHS, ANNOTATION_PERSPECTIVES } from '@shared/annotation'
import type { Attachment } from '@shared/conversations'
import type { AnnotationInputs, DocumentAction } from '@shared/documents'
import { detailsTable, toPromptReference } from './common'

export interface AnnotationPromptInput {
  inputs: AnnotationInputs
  references: Attachment[]
  country: string
  title: string
  action: DocumentAction
  currentContent?: string
  instruction?: string
}

/** Annotation of a DLL using the entire lesson text, with strict paragraph rules. */
export function buildAnnotationPrompt(p: AnnotationPromptInput): PreparedPrompt {
  const i = p.inputs
  if (!i.source?.text.trim()) throw new Error('Choose or upload the DLL to annotate.')
  const { min, max } = ANNOTATION_LENGTHS[i.length]
  const exact =
    i.paragraphs === 1
      ? 'Write exactly ONE paragraph — not two, not a list.'
      : `Write exactly ${i.paragraphs} paragraphs, separated by one blank line.`

  const sections = [
    '## Annotation details',
    '',
    detailsTable([
      ['Lesson (DLL)', i.source.title],
      ['Subject', i.subject],
      ['Grade level', i.gradeLevel],
      ['Focus', i.focus || 'The lesson as a whole'],
      ['Paragraphs', i.paragraphs],
      ['Length per paragraph', `${min}–${max} words`],
      [
        'Perspective',
        `${ANNOTATION_PERSPECTIVES[i.perspective].label}, e.g. ${ANNOTATION_PERSPECTIVES[i.perspective].example}`,
      ],
      ['Language', i.language],
    ]),
    '',
    '## Requirements',
    '',
    `- ${exact} Each paragraph must have ${min}–${max} words.`,
    '- Use professional, concise educational language.',
    '- Reflect the lesson accurately: describe only what the DLL below actually contains (objectives, activities, strategies, assessment, materials).',
    '- Make no unsupported claims: do not state results, learner performance, percentages, scores or observations that are not in the DLL. Do not add numbers that are not in the DLL.',
    '- Do not invent curriculum codes or PPST indicator numbers; use them only if they appear in the focus or the DLL.',
    '- Return only the annotation as plain paragraphs: no title, headings, bullet points, tables or commentary.',
    '',
    '## The DLL (complete text)',
    '',
    '````text',
    i.source.text.trim(),
    '````',
  ]
  if (i.instructions.trim()) {
    sections.push('', '## Additional instructions from the teacher', '', i.instructions.trim())
  }

  let request: string
  if (p.action === 'revise') {
    if (!p.instruction?.trim()) throw new Error('Revision instructions are required.')
    if (!p.currentContent?.trim()) throw new Error('There is no annotation to revise yet.')
    request = [
      ...sections,
      '',
      '## Current annotation',
      '',
      '````text',
      p.currentContent.trim(),
      '````',
      '',
      '## Revision requested',
      '',
      p.instruction.trim(),
      '',
      `Return the complete revised annotation. ${exact}`,
    ].join('\n')
  } else {
    request = [...sections, '', 'Write the annotation now.'].join('\n')
  }

  return {
    title: p.title,
    instructions: `You are an experienced teacher and instructional supervisor in ${p.country} writing a DLL annotation.\nThis is a writing task: do not create, edit or run files.`,
    history: [],
    references: p.references.map(toPromptReference),
    request,
  }
}
