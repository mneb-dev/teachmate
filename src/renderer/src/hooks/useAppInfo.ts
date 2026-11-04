import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import { teachmate } from '@renderer/lib/ipc'

export type AppInfoState =
  { status: 'pending' } | { status: 'ok'; data: AppInfo } | { status: 'fail'; error: string }

/** Fetches app and environment info from the main process once. */
export function useAppInfo(): AppInfoState {
  const [state, setState] = useState<AppInfoState>({ status: 'pending' })

  useEffect(() => {
    let cancelled = false
    teachmate.app
      .getInfo()
      .then((data) => !cancelled && setState({ status: 'ok', data }))
      .catch((err: unknown) => !cancelled && setState({ status: 'fail', error: String(err) }))
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
