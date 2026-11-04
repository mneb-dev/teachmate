import type { ProviderInfo } from '@shared/ai'
import type { AIProvider } from './provider'

export class ProviderRegistry {
  private readonly providers = new Map<string, AIProvider>()

  register(provider: AIProvider): void {
    if (this.providers.has(provider.id)) throw new Error(`Duplicate provider id: ${provider.id}`)
    this.providers.set(provider.id, provider)
  }

  get(id: unknown): AIProvider {
    const provider = typeof id === 'string' ? this.providers.get(id) : undefined
    if (!provider) throw new Error('Unknown AI provider')
    return provider
  }

  async list(): Promise<ProviderInfo[]> {
    return Promise.all(
      [...this.providers.values()].map(async (p) => {
        const status = await p.getStatus()
        return {
          id: p.id,
          name: p.name,
          kind: p.kind,
          description: p.description,
          capabilities: p.capabilities,
          state: status.state,
          statusDetail: status.detail,
        }
      }),
    )
  }
}
