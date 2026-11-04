import { IpcChannel } from '@shared/ipc'
import type { Services } from '../services'
import { assertSafeId } from '../lib/ids'
import { expectString, handle } from './handle'

export function registerConversationHandlers({ conversations }: Services): void {
  handle(IpcChannel.ConversationsList, () => conversations.list())
  handle(IpcChannel.ConversationsSearch, (_e, query) =>
    conversations.search(expectString(query, 'Search query', 1_000)),
  )
  handle(IpcChannel.ConversationsGet, (_e, id) => conversations.get(assertSafeId(id)))
  handle(IpcChannel.ConversationsCreate, () => conversations.create())
  handle(IpcChannel.ConversationsSave, (_e, conversation) => conversations.save(conversation))
  handle(IpcChannel.ConversationsRename, (_e, id, title) =>
    conversations.rename(assertSafeId(id), title),
  )
  handle(IpcChannel.ConversationsDelete, (_e, id) => conversations.delete(assertSafeId(id)))
}
