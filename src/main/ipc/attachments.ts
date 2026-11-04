import { basename } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import { LIMITS } from '@shared/conversations'
import { IpcChannel, type PickAttachmentsResult } from '@shared/ipc'
import { extractAttachment } from '../attachments/extract'
import { handle } from './handle'

export function registerAttachmentHandlers(): void {
  // The renderer never passes a path: files are chosen in the native dialog here.
  handle(IpcChannel.AttachmentsPick, async (event): Promise<PickAttachmentsResult> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Attach documents',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['docx', 'pdf', 'txt', 'md'] },
        { name: 'Word documents', extensions: ['docx'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Text and Markdown', extensions: ['txt', 'md'] },
      ],
    }
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (canceled) return { attachments: [], errors: [] }

    const result: PickAttachmentsResult = { attachments: [], errors: [] }
    for (const filePath of filePaths.slice(0, LIMITS.attachmentsPerMessage)) {
      try {
        result.attachments.push(await extractAttachment(filePath))
      } catch (err) {
        result.errors.push({ name: basename(filePath), reason: (err as Error).message })
      }
    }
    for (const filePath of filePaths.slice(LIMITS.attachmentsPerMessage)) {
      result.errors.push({
        name: basename(filePath),
        reason: `Only ${LIMITS.attachmentsPerMessage} files can be attached at a time.`,
      })
    }
    return result
  })
}
