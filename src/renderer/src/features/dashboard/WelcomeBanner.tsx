import { CalendarDays, Sparkles, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { ButtonLink } from '@renderer/components/ui/Button'
import { formatLongDate, greetingFor } from '@renderer/lib/format'

export function WelcomeBanner({
  name,
  suggestProfile = false,
}: {
  name: string
  /** Show a link to Settings while the teacher hasn't set their name. */
  suggestProfile?: boolean
}) {
  const now = new Date()
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
      {/* Soft primary glow, kept subtle so the banner stays calm. */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden />
            {formatLongDate(now)}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {greetingFor(now)}, {name}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Plan lessons, build assessments and review your work — all on this device. What would
            you like to create today?
          </p>
          {suggestProfile && (
            <Link
              to="/settings"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              <UserRound className="size-3.5" aria-hidden />
              Set how TeachMate greets you
            </Link>
          )}
        </div>
        <ButtonLink to="/ai-assistant">
          <Sparkles className="size-4" aria-hidden />
          Ask the AI Assistant
        </ButtonLink>
      </div>
    </section>
  )
}
