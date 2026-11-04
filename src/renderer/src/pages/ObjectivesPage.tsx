import { DocumentToolPage } from '@renderer/features/documents/DocumentToolPage'
import { ObjectivesForm } from '@renderer/features/objectives/ObjectivesForm'

export function ObjectivesPage() {
  return (
    <DocumentToolPage
      kind="learning-objectives"
      navId="learning-objectives"
      noun="objectives set"
      Form={ObjectivesForm}
    />
  )
}
