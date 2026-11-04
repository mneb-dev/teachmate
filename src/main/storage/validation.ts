import {
  ATTACHMENT_EXTENSIONS,
  LIMITS,
  type Attachment,
  type ChatMessage,
  type Conversation,
  type HandoffRecord,
  type MessageRole,
} from '@shared/conversations'
import { isSafeId } from '../lib/ids'

/**
 * Runtime validation for data arriving from the renderer over IPC.
 * The renderer is untrusted, so everything is checked before it is written to disk.
 */

type Obj = Record<string, unknown>

class ValidationError extends Error {
  constructor(path: string, problem: string) {
    super(`Invalid data: ${path} ${problem}`)
  }
}

export function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(path, 'must be an object')
  }
  return value as Obj
}

export function str(value: unknown, path: string, max: number, allowEmpty = true): string {
  if (typeof value !== 'string') throw new ValidationError(path, 'must be a string')
  if (!allowEmpty && value.trim().length === 0) throw new ValidationError(path, 'must not be empty')
  if (value.length > max) throw new ValidationError(path, `exceeds ${max} characters`)
  return value
}

export function optStr(value: unknown, path: string, max: number): string | undefined {
  return value === undefined ? undefined : str(value, path, max)
}

export function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new ValidationError(path, 'must be a boolean')
  return value
}

export function nonNegInt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(path, 'must be a non-negative integer')
  }
  return value
}

export function id(value: unknown, path: string): string {
  if (!isSafeId(value)) throw new ValidationError(path, 'is not a valid id')
  return value
}

export function isoDate(value: unknown, path: string): string {
  const s = str(value, path, 40)
  if (Number.isNaN(Date.parse(s))) throw new ValidationError(path, 'must be an ISO date')
  return s
}

export function arr(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw new ValidationError(path, 'must be an array')
  if (value.length > max) throw new ValidationError(path, `exceeds ${max} items`)
  return value
}

export function validateTitle(value: unknown): string {
  const title = str(value, 'title', LIMITS.titleMaxChars * 4, false)
    .trim()
    .replace(/\s+/g, ' ')
  return title.slice(0, LIMITS.titleMaxChars)
}

export function validateAttachment(value: unknown, path: string): Attachment {
  const o = obj(value, path)
  const kind = o.kind
  if (!ATTACHMENT_EXTENSIONS.includes(kind as Attachment['kind'])) {
    throw new ValidationError(`${path}.kind`, 'is not a supported type')
  }
  return {
    id: id(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`, 260, false),
    kind: kind as Attachment['kind'],
    size: nonNegInt(o.size, `${path}.size`),
    text: str(o.text, `${path}.text`, LIMITS.attachmentTextMaxChars),
    charCount: nonNegInt(o.charCount, `${path}.charCount`),
    truncated: bool(o.truncated, `${path}.truncated`),
  }
}

export function validateHandoff(value: unknown, path: string): HandoffRecord {
  const o = obj(value, path)
  const workspace = o.workspace === null ? null : str(o.workspace, `${path}.workspace`, 1024)
  return {
    handoffId: id(o.handoffId, `${path}.handoffId`),
    providerId: str(o.providerId, `${path}.providerId`, 64, false),
    promptChars: nonNegInt(o.promptChars, `${path}.promptChars`),
    attachmentCount: nonNegInt(o.attachmentCount, `${path}.attachmentCount`),
    copiedToClipboard: bool(o.copiedToClipboard, `${path}.copiedToClipboard`),
    openedExternally: bool(o.openedExternally, `${path}.openedExternally`),
    openError: optStr(o.openError, `${path}.openError`, 1000),
    usedFileReference: bool(o.usedFileReference, `${path}.usedFileReference`),
    workspace,
  }
}

const ROLES: readonly MessageRole[] = ['user', 'assistant', 'handoff']

function validateMessage(value: unknown, path: string): ChatMessage {
  const o = obj(value, path)
  const role = o.role as MessageRole
  if (!ROLES.includes(role)) throw new ValidationError(`${path}.role`, 'is not a valid role')

  const message: ChatMessage = {
    id: id(o.id, `${path}.id`),
    role,
    content: str(o.content, `${path}.content`, LIMITS.messageMaxChars),
    createdAt: isoDate(o.createdAt, `${path}.createdAt`),
  }

  if (o.attachments !== undefined) {
    if (role !== 'user')
      throw new ValidationError(`${path}.attachments`, 'only allowed on user messages')
    message.attachments = arr(
      o.attachments,
      `${path}.attachments`,
      LIMITS.attachmentsPerMessage,
    ).map((a, i) => validateAttachment(a, `${path}.attachments[${i}]`))
  }
  if (o.source !== undefined) {
    if (o.source !== 'provider' && o.source !== 'pasted') {
      throw new ValidationError(`${path}.source`, 'must be "provider" or "pasted"')
    }
    message.source = o.source
  }
  if (o.providerId !== undefined) message.providerId = str(o.providerId, `${path}.providerId`, 64)
  if (o.handoff !== undefined) {
    if (role !== 'handoff')
      throw new ValidationError(`${path}.handoff`, 'only allowed on handoff messages')
    message.handoff = validateHandoff(o.handoff, `${path}.handoff`)
  }
  if (o.error !== undefined) message.error = str(o.error, `${path}.error`, 2000)
  return message
}

export function validateMessages(value: unknown): ChatMessage[] {
  return arr(value, 'messages', LIMITS.messagesPerConversation).map((m, i) =>
    validateMessage(m, `messages[${i}]`),
  )
}

export function validateConversation(value: unknown): Conversation {
  const o = obj(value, 'conversation')
  return {
    id: id(o.id, 'id'),
    title: validateTitle(o.title),
    createdAt: isoDate(o.createdAt, 'createdAt'),
    updatedAt: isoDate(o.updatedAt, 'updatedAt'),
    messages: arr(o.messages, 'messages', LIMITS.messagesPerConversation).map((m, i) =>
      validateMessage(m, `messages[${i}]`),
    ),
  }
}
