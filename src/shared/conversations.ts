/**
 * Conversation data model shared by the main process (storage) and the
 * renderer (UI). Conversations are stored as JSON files on this device.
 */

export type AttachmentKind = 'docx' | 'pdf' | 'txt' | 'md'

export const ATTACHMENT_EXTENSIONS: readonly AttachmentKind[] = ['docx', 'pdf', 'txt', 'md']

/** A document attached to a user message, with its extracted text. */
export interface Attachment {
  id: string
  name: string
  kind: AttachmentKind
  /** Original file size in bytes. */
  size: number
  /** Extracted plain text (possibly truncated, see `truncated`). */
  text: string
  /** Length of the full extracted text before truncation. */
  charCount: number
  truncated: boolean
}

/** Record of a prompt handed off to an external tool (e.g. Claude Code). */
export interface HandoffRecord {
  /** Identifies the prepared prompt file inside TeachMate's handoff folder. */
  handoffId: string
  providerId: string
  promptChars: number
  attachmentCount: number
  copiedToClipboard: boolean
  openedExternally: boolean
  /** Why the external tool could not be opened, if it wasn't. */
  openError?: string
  /** True when the prompt was too long to pre-fill and the link points at the prompt file. */
  usedFileReference: boolean
  /** Working directory passed to the external tool, if any. */
  workspace: string | null
}

export type MessageRole = 'user' | 'assistant' | 'handoff'

export interface ChatMessage {
  id: string
  role: MessageRole
  /** Markdown/plain text. Empty for handoff records. */
  content: string
  createdAt: string
  /** User messages only. */
  attachments?: Attachment[]
  /**
   * Assistant messages only: where the text came from.
   * - `provider`: returned by an AI provider integration
   * - `pasted`:   pasted in by the user from an external tool (e.g. Claude Code)
   */
  source?: 'provider' | 'pasted'
  providerId?: string
  /** Handoff messages only. */
  handoff?: HandoffRecord
  /** Set when sending this turn failed. */
  error?: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export interface ConversationSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  /** Short preview of the latest user/assistant text. */
  preview: string
  /** For search results: text around the first match. */
  matchSnippet?: string
}

export const LIMITS = {
  titleMaxChars: 120,
  messageMaxChars: 100_000,
  messagesPerConversation: 2_000,
  attachmentsPerMessage: 5,
  attachmentTextMaxChars: 200_000,
  attachmentFileMaxBytes: 15 * 1024 * 1024,
  searchQueryMaxChars: 200,
} as const

export const DEFAULT_CONVERSATION_TITLE = 'New conversation'
