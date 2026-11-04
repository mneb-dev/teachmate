import { access, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, type WebContents } from 'electron'

/** Characters Windows/macOS don't allow in file names. */
export function safeFileName(title: string): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex -- strip control characters from file names
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return cleaned || 'TeachMate document'
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export interface SaveFileOptions {
  title: string
  defaultName: string
  extension: 'docx' | 'md'
  filterName: string
}

/**
 * Ask where to save, then write the file. An existing file is only replaced
 * after the teacher confirms it explicitly. Returns the path, or null when
 * canceled.
 */
export async function saveWithConfirmation(
  sender: WebContents,
  data: Buffer | string,
  o: SaveFileOptions,
): Promise<string | null> {
  const window = BrowserWindow.fromWebContents(sender) ?? undefined
  const options: Electron.SaveDialogOptions = {
    title: o.title,
    defaultPath: join(app.getPath('documents'), `${o.defaultName}.${o.extension}`),
    filters: [{ name: o.filterName, extensions: [o.extension] }],
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  }
  const { canceled, filePath } = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return null

  const path = filePath.toLowerCase().endsWith(`.${o.extension}`)
    ? filePath
    : `${filePath}.${o.extension}`
  if (await exists(path)) {
    const box: Electron.MessageBoxOptions = {
      type: 'warning',
      buttons: ['Replace', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: 'Replace file?',
      message: `“${basename(path)}” already exists.`,
      detail: 'Do you want to replace it? The existing file will be overwritten.',
    }
    const { response } = window
      ? await dialog.showMessageBox(window, box)
      : await dialog.showMessageBox(box)
    if (response !== 0) return null
  }
  await writeFile(path, data)
  return path
}
