import { BrowserWindow, dialog, shell } from 'electron'
import { basename } from 'node:path'
import { DOCUMENT_KINDS, type DocumentKind, type TeachingDocument } from '@shared/documents'
import { IpcChannel } from '@shared/ipc'
import {
  RESOURCE_LIMITS,
  titleFromFileName,
  type ResourceFilter,
  type ResourceImportResult,
} from '@shared/resources'
import { fileToMarkdown } from '../attachments/to-markdown'
import { assertSafeId, newId } from '../lib/ids'
import type { Services } from '../services'
import { newDocument } from '../storage/document-store'
import { expectString, handle } from './handle'

const FILTERS: Electron.FileFilter[] = [
  { name: 'Documents', extensions: ['docx', 'pdf', 'txt', 'md'] },
  { name: 'Word documents', extensions: ['docx'] },
  { name: 'PDF', extensions: ['pdf'] },
  { name: 'Text and Markdown', extensions: ['txt', 'md'] },
]

/** Kinds whose content is free text and can therefore be imported from a file. */
export const IMPORTABLE_KINDS: readonly DocumentKind[] = [
  'lesson-plan',
  'learning-objectives',
  'learning-activities',
  'assessment',
  'performance-task',
  'annotation',
]

function parseFilter(value: unknown): ResourceFilter {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object') throw new Error('Invalid filter')
  const v = value as Record<string, unknown>
  const opt = (k: string) => (v[k] === undefined ? undefined : expectString(v[k], k, 500))
  return {
    query: opt('query'),
    subject: opt('subject'),
    gradeLevel: opt('gradeLevel'),
    tag: opt('tag'),
  }
}

async function pickFiles(sender: Electron.WebContents, multiple: boolean, title: string) {
  const window = BrowserWindow.fromWebContents(sender)
  const options: Electron.OpenDialogOptions = {
    title,
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: FILTERS,
  }
  const { canceled, filePaths } = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  return canceled ? [] : filePaths
}

export function registerResourceHandlers({ resources, documents, settings }: Services): void {
  /** Duplicates waiting for the teacher's "import anyway" (token → path picked in the dialog). */
  const pendingDuplicates = new Map<string, string>()

  handle(IpcChannel.ResourcesList, (_e, filter) => resources.list(parseFilter(filter)))
  handle(IpcChannel.ResourcesGet, (_e, id) => resources.get(assertSafeId(id)))

  handle(IpcChannel.ResourcesImport, async (event) => {
    const paths = await pickFiles(event.sender, true, 'Add teaching resources')
    const { teaching } = await settings.get()
    const result: ResourceImportResult = { imported: [], errors: [], duplicates: [] }
    for (const path of paths.slice(0, RESOURCE_LIMITS.filesPerImport)) {
      try {
        const outcome = await resources.importFile(path, {
          subject: teaching.subject,
          gradeLevel: teaching.gradeLevel,
        })
        if (outcome.status === 'imported') {
          result.imported.push(outcome.resource)
        } else {
          const token = newId()
          pendingDuplicates.set(token, path)
          result.duplicates.push({
            token,
            name: basename(path),
            existingTitle: outcome.existing.title,
            existingId: outcome.existing.id,
          })
        }
      } catch (err) {
        result.errors.push({ name: basename(path), reason: (err as Error).message })
      }
    }
    for (const path of paths.slice(RESOURCE_LIMITS.filesPerImport)) {
      result.errors.push({
        name: basename(path),
        reason: `Add at most ${RESOURCE_LIMITS.filesPerImport} files at a time.`,
      })
    }
    return result
  })

  handle(IpcChannel.ResourcesImportDuplicate, async (_e, token) => {
    const path = pendingDuplicates.get(assertSafeId(token, 'token'))
    if (!path) throw new Error('That file is no longer waiting to be added. Add it again.')
    pendingDuplicates.delete(token as string)
    const { teaching } = await settings.get()
    const outcome = await resources.importFile(
      path,
      { subject: teaching.subject, gradeLevel: teaching.gradeLevel },
      { allowDuplicate: true },
    )
    if (outcome.status !== 'imported') throw new Error('Could not add the file.')
    return outcome.resource
  })

  handle(IpcChannel.ResourcesUpdate, (_e, id, patch) => resources.update(assertSafeId(id), patch))
  handle(IpcChannel.ResourcesDelete, (_e, id) => resources.delete(assertSafeId(id)))
  handle(IpcChannel.ResourcesAsAttachment, (_e, id) => resources.toAttachment(assertSafeId(id)))

  handle(IpcChannel.ResourcesOpenOriginal, async (_e, id) => {
    const meta = await resources.require(assertSafeId(id))
    const error = await shell.openPath(resources.originalPath(meta))
    return error ? { ok: false, error } : { ok: true }
  })
  handle(IpcChannel.ResourcesReveal, async (_e, id) => {
    const meta = await resources.require(assertSafeId(id))
    shell.showItemInFolder(resources.originalPath(meta))
  })

  /**
   * Import a file as a new document of `kind`: the original goes into the
   * resource library (preserved) and its text becomes the document content.
   */
  handle(IpcChannel.DocumentsImport, async (event, rawKind) => {
    const kind = rawKind as DocumentKind
    if (!IMPORTABLE_KINDS.includes(kind)) {
      throw new Error(
        `${DOCUMENT_KINDS[kind]?.label ?? 'This document type'} can’t be imported from a file.`,
      )
    }
    const [path] = await pickFiles(
      event.sender,
      false,
      `Import a ${DOCUMENT_KINDS[kind].label.toLowerCase()}`,
    )
    if (!path) return null
    const { teaching } = await settings.get()
    const outcome = await resources.importFile(path, {
      subject: teaching.subject,
      gradeLevel: teaching.gradeLevel,
    })
    const resource = outcome.status === 'imported' ? outcome.resource : outcome.existing
    const content = await fileToMarkdown(resources.originalPath(resource), resource.kind)

    const doc = newDocument(kind, teaching) as TeachingDocument
    const imported = {
      ...doc,
      title: titleFromFileName(basename(path)),
      content,
      contentSource: 'imported' as const,
    }
    return documents.save(imported)
  })
}
