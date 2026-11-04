import { useState } from 'react'
import { Library, LoaderCircle, Paperclip, TriangleAlert } from 'lucide-react'
import type { Attachment } from '@shared/conversations'
import { DOCUMENT_LIMITS } from '@shared/documents'
import type { AttachmentError } from '@shared/ipc'
import { AttachmentChip } from '@renderer/components/ai/AttachmentChip'
import { LibraryPickerDialog } from '@renderer/components/library/LibraryPickerDialog'
import { Button } from '@renderer/components/ui/Button'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

/** Attach DOCX/PDF/TXT/MD reference documents (text is extracted in the main process). */
export function ReferencePicker({
  value,
  onChange,
  disabled,
}: {
  value: Attachment[]
  onChange: (value: Attachment[]) => void
  disabled?: boolean
}) {
  const [picking, setPicking] = useState(false)
  const [errors, setErrors] = useState<AttachmentError[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const max = DOCUMENT_LIMITS.referencesPerDocument

  const pick = async () => {
    setPicking(true)
    setErrors([])
    try {
      const { attachments, errors: pickErrors } = await teachmate.attachments.pick()
      const room = Math.max(0, max - value.length)
      const accepted = attachments.slice(0, room)
      const overflow = attachments.slice(room).map((a) => ({
        name: a.name,
        reason: `Only ${max} reference documents can be attached.`,
      }))
      if (accepted.length) onChange([...value, ...accepted])
      setErrors([...pickErrors, ...overflow])
    } catch (err) {
      setErrors([{ name: 'Attachment', reason: ipcErrorMessage(err) }])
    } finally {
      setPicking(false)
    }
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-col gap-2" aria-label="Reference documents">
          {value.map((a) => (
            <AttachmentChip
              key={a.id}
              attachment={a}
              className="w-full"
              onRemove={disabled ? undefined : () => onChange(value.filter((x) => x.id !== a.id))}
            />
          ))}
        </div>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => void pick()}
        disabled={disabled || picking || value.length >= max}
      >
        {picking ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <Paperclip className="size-4" aria-hidden />
        )}
        Attach reference documents
      </Button>{' '}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLibraryOpen(true)}
        disabled={disabled || value.length >= max}
      >
        <Library className="size-4" aria-hidden />
        From library
      </Button>
      <LibraryPickerDialog
        open={libraryOpen}
        title="Add a reference from Teaching Resources"
        onClose={() => setLibraryOpen(false)}
        onPick={(resource) => {
          setLibraryOpen(false)
          teachmate.resources
            .asAttachment(resource.id)
            .then((a) => onChange([...value, a]))
            .catch((err: unknown) =>
              setErrors([{ name: resource.title, reason: ipcErrorMessage(err) }]),
            )
        }}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        DOCX, PDF, TXT or MD — e.g. a curriculum guide, MELC/MATATAG/ILAW competency list or textbook
        pages. Up to {max}.
      </p>
      {errors.length > 0 && (
        <ul
          role="alert"
          className="mt-2 space-y-0.5 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-xs text-primary-soft-foreground"
        >
          {errors.map((e, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{e.name}:</span> {e.reason}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
