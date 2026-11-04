import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PreparedPrompt } from '@shared/ai'
import { HandoffStore } from '../handoff/handoff-store'
import { ClaudeCodeHandoffProvider } from './claude-code-handoff'

let dir: string
let copied: string[]
let opened: string[]

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'teachmate-handoff-'))
  copied = []
  opened = []
})
afterEach(async () => rm(dir, { recursive: true, force: true }))

function provider(registered = true, openFails = false) {
  return new ClaudeCodeHandoffProvider({
    store: new HandoffStore(dir),
    getWorkspace: async () => null,
    copyText: (t) => copied.push(t),
    openUrl: async (u) => {
      if (openFails) throw new Error('boom')
      opened.push(u)
    },
    isDeepLinkHandlerRegistered: () => registered,
  })
}

const request = (content: string): PreparedPrompt => ({
  title: 'Test',
  instructions: 'Be helpful.',
  history: [],
  references: [],
  request: content,
})

const ctx = { signal: new AbortController().signal, emit: () => {} }

describe('ClaudeCodeHandoffProvider', () => {
  it('saves the prompt, copies it, and opens a claude-cli deep link — never returns an AI response', async () => {
    const result = await provider().send(request('Draft objectives'), ctx)
    expect(result.type).toBe('handoff')
    if (result.type !== 'handoff') return

    const saved = await readFile(join(dir, `handoff-${result.handoff.handoffId}.md`), 'utf8')
    expect(saved).toContain('Draft objectives')
    expect(copied).toEqual([saved])
    expect(opened).toHaveLength(1)
    expect(opened[0]).toMatch(/^claude-cli:\/\/open\?/)
    expect(result.handoff).toMatchObject({ copiedToClipboard: true, openedExternally: true })
  })

  it('still prepares and copies the prompt when Claude Code is not installed', async () => {
    const p = provider(false)
    expect((await p.getStatus()).state).toBe('needs-setup')
    const result = await p.send(request('Hi'), ctx)
    expect(opened).toEqual([])
    expect(copied).toHaveLength(1)
    expect(result.type === 'handoff' && result.handoff.openedExternally).toBe(false)
    expect(result.type === 'handoff' && result.handoff.openError).toMatch(/not installed/)
  })

  it('reports a failed launch instead of throwing', async () => {
    const result = await provider(true, true).send(request('Hi'), ctx)
    expect(result.type === 'handoff' && result.handoff.openError).toMatch(/boom/)
  })

  it('can copy and reopen a previous handoff', async () => {
    const p = provider()
    const result = await p.send(request('Again'), ctx)
    if (result.type !== 'handoff') throw new Error('expected handoff')
    copied = []
    expect(await p.copyPrompt(result.handoff.handoffId)).toEqual({ ok: true })
    expect(copied[0]).toContain('Again')
    expect(await p.reopen(result.handoff.handoffId)).toEqual({ ok: true })
    expect(opened).toHaveLength(2)
    await expect(p.copyPrompt('missing')).rejects.toThrow(/no longer exists/)
  })
})
