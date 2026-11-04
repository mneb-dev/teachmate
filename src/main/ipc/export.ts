import { shell } from 'electron'
import { IpcChannel, type ExportVariant } from '@shared/ipc'
import { documentToDocx } from '../export/docx'
import { documentToMarkdown } from '../export/markdown'
import { assertSafeId } from '../lib/ids'
import type { Services } from '../services'
import { prepareTos } from '../storage/document-store'
import { expectString, handle } from './handle'
import { safeFileName, saveWithConfirmation } from './save-file'

export function registerExportHandlers({ documents }: Services): void {
  /** Only files exported in this session may be revealed. */
  const exported = new Set<string>()

  handle(IpcChannel.DocumentsExportDocx, async (event, documentId, rawVariant) => {
    const variant: ExportVariant = rawVariant === 'student' ? 'student' : 'full'
    let doc = await documents.require(assertSafeId(documentId, 'document id'))
    if (doc.kind === 'tos') doc = prepareTos(doc)

    // Build first so calculation or content problems are reported before the dialog opens.
    const buffer = await documentToDocx(doc, variant)
    const suffix =
      variant === 'student'
        ? ' (learner copy)'
        : doc.kind === 'assessment'
          ? ' (with answer key)'
          : ''
    const path = await saveWithConfirmation(event.sender, buffer, {
      title: 'Export to Word',
      defaultName: `${safeFileName(doc.title)}${suffix}`,
      extension: 'docx',
      filterName: 'Word document',
    })
    if (!path) return { status: 'canceled' as const }
    exported.add(path)
    return { status: 'saved' as const, path }
  })

  handle(IpcChannel.DocumentsExportMarkdown, async (event, documentId) => {
    const doc = await documents.require(assertSafeId(documentId, 'document id'))
    const markdown = documentToMarkdown(doc)
    const path = await saveWithConfirmation(event.sender, markdown, {
      title: 'Export to Markdown',
      defaultName: safeFileName(doc.title),
      extension: 'md',
      filterName: 'Markdown',
    })
    if (!path) return { status: 'canceled' as const }
    exported.add(path)
    return { status: 'saved' as const, path }
  })

  handle(IpcChannel.DocumentsRevealExport, (_e, rawPath) => {
    const path = expectString(rawPath, 'Path', 2048)
    if (!exported.has(path)) throw new Error('Only files exported by TeachMate can be shown.')
    shell.showItemInFolder(path)
  })
}
