import { Info, Sparkles, SquareTerminal } from 'lucide-react'
import type { ProviderInfo } from '@shared/ai'
import { IconTile } from '@renderer/components/ui/IconTile'
import { StatusDot } from '@renderer/components/ui/StatusDot'
import { Link } from 'react-router'

/** Prompt starters fill the composer only — they are not responses. */
const STARTERS = [
  'Write three SMART learning objectives for a Grade 7 lesson on ecosystems.',
  'Suggest differentiated activities for a mixed-ability Grade 8 math class on linear equations.',
  'Create a 10-item multiple-choice quiz with an answer key on the water cycle.',
  'Draft an analytic rubric for an oral presentation with four criteria.',
]

export function EmptyChat({
  provider,
  onPickStarter,
}: {
  provider: ProviderInfo | null
  onPickStarter: (text: string) => void
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12 text-center">
      <IconTile icon={Sparkles} size="lg" />
      <h2 className="mt-4 text-xl font-semibold tracking-tight">How can I help you teach today?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ask a question or attach a lesson document (DOCX, PDF, TXT or MD).
      </p>

      {provider?.kind === 'handoff' && (
        <div className="mt-6 w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-card">
          <div className="flex items-start gap-3">
            <IconTile icon={SquareTerminal} size="sm" tone="muted" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex items-center gap-2 font-medium">
                {provider.name}
                <StatusDot tone={provider.state === 'ready' ? 'success' : 'neutral'} />
              </p>
              <p className="mt-1 text-muted-foreground">
                TeachMate prepares your prompt and documents, copies them, and opens Claude Code.
                You review and send the prompt there with your own Claude account — the reply
                appears in Claude Code, not in TeachMate.
              </p>
              {provider.state !== 'ready' && (
                <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {provider.statusDetail}
                </p>
              )}
              <Link
                to="/settings"
                className="mt-2 inline-block text-xs font-medium text-primary hover:text-primary-hover"
              >
                Choose a Claude Code workspace folder in Settings
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPickStarter(s)}
            className="cursor-pointer rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
