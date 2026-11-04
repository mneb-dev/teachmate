import type { WebContents } from 'electron'
import type { ChatResult, PreparedPrompt } from '@shared/ai'
import { IpcEvent } from '@shared/ipc'
import type { ProviderRegistry } from './registry'

/**
 * Runs prepared prompts through a provider and tracks running requests so
 * they can be cancelled. Shared by the AI Assistant and the planning tools.
 */
export class AiRunner {
  private readonly running = new Map<string, AbortController>()

  constructor(private readonly providers: ProviderRegistry) {}

  async run(
    sender: WebContents,
    requestId: string,
    providerId: unknown,
    prompt: PreparedPrompt,
  ): Promise<{ result: ChatResult; providerId: string }> {
    const provider = this.providers.get(providerId)
    const controller = new AbortController()
    this.running.set(requestId, controller)
    try {
      const result = await provider.send(prompt, {
        signal: controller.signal,
        emit: (event) => {
          if (!sender.isDestroyed()) sender.send(IpcEvent.AiStream, { ...event, requestId })
        },
      })
      return { result, providerId: provider.id }
    } finally {
      this.running.delete(requestId)
    }
  }

  cancel(requestId: string): void {
    this.running.get(requestId)?.abort()
  }
}
