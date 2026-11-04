import { GraduationCap, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from '@renderer/app/navigation'
import { cn } from '@renderer/lib/cn'

interface SidebarProps {
  collapsed: boolean
  /** Hidden when the window is too narrow to expand the sidebar. */
  onToggle?: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className={cn('flex h-16 items-center gap-3 px-4', collapsed && 'justify-center px-0')}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="size-5" aria-hidden />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">TeachMate</p>
            <p className="truncate text-xs text-muted-foreground">AI Teaching Assistant</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label ?? index} className={cn(index > 0 && 'mt-5')}>
            {group.label &&
              (collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
              ) : (
                <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {group.label}
                </p>
              ))}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <SidebarLink item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-0.5 border-t border-border px-3 py-3">
        <SidebarLink item={SETTINGS_ITEM} collapsed={collapsed} />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" aria-hidden />
                <span>Collapse</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  )
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-primary-soft font-medium text-primary-soft-foreground'
            : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r-full bg-primary"
              aria-hidden
            />
          )}
          <Icon className="size-[18px] shrink-0" aria-hidden strokeWidth={isActive ? 2 : 1.75} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  )
}
