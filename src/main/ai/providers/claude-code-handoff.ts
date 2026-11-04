import type { ChatResult, PreparedPrompt, ProviderCapabilities } from '@shared/ai'
import type { HandoffActionResult } from '@shared/ipc'
import type { HandoffStore } from '../handoff/handoff-store'
import { buildClaudeCodeDeepLink, renderPromptMarkdown } from '../handoff/prompt'
import type { AIProvider, ProviderContext, ProviderStatus } from '../provider'

export interface ClaudeCodeHandoffDeps {
  store: HandoffStore
  getWorkspace: () => Promise<string | null>
  copyText: (text: string) => void
  /** Opens a URL with the OS handler (shell.openExternal in production). */
  openUrl: (url: string) => Promise<void>
  /** Whether a `claude-cli://` handler is registered with the OS. */
  isDeepLinkHandlerRegistered: () => boolean
}

/**
 * Manual handoff to Claude Code.
 *
 * Anthropic does not allow third-party apps to offer claude.ai (Free/Pro/Max)
 * login or reuse its credentials, so TeachMate never touches Claude login
 * tokens. Instead this provider:
 *   1. prepares a self-contained prompt (conversation + document text),
 *   2. saves it locally and copies it to the clipboard,
 *   3. opens Claude Code via its official `claude-cli://open` deep link,
 *      which pre-fills — but never sends — the prompt.
 * The teacher continues in Claude Code. No AI reply is returned to TeachMate.
 */
export class ClaudeCodeHandoffProvider implements AIProvider {
  readonly id = 'claude-code-handoff'
  readonly name = 'Claude Code (manual handoff)'
  readonly kind = 'handoff' as const
  readonly description =
    'Prepares your prompt and documents, copies them, and opens Claude Code. You continue the conversation in Claude Code with your own Claude account.'
  readonly capabilities: ProviderCapabilities = {
    streaming: false,
    cancellation: false,
    returnsResponse: false,
    attachments: true,
  }

  constructor(private readonly deps: ClaudeCodeHandoffDeps) {}

  async getStatus(): Promise<ProviderStatus> {
    if (this.deps.isDeepLinkHandlerRegistered()) {
      return {
        state: 'ready',
        detail: 'Claude Code is installed and can be opened from TeachMate.',
      }
    }
    return {
      state: 'needs-setup',
      detail:
        'Claude Code was not detected. Install Claude Code (v2.1.91 or later) and send one message in an interactive session so it registers its link handler. Until then, prompts are still prepared and copied for you to paste manually.',
    }
  }

  async send(prepared: PreparedPrompt, _context: ProviderContext): Promise<ChatResult> {
    const prompt = renderPromptMarkdown(prepared)
    const { handoffId } = await this.deps.store.save(prompt)
    const attachmentCount = prepared.references.length

    const copied = this.copy(prompt)
    const workspace = await this.deps.getWorkspace()
    const opened = await this.openWith(handoffId, prompt, workspace)

    return {
      type: 'handoff',
      handoff: {
        handoffId,
        providerId: this.id,
        promptChars: prompt.length,
        attachmentCount,
        copiedToClipboard: copied,
        openedExternally: opened.ok,
        ...(opened.error ? { openError: opened.error } : {}),
        usedFileReference: opened.usedFileReference,
        workspace,
      },
    }
  }

  async copyPrompt(handoffId: string): Promise<HandoffActionResult> {
    const prompt = await this.deps.store.read(handoffId)
    return this.copy(prompt) ? { ok: true } : { ok: false, error: 'Could not copy to clipboard.' }
  }

  async reopen(handoffId: string): Promise<HandoffActionResult> {
    const prompt = await this.deps.store.read(handoffId)
    this.copy(prompt)
    const { ok, error } = await this.openWith(handoffId, prompt, await this.deps.getWorkspace())
    return error ? { ok, error } : { ok }
  }

  private copy(text: string): boolean {
    try {
      this.deps.copyText(text)
      return true
    } catch {
      return false
    }
  }

  private async openWith(
    handoffId: string,
    prompt: string,
    workspace: string | null,
  ): Promise<{ ok: boolean; error?: string; usedFileReference: boolean }> {
    const link = buildClaudeCodeDeepLink({
      prompt,
      promptFile: this.deps.store.pathFor(handoffId),
      cwd: workspace ?? this.deps.store.dir,
    })
    if (!this.deps.isDeepLinkHandlerRegistered()) {
      return {
        ok: false,
        error: 'Claude Code is not installed or has not registered its link handler yet.',
        usedFileReference: link.usedFileReference,
      }
    }
    try {
      await this.deps.openUrl(link.url)
      return { ok: true, usedFileReference: link.usedFileReference }
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
        usedFileReference: link.usedFileReference,
      }
    }
  }
}
