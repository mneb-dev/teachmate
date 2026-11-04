import { useNavigate } from 'react-router'
import { ListChecks } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { DocumentToolPage } from '@renderer/features/documents/DocumentToolPage'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'
import { PerformanceTaskForm } from '@renderer/features/performance-task/PerformanceTaskForm'

function CreateRubricButton({ editor }: { editor: DocumentEditor }) {
  const navigate = useNavigate()
  const hasContent = Boolean(editor.doc?.content.trim())
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={!hasContent || editor.busy !== null}
      title={
        hasContent ? 'Build a rubric from this task’s assessment criteria' : 'Add the task first'
      }
      onClick={async () => {
        const saved = await editor.save()
        if (saved) navigate(`/rubrics?fromTask=${encodeURIComponent(saved.id)}`)
      }}
    >
      <ListChecks className="size-4" aria-hidden />
      Create rubric
    </Button>
  )
}

export function PerformanceTaskPage() {
  return (
    <DocumentToolPage
      kind="performance-task"
      navId="performance-tasks"
      noun="performance task"
      Form={PerformanceTaskForm}
      workspaceActions={(editor) => <CreateRubricButton editor={editor} />}
    />
  )
}
