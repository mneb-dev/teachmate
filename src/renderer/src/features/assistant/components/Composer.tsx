import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp, LoaderCircle, Paperclip, Square, TriangleAlert } from 'lucide-react'
import type { ProviderInfo } from '@shared/ai'
import { LIMITS, type Attachment } from '@shared/conversations'
import type { AttachmentError } from '@shared/ipc'
import { IconButton } from '@renderer/components/ui/IconButton'
import { cn } from '@renderer/lib/cn'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'
import { AttachmentChip } from '@renderer/components/ai/AttachmentChip'

const MAX_TEXTAREA_PX = 240

interface ComposerProps {
  text: string
  onTextChange: (text: string) => void
  attachments: Attachment[]
  onAttachmentsChange: (attachments: Attachment[]) => void
  onSend: () => void
  onStop: () => void
  provider: ProviderInfo | null
  busy: boolean
  disabled?: boolean
}

export function Composer({
  text,
  onTextChange,
  attachments,
  onAttachmentsChange,
  onSend,
  onStop,
  provider,
  busy,
  disabled = false,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [picking, setPicking] = useState(false)
  const [attachErrors, setAttachErrors] = useState<AttachmentError[]>([])

  // Grow the textarea with its content, up to a maximum height.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`
  }, [text])

  const canAttach = !disabled && !busy && (provider?.capabilities.attachments ?? false)
  const canSend = !disabled && !busy && text.trim().length > 0
  const canStop = busy && (provider?.capabilities.cancellation ?? false)

  const pickFiles = async () => {
    setPicking(true)
    setAttachErrors([])
    try {
      const { attachments: picked, errors } = await teachmate.attachments.pick()
      const room = LIMITS.attachmentsPerMessage - attachments.length
      const accepted = picked.slice(0, Math.max(0, room))
      const overflow = picked.slice(accepted.length).map((a) => ({
        name: a.name,
        reason: `Only ${LIMITS.attachmentsPerMessage} files can be attached to one message.`,
      }))
      if (accepted.length) onAttachmentsChange([...attachments, ...accepted])
      setAttachErrors([...errors, ...overflow])
    } catch (err) {
      setAttachErrors([{ name: 'Attachment', reason: ipcErrorMessage(err) }])
    } finally {
      setPicking(false)
    }
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    setAttachErrors([])
    onSend()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const hint = provider
    ? provider.capabilities.returnsResponse
      ? 'Enter to send · Shift + Enter for a new line'
      : 'Enter to prepare for Claude Code · Shift + Enter for a new line · The reply appears in Claude Code, not here'
    : 'No AI provider available'

  return (
    <div className="border-t border-border bg-background px-4 pt-3 pb-4 sm:px-6">
      <form
        onSubmit={submit}
        className={cn(
          'mx-auto max-w-3xl rounded-2xl border border-border bg-surface shadow-card transition-colors focus-within:border-primary/50',
          disabled && 'opacity-60',
        )}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Attachments">
            {attachments.map((a) => (
              <AttachmentChip
                key={a.id}
                attachment={a}
                className="max-w-64"
                onRemove={
                  busy
                    ? undefined
                    : () => onAttachmentsChange(attachments.filter((x) => x.id !== a.id))
                }
              />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          maxLength={LIMITS.messageMaxChars}
          placeholder="Ask about lesson plans, objectives, assessments…"
          aria-label="Message"
          className="block max-h-60 w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm leading-6 placeholder:text-muted-foreground focus:outline-none"
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <IconButton
            label={`Attach files (DOCX, PDF, TXT, MD · up to ${LIMITS.attachmentsPerMessage})`}
            onClick={() => void pickFiles()}
            disabled={!canAttach || picking || attachments.length >= LIMITS.attachmentsPerMessage}
            className="size-9"
          >
            {picking ? (
              <LoaderCircle className="size-[18px] animate-spin" aria-hidden />
            ) : (
              <Paperclip className="size-[18px]" aria-hidden />
            )}
          </IconButton>

          {canStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="flex size-9 cursor-pointer items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-85"
            >
              <Square className="size-3.5 fill-current" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label={
                provider?.capabilities.returnsResponse === false
                  ? 'Prepare for Claude Code'
                  : 'Send message'
              }
              title={
                provider?.capabilities.returnsResponse === false
                  ? 'Prepare for Claude Code'
                  : 'Send message'
              }
              className="flex size-9 cursor-pointer items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden />
              )}
            </button>
          )}
        </div>
      </form>

      {attachErrors.length > 0 && (
        <div
          role="alert"
          className="mx-auto mt-2 flex max-w-3xl items-start gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-xs text-primary-soft-foreground"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <ul className="flex-1 space-y-0.5">
            {attachErrors.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.name}:</span> {e.reason}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setAttachErrors([])}
            className="cursor-pointer font-medium underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}
