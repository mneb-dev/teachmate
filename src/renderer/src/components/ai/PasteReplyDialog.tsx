import { useState, type ClipboardEvent } from 'react'
import { Info } from 'lucide-react'
import { cleanPastedReply } from '@shared/paste'
import { Button } from '@renderer/components/ui/Button'
import { Dialog } from '@renderer/components/ui/Dialog'
import { ipcErrorMessage } from '@renderer/lib/ipc'

interface PasteReplyDialogProps {
  open: boolean
  onClose: () => void
  onSave: (content: string) => Promise<void>
  title?: string
  description?: string
  confirmLabel?: string
}

/** Lets the teacher paste a reply copied from Claude Code. The text is theirs, never generated here. */
export function PasteReplyDialog({
  open,
  onClose,
  onSave,
  title = 'Paste Claude’s reply',
  description = 'Copy the reply from Claude Code (type /copy there for an exact copy) and paste it here. It will be labelled as pasted from Claude Code.',
  confirmLabel = 'Add reply',
}: PasteReplyDialogProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** What the last paste looked like: cleaned up, and/or copied from the terminal display. */
  const [pasted, setPasted] = useState<{ changed: boolean; fromTerminal: boolean } | null>(null)

  const close = () => {
    setContent('')
    setError(null)
    setPasted(null)
    onClose()
  }

  // Text selected in the Claude Code terminal carries display artifacts
  // (response marker, indentation, drawn tables); clean them up as it is pasted.
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData('text/plain')
    if (!raw) return
    const cleaned = cleanPastedReply(raw)
    setPasted({ changed: cleaned.changed, fromTerminal: cleaned.fromTerminal })
    if (!cleaned.changed) return
    e.preventDefault()
    const el = e.currentTarget
    const next = content.slice(0, el.selectionStart) + cleaned.text + content.slice(el.selectionEnd)
    setContent(next)
  }

  const save = () => {
    setSaving(true)
    setError(null)
    onSave(content)
      .then(() => {
        setContent('')
        setPasted(null)
      })
      .catch((err: unknown) => setError(ipcErrorMessage(err)))
      .finally(() => setSaving(false))
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" disabled={!content.trim() || saving} onClick={save}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <textarea
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onPaste={onPaste}
        rows={14}
        aria-label="Reply from Claude Code"
        placeholder="Paste the reply from Claude Code…"
        className="block w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs leading-5 focus:border-primary/60 focus:outline-none"
      />
      {pasted?.fromTerminal ? (
        <p
          role="status"
          className="mt-2 flex items-start gap-2 rounded-lg bg-primary-soft px-3 py-2 text-xs leading-5 text-primary-soft-foreground"
        >
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            This looks like text selected in the terminal. TeachMate removed the terminal spacing
            and converted drawn tables, but headings and bold text can’t be recovered. For an exact
            copy, type <code className="font-mono font-semibold">/copy</code> in Claude Code and
            paste again.
          </span>
        </p>
      ) : (
        pasted?.changed && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            Terminal spacing was removed from the pasted text.
          </p>
        )
      )}
      {error && <p className="mt-2 text-sm text-primary">{error}</p>}
    </Dialog>
  )
}
