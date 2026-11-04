import { useState, type KeyboardEvent } from 'react'
import { Check, MessageSquarePlus, Pencil, Search, Trash2, X } from 'lucide-react'
import type { ConversationSummary } from '@shared/conversations'
import { IconButton } from '@renderer/components/ui/IconButton'
import { cn } from '@renderer/lib/cn'
import { formatRelativeTime } from '@renderer/lib/format'

interface ConversationSidebarProps {
  summaries: ConversationSummary[] | null
  error: string | null
  activeId: string | null
  query: string
  onQueryChange: (query: string) => void
  onNew: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => Promise<void>
  onRequestDelete: (summary: ConversationSummary) => void
}

export function ConversationSidebar({
  summaries,
  error,
  activeId,
  query,
  onQueryChange,
  onNew,
  onSelect,
  onRename,
  onRequestDelete,
}: ConversationSidebarProps) {
  return (
    <aside
      className="flex w-72 shrink-0 flex-col border-r border-border bg-surface"
      aria-label="Conversation history"
    >
      <div className="space-y-3 p-4">
        <button
          type="button"
          onClick={onNew}
          className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <MessageSquarePlus className="size-4" aria-hidden />
          New conversation
        </button>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-9 w-full rounded-lg border border-border bg-background pr-8 pl-9 text-sm placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {error ? (
          <p className="px-3 py-2 text-sm text-primary">Couldn’t load conversations: {error}</p>
        ) : summaries === null ? (
          <ListSkeleton />
        ) : summaries.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {query.trim() ? 'No conversations match your search.' : 'No conversations yet.'}
          </p>
        ) : (
          <ul className="space-y-0.5" aria-label="Conversations">
            {summaries.map((s) => (
              <ConversationItem
                key={s.id}
                summary={s}
                active={s.id === activeId}
                onSelect={() => onSelect(s.id)}
                onRename={(title) => onRename(s.id, title)}
                onDelete={() => onRequestDelete(s)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

function ConversationItem({
  summary,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  summary: ConversationSummary
  active: boolean
  onSelect: () => void
  onRename: (title: string) => Promise<void>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(summary.title)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const title = draft.trim()
    if (!title) return setError('Title can’t be empty')
    if (title === summary.title) return setEditing(false)
    try {
      await onRename(title)
      setEditing(false)
      setError(null)
    } catch {
      setError('Couldn’t rename')
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void save()
    if (e.key === 'Escape') {
      setEditing(false)
      setDraft(summary.title)
      setError(null)
    }
  }

  if (editing) {
    return (
      <li className="rounded-lg bg-surface-muted p-2">
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Conversation title"
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm focus:border-primary/60 focus:outline-none"
          />
          <IconButton label="Save title" onClick={() => void save()}>
            <Check className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            label="Cancel rename"
            onClick={() => {
              setEditing(false)
              setDraft(summary.title)
              setError(null)
            }}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
        {error && <p className="mt-1 px-1 text-xs text-primary">{error}</p>}
      </li>
    )
  }

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'w-full cursor-pointer rounded-lg px-3 py-2.5 pr-16 text-left transition-colors',
          active ? 'bg-primary-soft' : 'hover:bg-surface-muted',
        )}
      >
        <p
          className={cn(
            'truncate text-sm',
            active ? 'font-medium text-primary-soft-foreground' : 'text-foreground',
          )}
        >
          {summary.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {summary.matchSnippet ?? (summary.preview || 'No messages yet')}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">
          {formatRelativeTime(new Date(summary.updatedAt))}
        </p>
      </button>
      <div
        className={cn(
          'absolute top-2 right-2 flex gap-0.5 rounded-lg bg-surface-muted opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
          active && 'bg-primary-soft opacity-100',
        )}
      >
        <IconButton
          label={`Rename “${summary.title}”`}
          className="size-7"
          onClick={() => {
            setDraft(summary.title)
            setEditing(true)
          }}
        >
          <Pencil className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton label={`Delete “${summary.title}”`} className="size-7" onClick={onDelete}>
          <Trash2 className="size-3.5" aria-hidden />
        </IconButton>
      </div>
    </li>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2 px-1" aria-label="Loading conversations">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse space-y-2 rounded-lg px-3 py-2.5">
          <div className="h-3 w-3/4 rounded bg-surface-muted" />
          <div className="h-2.5 w-1/2 rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  )
}
