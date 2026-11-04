import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import { AnnotationPage } from '@renderer/pages/AnnotationPage'
import { AssessmentPage } from '@renderer/pages/AssessmentPage'
import { AssistantPage } from '@renderer/pages/AssistantPage'
import { DashboardPage } from '@renderer/pages/DashboardPage'
import { LearningActivitiesPage } from '@renderer/pages/LearningActivitiesPage'
import { LessonPlannerPage } from '@renderer/pages/LessonPlannerPage'
import { LessonReviewerPage } from '@renderer/pages/LessonReviewerPage'
import { ObjectivesPage } from '@renderer/pages/ObjectivesPage'
import { PerformanceTaskPage } from '@renderer/pages/PerformanceTaskPage'
import { ResourcesPage } from '@renderer/pages/ResourcesPage'
import { RubricPage } from '@renderer/pages/RubricPage'
import { PlaceholderPage } from '@renderer/pages/PlaceholderPage'
import { SavedDocumentsPage } from '@renderer/pages/SavedDocumentsPage'
import { SettingsPage } from '@renderer/pages/SettingsPage'
import { TosPage } from '@renderer/pages/TosPage'
import { ThemeProvider } from '@renderer/theme/ThemeProvider'
import { NAV_GROUPS, SETTINGS_ITEM, getNavItem, type NavId } from './navigation'

/** Modules with a real page. Everything else renders the shared placeholder. */
const IMPLEMENTED: NavId[] = [
  'dashboard',
  'ai-assistant',
  'lesson-planner',
  'learning-objectives',
  'learning-activities',
  'saved-documents',
  'assessments',
  'table-of-specifications',
  'performance-tasks',
  'rubrics',
  'dll-annotation',
  'lesson-reviewer',
  'teaching-resources',
]
const placeholderItems = NAV_GROUPS.flatMap((g) => g.items).filter(
  (i) => !IMPLEMENTED.includes(i.id),
)

export default function App() {
  return (
    <ThemeProvider>
      {/* HashRouter works with Electron's file:// loading in production. */}
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path={getNavItem('ai-assistant').path} element={<AssistantPage />} />
            <Route path={getNavItem('lesson-planner').path} element={<LessonPlannerPage />} />
            <Route path={getNavItem('learning-objectives').path} element={<ObjectivesPage />} />
            <Route
              path={getNavItem('learning-activities').path}
              element={<LearningActivitiesPage />}
            />
            <Route path={getNavItem('saved-documents').path} element={<SavedDocumentsPage />} />
            <Route path={getNavItem('assessments').path} element={<AssessmentPage />} />
            <Route path={getNavItem('performance-tasks').path} element={<PerformanceTaskPage />} />
            <Route path={getNavItem('rubrics').path} element={<RubricPage />} />
            <Route path={getNavItem('dll-annotation').path} element={<AnnotationPage />} />
            <Route path={getNavItem('lesson-reviewer').path} element={<LessonReviewerPage />} />
            <Route path={getNavItem('teaching-resources').path} element={<ResourcesPage />} />
            <Route path={getNavItem('table-of-specifications').path} element={<TosPage />} />
            {placeholderItems.map((item) => (
              <Route key={item.id} path={item.path} element={<PlaceholderPage item={item} />} />
            ))}
            <Route path={SETTINGS_ITEM.path} element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}
