import type { TeachMateApi } from '@shared/ipc'

/**
 * Typed access to the preload bridge. Components should import from here
 * rather than touching `window.teachmate` directly, so the bridge can be
 * mocked or swapped in one place.
 */
export const teachmate: TeachMateApi = window.teachmate

/**
 * Errors thrown in the main process arrive as
 * "Error invoking remote method 'x': Error: <message>". Return just the message.
 */
export function ipcErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
}
