import { BrowserWindow, clipboard, dialog } from 'electron'
import { stat } from 'node:fs/promises'
import { IpcChannel } from '@shared/ipc'
import { isValidWorkspacePath } from '../ai/handoff/prompt'
import { parseTeacherProfile, parseTeachingDefaults } from '../storage/settings-store'
import type { Services } from '../services'
import { expectString, handle } from './handle'

const CLIPBOARD_MAX_CHARS = 2_000_000

export function registerSettingsHandlers({ settings }: Services): void {
  handle(IpcChannel.SettingsGet, () => settings.get())

  handle(IpcChannel.SettingsChooseClaudeWorkspace, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose your Claude Code workspace folder',
      properties: ['openDirectory', 'createDirectory'],
    }
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const folder = filePaths[0]
    if (canceled || !folder) return settings.get()
    if (!isValidWorkspacePath(folder) || !(await stat(folder)).isDirectory()) {
      throw new Error('Choose a local folder (network paths are not supported by Claude Code).')
    }
    return settings.update({ claudeCodeWorkspace: folder })
  })

  handle(IpcChannel.SettingsClearClaudeWorkspace, () =>
    settings.update({ claudeCodeWorkspace: null }),
  )

  handle(IpcChannel.SettingsUpdateTeaching, (_e, defaults) =>
    settings.update({ teaching: parseTeachingDefaults(defaults) }),
  )

  handle(IpcChannel.SettingsUpdateProfile, (_e, profile) =>
    settings.update({ profile: parseTeacherProfile(profile) }),
  )

  // Clipboard writes go through main: the renderer's permission handler denies clipboard access.
  handle(IpcChannel.ClipboardWriteText, (_e, text) => {
    clipboard.writeText(expectString(text, 'Text', CLIPBOARD_MAX_CHARS))
  })
}
