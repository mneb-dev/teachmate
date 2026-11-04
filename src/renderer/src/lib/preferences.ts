/**
 * Small per-device UI preferences (theme, sidebar state) kept in localStorage.
 * Real application data will be stored by the main process. Storage access
 * can throw (for example when storage is blocked), so every call is guarded.
 */
export function readPreference<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function writePreference(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Non-critical: the preference simply won't persist.
  }
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}
