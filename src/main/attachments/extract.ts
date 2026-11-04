import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import {
  ATTACHMENT_EXTENSIONS,
  LIMITS,
  type Attachment,
  type AttachmentKind,
} from '@shared/conversations'
import { newId } from '../lib/ids'

export function attachmentKindOf(filePath: string): AttachmentKind | null {
  const ext = extname(filePath).slice(1).toLowerCase()
  return (ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AttachmentKind) : null
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractRaw(filePath: string, kind: AttachmentKind): Promise<string> {
  switch (kind) {
    case 'txt':
    case 'md':
      return readFile(filePath, 'utf8')
    case 'docx': {
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value
    }
    case 'pdf': {
      const pdf = await getDocumentProxy(new Uint8Array(await readFile(filePath)))
      const { text } = await extractText(pdf, { mergePages: true })
      return text
    }
  }
}

/**
 * Read a user-selected document and return its plain text. Only called with
 * paths chosen in the native file dialog; the renderer never supplies a path.
 */
export async function extractAttachment(filePath: string): Promise<Attachment> {
  const kind = attachmentKindOf(filePath)
  if (!kind) throw new Error('Unsupported file type. Use DOCX, PDF, TXT or MD.')

  const info = await stat(filePath)
  if (!info.isFile()) throw new Error('Not a file.')
  if (info.size > LIMITS.attachmentFileMaxBytes) {
    throw new Error(`File is larger than ${LIMITS.attachmentFileMaxBytes / 1024 / 1024} MB.`)
  }

  let text: string
  try {
    text = normalizeText(await extractRaw(filePath, kind))
  } catch (err) {
    throw new Error(`Could not read the ${kind.toUpperCase()} file (${(err as Error).message}).`, {
      cause: err,
    })
  }
  if (!text) {
    throw new Error(
      kind === 'pdf'
        ? 'No text found. Scanned PDFs (images) are not supported yet.'
        : 'The file contains no text.',
    )
  }

  const truncated = text.length > LIMITS.attachmentTextMaxChars
  return {
    id: newId(),
    name: basename(filePath),
    kind,
    size: info.size,
    text: truncated ? text.slice(0, LIMITS.attachmentTextMaxChars) : text,
    charCount: text.length,
    truncated,
  }
}
