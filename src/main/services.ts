import { join } from 'node:path'
import { app, clipboard, shell } from 'electron'
import { HandoffStore } from './ai/handoff/handoff-store'
import { ClaudeCodeHandoffProvider } from './ai/providers/claude-code-handoff'
import { ProviderRegistry } from './ai/registry'
import { AiRunner } from './ai/runner'
import { ConversationStore } from './storage/conversation-store'
import { DocumentStore } from './storage/document-store'
import { ResourceStore } from './storage/resource-store'
import { SettingsStore } from './storage/settings-store'

/** All local data lives under Electron's per-user data folder. */
export function createServices() {
  const dataDir = app.getPath('userData')

  const conversations = new ConversationStore(join(dataDir, 'conversations'))
  const documents = new DocumentStore(join(dataDir, 'documents'))
  const resources = new ResourceStore(join(dataDir, 'resources'))
  const settings = new SettingsStore(join(dataDir, 'settings.json'))
  const handoffs = new HandoffStore(join(dataDir, 'handoffs'))

  const claudeCode = new ClaudeCodeHandoffProvider({
    store: handoffs,
    getWorkspace: async () => (await settings.get()).claudeCodeWorkspace,
    copyText: (text) => clipboard.writeText(text),
    // Only ever called with a claude-cli://open URL built in main.
    openUrl: (url) => shell.openExternal(url),
    isDeepLinkHandlerRegistered: () => app.getApplicationNameForProtocol('claude-cli://') !== '',
  })

  const providers = new ProviderRegistry()
  providers.register(claudeCode)

  const runner = new AiRunner(providers)

  return { conversations, documents, resources, settings, handoffs, providers, runner, claudeCode }
}

export type Services = ReturnType<typeof createServices>
