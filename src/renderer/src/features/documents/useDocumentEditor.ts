import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ProviderInfo } from '@shared/ai'
import { calculationErrors, documentInputErrors } from '@shared/calculation-rules'
import { suggestedTitle } from '@shared/document-text'
import type {
  DocumentAction,
  DocumentKind,
  DocumentPromptPreview,
  DocumentScope,
  TeachingDocument,
} from '@shared/documents'
import type { ChatResult } from '@shared/ai'
import type { ExportResult, ExportVariant } from '@shared/ipc'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

export type LoadState =
  { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready' }

const inputErrors = documentInputErrors

/** Delay after the last edit before a saved document is saved automatically. */
export const AUTOSAVE_DELAY_MS = 1500

/** Fields that differ between two documents, for the "unsaved changes" indicator. */
function snapshot(doc: TeachingDocument | null): string {
  if (!doc) return ''
  const { updatedAt: _u, ...rest } = doc
  return JSON.stringify(rest)
}

export interface UseDocumentEditorOptions {
  kind: DocumentKind
  /** Document id from the URL, or null for a new document. */
  documentId: string | null
  onIdChange: (id: string | null) => void
  /** Applied to a brand-new document (e.g. a quick action's preset format, or a TOS). */
  preset?: (doc: TeachingDocument) => TeachingDocument | Promise<TeachingDocument>
}

/**
 * Editing state for one teaching document. The main process is the source of
 * truth: prompts are always built from the saved document, so every action
 * that needs the latest edits saves first.
 */
export function useDocumentEditor({
  kind,
  documentId,
  onIdChange,
  preset,
}: UseDocumentEditorOptions) {
  const [doc, setDoc] = useState<TeachingDocument | null>(null)
  const [saved, setSaved] = useState<TeachingDocument | null>(null)
  const [persisted, setPersisted] = useState(false)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [busy, setBusy] = useState<null | 'saving' | 'generating' | 'previewing' | 'exporting'>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [titleTouched, setTitleTouched] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const docRef = useRef<TeachingDocument | null>(null)
  const presetRef = useRef(preset)
  // Keep refs (read by async actions and the loader) in sync after each render.
  useLayoutEffect(() => {
    docRef.current = doc
    presetRef.current = preset
  })

  // Load the document in the URL, or start a new one.
  useEffect(() => {
    if (docRef.current && docRef.current.id === documentId) return
    let cancelled = false
    const run = async () => {
      setLoad({ status: 'loading' })
      setError(null)
      setShowErrors(false)
      try {
        if (documentId) {
          const found = await teachmate.documents.get(documentId)
          if (cancelled) return
          if (!found) return setLoad({ status: 'error', error: 'This document no longer exists.' })
          if (found.kind !== kind)
            return setLoad({ status: 'error', error: 'This document belongs to another tool.' })
          setDoc(found)
          setSaved(found)
          setPersisted(true)
          setTitleTouched(true)
        } else {
          let fresh = await teachmate.documents.create(kind)
          if (cancelled) return
          if (presetRef.current) fresh = await presetRef.current(fresh)
          if (cancelled) return
          fresh = { ...fresh, title: suggestedTitle(fresh) }
          setDoc(fresh)
          setSaved(null)
          setPersisted(false)
          setTitleTouched(false)
        }
        setLoad({ status: 'ready' })
      } catch (err) {
        if (!cancelled) setLoad({ status: 'error', error: ipcErrorMessage(err) })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [documentId, kind, resetKey])

  const errors = useMemo(() => (doc ? inputErrors(doc) : {}), [doc])
  const isValid = Object.keys(errors).length === 0
  const dirty = !persisted || snapshot(doc) !== snapshot(saved)

  /** Update the document locally; keeps the suggested title in sync until the teacher edits it. */
  const update = useCallback(
    (fn: (d: TeachingDocument) => TeachingDocument) => {
      setDoc((current) => {
        if (!current) return current
        const next = fn(current)
        return titleTouched ? next : { ...next, title: suggestedTitle(next) }
      })
    },
    [titleTouched],
  )

  const setTitle = useCallback((title: string) => {
    setTitleTouched(true)
    setDoc((d) => (d ? { ...d, title } : d))
  }, [])

  const setContent = useCallback((content: string) => {
    setDoc((d) => (d ? { ...d, content, contentSource: 'edited' } : d))
  }, [])

  const commit = useCallback(
    (next: TeachingDocument) => {
      setDoc(next)
      setSaved(next)
      if (!persisted) {
        setPersisted(true)
      }
      if (documentId !== next.id) onIdChange(next.id)
    },
    [documentId, onIdChange, persisted],
  )

  const save = useCallback(async (): Promise<TeachingDocument | null> => {
    const current = docRef.current
    if (!current) return null
    // Calculations (question totals, Bloom's %, TOS rows/columns) must be right before saving.
    const problems = calculationErrors(current)
    if (problems.length > 0) {
      setShowErrors(true)
      setError(`Fix the calculations before saving: ${problems.join(' ')}`)
      return null
    }
    setBusy('saving')
    setError(null)
    try {
      const result = await teachmate.documents.save(current)
      commit(result)
      return result
    } catch (err) {
      setError(ipcErrorMessage(err))
      return null
    } finally {
      setBusy(null)
    }
  }, [commit])

  // Automatic saving: once a document has been saved, later edits are written
  // shortly after the teacher stops typing (only when the calculations are valid).
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null)
  useEffect(() => {
    if (!doc || !persisted || !dirty || busy !== null) return
    if (calculationErrors(doc).length > 0) return
    const timer = setTimeout(() => {
      void save().then((result) => {
        if (result) setAutoSavedAt(result.updatedAt)
      })
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [doc, persisted, dirty, busy, save])

  /** Save if needed, so the main process sees the latest edits. */
  const ensureSaved = useCallback(async (): Promise<TeachingDocument | null> => {
    if (!docRef.current) return null
    if (persisted && snapshot(docRef.current) === snapshot(saved)) return docRef.current
    return save()
  }, [persisted, save, saved])

  const validateOrShow = useCallback((): boolean => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true)
      setError('Please fix the highlighted fields first.')
      return false
    }
    return true
  }, [errors])

  const previewPrompt = useCallback(
    async (
      action: DocumentAction,
      instruction?: string,
      scope?: DocumentScope,
    ): Promise<DocumentPromptPreview | null> => {
      if (!validateOrShow()) return null
      const current = await ensureSaved()
      if (!current) return null
      setBusy('previewing')
      setError(null)
      try {
        return await teachmate.documents.previewPrompt({
          documentId: current.id,
          action,
          instruction,
          ...(scope ? { scope } : {}),
        })
      } catch (err) {
        setError(ipcErrorMessage(err))
        return null
      } finally {
        setBusy(null)
      }
    },
    [ensureSaved, validateOrShow],
  )

  const generate = useCallback(
    async (
      provider: ProviderInfo | null,
      action: DocumentAction,
      instruction?: string,
      scope?: DocumentScope,
    ): Promise<ChatResult | null> => {
      if (!provider) {
        setError('No AI provider is available.')
        return null
      }
      if (!validateOrShow()) return null
      const current = await ensureSaved()
      if (!current) return null
      setBusy('generating')
      setError(null)
      try {
        const { result, document } = await teachmate.documents.generate({
          requestId: crypto.randomUUID(),
          providerId: provider.id,
          documentId: current.id,
          action,
          instruction,
          ...(scope ? { scope } : {}),
        })
        commit(document)
        return result
      } catch (err) {
        setError(ipcErrorMessage(err))
        return null
      } finally {
        setBusy(null)
      }
    },
    [commit, ensureSaved, validateOrShow],
  )

  const applyReply = useCallback(
    async (requestRecordId: string | null, content: string) => {
      const current = await ensureSaved()
      if (!current) throw new Error('Save the document first.')
      commit(await teachmate.documents.applyReply(current.id, requestRecordId, content))
    },
    [commit, ensureSaved],
  )

  const restoreVersion = useCallback(
    async (index: number) => {
      const current = await ensureSaved()
      if (!current) return
      try {
        commit(await teachmate.documents.restoreVersion(current.id, index))
      } catch (err) {
        setError(ipcErrorMessage(err))
      }
    },
    [commit, ensureSaved],
  )

  /** Save (with calculation checks) and export the saved document to Word. */
  const exportDocx = useCallback(
    async (variant: ExportVariant): Promise<ExportResult | null> => {
      const current = await ensureSaved()
      if (!current) return null
      setBusy('exporting')
      setError(null)
      try {
        return await teachmate.documents.exportDocx(current.id, variant)
      } catch (err) {
        setError(ipcErrorMessage(err))
        return null
      } finally {
        setBusy(null)
      }
    },
    [ensureSaved],
  )

  /** Start a fresh, unsaved document. */
  const startNew = useCallback(() => {
    docRef.current = null
    setResetKey((k) => k + 1)
    onIdChange(null)
  }, [onIdChange])

  const remove = useCallback(async () => {
    const current = docRef.current
    if (current && persisted) await teachmate.documents.delete(current.id)
    startNew()
  }, [persisted, startNew])

  return {
    doc,
    load,
    busy,
    error,
    setError,
    errors: showErrors ? errors : {},
    isValid,
    dirty,
    autoSavedAt,
    persisted,
    update,
    setTitle,
    setContent,
    save,
    previewPrompt,
    generate,
    applyReply,
    restoreVersion,
    exportDocx,
    startNew,
    remove,
  }
}

export type DocumentEditor = ReturnType<typeof useDocumentEditor>
