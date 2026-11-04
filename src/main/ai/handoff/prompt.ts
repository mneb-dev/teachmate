import { isAbsolute } from 'node:path'
import type { PreparedPrompt } from '@shared/ai'

/** Claude Code deep links accept at most 5,000 characters in `q`; keep a margin. */
export const DEEP_LINK_PROMPT_MAX_CHARS = 4_500
const HISTORY_MESSAGE_MAX_CHARS = 4_000

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text
}

/**
 * Render a prepared prompt as one self-contained Markdown document for an
 * external tool (Claude Code). Sections: instructions, conversation so far,
 * reference documents, and the request.
 */
export function renderPromptMarkdown(prompt: PreparedPrompt): string {
  const parts: string[] = ['# TeachMate request', '', prompt.instructions.trim()]

  if (prompt.title.trim()) parts.push('', `Title: ${prompt.title.trim()}`)

  if (prompt.history.length > 0) {
    parts.push('', '## Conversation so far', '')
    for (const m of prompt.history) {
      const speaker = m.role === 'user' ? 'Teacher' : 'Assistant'
      parts.push(`**${speaker}:**`, clip(m.content.trim(), HISTORY_MESSAGE_MAX_CHARS), '')
    }
  }

  if (prompt.references.length > 0) {
    parts.push('', '## Reference documents')
    for (const r of prompt.references) {
      const note = r.truncated
        ? ` (truncated to ${r.text.length.toLocaleString('en-US')} of ${r.charCount.toLocaleString('en-US')} characters)`
        : ''
      parts.push('', `### ${r.name}${note}`, '', '````text', r.text, '````')
    }
  }

  parts.push('', '## Request', '', prompt.request.trim())
  return parts.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'
}

/** Control, zero-width and bidirectional-override characters (escaped so the source stays ASCII). */
/* eslint-disable no-control-regex -- matching control characters is the point of this check */
const UNSAFE_PATH_CHARS = new RegExp(
  '[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069]',
)
/* eslint-enable no-control-regex */

/** Rejects relative, UNC/network, `..` and control-character paths (mirrors Claude Code's own rules). */
export function isValidWorkspacePath(path: string): boolean {
  if (!path || path.length > 1024) return false
  if (!isAbsolute(path)) return false
  if (path.startsWith('\\\\') || path.startsWith('//')) return false
  if (path.split(/[\\/]/).includes('..')) return false
  if (UNSAFE_PATH_CHARS.test(path)) return false
  return true
}

export interface DeepLinkInput {
  prompt: string
  /** Absolute path of the saved prompt file, used when the prompt is too long to pre-fill. */
  promptFile: string
  cwd: string | null
}

export interface DeepLink {
  url: string
  usedFileReference: boolean
}

/**
 * Build a `claude-cli://open` deep link. Claude Code pre-fills the prompt but
 * never sends it automatically; the teacher reviews it and presses Enter.
 * See https://code.claude.com/docs/en/deep-links
 */
export function buildClaudeCodeDeepLink({ prompt, promptFile, cwd }: DeepLinkInput): DeepLink {
  const usedFileReference = prompt.length > DEEP_LINK_PROMPT_MAX_CHARS
  const q = usedFileReference
    ? `Please read the TeachMate request saved at "${promptFile}" and respond to it.\n` +
      '(The same request is also on your clipboard.)'
    : prompt

  const params = new URLSearchParams()
  if (cwd && isValidWorkspacePath(cwd)) params.set('cwd', cwd)
  params.set('q', q)
  // URLSearchParams encodes spaces as "+"; the deep-link docs use %20, so normalize.
  return {
    url: `claude-cli://open?${params.toString().replace(/\+/g, '%20')}`,
    usedFileReference,
  }
}
