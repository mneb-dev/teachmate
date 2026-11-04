import { describe, expect, it } from 'vitest'
import { parseActivities } from '@shared/activities'
import { cleanPastedReply } from '@shared/paste'
import { parseReview } from '@shared/review'

const NBSP = String.fromCharCode(0xa0)
const ZWSP = String.fromCharCode(0x200b)

describe('cleaning text pasted from the Claude Code terminal', () => {
  it('leaves clean Markdown (e.g. from /copy) unchanged', () => {
    const md = [
      '# Learning Activities: Hardware',
      '',
      '## Activity 1: Mystery Box',
      '',
      '- **Activity type:** Motivation',
      '  - nested item',
      '',
      '    indented code',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n')
    expect(cleanPastedReply(md)).toEqual({ text: md, changed: false, fromTerminal: false })
    expect(cleanPastedReply(`${md}\n\n`).changed).toBe(false)
  })

  it('removes the response marker, the terminal indent and padding', () => {
    const pasted = [
      '⏺ ## Activity 1: Mystery Box   ',
      '',
      '  - **Activity type:** Motivation',
      '  - **Estimated duration:** 10 minutes' + NBSP + NBSP,
      '    - nested',
      '',
      '  ### Procedure' + ZWSP,
      '  1. Show the box (5 min)',
    ].join('\r\n')
    const r = cleanPastedReply(pasted)
    expect(r.text).toBe(
      [
        '## Activity 1: Mystery Box',
        '',
        '- **Activity type:** Motivation',
        '- **Estimated duration:** 10 minutes',
        '  - nested',
        '',
        '### Procedure',
        '1. Show the box (5 min)',
      ].join('\n'),
    )
    expect(r.fromTerminal).toBe(true)
    expect(parseActivities(r.text)[0]).toMatchObject({ title: 'Mystery Box', minutes: 10 })
  })

  it('dedents a copy that starts without the marker (●, Windows) or with none', () => {
    expect(cleanPastedReply('●  Hello\n   world').text).toBe('Hello\nworld')
    expect(cleanPastedReply('  # Title\n\n  Body text\n    - deeper').text).toBe(
      '# Title\n\nBody text\n  - deeper',
    )
  })

  it('converts drawn tables, joining wrapped cells', () => {
    const pasted = [
      '  ## Objective and Assessment Alignment',
      '',
      '  ┌───────────────┬───────────┬────────────┐',
      '  │ Objective     │ Activities│ Alignment  │',
      '  ├───────────────┼───────────┼────────────┤',
      '  │ Write ratios  │ Recipe    │ Aligned    │',
      '  │ in simplest   │ pairs     │            │',
      '  ├───────────────┼───────────┼────────────┤',
      '  │ Solve | words │ None      │ Not aligned│',
      '  └───────────────┴───────────┴────────────┘',
      '',
      '  After the table.',
    ].join('\n')
    const r = cleanPastedReply(pasted)
    expect(r.fromTerminal).toBe(true)
    expect(r.text).toBe(
      [
        '## Objective and Assessment Alignment',
        '',
        '| Objective | Activities | Alignment |',
        '| --- | --- | --- |',
        '| Write ratios in simplest | Recipe pairs | Aligned |',
        '| Solve \\| words | None | Not aligned |',
        '',
        'After the table.',
      ].join('\n'),
    )
  })

  it('treats each line as a row when only the header is separated', () => {
    const r = cleanPastedReply(
      ['┌───┬───┐', '│ A │ B │', '├───┼───┤', '│ 1 │ 2 │', '│ 3 │ 4 │', '└───┴───┘'].join('\n'),
    )
    expect(r.text).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |')
  })

  it('rejoins Markdown table rows cut at the terminal width', () => {
    const r = cleanPastedReply(
      '| Objective | Status |\n| --- | --- |\n| Learners will write\nratios | Meets |\n\nNext',
    )
    expect(r.text).toBe(
      '| Objective | Status |\n| --- | --- |\n| Learners will write ratios | Meets |\n\nNext',
    )
  })

  it('turns displayed bullets into list items and keeps review labels readable', () => {
    const pasted = [
      '⏺ ### E. Assessment',
      '  • **Status:** Needs Improvement',
      '  • **Evidence:** IV. Evaluation',
    ].join('\n')
    const r = cleanPastedReply(pasted)
    expect(r.text).toBe(
      '### E. Assessment\n- **Status:** Needs Improvement\n- **Evidence:** IV. Evaluation',
    )
    const review = parseReview(`## Detailed Evaluation\n\n${r.text}`)
    expect(review.criteria.find((c) => c.letter === 'E')?.status).toBe('needs-improvement')
  })
})
