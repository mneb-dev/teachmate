import { useEffect, useState } from 'react'
import type { DocumentSummary } from '@shared/documents'
import {
  DEFAULT_TEACHER_PROFILE,
  addressTeacher,
  isProfileEmpty,
  type TeacherProfile,
} from '@shared/teaching'
import { QuickActions } from '@renderer/features/dashboard/QuickActions'
import { RecentConversations } from '@renderer/features/dashboard/RecentConversations'
import { RecentDocuments } from '@renderer/features/dashboard/RecentDocuments'
import { AiConnectionCard, LocalStorageCard } from '@renderer/features/dashboard/StatusCards'
import { ToolsOverview } from '@renderer/features/dashboard/ToolsOverview'
import { WelcomeBanner } from '@renderer/features/dashboard/WelcomeBanner'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

export function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // null until loaded: greet "Teacher" meanwhile, without the set-up nudge.
  const [profile, setProfile] = useState<TeacherProfile | null>(null)

  useEffect(() => {
    let cancelled = false
    teachmate.documents
      .list()
      .then((list) => !cancelled && setDocuments(list))
      .catch((err: unknown) => !cancelled && setError(ipcErrorMessage(err)))
    teachmate.settings
      .get()
      .then((s) => !cancelled && setProfile(s.profile))
      .catch(() => !cancelled && setProfile(DEFAULT_TEACHER_PROFILE))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <WelcomeBanner
        name={addressTeacher(profile ?? DEFAULT_TEACHER_PROFILE)}
        suggestProfile={profile !== null && isProfileEmpty(profile)}
      />
      <QuickActions />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <RecentDocuments documents={documents} error={error} />
          <ToolsOverview documents={documents} />
        </div>
        <div className="space-y-6">
          <AiConnectionCard />
          <LocalStorageCard documentCount={documents?.length ?? null} />
          <RecentConversations />
        </div>
      </div>
    </div>
  )
}
