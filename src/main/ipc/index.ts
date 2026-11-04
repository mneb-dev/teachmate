import { IpcChannel } from '@shared/ipc'
import type { Services } from '../services'
import { registerAiHandlers } from './ai'
import { getAppInfo, ping } from './app'
import { registerAttachmentHandlers } from './attachments'
import { registerConversationHandlers } from './conversations'
import { registerDocumentHandlers } from './documents'
import { registerExportHandlers } from './export'
import { registerResourceHandlers } from './resources'
import { handle } from './handle'
import { registerSettingsHandlers } from './settings'

export function registerIpcHandlers(services: Services): void {
  handle(IpcChannel.AppGetInfo, () => getAppInfo())
  handle(IpcChannel.AppPing, (_event, message) => ping(message))

  registerConversationHandlers(services)
  registerAttachmentHandlers()
  registerAiHandlers(services)
  registerDocumentHandlers(services)
  registerExportHandlers(services)
  registerResourceHandlers(services)
  registerSettingsHandlers(services)
}
