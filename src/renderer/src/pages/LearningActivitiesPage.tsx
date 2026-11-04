import { ActivitiesForm } from '@renderer/features/activities/ActivitiesForm'
import { ActivityManager } from '@renderer/features/activities/ActivityManager'
import { DocumentToolPage } from '@renderer/features/documents/DocumentToolPage'

export function LearningActivitiesPage() {
  return (
    <DocumentToolPage
      kind="learning-activities"
      navId="learning-activities"
      noun="activity set"
      Form={ActivitiesForm}
      workspacePanels={(editor, provider) => (
        <ActivityManager editor={editor} provider={provider} />
      )}
    />
  )
}
