import { useCallback, useEffect, useState } from 'react'
import type { ProviderInfo } from '@shared/ai'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

export type ProvidersState =
  | { status: 'loading' }
  | { status: 'ok'; providers: ProviderInfo[] }
  | { status: 'error'; error: string }

/** AI providers registered in the main process, with their live status. */
export function useProviders(): ProvidersState & { refresh: () => void } {
  const [state, setState] = useState<ProvidersState>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    teachmate.ai
      .listProviders()
      .then((providers) => !cancelled && setState({ status: 'ok', providers }))
      .catch(
        (err: unknown) => !cancelled && setState({ status: 'error', error: ipcErrorMessage(err) }),
      )
    return () => {
      cancelled = true
    }
  }, [version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, refresh }
}
