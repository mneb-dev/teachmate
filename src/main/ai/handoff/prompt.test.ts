import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@shared/conversations'
import {
  DEEP_LINK_PROMPT_MAX_CHARS,
  buildClaudeCodeDeepLink,
  renderPromptMarkdown,
  isValidWorkspacePath,
} from './prompt'
import { buildChatPrompt } from '../prompts/chat'

const buildHandoffPrompt = (title: string, messages: ChatMessage[]) =>
  renderPromptMarkdown(buildChatPrompt(title, messages))

const msg = (role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}) =>
  ({
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  }) as ChatMessage

describe('buildHandoffPrompt', () => {
  it('includes the request, history and attachment text, but not handoff records', () => {
    const prompt = buildHandoffPrompt('Science 7', [
      msg('user', 'Earlier question'),
      msg('handoff', ''),
      msg('assistant', 'Earlier pasted answer', { source: 'pasted' }),
      msg('user', 'Make a 10-item quiz', {
        attachments: [
          {
            id: 'a1',
            name: 'lesson.docx',
            kind: 'docx',
            size: 1,
            text: 'Food webs show energy flow.',
            charCount: 27,
            truncated: false,
          },
        ],
      }),
    ])
    expect(prompt).toContain('# TeachMate request')
    expect(prompt).toContain('Title: Science 7')
    expect(prompt).toContain('**Teacher:**\nEarlier question')
    expect(prompt).toContain('**Assistant:**\nEarlier pasted answer')
    expect(prompt).toContain('### lesson.docx')
    expect(prompt).toContain('Food webs show energy flow.')
    expect(prompt.trim().endsWith('## Request\n\nMake a 10-item quiz')).toBe(true)
  })

  it('requires the last message to be from the user', () => {
    expect(() => buildHandoffPrompt('t', [msg('assistant', 'hi')])).toThrow()
  })
})

describe('buildClaudeCodeDeepLink', () => {
  it('pre-fills short prompts directly with %20-encoded spaces and %0A newlines', () => {
    const { url, usedFileReference } = buildClaudeCodeDeepLink({
      prompt: 'Line one\nLine two & more',
      promptFile: 'C:\\data\\handoff-1.md',
      cwd: 'C:\\Users\\T\\Teaching',
    })
    expect(usedFileReference).toBe(false)
    expect(url.startsWith('claude-cli://open?')).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('q')).toBe('Line one\nLine two & more')
    expect(params.get('cwd')).toBe('C:\\Users\\T\\Teaching')
    expect(url).toContain('%0A')
    expect(url).not.toContain('+')
  })

  it('points at the prompt file when the prompt is too long for a deep link', () => {
    const { url, usedFileReference } = buildClaudeCodeDeepLink({
      prompt: 'x'.repeat(DEEP_LINK_PROMPT_MAX_CHARS + 1),
      promptFile: 'C:\\data\\handoff-1.md',
      cwd: null,
    })
    expect(usedFileReference).toBe(true)
    const q = new URL(url).searchParams.get('q') ?? ''
    expect(q).toContain('C:\\data\\handoff-1.md')
    expect(q.length).toBeLessThanOrEqual(5_000)
    expect(new URL(url).searchParams.has('cwd')).toBe(false)
  })

  it('drops unsafe working directories', () => {
    const { url } = buildClaudeCodeDeepLink({
      prompt: 'hi',
      promptFile: '/f.md',
      cwd: 'relative/dir',
    })
    expect(new URL(url).searchParams.has('cwd')).toBe(false)
  })
})

describe('isValidWorkspacePath', () => {
  it.each([
    ['C:\\Users\\T\\Teaching', process.platform === 'win32'],
    ['/home/t/teaching', true],
    ['relative/path', false],
    ['\\\\server\\share', false],
    ['C:\\Users\\..\\Windows', false],
    ['/home/t/\u202eevil', false],
  ])('%s → %s', (path, expected) => {
    expect(isValidWorkspacePath(path)).toBe(expected)
  })
})
