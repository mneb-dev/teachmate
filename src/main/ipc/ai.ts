import { shell } from 'electron'
import type { ChatRequest } from '@shared/ai'
import { IpcChannel } from '@shared/ipc'
import { buildChatPrompt } from '../ai/prompts/chat'
import { assertSafeId } from '../lib/ids'
import type { Services } from '../services'
import { validateMessages } from '../storage/validation'
import { expectString, handle } from './handle'

function parseChatRequest(value: unknown): ChatRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid chat request')
  const v = value as Record<string, unknown>
  const messages = validateMessages(v.messages)
  if (messages.at(-1)?.role !== 'user') throw new Error('The last message must be from the user')
  return {
    requestId: assertSafeId(v.requestId, 'request id'),
    providerId: expectString(v.providerId, 'Provider id', 64),
    conversationId: assertSafeId(v.conversationId, 'conversation id'),
    conversationTitle: expectString(v.conversationTitle, 'Title', 500),
    messages,
  }
}

export function registerAiHandlers({ providers, runner, claudeCode, handoffs }: Services): void {
  handle(IpcChannel.AiListProviders, () => providers.list())

  handle(IpcChannel.AiSend, async (event, raw) => {
    const request = parseChatRequest(raw)
    const prompt = buildChatPrompt(request.conversationTitle, request.messages)
    const { result } = await runner.run(event.sender, request.requestId, request.providerId, prompt)
    return result
  })

  handle(IpcChannel.AiCancel, (_e, requestId) => {
    runner.cancel(assertSafeId(requestId, 'request id'))
  })

  // Handoff follow-up actions (Claude Code provider).
  handle(IpcChannel.HandoffCopyPrompt, (_e, id) => claudeCode.copyPrompt(assertSafeId(id)))
  handle(IpcChannel.HandoffOpen, (_e, id) => claudeCode.reopen(assertSafeId(id)))
  handle(IpcChannel.HandoffRevealFile, async (_e, id) => {
    const path = handoffs.pathFor(assertSafeId(id))
    await handoffs.read(id as string) // throws a friendly error if the file is gone
    shell.showItemInFolder(path)
    return { ok: true }
  })
}
