import { DocumentToolPage } from '@renderer/features/documents/DocumentToolPage'
import { ReviewForm } from '@renderer/features/review/ReviewForm'
import { ReviewSummary } from '@renderer/features/review/ReviewSummary'
import { RevisedPlanPanel } from '@renderer/features/review/RevisedPlanPanel'

export function LessonReviewerPage() {
  return (
    <DocumentToolPage
      kind="lesson-plan-review"
      navId="lesson-reviewer"
      noun="review"
      Form={ReviewForm}
      workspacePanels={(editor, provider) =>
        editor.doc && (
          <>
            <ReviewSummary doc={editor.doc} />
            <RevisedPlanPanel editor={editor} provider={provider} />
          </>
        )
      }
    />
  )
}
