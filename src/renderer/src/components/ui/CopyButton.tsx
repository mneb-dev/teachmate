import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { teachmate } from '@renderer/lib/ipc'
import { IconButton } from './IconButton'

/** Copies text via the main process clipboard and briefly confirms. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const t = setTimeout(() => setState('idle'), 1500)
    return () => clearTimeout(t)
  }, [state])

  const copy = () => {
    teachmate.clipboard
      .writeText(text)
      .then(() => setState('copied'))
      .catch(() => setState('failed'))
  }

  return (
    <IconButton
      label={state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
      onClick={copy}
    >
      {state === 'copied' ? (
        <Check className="size-4 text-success" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
    </IconButton>
  )
}
