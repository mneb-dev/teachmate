import { Button } from '@renderer/components/ui/Button'
import { CopyButton } from '@renderer/components/ui/CopyButton'
import { Dialog } from '@renderer/components/ui/Dialog'
import type { DocumentPromptPreview } from '@shared/documents'

/** Shows the exact prompt TeachMate will send, so the teacher can check it first. */
export function PromptPreviewDialog({
  preview,
  onClose,
  onSend,
  sendLabel,
}: {
  preview: DocumentPromptPreview | null
  onClose: () => void
  onSend: () => void
  sendLabel: string
}) {
  return (
    <Dialog
      open={preview !== null}
      onClose={onClose}
      title="Prompt preview"
      description={
        preview
          ? `This is exactly what will be sent (${preview.chars.toLocaleString()} characters), built from your saved form and reference documents.`
          : undefined
      }
      className="max-w-3xl"
      footer={
        <>
          {preview && <CopyButton text={preview.markdown} label="Copy prompt" />}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={onSend}>
            {sendLabel}
          </Button>
        </>
      }
    >
      <pre
        className="max-h-[55vh] overflow-auto rounded-lg border border-border bg-surface-muted p-4 font-mono text-xs leading-5 whitespace-pre-wrap"
        aria-label="Prompt"
      >
        {preview?.markdown}
      </pre>
    </Dialog>
  )
}
