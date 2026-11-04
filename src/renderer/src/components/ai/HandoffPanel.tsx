import { useState, type ReactNode } from 'react'
import {
  CircleCheck,
  CircleX,
  ClipboardPaste,
  Copy,
  FileSearch,
  Info,
  RefreshCw,
  SquareTerminal,
  X,
} from 'lucide-react'
import type { HandoffRecord } from '@shared/conversations'
import { Button } from '@renderer/components/ui/Button'
import { cn } from '@renderer/lib/cn'
import { formatRelativeTime } from '@renderer/lib/format'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

function Step({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      ) : (
        <CircleX className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      )}
      <span>{children}</span>
    </li>
  )
}

interface HandoffPanelProps {
  handoff: HandoffRecord
  createdAt: string
  busy: boolean
  onPasteReply: () => void
  onPrepareAgain: () => void
  /** Wording: a chat conversation or a document being generated. */
  context: 'conversation' | 'document'
  title?: string
  className?: string
}

/** Status and follow-up actions for a prompt handed off to Claude Code. */
export function HandoffPanel({
  handoff,
  createdAt,
  busy,
  onPasteReply,
  onPrepareAgain,
  context,
  title = 'Continue in Claude Code',
  className,
}: HandoffPanelProps) {
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    try {
      const result = await action()
      setFeedback(
        result.ok ? { ok: true, text: success } : { ok: false, text: result.error ?? 'Failed' },
      )
    } catch (err) {
      setFeedback({ ok: false, text: ipcErrorMessage(err) })
    }
  }

  const docs =
    handoff.attachmentCount > 0
      ? ` and ${handoff.attachmentCount} document${handoff.attachmentCount === 1 ? '' : 's'}`
      : ''

  return (
    <div
      className={cn('rounded-2xl border border-border bg-surface p-4 shadow-card', className)}
      data-role="handoff-panel"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-[11px] text-muted-foreground">
          {formatRelativeTime(new Date(createdAt))}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5 text-sm">
        <Step ok>
          Prompt prepared ({handoff.promptChars.toLocaleString()} characters{docs})
        </Step>
        <Step ok={handoff.copiedToClipboard}>
          {handoff.copiedToClipboard
            ? 'Copied to your clipboard'
            : 'Could not copy to the clipboard'}
        </Step>
        <Step ok={handoff.openedExternally}>
          {handoff.openedExternally
            ? 'Claude Code opened with your prompt pre-filled — review it and press Enter to send'
            : `Claude Code did not open${handoff.openError ? `: ${handoff.openError}` : ''}`}
        </Step>
      </ul>

      {handoff.usedFileReference && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          The prompt was too long to pre-fill, so Claude Code is asked to read the saved prompt
          file. You can also paste the full prompt from your clipboard.
        </p>
      )}

      <p className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
        {context === 'conversation' ? (
          <>
            <span className="font-medium text-foreground">
              You continue this conversation in Claude Code.
            </span>{' '}
            Claude’s reply stays there — TeachMate doesn’t receive it. To keep it with this
            conversation, type <code className="font-mono font-medium text-foreground">/copy</code>{' '}
            in Claude Code to copy the reply, then use{' '}
            <span className="font-medium">Paste reply</span>.
          </>
        ) : (
          <>
            <span className="font-medium text-foreground">Continue in Claude Code.</span> TeachMate
            doesn’t receive Claude’s reply automatically. When it’s ready, type{' '}
            <code className="font-mono font-medium text-foreground">/copy</code> in Claude Code to
            copy the reply exactly (selecting it in the terminal loses headings and tables), then
            use <span className="font-medium">Paste reply</span> to put it into this document.
          </>
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            void run(() => teachmate.handoff.open(handoff.handoffId), 'Opened Claude Code')
          }
        >
          <SquareTerminal className="size-3.5" aria-hidden />
          Open Claude Code again
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            void run(() => teachmate.handoff.copyPrompt(handoff.handoffId), 'Prompt copied')
          }
        >
          <Copy className="size-3.5" aria-hidden />
          Copy prompt
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            void run(() => teachmate.handoff.revealFile(handoff.handoffId), 'Opened folder')
          }
        >
          <FileSearch className="size-3.5" aria-hidden />
          Show prompt file
        </Button>
        <Button variant="secondary" size="sm" onClick={onPrepareAgain} disabled={busy}>
          <RefreshCw className="size-3.5" aria-hidden />
          Prepare again
        </Button>
        <Button size="sm" onClick={onPasteReply}>
          <ClipboardPaste className="size-3.5" aria-hidden />
          Paste reply
        </Button>
      </div>

      {feedback && (
        <p
          role="status"
          className={cn(
            'mt-2 flex items-center gap-1.5 text-xs',
            feedback.ok ? 'text-success' : 'text-primary',
          )}
        >
          {feedback.text}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setFeedback(null)}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" aria-hidden />
          </button>
        </p>
      )}
    </div>
  )
}
