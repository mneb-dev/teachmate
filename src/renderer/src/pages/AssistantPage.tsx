import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import type { Attachment, ChatMessage, ConversationSummary } from '@shared/conversations'
import { Button } from '@renderer/components/ui/Button'
import { Dialog } from '@renderer/components/ui/Dialog'
import { IconButton } from '@renderer/components/ui/IconButton'
import { PasteReplyDialog } from '@renderer/components/ai/PasteReplyDialog'
import { Composer } from '@renderer/features/assistant/components/Composer'
import { ConversationSidebar } from '@renderer/features/assistant/components/ConversationSidebar'
import { EmptyChat } from '@renderer/features/assistant/components/EmptyChat'
import { MessageList } from '@renderer/features/assistant/components/MessageList'
import { useAssistant } from '@renderer/features/assistant/useAssistant'
import { ipcErrorMessage } from '@renderer/lib/ipc'
import { isBoolean, readPreference, writePreference } from '@renderer/lib/preferences'

const HISTORY_KEY = 'teachmate.assistant.historyOpen'

export function AssistantPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeId = searchParams.get('c')
  const setActiveId = useCallback(
    (id: string | null) => setSearchParams(id ? { c: id } : {}, { replace: false }),
    [setSearchParams],
  )

  const a = useAssistant(activeId, setActiveId)

  // Composer draft (shared by the empty state's prompt starters).
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sendError, setSendError] = useState<string | null>(null)

  const [historyOpen, setHistoryOpen] = useState(() => readPreference(HISTORY_KEY, true, isBoolean))
  const toggleHistory = () => {
    setHistoryOpen(!historyOpen)
    writePreference(HISTORY_KEY, !historyOpen)
  }

  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null)
  const [pasteFor, setPasteFor] = useState<ChatMessage | null>(null)

  const busy = a.pending !== null
  const conversation = a.conversation

  const send = () => {
    const draftText = text
    const draftAttachments = attachments
    setText('')
    setAttachments([])
    setSendError(null)
    a.send(draftText, draftAttachments).catch((err: unknown) => {
      // Restore the draft so nothing the teacher typed is lost.
      setText(draftText)
      setAttachments(draftAttachments)
      setSendError(ipcErrorMessage(err))
    })
  }

  const report = (p: Promise<unknown>) =>
    p.catch((err: unknown) => setSendError(ipcErrorMessage(err)))

  return (
    <div className="flex h-full">
      {historyOpen && (
        <ConversationSidebar
          summaries={a.summaries}
          error={a.listError}
          activeId={activeId}
          query={a.query}
          onQueryChange={a.setQuery}
          onNew={() => setActiveId(null)}
          onSelect={setActiveId}
          onRename={a.rename}
          onRequestDelete={setDeleting}
        />
      )}

      <section className="flex min-w-0 flex-1 flex-col" aria-label="Chat">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
          <IconButton
            label={historyOpen ? 'Hide conversation history' : 'Show conversation history'}
            onClick={toggleHistory}
          >
            {historyOpen ? (
              <PanelLeftClose className="size-[18px]" aria-hidden />
            ) : (
              <PanelLeftOpen className="size-[18px]" aria-hidden />
            )}
          </IconButton>

          {conversation && renaming !== null ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!renaming.trim()) return
                void report(a.rename(conversation.id, renaming)).finally(() => setRenaming(null))
              }}
            >
              <input
                autoFocus
                value={renaming}
                maxLength={120}
                onChange={(e) => setRenaming(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                aria-label="Conversation title"
                className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm focus:border-primary/60 focus:outline-none"
              />
              <Button size="sm" type="submit">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
            </form>
          ) : (
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
              {conversation?.title ?? 'New conversation'}
            </h1>
          )}

          {conversation && renaming === null && (
            <>
              <IconButton
                label="Rename conversation"
                onClick={() => setRenaming(conversation.title)}
              >
                <Pencil className="size-4" aria-hidden />
              </IconButton>
              <IconButton
                label="Delete conversation"
                onClick={() =>
                  setDeleting({
                    id: conversation.id,
                    title: conversation.title,
                    createdAt: conversation.createdAt,
                    updatedAt: conversation.updatedAt,
                    messageCount: conversation.messages.length,
                    preview: '',
                  })
                }
              >
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            </>
          )}

          {/* Provider picker only when there is a choice; status already shows in the top bar. */}
          {a.providers.length > 1 && (
            <select
              value={a.provider?.id ?? ''}
              onChange={(e) => a.setProviderId(e.target.value)}
              disabled={busy}
              aria-label="AI provider"
              className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
            >
              {a.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {a.conversationError ? (
            <div className="mx-auto mt-16 max-w-md px-6 text-center">
              <TriangleAlert className="mx-auto size-6 text-primary" aria-hidden />
              <p className="mt-2 text-sm font-medium">Couldn’t open this conversation</p>
              <p className="mt-1 text-sm text-muted-foreground">{a.conversationError}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => setActiveId(null)}
              >
                Start a new conversation
              </Button>
            </div>
          ) : a.isLoadingConversation ? (
            <div
              className="flex h-full items-center justify-center text-sm text-muted-foreground"
              role="status"
            >
              <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
              Loading conversation…
            </div>
          ) : !conversation || (conversation.messages.length === 0 && !busy) ? (
            <EmptyChat provider={a.provider} onPickStarter={setText} />
          ) : (
            <MessageList
              messages={conversation.messages}
              providers={a.providers}
              pendingProvider={
                a.pending?.conversationId === conversation.id ? a.pending.provider : null
              }
              streamText={a.streamText}
              turnError={a.turnError}
              onRetry={() => void report(a.retry())}
              onEditAndResend={(id, content) => void report(a.editAndResend(id, content))}
              onRegenerate={(id) => void report(a.regenerate(id))}
              onPasteResponse={setPasteFor}
            />
          )}
        </div>

        {sendError && (
          <div
            role="alert"
            className="mx-auto mb-1 flex w-full max-w-3xl items-center gap-2 px-4 text-xs text-primary sm:px-6"
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            <span className="flex-1">{sendError}</span>
            <button
              type="button"
              className="cursor-pointer underline"
              onClick={() => setSendError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <Composer
          text={text}
          onTextChange={setText}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onSend={send}
          onStop={a.stop}
          provider={a.provider}
          busy={busy}
          disabled={a.isLoadingConversation || Boolean(a.conversationError) || !a.provider}
        />
      </section>

      <DeleteConversationDialog
        target={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async (id) => {
          await a.remove(id)
          setDeleting(null)
        }}
      />
      <PasteReplyDialog
        open={pasteFor !== null}
        onClose={() => setPasteFor(null)}
        onSave={async (content) => {
          await a.addPastedResponse(content, pasteFor?.providerId ?? 'claude-code-handoff')
          setPasteFor(null)
        }}
      />
    </div>
  )
}

function DeleteConversationDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: ConversationSummary | null
  onClose: () => void
  onConfirm: (id: string) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  return (
    <Dialog
      open={target !== null}
      onClose={() => {
        setError(null)
        onClose()
      }}
      title="Delete conversation?"
      description={
        <>“{target?.title}” and its messages will be permanently removed from this device.</>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={working}
            onClick={() => {
              if (!target) return
              setWorking(true)
              onConfirm(target.id)
                .catch((err: unknown) => setError(ipcErrorMessage(err)))
                .finally(() => setWorking(false))
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Delete
          </Button>
        </>
      }
    >
      {error && <p className="text-sm text-primary">{error}</p>}
    </Dialog>
  )
}
