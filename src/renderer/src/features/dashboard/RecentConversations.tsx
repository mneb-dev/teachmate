import { useEffect, useState } from 'react'
import { MessageSquarePlus, MessagesSquare } from 'lucide-react'
import { Link } from 'react-router'
import type { ConversationSummary } from '@shared/conversations'
import { ButtonLink } from '@renderer/components/ui/Button'
import { Card, CardHeader } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'
import { formatRelativeTime } from '@renderer/lib/format'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

const SHOWN = 3

/** Latest conversations, read from local storage. */
export function RecentConversations() {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ok'; items: ConversationSummary[] }
    | { status: 'error'; error: string }
  >({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    teachmate.conversations
      .list()
      .then((items) => !cancelled && setState({ status: 'ok', items: items.slice(0, SHOWN) }))
      .catch(
        (err: unknown) => !cancelled && setState({ status: 'error', error: ipcErrorMessage(err) }),
      )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Recent conversations"
        description="Your latest chats with the assistant."
        icon={<IconTile icon={MessagesSquare} size="sm" tone="muted" />}
        action={
          <Link
            to="/ai-assistant"
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            Open
          </Link>
        }
      />
      {state.status === 'loading' && (
        <p className="px-5 py-4 text-sm text-muted-foreground">Loading…</p>
      )}
      {state.status === 'error' && (
        <p className="px-5 py-4 text-sm text-primary">Couldn’t load conversations: {state.error}</p>
      )}
      {state.status === 'ok' && state.items.length === 0 && (
        <div className="px-5 pt-3 pb-5">
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
          <ButtonLink to="/ai-assistant" variant="secondary" size="sm" className="mt-3">
            <MessageSquarePlus className="size-4" aria-hidden />
            Start a conversation
          </ButtonLink>
        </div>
      )}
      {state.status === 'ok' && state.items.length > 0 && (
        <ul className="mt-3 space-y-1 px-2 pb-2">
          {state.items.map((conv) => (
            <li key={conv.id}>
              <Link
                to={`/ai-assistant?c=${encodeURIComponent(conv.id)}`}
                className="block rounded-xl px-3 py-3 transition-colors hover:bg-surface-muted"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{conv.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(new Date(conv.updatedAt))}
                  </span>
                </div>
                {conv.preview && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {conv.preview}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {conv.messageCount} message{conv.messageCount === 1 ? '' : 's'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
