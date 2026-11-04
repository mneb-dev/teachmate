import {
  appendToLessonPlan,
  applyScopedReply,
  lessonPlanSection,
  parseActivities,
} from '@shared/activities'
import { requestScopeLabel } from '@shared/document-text'
import {
  DOCUMENT_KINDS,
  DOCUMENT_LIMITS,
  type DocumentAction,
  type DocumentKind,
  type DocumentRequestRecord,
  type DocumentScope,
  type TeachingDocument,
} from '@shared/documents'
import { IpcChannel } from '@shared/ipc'
import { addRevision } from '@shared/review'
import { applyRubricReply } from '@shared/rubric'
import { renderPromptMarkdown } from '../ai/handoff/prompt'
import { buildDocumentPrompt } from '../ai/prompts/document'
import { assertSafeId, newId } from '../lib/ids'
import type { Services } from '../services'
import { newDocument, replaceContent } from '../storage/document-store'
import { documentScope } from '../storage/document-validation'
import { expectString, handle } from './handle'

const KINDS = Object.keys(DOCUMENT_KINDS) as DocumentKind[]

function parseKind(value: unknown): DocumentKind {
  if (!KINDS.includes(value as DocumentKind)) throw new Error('Unknown document type')
  return value as DocumentKind
}

function parsePromptRequest(value: unknown): {
  documentId: string
  action: DocumentAction
  instruction?: string
  scope?: DocumentScope
} {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid request')
  const v = value as Record<string, unknown>
  const action = v.action
  if (action !== 'generate' && action !== 'revise') throw new Error('Invalid action')
  const instruction =
    v.instruction === undefined
      ? undefined
      : expectString(v.instruction, 'Revision instructions', DOCUMENT_LIMITS.instructionsMaxChars)
  const scope = v.scope === undefined ? undefined : documentScope(v.scope, 'scope')
  if (action === 'revise' && !scope && !instruction?.trim()) {
    throw new Error('Describe the changes you want before requesting a revision.')
  }
  return { documentId: assertSafeId(v.documentId, 'document id'), action, instruction, scope }
}

/**
 * Put reply text into a document. A scoped learning-activities reply replaces
 * one activity or adds alternatives; a review's revision reply is stored as a
 * separate revised plan (the review and the original plan are untouched);
 * anything else replaces the content.
 */
function withReply(
  doc: TeachingDocument,
  text: string,
  source: 'provider' | 'pasted',
  scope: DocumentScope | undefined,
): TeachingDocument {
  if (!scope) return replaceContent(doc, text, source)
  try {
    if (scope.type === 'revision' && doc.kind === 'lesson-plan-review') {
      return { ...doc, revisions: addRevision(doc.revisions, text, source, scope, newId()) }
    }
    if (scope.type !== 'revision' && doc.kind === 'learning-activities') {
      return replaceContent(doc, applyScopedReply(doc.content, scope, text), source)
    }
  } catch (err) {
    throw new Error(`${requestScopeLabel(scope)}: ${(err as Error).message}`, { cause: err })
  }
  return replaceContent(doc, text, source)
}

