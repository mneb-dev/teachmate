import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assertSafeId, newId } from '../../lib/ids'

/** Saves prepared handoff prompts as Markdown files in TeachMate's data folder. */
export class HandoffStore {
  constructor(readonly dir: string) {}

  pathFor(handoffId: string): string {
    return join(this.dir, `handoff-${assertSafeId(handoffId, 'handoff id')}.md`)
  }

  async save(prompt: string): Promise<{ handoffId: string; path: string }> {
    await mkdir(this.dir, { recursive: true })
    const handoffId = newId()
    const path = this.pathFor(handoffId)
    await writeFile(path, prompt, 'utf8')
    return { handoffId, path }
  }

  async read(handoffId: string): Promise<string> {
    try {
      return await readFile(this.pathFor(handoffId), 'utf8')
    } catch {
      throw new Error('The prepared prompt file no longer exists.')
    }
  }
}
