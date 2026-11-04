import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_CONVERSATION_TITLE,
  LIMITS,
  type Conversation,
  type ConversationSummary,
} from '@shared/conversations'
import { assertSafeId, newId } from '../lib/ids'
import { readJsonFile, writeJsonFileAtomic } from './json-file'
import { validateConversation, validateTitle } from './validation'

const PREVIEW_CHARS = 140
const SNIPPET_RADIUS = 50

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Rough Markdown → plain text, good enough for one-line previews. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`|]+/g, '')
}

function previewOf(conversation: Conversation): string {
  for (let i = conversation.messages.length - 1; i >= 0; i--) {
    const m = conversation.messages[i]
    if ((m.role === 'user' || m.role === 'assistant') && m.content.trim()) {
      return collapse(stripMarkdown(m.content)).slice(0, PREVIEW_CHARS)
    }
  }
  return ''
}

function summarize(conversation: Conversation, matchSnippet?: string): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.filter((m) => m.role !== 'handoff').length,
    preview: previewOf(conversation),
    ...(matchSnippet !== undefined ? { matchSnippet } : {}),
  }
}

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - SNIPPET_RADIUS)
  const end = Math.min(text.length, index + length + SNIPPET_RADIUS)
  return `${start > 0 ? '…' : ''}${collapse(text.slice(start, end))}${end < text.length ? '…' : ''}`
}

/**
 * Stores each conversation as `<id>.json` in a folder on this device.
 * Pure Node.js (no Electron imports) so it can be unit-tested.
 */
export class ConversationStore {
  constructor(private readonly dir: string) {}

  private fileFor(id: string): string {
    return join(this.dir, `${assertSafeId(id, 'conversation id')}.json`)
  }

  private async readAll(): Promise<Conversation[]> {
    await mkdir(this.dir, { recursive: true })
    const files = (await readdir(this.dir)).filter((f) => f.endsWith('.json'))
    const conversations: Conversation[] = []
    for (const file of files) {
      try {
        conversations.push(validateConversation(await readJsonFile(join(this.dir, file))))
      } catch (err) {
        // Skip unreadable files instead of failing the whole list.
        console.warn(`[storage] skipping unreadable conversation ${file}:`, (err as Error).message)
      }
    }
    return conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async list(): Promise<ConversationSummary[]> {
    return (await this.readAll()).map((c) => summarize(c))
  }

  async search(rawQuery: string): Promise<ConversationSummary[]> {
    if (typeof rawQuery !== 'string') throw new Error('Search query must be a string')
    const query = rawQuery.trim().slice(0, LIMITS.searchQueryMaxChars).toLowerCase()
    const all = await this.readAll()
    if (!query) return all.map((c) => summarize(c))

    const results: ConversationSummary[] = []
    for (const conversation of all) {
      if (conversation.title.toLowerCase().includes(query)) {
        results.push(summarize(conversation))
        continue
      }
      for (const message of conversation.messages) {
        const haystacks = [message.content, ...(message.attachments ?? []).map((a) => a.name)]
        const hit = haystacks.find((h) => h.toLowerCase().includes(query))
        if (hit !== undefined) {
          const index = hit.toLowerCase().indexOf(query)
          results.push(summarize(conversation, snippetAround(hit, index, query.length)))
          break
        }
      }
    }
    return results
  }

  async get(id: string): Promise<Conversation | null> {
    const data = await readJsonFile(this.fileFor(id))
    return data === null ? null : validateConversation(data)
  }

  async create(): Promise<Conversation> {
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id: newId(),
      title: DEFAULT_CONVERSATION_TITLE,
      createdAt: now,
      updatedAt: now,
      messages: [],
    }
    await writeJsonFileAtomic(this.fileFor(conversation.id), conversation)
    return conversation
  }

  async save(input: unknown): Promise<Conversation> {
    const conversation = validateConversation(input)
    conversation.updatedAt = new Date().toISOString()
    await writeJsonFileAtomic(this.fileFor(conversation.id), conversation)
    return conversation
  }

  async rename(id: string, title: unknown): Promise<Conversation> {
    const conversation = await this.get(id)
    if (!conversation) throw new Error('Conversation not found')
    conversation.title = validateTitle(title)
    conversation.updatedAt = new Date().toISOString()
    await writeJsonFileAtomic(this.fileFor(id), conversation)
    return conversation
  }

  async delete(id: string): Promise<void> {
    await rm(this.fileFor(id), { force: true })
  }
}