export function registerDocumentHandlers({ documents, settings, runner }: Services): void {
  handle(IpcChannel.DocumentsList, (_e, kind) =>
    documents.list(kind === undefined ? undefined : parseKind(kind)),
  )
  handle(IpcChannel.DocumentsGet, (_e, id) => documents.get(assertSafeId(id)))
  handle(IpcChannel.DocumentsCreate, async (_e, kind) => {
    // Not written to disk until the teacher saves or generates.
    return newDocument(parseKind(kind), (await settings.get()).teaching)
  })
  handle(IpcChannel.DocumentsSave, (_e, doc) => documents.save(doc))
  handle(IpcChannel.DocumentsDelete, (_e, id) => documents.delete(assertSafeId(id)))
  handle(IpcChannel.DocumentsRename, (_e, id, title) => documents.rename(assertSafeId(id), title))

  handle(IpcChannel.DocumentsPreviewPrompt, async (_e, raw) => {
    const req = parsePromptRequest(raw)
    const doc = await documents.require(req.documentId)
    const { teaching } = await settings.get()
    const markdown = renderPromptMarkdown(
      buildDocumentPrompt(doc, req.action, req.instruction, teaching.country, req.scope),
    )
    return { markdown, chars: markdown.length }
  })

  handle(IpcChannel.DocumentsGenerate, async (event, raw) => {
    const req = parsePromptRequest(raw)
    const v = raw as Record<string, unknown>
    const requestId = assertSafeId(v.requestId, 'request id')
    let doc = await documents.require(req.documentId)
    const { teaching } = await settings.get()
    const prompt = buildDocumentPrompt(
      doc,
      req.action,
      req.instruction,
      teaching.country,
      req.scope,
    )

    const { result, providerId } = await runner.run(event.sender, requestId, v.providerId, prompt)

    const record: DocumentRequestRecord = {
      id: newId(),
      action: req.action,
      ...(req.instruction?.trim() ? { instruction: req.instruction.trim() } : {}),
      ...(req.scope ? { scope: req.scope } : {}),
      providerId,
      createdAt: new Date().toISOString(),
      status: 'awaiting-reply',
    }
    if (result.type === 'handoff') {
      record.handoff = result.handoff
    } else {
      // API providers return the content directly.
      doc = withReply(doc, result.content, 'provider', req.scope)
      record.status = 'completed'
    }
    doc = { ...doc, requests: [record, ...doc.requests].slice(0, DOCUMENT_LIMITS.requestsKept) }
    return { result, document: await documents.save(doc) }
  })

  handle(IpcChannel.DocumentsApplyReply, async (_e, documentId, requestRecordId, content) => {
    const text = expectString(content, 'Reply', DOCUMENT_LIMITS.contentMaxChars)
    if (!text.trim()) throw new Error('The reply is empty.')
    let doc = await documents.require(assertSafeId(documentId, 'document id'))
    if (doc.kind === 'rubric') {
      // Read criteria/descriptions from the reply; numbers stay as the teacher set them.
      // (Saving re-renders the content from the rubric.)
      doc = { ...doc, rubric: applyRubricReply(text, doc.rubric) }
    } else if (doc.kind === 'tos') {
      throw new Error(
        'A Table of Specifications is calculated in TeachMate and has no reply to paste.',
      )
    } else {
      const recordId = requestRecordId === null ? null : assertSafeId(requestRecordId, 'request id')
      const scope = doc.requests.find((r) => r.id === recordId)?.scope
      doc = withReply(doc, text.trim(), 'pasted', scope)
    }
    if (requestRecordId !== null) {
      const recordId = assertSafeId(requestRecordId, 'request id')
      doc = {
        ...doc,
        requests: doc.requests.map((r) => (r.id === recordId ? { ...r, status: 'completed' } : r)),
      }
    }
    return documents.save(doc)
  })

  handle(IpcChannel.DocumentsAddActivitiesToLessonPlan, async (_e, sourceId, positions, planId) => {
    const source = await documents.require(assertSafeId(sourceId, 'document id'))
    if (source.kind !== 'learning-activities') throw new Error('Choose learning activities to add.')
    const plan = await documents.require(assertSafeId(planId, 'lesson plan id'))
    if (plan.kind !== 'lesson-plan')
      throw new Error('Activities can only be added to a lesson plan.')
    if (
      !Array.isArray(positions) ||
      positions.length === 0 ||
      positions.length > 99 ||
      positions.some((p) => typeof p !== 'number' || !Number.isInteger(p))
    ) {
      throw new Error('Choose at least one activity.')
    }
    const blocks = parseActivities(source.content)
    const chosen = [...new Set(positions as number[])]
      .sort((a, b) => a - b)
      .map((p) => {
        const block = blocks[p - 1]
        if (!block) throw new Error(`Activity ${p} no longer exists.`)
        return block
      })
    const content = appendToLessonPlan(plan.content, lessonPlanSection(chosen, source.title))
    // The lesson plan's previous content is kept in its version history.
    return documents.save(replaceContent(plan, content, 'edited'))
  })

  /**
   * Save a review's revised plan as a new lesson plan. The original plan and
   * the review are not changed; the new plan copies the original's form
   * details when the review was made from a saved lesson plan.
   */
  handle(IpcChannel.DocumentsSaveRevisionAsLessonPlan, async (_e, reviewId, revisionId) => {
    const review = await documents.require(assertSafeId(reviewId, 'document id'))
    if (review.kind !== 'lesson-plan-review') throw new Error('Choose a lesson plan review.')
    const revision = review.revisions.find((r) => r.id === assertSafeId(revisionId, 'revision id'))
    if (!revision) throw new Error('That revised version no longer exists.')
    const fresh = newDocument('lesson-plan', (await settings.get()).teaching)
    if (fresh.kind !== 'lesson-plan') throw new Error('Could not create the lesson plan.')
    const src = review.inputs.source
    const original = src?.origin === 'document' && src.refId ? await documents.get(src.refId) : null
    const inputs =
      original?.kind === 'lesson-plan'
        ? { ...original.inputs }
        : {
            ...fresh.inputs,
            subject: review.inputs.subject || fresh.inputs.subject,
            gradeLevel: review.inputs.gradeLevel || fresh.inputs.gradeLevel,
            format: review.inputs.planType,
          }
    const base = (src?.title || review.title).replace(/\s*\(revised\)$/i, '')
    return documents.save({
      ...fresh,
      inputs,
      title: `${base.slice(0, DOCUMENT_LIMITS.titleMaxChars - 10)} (revised)`,
      content: revision.content,
      contentSource: revision.source,
    })
  })

  handle(IpcChannel.DocumentsRestoreVersion, async (_e, documentId, index) => {
    const doc = await documents.require(assertSafeId(documentId, 'document id'))
    if (typeof index !== 'number' || !Number.isInteger(index) || !doc.versions[index]) {
      throw new Error('That version no longer exists.')
    }
    const version = doc.versions[index]
    const restored = replaceContent(
      { ...doc, versions: doc.versions.filter((_, i) => i !== index) },
      version.content,
      version.source,
    )
    return documents.save(restored)
  })
}
