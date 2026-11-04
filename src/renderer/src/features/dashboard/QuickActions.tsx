import {
  ArrowUpRight,
  ClipboardCheck,
  FilePenLine,
  Highlighter,
  NotebookPen,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { getNavItem, type NavId } from '@renderer/app/navigation'
import { IconTile } from '@renderer/components/ui/IconTile'

interface QuickAction {
  label: string
  description: string
  icon: LucideIcon
  target: NavId
  /** Optional query string, e.g. a preset format. */
  search?: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Create DLL',
    description: 'Daily Lesson Log for the week',
    icon: NotebookPen,
    target: 'lesson-planner',
    search: '?new=dll',
  },
  {
    label: 'Create DLP',
    description: 'Detailed Lesson Plan for one session',
    icon: FilePenLine,
    target: 'lesson-planner',
    search: '?new=dlp',
  },
  {
    label: 'Generate Objectives',
    description: 'SMART objectives from a competency',
    icon: Target,
    target: 'learning-objectives',
  },
  {
    label: 'Create Assessment',
    description: 'Quiz or test with an answer key',
    icon: ClipboardCheck,
    target: 'assessments',
  },
  {
    label: 'Create Performance Task',
    description: 'Authentic task using GRASPS',
    icon: Trophy,
    target: 'performance-tasks',
  },
  {
    label: 'Annotate DLL',
    description: 'Add indicators and notes to a DLL',
    icon: Highlighter,
    target: 'dll-annotation',
  },
]

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="mb-3 text-sm font-semibold">
        Quick actions
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <QuickActionCard key={action.label} action={action} />
        ))}
      </div>
    </section>
  )
}

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <Link
      to={`${getNavItem(action.target).path}${action.search ?? ''}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <IconTile icon={action.icon} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{action.label}</p>
        <p className="truncate text-sm text-muted-foreground">{action.description}</p>
      </div>
      <ArrowUpRight
        className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
        aria-hidden
      />
    </Link>
  )
}
