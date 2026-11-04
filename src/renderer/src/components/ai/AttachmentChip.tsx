import { FileText, X } from 'lucide-react'
import type { Attachment } from '@shared/conversations'
import { cn } from '@renderer/lib/cn'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AttachmentChip({
  attachment,
  onRemove,
  className,
}: {
  attachment: Attachment
  onRemove?: () => void
  className?: string
}) {
  const detail = `${attachment.kind.toUpperCase()} · ${formatSize(attachment.size)}${attachment.truncated ? ' · truncated' : ''}`
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-surface py-1.5 pr-1.5 pl-2.5 text-sm',
        !onRemove && 'pr-2.5',
        className,
      )}
      title={
        attachment.truncated
          ? `Only the first ${attachment.text.length.toLocaleString()} of ${attachment.charCount.toLocaleString()} characters will be used.`
          : `${attachment.charCount.toLocaleString()} characters of text`
      }
    >
      <FileText className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate font-medium">{attachment.name}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${attachment.name}`}
          title="Remove attachment"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </span>
  )
}
