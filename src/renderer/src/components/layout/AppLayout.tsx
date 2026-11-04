import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { findNavItemByPath } from '@renderer/app/navigation'
import { useMediaQuery } from '@renderer/hooks/useMediaQuery'
import { isBoolean, readPreference, writePreference } from '@renderer/lib/preferences'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const COLLAPSED_KEY = 'teachmate.sidebar.collapsed'

/** Shared shell for every page: sidebar, top bar and a scrollable content area. */
export function AppLayout() {
  const isNarrow = useMediaQuery('(max-width: 1023px)')
  const [collapsedPref, setCollapsedPref] = useState(() =>
    readPreference(COLLAPSED_KEY, false, isBoolean),
  )
  const collapsed = isNarrow || collapsedPref

  const toggle = () => {
    const next = !collapsedPref
    setCollapsedPref(next)
    writePreference(COLLAPSED_KEY, next)
  }

  // Reset scroll position when switching pages.
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const fullBleed = findNavItemByPath(pathname)?.fullBleed ?? false
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onToggle={isNarrow ? undefined : toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {fullBleed ? (
          <main className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        ) : (
          <main ref={mainRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-6 py-6 lg:px-8 lg:py-8">
              <Outlet />
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
