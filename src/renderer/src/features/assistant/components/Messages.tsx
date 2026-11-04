import { useState } from 'react'
import {
  LoaderCircle,
  Pencil,
  RefreshCw,
  RotateCw,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
} from 'lucide-react'
import type { ProviderInfo } from '@shared/ai'
import type { ChatMessage, HandoffRecord } from '@shared/conversations'
import { Button } from '@renderer/components/ui/Button'
import { CopyButton } from '@renderer/components/ui/CopyButton'
import { IconButton } from '@renderer/components/ui/IconButton'
import { IconTile } from '@renderer/components/ui/IconTile'
import { Markdown } from '@renderer/components/ui/Markdown'
import { formatRelativeTime } from '@renderer/lib/format'
import { AttachmentChip } from '@renderer/components/ai/AttachmentChip'
import { HandoffPanel } from '@renderer/components/ai/HandoffPanel'

const time = (iso: string) => formatRelativeTime(new Date(iso))

// ── User ───────────────────────────────────────────────────────────────────

export function UserMessage({
  message,
  busy,
  onEditAndResend,
}: {
  message: ChatMessage
  busy: boolean
  onEditAndResend: (content: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)

  return (
    <div className="group flex flex-col items-end gap-1.5" data-role="user">
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
          {message.attachments.map((a) => (
            <AttachmentChip key={a.id} attachment={a} />
          ))}
        </div>
      )}

      {editing ? (
        <div className="w-full max-w-[85%] rounded-2xl border border-primary/50 bg-surface p-3 shadow-card">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(10, Math.max(2, draft.split('\n').length))}
            aria-label="Edit message"
            className="block w-full resize-y bg-transparent text-sm leading-6 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Messages after this one will be replaced.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setDraft(message.content)
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!draft.trim() || busy}
                onClick={() => {
                  setEditing(false)
                  onEditAndResend(draft)
                }}
              >
                Save & resend
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-soft px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap text-foreground">
          {message.content}
        </div>
      )}

      {!editing && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <span className="mr-1 text-[11px] text-muted-foreground">{time(message.createdAt)}</span>
          <CopyButton text={message.content} label="Copy message" />
          <IconButton
            label="Edit and resend"
            disabled={busy}
            onClick={() => {
              setDraft(message.content)
              setEditing(true)
            }}
          >
            <Pencil className="size-4" aria-hidden />
          </IconButton>
        </div>
      )}
    </div>
  )
}

// ── Assistant ──────────────────────────────────────────────────────────────

function AssistantAvatar() {
  return <IconTile icon={Sparkles} size="sm" tone="soft" className="mt-0.5" />
}

export function AssistantMessage({
  message,
  providerName,
  busy,
  canRegenerate,
  onRegenerate,
}: {
  message: ChatMessage
  providerName: string
  busy: boolean
  canRegenerate: boolean
  onRegenerate: () => void
}) {
  const label = message.source === 'pasted' ? 'Response pasted from Claude Code' : providerName
  return (
    <div className="group flex gap-3" data-role="assistant">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
        <Markdown>{message.content}</Markdown>
        <div className="mt-1 flex items-center gap-0.5">
          <CopyButton text={message.content} label="Copy response" />
          {canRegenerate && (
            <IconButton label="Regenerate response" disabled={busy} onClick={onRegenerate}>
              <RefreshCw className="size-4" aria-hidden />
            </IconButton>
          )}
          <span className="ml-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {time(message.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Live output from a streaming provider (not used by the handoff provider). */
export function StreamingMessage({ text, providerName }: { text: string; providerName: string }) {
  return (
    <div className="flex gap-3" aria-live="polite">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground">{providerName}</p>
        <Markdown>{text}</Markdown>
      </div>
    </div>
  )
}

export function PendingIndicator({ provider }: { provider: ProviderInfo }) {
  const label = provider.capabilities.returnsResponse
    ? 'Thinking…'
    : 'Preparing your prompt for Claude Code…'
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <AssistantAvatar />
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {label}
      </span>
    </div>
  )
}

export function TurnErrorBanner({
  message,
  onRetry,
  busy,
}: {
  message: string
  onRetry: () => void
  busy: boolean
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">Something went wrong</p>
        <p className="mt-0.5">{message}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry} disabled={busy}>
        <RotateCw className="size-3.5" aria-hidden />
        Try again
      </Button>
    </div>
  )
}

// ── Handoff ────────────────────────────────────────────────────────────────

export function HandoffCard({
  message,
  busy,
  onPasteResponse,
  onSendAgain,
}: {
  message: ChatMessage
  busy: boolean
  onPasteResponse: () => void
  onSendAgain: () => void
}) {
  return (
    <div className="flex gap-3" data-role="handoff">
      <IconTile icon={SquareTerminal} size="sm" tone="muted" className="mt-0.5" />
      <HandoffPanel
        className="min-w-0 flex-1"
        handoff={message.handoff as HandoffRecord}
        createdAt={message.createdAt}
        busy={busy}
        context="conversation"
        onPasteReply={onPasteResponse}
        onPrepareAgain={onSendAgain}
      />
    </div>
  )
}
