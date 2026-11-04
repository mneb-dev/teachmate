import { Combine } from 'lucide-react'
import { joinParagraphs, splitParagraphs } from '@shared/annotation'
import { Button } from '@renderer/components/ui/Button'
import { AnnotationForm } from '@renderer/features/annotation/AnnotationForm'
import { DocumentToolPage } from '@renderer/features/documents/DocumentToolPage'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'

/** One-click fix when exactly one paragraph was requested but the text has several. */
function JoinParagraphsButton({ editor }: { editor: DocumentEditor }) {
  const doc = editor.doc
  if (!doc || doc.kind !== 'annotation' || doc.inputs.paragraphs !== 1) return null
  if (splitParagraphs(doc.content).length <= 1) return null
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => editor.setContent(joinParagraphs(doc.content))}
    >
      <Combine className="size-4" aria-hidden />
      Join into one paragraph
    </Button>
  )
}

export function AnnotationPage() {
  return (
    <DocumentToolPage
      kind="annotation"
      navId="dll-annotation"
      noun="annotation"
      Form={AnnotationForm}
      workspaceActions={(editor) => <JoinParagraphsButton editor={editor} />}
    />
  )
}
