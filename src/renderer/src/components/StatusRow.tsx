import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'

export type Status = 'ok' | 'fail' | 'pending'

interface StatusRowProps {
  label: string
  status: Status
  detail?: string
}

export function StatusRow({ label, status, detail }: StatusRowProps) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        {status === 'ok' && <CircleCheck className="size-5 text-success" aria-hidden />}
        {status === 'fail' && <CircleX className="size-5 text-primary" aria-hidden />}
        {status === 'pending' && (
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-hidden />
        )}
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      {detail && <span className="truncate text-sm text-muted-foreground">{detail}</span>}
    </li>
  )
}
