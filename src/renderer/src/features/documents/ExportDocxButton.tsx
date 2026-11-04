import { useState } from 'react'
import { CircleCheck, FileDown, FolderOpen, LoaderCircle } from 'lucide-react'
import type { ExportVariant } from '@shared/ipc'
import { Button } from '@renderer/components/ui/Button'
import { Dialog } from '@renderer/components/ui/Dialog'
import { cn } from '@renderer/lib/cn'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'
import type { DocumentEditor } from './useDocumentEditor'

const VARIANTS: Array<{ value: ExportVariant; label: string; description: string }> = [
  {
    value: 'full',
    label: 'Teacher copy',
    description: 'Everything, including the answer key, scoring guide and Bloom’s summary.',
  },
  {
    value: 'student',
    label: 'Learner copy',
    description: 'Questions only, with a Name / Section / Date / Score line. No answers.',
  },
]

/** Export the document to .docx. Assessments can be exported with or without answers. */
export function ExportDocxButton({
  editor,
  disabled,
  withVariants,
}: {
  editor: DocumentEditor
  disabled?: boolean
  /** Offer teacher/learner copies (assessments). */
  withVariants?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [variant, setVariant] = useState<ExportVariant>('full')
  const [saved, setSaved] = useState<string | null>(null)

  const run = async (v: ExportVariant) => {
    setOpen(false)
    setSaved(null)
    const result = await editor.exportDocx(v)
    if (result?.status === 'saved') setSaved(result.path)
  }

  const exporting = editor.busy === 'exporting'

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || editor.busy !== null}
        onClick={() => (withVariants ? setOpen(true) : void run('full'))}
      >
        {exporting ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <FileDown className="size-4" aria-hidden />
        )}
        Export to Word
      </Button>

      {saved && (
        <span
          role="status"
          className="order-last flex min-w-0 basis-full items-center gap-2 overflow-hidden text-xs text-success"
        >
          <CircleCheck className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate" title={saved}>
            Exported {saved.split(/[\\/]/).pop()}
          </span>
          <button
            type="button"
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 font-medium text-primary hover:text-primary-hover"
            onClick={() =>
              teachmate.documents
                .revealExport(saved)
                .catch((err: unknown) => editor.setError(ipcErrorMessage(err)))
            }
          >
            <FolderOpen className="size-3.5" aria-hidden />
            Show in folder
          </button>
        </span>
      )}

      {withVariants && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Export to Word"
          description="Choose which copy to create. You’ll be asked where to save it."
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void run(variant)}>
                <FileDown className="size-4" aria-hidden />
                Export
              </Button>
            </>
          }
        >
          <div role="radiogroup" aria-label="Copy to export" className="space-y-2">
            {VARIANTS.map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={variant === v.value}
                onClick={() => setVariant(v.value)}
                className={cn(
                  'w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors',
                  variant === v.value
                    ? 'border-primary/50 bg-primary-soft'
                    : 'border-border hover:bg-surface-muted',
                )}
              >
                <span className="block text-sm font-medium">{v.label}</span>
                <span className="block text-xs text-muted-foreground">{v.description}</span>
              </button>
            ))}
          </div>
        </Dialog>
      )}
    </>
  )
}
