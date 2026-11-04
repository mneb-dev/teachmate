import { app } from 'electron'
import type { AppInfo, PingResult } from '@shared/ipc'

const MAX_PING_LENGTH = 200

export function getAppInfo(): AppInfo {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
    isPackaged: app.isPackaged,
    dataPath: app.getPath('userData'),
  }
}

export function ping(message: unknown): PingResult {
  if (typeof message !== 'string' || message.length > MAX_PING_LENGTH) {
    throw new TypeError(`ping expects a string of at most ${MAX_PING_LENGTH} characters`)
  }
  console.log(`[ipc] app:ping received "${message}"`)
  return { message: `pong: ${message}`, receivedAt: new Date().toISOString() }
}
