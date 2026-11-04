import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { IpcChannel, IpcContract } from '@shared/ipc'

export type Handler<C extends IpcChannel> = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => IpcContract[C]['result'] | Promise<IpcContract[C]['result']>

/**
 * Only accept IPC from our own renderer: the Vite dev server in development
 * or the bundled file:// page in production.
 */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const frameUrl = event.senderFrame?.url
  if (!frameUrl) return false
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl && frameUrl.startsWith(devUrl)) return true
  return frameUrl.startsWith('file://')
}

/** Register a handler for one whitelisted channel. Arguments arrive as `unknown` and must be validated. */
export function handle<C extends IpcChannel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (!isTrustedSender(event)) {
      throw new Error(`Blocked IPC call to "${channel}" from untrusted sender`)
    }
    return handler(event, ...args)
  })
}

export function expectString(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`)
  if (value.length > max) throw new Error(`${label} is too long`)
  return value
}
