import { useEffect, useRef } from 'react'
import type { ProviderInfo } from '@shared/ai'
import type { ChatMessage } from '@shared/conversations'
import {
  AssistantMessage,
  HandoffCard,
  PendingIndicator,
  StreamingMessage,
  TurnErrorBanner,
  UserMessage,
} from './Messages'

interface MessageListProps {
  messages: ChatMessage[]
  providers: ProviderInfo[]
  pendingProvider: ProviderInfo | null
  streamText: string
  turnError: string | null
  onRetry: () => void
  onEditAndResend: (messageId: string, content: string) => void
  onRegenerate: (messageId: string) => void
  onPasteResponse: (handoffMessage: ChatMessage) => void
}

export function MessageList({
  messages,
  providers,
  pendingProvider,
  streamText,
  turnError,
  onRetry,
  onEditAndResend,
  onRegenerate,
  onPasteResponse,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const busy = pendingProvider !== null

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, busy, streamText, turnError])

  const providerName = (id?: string) => providers.find((p) => p.id === id)?.name ?? 'Assistant'

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6" aria-label="Messages">
      {messages.map((m) => {
        if (m.role === 'user') {
          return (
            <UserMessage
              key={m.id}
              message={m}
              busy={busy}
              onEditAndResend={(content) => onEditAndResend(m.id, content)}
            />
          )
        }
        if (m.role === 'handoff') {
          return (
            <HandoffCard
              key={m.id}
              message={m}
              busy={busy}
              onPasteResponse={() => onPasteResponse(m)}
              onSendAgain={() => onRegenerate(m.id)}
            />
          )
        }
        return (
          <AssistantMessage
            key={m.id}
            message={m}
            providerName={providerName(m.providerId)}
            busy={busy}
            // Pasted replies can't be regenerated inside TeachMate.
            canRegenerate={m.source === 'provider'}
            onRegenerate={() => onRegenerate(m.id)}
          />
        )
      })}

      {pendingProvider &&
        (streamText ? (
          <StreamingMessage text={streamText} providerName={pendingProvider.name} />
        ) : (
          <PendingIndicator provider={pendingProvider} />
        ))}

      {turnError && !busy && <TurnErrorBanner message={turnError} onRetry={onRetry} busy={busy} />}

      <div ref={endRef} />
    </div>
  )
}
