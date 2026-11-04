import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ChatMessage, Conversation } from '@shared/conversations'
import { ConversationStore } from './conversation-store'

let dir: string
let store: ConversationStore

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'teachmate-test-'))
  store = new ConversationStore(dir)
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function userMessage(content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

async function withMessages(...messages: ChatMessage[]): Promise<Conversation> {
  const c = await store.create()
  return store.save({ ...c, messages })
}

describe('ConversationStore', () => {
  it('creates, saves, reloads and lists conversations', async () => {
    const created = await store.create()
    expect(created.title).toBe('New conversation')

    await store.save({
      ...created,
      title: 'Fractions',
      messages: [userMessage('Explain fractions')],
    })
    const reloaded = await store.get(created.id)
    expect(reloaded?.title).toBe('Fractions')
    expect(reloaded?.messages).toHaveLength(1)

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: created.id, messageCount: 1, preview: 'Explain fractions' })
  })

  it('writes one JSON file per conversation and no temp files', async () => {
    const c = await store.create()
    await store.save({ ...c, messages: [userMessage('hi')] })
    expect(await readdir(dir)).toEqual([`${c.id}.json`])
    const onDisk = JSON.parse(await readFile(join(dir, `${c.id}.json`), 'utf8'))
    expect(onDisk.messages[0].content).toBe('hi')
  })

  it('lists most recently updated first', async () => {
    const a = await store.create()
    await new Promise((r) => setTimeout(r, 5))
    const b = await store.create()
    await new Promise((r) => setTimeout(r, 5))
    await store.save({ ...a, messages: [userMessage('bump')] })
    expect((await store.list()).map((s) => s.id)).toEqual([a.id, b.id])
  })

  it('renames and trims titles', async () => {
    const c = await store.create()
    const renamed = await store.rename(c.id, '   Grade 7   Science  ')
    expect(renamed.title).toBe('Grade 7 Science')
    await expect(store.rename(c.id, '   ')).rejects.toThrow(/must not be empty/)
  })

  it('deletes conversations', async () => {
    const c = await store.create()
    await store.delete(c.id)
    expect(await store.get(c.id)).toBeNull()
    expect(await store.list()).toEqual([])
  })

  it('searches titles, message text and attachment names', async () => {
    const byTitle = await store.create()
    await store.rename(byTitle.id, 'Photosynthesis lesson')
    const byContent = await withMessages(
      userMessage('Write objectives about the WATER cycle please'),
    )
    const byAttachment = await withMessages(
      userMessage('See attached', {
        attachments: [
          {
            id: 'att-1',
            name: 'rubric-draft.docx',
            kind: 'docx',
            size: 10,
            text: 'x',
            charCount: 1,
            truncated: false,
          },
        ],
      }),
    )

    expect((await store.search('photosynthesis')).map((r) => r.id)).toEqual([byTitle.id])

    const water = await store.search('water cycle')
    expect(water.map((r) => r.id)).toEqual([byContent.id])
    expect(water[0].matchSnippet).toContain('WATER cycle')

    expect((await store.search('RUBRIC')).map((r) => r.id)).toEqual([byAttachment.id])
    expect(await store.search('no such thing')).toEqual([])
    expect(await store.search('  ')).toHaveLength(3)
  })

  it('rejects path traversal ids', async () => {
    await expect(store.get('../../etc/passwd')).rejects.toThrow(/Invalid/)
    await expect(store.delete('..\\x')).rejects.toThrow(/Invalid/)
  })

  it('rejects invalid data from the renderer', async () => {
    const c = await store.create()
    await expect(store.save({ ...c, messages: [{ role: 'hacker' }] })).rejects.toThrow(/Invalid/)
    await expect(
      store.save({ ...c, messages: [userMessage('x'.repeat(100_001))] }),
    ).rejects.toThrow(/exceeds/)
    await expect(
      store.save({
        ...c,
        messages: [{ ...userMessage('a'), role: 'assistant', attachments: [] }],
      }),
    ).rejects.toThrow(/only allowed on user messages/)
  })

  it('builds plain-text previews from Markdown replies', async () => {
    const c = await withMessages(userMessage('q'), {
      ...userMessage(
        '## Quiz\n\n1. **Producers** make `food`\n\n| A | B |\n| --- | --- |\n| 1 | 2 |',
      ),
      role: 'assistant',
      source: 'pasted',
    })
    const [summary] = (await store.list()).filter((s) => s.id === c.id)
    expect(summary.preview).toBe('Quiz Producers make food A B 1 2')
  })

  it('skips corrupt files instead of failing the whole list', async () => {
    const c = await store.create()
    await writeFile(join(dir, 'broken.json'), '{ not json', 'utf8')
    const list = await store.list()
    expect(list.map((s) => s.id)).toEqual([c.id])
  })
})
