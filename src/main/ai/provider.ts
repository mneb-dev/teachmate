import type {
  PreparedPrompt,
  ChatResult,
  ChatStreamEvent,
  ProviderCapabilities,
  ProviderState,
} from '@shared/ai'

export interface ProviderStatus {
  state: ProviderState
  detail: string
}

export interface ProviderContext {
  /** Aborted when the user presses Stop (only for providers with `cancellation`). */
  signal: AbortSignal
  /** Emit streamed output (only for providers with `streaming`). */
  emit: (event: Omit<ChatStreamEvent, 'requestId'>) => void
}

/**
 * Contract every AI integration implements. Providers run in the main
 * process only, so API keys and OS access never reach the renderer.
 *
 * To add an officially supported API later (e.g. the Claude API with an API
 * key), implement this interface in `providers/` and register it in
 * `registry.ts`. The UI adapts to `capabilities` automatically.
 */
export interface AIProvider {
  readonly id: string
  readonly name: string
  readonly kind: 'handoff' | 'api'
  readonly description: string
  readonly capabilities: ProviderCapabilities

  getStatus(): Promise<ProviderStatus>

  /** Answer (or hand off) the prepared prompt built by a feature (chat, lesson planner, …). */
  send(prompt: PreparedPrompt, context: ProviderContext): Promise<ChatResult>
}
