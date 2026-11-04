import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { useMediaQuery } from '@renderer/hooks/useMediaQuery'
import { readPreference, writePreference } from '@renderer/lib/preferences'
import { DEFAULT_PRIMARY_HUE, isHue } from './palette'
import { ThemeContext, isThemeMode, type ThemeContextValue, type ThemeMode } from './theme-context'

const MODE_KEY = 'teachmate.theme.mode'
const HUE_KEY = 'teachmate.theme.primaryHue'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    readPreference(MODE_KEY, 'system', isThemeMode),
  )
  const [primaryHue, setHueState] = useState<number>(() =>
    readPreference(HUE_KEY, DEFAULT_PRIMARY_HUE, isHue),
  )
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const resolvedTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--primary-hue', String(primaryHue))
  }, [primaryHue])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    writePreference(MODE_KEY, next)
  }, [])

  const setPrimaryHue = useCallback((hue: number) => {
    const next = Math.round(Math.min(360, Math.max(0, hue)))
    setHueState(next)
    writePreference(HUE_KEY, next)
  }, [])

  const toggleTheme = useCallback(
    () => setMode(resolvedTheme === 'dark' ? 'light' : 'dark'),
    [resolvedTheme, setMode],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedTheme, setMode, toggleTheme, primaryHue, setPrimaryHue }),
    [mode, resolvedTheme, setMode, toggleTheme, primaryHue, setPrimaryHue],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
