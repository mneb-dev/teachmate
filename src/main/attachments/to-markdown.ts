import { readFile } from 'node:fs/promises'
import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import type { AttachmentKind } from '@shared/conversations'
import { DOCUMENT_LIMITS } from '@shared/documents'

/**
 * Convert an imported file to Markdown for editing as a document. Word files
 * keep headings, lists and emphasis; PDFs become plain text.
 */
export async function fileToMarkdown(path: string, kind: AttachmentKind): Promise<string> {
  let text: string
  switch (kind) {
    case 'md':
    case 'txt':
      text = await readFile(path, 'utf8')
      break
    case 'docx': {
      // convertToMarkdown exists at runtime but is missing from mammoth's type definitions.
      const toMarkdown = (
        mammoth as unknown as {
          convertToMarkdown: (input: { path: string }) => Promise<{ value: string }>
        }
      ).convertToMarkdown
      // Mammoth escapes punctuation (".", "(", "!") defensively; keep the escape only where a
      // line would otherwise turn into a numbered list ("1\.").
      text = (await toMarkdown({ path })).value.replace(/(?<!^\s*\d+)\\([.()!])/gm, '$1')
      break
    }
    case 'pdf': {
      const pdf = await getDocumentProxy(new Uint8Array(await readFile(path)))
      text = (await extractText(pdf, { mergePages: true })).text
      break
    }
  }
  const normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!normalized) throw new Error('The file contains no text.')
  return normalized.slice(0, DOCUMENT_LIMITS.contentMaxChars)
}
