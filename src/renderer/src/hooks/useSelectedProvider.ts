import { useCallback, useState } from 'react'
import type { ProviderInfo } from '@shared/ai'
import { readPreference, writePreference } from '@renderer/lib/preferences'
import { useProviders } from './useProviders'

const PROVIDER_KEY = 'teachmate.ai.providerId'
const isString = (v: unknown): v is string => typeof v === 'string'

/** The provider the teacher picked (shared across tools), falling back to the first available. */
export function useSelectedProvider() {
  const state = useProviders()
  const providers = state.status === 'ok' ? state.providers : []
  const [id, setIdState] = useState(() => readPreference(PROVIDER_KEY, '', isString))
  const provider: ProviderInfo | null = providers.find((p) => p.id === id) ?? providers[0] ?? null
  const setProviderId = useCallback((next: string) => {
    setIdState(next)
    writePreference(PROVIDER_KEY, next)
  }, [])
  return { providers, provider, setProviderId, status: state.status }
}
