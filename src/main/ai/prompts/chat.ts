import type { PreparedPrompt } from '@shared/ai'
import type { ChatMessage } from '@shared/conversations'
import { toPromptReference } from './common'

/** How many earlier turns to include as context. */
const HISTORY_TURNS = 10

const CHAT_INSTRUCTIONS = [
  'You are helping a teacher who prepared this request in TeachMate, a personal teaching-assistant app.',
  'Reply in clear Markdown that the teacher can paste back into TeachMate.',
  'This is a planning and writing task: do not create, edit or run files unless the teacher asks you to.',
].join('\n')

/** Build the prompt for an AI Assistant turn. The last message must be the user's request. */
export function buildChatPrompt(title: string, messages: ChatMessage[]): PreparedPrompt {
  const request = messages.at(-1)
  if (!request || request.role !== 'user') {
    throw new Error('The last message must be a user message')
  }

  const history = messages
    .slice(0, -1)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  return {
    title,
    instructions: CHAT_INSTRUCTIONS,
    history,
    references: (request.attachments ?? []).map(toPromptReference),
    request: request.content,
  }
}
