import { useCallback, useState, type ComponentType, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import {
  Eye,
  FilePlus2,
  FolderOpen,
  LoaderCircle,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import type { ProviderInfo } from '@shared/ai'
import type { DocumentKind, DocumentPromptPreview, TeachingDocument } from '@shared/documents'
import { getNavItem, type NavId } from '@renderer/app/navigation'
import { Button } from '@renderer/components/ui/Button'
import { Card } from '@renderer/components/ui/Card'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { StatusDot } from '@renderer/components/ui/StatusDot'
import { useSelectedProvider } from '@renderer/hooks/useSelectedProvider'
import { DocumentWorkspace } from './DocumentWorkspace'
import { OpenSavedDialog } from './OpenSavedDialog'
import { PromptPreviewDialog } from './PromptPreviewDialog'
import { useDocumentEditor, type DocumentEditor } from './useDocumentEditor'

interface DocumentToolPageProps {
  kind: DocumentKind
  navId: NavId
  /** Singular noun used in labels, e.g. "lesson plan". */
  noun: string
  Form: ComponentType<{ editor: DocumentEditor }>
  /** Extra toolbar buttons in the document workspace. */
  workspaceActions?: (editor: DocumentEditor) => ReactNode
  /** Extra panels below the document content (shown once there is content). */
  workspacePanels?: (editor: DocumentEditor, provider: ProviderInfo | null) => ReactNode
  /** Build a preset for new documents from URL params (e.g. ?new=dlp). */
  presetFromParams?: (
    params: URLSearchParams,
  ) => ((doc: TeachingDocument) => TeachingDocument | Promise<TeachingDocument>) | undefined
}

/** Shared layout for the planning tools: form on the left, generated document on the right. */
export function DocumentToolPage({
  kind,
  navId,
  noun,
  Form,
  presetFromParams,
  workspaceActions,
  workspacePanels,
}: DocumentToolPageProps) {
  const nav = getNavItem(navId)
  const [params, setParams] = useSearchParams()
  const documentId = params.get('d')
  const preset = presetFromParams?.(params)

  const onIdChange = useCallback(
    (id: string | null) => setParams(id ? { d: id } : {}, { replace: true }),
    [setParams],
  )
  const editor = useDocumentEditor({ kind, documentId, onIdChange, preset })
  const { provider } = useSelectedProvider()
  const [openSaved, setOpenSaved] = useState(false)
  const [preview, setPreview] = useState<DocumentPromptPreview | null>(null)

  const handoff = provider?.capabilities.returnsResponse === false
  const hasContent = Boolean(editor.doc?.content.trim())
  const generateLabel = handoff
    ? hasContent
      ? 'Prepare again'
      : 'Prepare for Claude Code'
    : hasContent
      ? 'Generate again'
      : 'Generate'

  const confirmDiscard = () =>
    !editor.dirty || !editor.persisted || window.confirm('You have unsaved changes. Discard them?')

  const generate = () => void editor.generate(provider, 'generate')

  return (
    <>
      <PageHeader
        title={nav.label}
        description={nav.description}
        icon={nav.icon}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => confirmDiscard() && setOpenSaved(true)}
            >
              <FolderOpen className="size-4" aria-hidden />
              Open saved
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => confirmDiscard() && editor.startNew()}
            >
              <FilePlus2 className="size-4" aria-hidden />
              New {noun}
            </Button>
          </>
        }
      />

      {editor.load.status === 'loading' && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading…
        </div>
      )}

      {editor.load.status === 'error' && (
        <Card className="mx-auto max-w-md p-8 text-center">
          <TriangleAlert className="mx-auto size-6 text-primary" aria-hidden />
          <p className="mt-2 text-sm font-medium">Couldn’t open this {noun}</p>
          <p className="mt-1 text-sm text-muted-foreground">{editor.load.error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={editor.startNew}>
            Start a new {noun}
          </Button>
        </Card>
      )}

      {editor.load.status === 'ready' && editor.doc && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
          <Card className="xl:sticky xl:top-0">
            <div className="max-h-none overflow-visible p-5 xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto">
              <Form editor={editor} />
            </div>
            <div className="space-y-3 border-t border-border p-4">
              {provider && (
                <p
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                  title={provider.statusDetail}
                >
                  <StatusDot tone={provider.state === 'ready' ? 'success' : 'neutral'} />
                  {provider.name}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={editor.busy !== null}
                  onClick={() =>
                    void editor.previewPrompt('generate').then((p) => p && setPreview(p))
                  }
                >
                  <Eye className="size-4" aria-hidden />
                  Preview prompt
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={editor.busy !== null || !provider}
                  onClick={generate}
                >
                  {editor.busy === 'generating' ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : handoff ? (
                    <Send className="size-4" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  {generateLabel}
                </Button>
              </div>
              {hasContent && (
                <p className="text-xs text-muted-foreground">
                  Generating again replaces the current {noun} when you add the reply; the current
                  version is kept in history.
                </p>
              )}
            </div>
          </Card>

          <DocumentWorkspace
            editor={editor}
            provider={provider}
            noun={noun}
            extraActions={workspaceActions?.(editor)}
          >
            {workspacePanels?.(editor, provider)}
          </DocumentWorkspace>
        </div>
      )}

      <OpenSavedDialog
        open={openSaved}
        kind={kind}
        noun={noun}
        onClose={() => setOpenSaved(false)}
        onOpen={(id) => {
          setOpenSaved(false)
          onIdChange(id)
        }}
      />
      <PromptPreviewDialog
        preview={preview}
        onClose={() => setPreview(null)}
        sendLabel={generateLabel}
        onSend={() => {
          setPreview(null)
          generate()
        }}
      />
    </>
  )
}
