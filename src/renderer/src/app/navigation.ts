import {
  BookOpenCheck,
  ClipboardCheck,
  FolderOpen,
  Grid3x3,
  Highlighter,
  LayoutDashboard,
  Library,
  ListChecks,
  NotebookPen,
  Settings,
  Shapes,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import type { DocumentKind } from '@shared/documents'

export type NavId =
  | 'dashboard'
  | 'ai-assistant'
  | 'lesson-planner'
  | 'learning-objectives'
  | 'learning-activities'
  | 'assessments'
  | 'table-of-specifications'
  | 'performance-tasks'
  | 'rubrics'
  | 'dll-annotation'
  | 'lesson-reviewer'
  | 'teaching-resources'
  | 'saved-documents'
  | 'settings'

export interface NavItem {
  id: NavId
  label: string
  path: string
  icon: LucideIcon
  /** One-line summary shown in page headers and the tools overview. */
  description: string
  /** Full-height pages (e.g. chat) skip the padded, scrolling content container. */
  fullBleed?: boolean
  /** Planned capabilities, listed on the module's placeholder page. */
  plannedFeatures: string[]
}

export interface NavGroup {
  label: string | null
  items: NavItem[]
}

/**
 * Single source of truth for the sidebar, routes and page headers.
 * Order matches the product navigation spec.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/',
        icon: LayoutDashboard,
        description: 'Overview of your recent work and teaching tools.',
        plannedFeatures: [],
      },
      {
        id: 'ai-assistant',
        label: 'AI Assistant',
        path: '/ai-assistant',
        icon: Sparkles,
        description: 'Chat with your teaching assistant to brainstorm, draft and refine.',
        fullBleed: true,
        plannedFeatures: [
          'Conversational help for lesson ideas and classroom strategies',
          'Conversation history stored on this device',
          'Send drafts straight into any teaching tool',
        ],
      },
    ],
  },
  {
    label: 'Planning',
    items: [
      {
        id: 'lesson-planner',
        label: 'Lesson Planner',
        path: '/lesson-planner',
        icon: NotebookPen,
        description: 'Draft Daily Lesson Logs (DLL) and Detailed Lesson Plans (DLP).',
        plannedFeatures: [
          'DLL and DLP templates aligned with DepEd formats',
          'Fill sections from curriculum competencies',
          'Export to Word or PDF',
        ],
      },
      {
        id: 'learning-objectives',
        label: 'Learning Objectives',
        path: '/learning-objectives',
        icon: Target,
        description: "Write SMART objectives across Bloom's taxonomy levels.",
        plannedFeatures: [
          'Generate objectives from a competency or topic',
          'Tag cognitive, psychomotor and affective domains',
          'Check verb alignment with Bloom’s levels',
        ],
      },
      {
        id: 'learning-activities',
        label: 'Learning Activities',
        path: '/learning-activities',
        icon: Shapes,
        description: 'Design engaging, differentiated classroom activities.',
        plannedFeatures: [
          'Activity ideas by grade level and subject',
          'Differentiation for diverse learners',
          'Time and material estimates',
        ],
      },
    ],
  },
  {
    label: 'Assessment',
    items: [
      {
        id: 'assessments',
        label: 'Assessments',
        path: '/assessments',
        icon: ClipboardCheck,
        description: 'Build quizzes, unit tests and summative assessments.',
        plannedFeatures: [
          'Multiple choice, true/false, matching and essay items',
          'Automatic answer keys',
          'Printable test papers',
        ],
      },
      {
        id: 'table-of-specifications',
        label: 'Table of Specifications',
        path: '/table-of-specifications',
        icon: Grid3x3,
        description: 'Plan test coverage across competencies and cognitive levels.',
        plannedFeatures: [
          'Distribute items by days taught and weight',
          'Balance across cognitive levels',
          'Link items to the Assessments tool',
        ],
      },
      {
        id: 'performance-tasks',
        label: 'Performance Tasks',
        path: '/performance-tasks',
        icon: Trophy,
        description: 'Create authentic tasks using the GRASPS framework.',
        plannedFeatures: [
          'GRASPS task builder',
          'Real-world scenarios per subject',
          'Pair each task with a rubric',
        ],
      },
      {
        id: 'rubrics',
        label: 'Rubrics',
        path: '/rubrics',
        icon: ListChecks,
        description: 'Design analytic and holistic scoring rubrics.',
        plannedFeatures: [
          'Analytic and holistic rubric templates',
          'Clear performance-level descriptors',
          'Weighting and score computation',
        ],
      },
    ],
  },
  {
    label: 'Review',
    items: [
      {
        id: 'dll-annotation',
        label: 'DLL Annotation',
        path: '/dll-annotation',
        icon: Highlighter,
        description: 'Annotate DLLs with indicators and supporting notes.',
        plannedFeatures: [
          'Mark indicators directly on a DLL',
          'Suggested annotations for each section',
          'Export annotated copies',
        ],
      },
      {
        id: 'lesson-reviewer',
        label: 'Lesson Plan Reviewer',
        path: '/lesson-reviewer',
        icon: BookOpenCheck,
        description: 'Get structured feedback on lesson plans before teaching.',
        plannedFeatures: [
          'Check alignment of objectives, activities and assessment',
          'Highlight gaps and suggest improvements',
          'Readiness checklist',
        ],
      },
    ],
  },
  {
    label: 'Library',
    items: [
      {
        id: 'teaching-resources',
        label: 'Teaching Resources',
        path: '/teaching-resources',
        icon: Library,
        description: 'Keep reference materials, templates and links in one place.',
        plannedFeatures: [
          'Organize references by subject and grade',
          'Reusable templates',
          'Quick search across resources',
        ],
      },
      {
        id: 'saved-documents',
        label: 'Saved Documents',
        path: '/saved-documents',
        icon: FolderOpen,
        description: 'Browse everything you have created, stored on this device.',
        plannedFeatures: [
          'Search and filter by type, subject and date',
          'Duplicate, rename and delete documents',
          'Export and back up locally',
        ],
      },
    ],
  },
]

export const SETTINGS_ITEM: NavItem = {
  id: 'settings',
  label: 'Settings',
  path: '/settings',
  icon: Settings,
  description: 'Appearance, AI provider and local data preferences.',
  plannedFeatures: [],
}

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM]

export function getNavItem(id: NavId): NavItem {
  const item = ALL_NAV_ITEMS.find((i) => i.id === id)
  if (!item) throw new Error(`Unknown nav item: ${id}`)
  return item
}

export function findNavItemByPath(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((i) => i.path === pathname)
}

/** The tool that creates and edits each kind of saved document. */
export const DOCUMENT_KIND_NAV: Record<DocumentKind, NavId> = {
  'lesson-plan': 'lesson-planner',
  'learning-objectives': 'learning-objectives',
  'learning-activities': 'learning-activities',
  assessment: 'assessments',
  tos: 'table-of-specifications',
  'performance-task': 'performance-tasks',
  rubric: 'rubrics',
  annotation: 'dll-annotation',
  'lesson-plan-review': 'lesson-reviewer',
}
