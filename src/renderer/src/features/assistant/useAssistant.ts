import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProviderInfo } from '@shared/ai'
import {
  DEFAULT_CONVERSATION_TITLE,
  type Attachment,
  type ChatMessage,
  type Conversation,
  type ConversationSummary,
} from '@shared/conversations'
import { useProviders } from '@renderer/hooks/useProviders'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'
import { readPreference, writePreference } from '@renderer/lib/preferences'

const PROVIDER_KEY = 'teachmate.ai.providerId'
const SEARCH_DEBOUNCE_MS = 200

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()
const isString = (v: unknown): v is string => typeof v === 'string'

function titleFrom(text: string, attachments: Attachment[]): string {
  const firstLine = text.trim().split('\n')[0]?.trim() ?? ''
  const base = firstLine || attachments[0]?.name || DEFAULT_CONVERSATION_TITLE
  return base.length > 60 ? `${base.slice(0, 57).trimEnd()}…` : base
}

export interface PendingTurn {
  requestId: string
  conversationId: string
  provider: ProviderInfo
}

export interface TurnError {
  conversationId: string
  message: string
}

/**
 * State and actions for the AI Assistant page. All persistence goes through
 * the main process; nothing here fabricates AI output — assistant messages
 * only come from a provider result or from text the teacher pastes in.
 */
export function useAssistant(activeId: string | null, setActiveId: (id: string | null) => void) {
  // ── Providers ────────────────────────────────────────────────────────────
  const providersState = useProviders()
  const providers = providersState.status === 'ok' ? providersState.providers : []
  const [providerId, setProviderIdState] = useState(() =>
    readPreference(PROVIDER_KEY, '', isString),
  )
  const provider = providers.find((p) => p.id === providerId) ?? providers[0] ?? null
  const setProviderId = useCallback((id: string) => {
    setProviderIdState(id)
    writePreference(PROVIDER_KEY, id)
  }, [])

  // ── Conversation list + search ───────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [summaries, setSummaries] = useState<ConversationSummary[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [listVersion, setListVersion] = useState(0)
  const refreshList = useCallback(() => setListVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    const q = query.trim()
    const timer = setTimeout(
      () => {
        ;(q ? teachmate.conversations.search(q) : teachmate.conversations.list())
          .then((result) => {
            if (cancelled) return
            setSummaries(result)
            setListError(null)
          })
          .catch((err: unknown) => !cancelled && setListError(ipcErrorMessage(err)))
      },
      q ? SEARCH_DEBOUNCE_MS : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, listVersion])

  // ── Active conversation ──────────────────────────────────────────────────
  const [loaded, setLoadedState] = useState<Conversation | null>(null)
  const [loadError, setLoadError] = useState<{ id: string; message: string } | null>(null)
  const loadedRef = useRef<Conversation | null>(null)
  /** Keep the ref (read by async actions) and the rendered state in sync. */
  const setLoaded = useCallback((c: Conversation | null) => {
    loadedRef.current = c
    setLoadedState(c)
  }, [])

  useEffect(() => {
    if (!activeId || loadedRef.current?.id === activeId) return
    let cancelled = false
    teachmate.conversations
      .get(activeId)
      .then((conversation) => {
        if (cancelled) return
        if (!conversation) {
          setLoadError({ id: activeId, message: 'This conversation no longer exists.' })
          return
        }
        setLoaded(conversation)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError({ id: activeId, message: ipcErrorMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [activeId, setLoaded])

  const conversation = activeId && loaded?.id === activeId ? loaded : null
  const conversationError = activeId && loadError?.id === activeId ? loadError.message : null
  const isLoadingConversation = Boolean(activeId) && !conversation && !conversationError

  // ── Turns (sending) ──────────────────────────────────────────────────────
  const [pending, setPending] = useState<PendingTurn | null>(null)
  const pendingRef = useRef<PendingTurn | null>(null)
  const [streamText, setStreamText] = useState('')
  const [turnError, setTurnError] = useState<TurnError | null>(null)

  useEffect(
    () =>
      teachmate.ai.onStream((event) => {
        if (event.requestId === pendingRef.current?.requestId && event.type === 'delta') {
          setStreamText((t) => t + event.text)
        }
      }),
    [],
  )

  /** Save and, if it is still the open conversation, show the saved version. */
  const persist = useCallback(
    async (next: Conversation): Promise<Conversation> => {
      const saved = await teachmate.conversations.save(next)
      if (loadedRef.current?.id === saved.id) setLoaded(saved)
      refreshList()
      return saved
    },
    [refreshList, setLoaded],
  )

  const runTurn = useCallback(
    async (conv: Conversation) => {
      if (!provider) {
        setTurnError({ conversationId: conv.id, message: 'No AI provider is available.' })
        return
      }
      const turn: PendingTurn = { requestId: newId(), conversationId: conv.id, provider }
      pendingRef.current = turn
      setPending(turn)
      setTurnError(null)
      setStreamText('')
      try {
        const result = await teachmate.ai.send({
          requestId: turn.requestId,
          providerId: provider.id,
          conversationId: conv.id,
          conversationTitle: conv.title,
          messages: conv.messages,
        })
        const message: ChatMessage =
          result.type === 'handoff'
            ? {
                id: newId(),
                role: 'handoff',
                content: '',
                createdAt: now(),
                providerId: provider.id,
                handoff: result.handoff,
              }
            : {
                id: newId(),
                role: 'assistant',
                content: result.content,
                createdAt: now(),
                source: 'provider',
                providerId: provider.id,
              }
        await persist({ ...conv, messages: [...conv.messages, message] })
      } catch (err) {
        setTurnError({ conversationId: conv.id, message: ipcErrorMessage(err) })
      } finally {
        pendingRef.current = null
        setPending(null)
        setStreamText('')
      }
    },
    [provider, persist],
  )

  const send = useCallback(
    async (text: string, attachments: Attachment[]) => {
      const base =
        loadedRef.current && loadedRef.current.id === activeId
          ? loadedRef.current
          : await teachmate.conversations.create()
      const userMessage: ChatMessage = {
        id: newId(),
        role: 'user',
        content: text.trim(),
        createdAt: now(),
        ...(attachments.length > 0 ? { attachments } : {}),
      }
      const title =
        base.messages.length === 0 && base.title === DEFAULT_CONVERSATION_TITLE
          ? titleFrom(text, attachments)
          : base.title
      setLoaded(base)
      const saved = await persist({ ...base, title, messages: [...base.messages, userMessage] })
      if (activeId !== saved.id) setActiveId(saved.id)
      await runTurn(saved)
    },
    [activeId, persist, runTurn, setActiveId, setLoaded],
  )

  /** Drop `fromIndex` and everything after it, keep earlier messages, and re-run. */
  const rerunFrom = useCallback(
    async (messages: ChatMessage[]) => {
      const conv = loadedRef.current
      if (!conv) return
      const saved = await persist({ ...conv, messages })
      await runTurn(saved)
    },
    [persist, runTurn],
  )

  const regenerate = useCallback(
    async (messageId: string) => {
      const conv = loadedRef.current
      if (!conv) return
      const index = conv.messages.findIndex((m) => m.id === messageId)
      const userIndex = conv.messages.slice(0, index).findLastIndex((m) => m.role === 'user')
      if (userIndex < 0) return
      await rerunFrom(conv.messages.slice(0, userIndex + 1))
    },
    [rerunFrom],
  )

  const editAndResend = useCallback(
    async (messageId: string, content: string) => {
      const conv = loadedRef.current
      if (!conv) return
      const index = conv.messages.findIndex((m) => m.id === messageId)
      const original = conv.messages[index]
      if (!original || original.role !== 'user') return
      await rerunFrom([...conv.messages.slice(0, index), { ...original, content: content.trim() }])
    },
    [rerunFrom],
  )

  const retry = useCallback(async () => {
    const conv = loadedRef.current
    if (conv && conv.messages.at(-1)?.role === 'user') await runTurn(conv)
  }, [runTurn])

  /** Add a reply the teacher copied from Claude Code (clearly labelled as pasted). */
  const addPastedResponse = useCallback(
    async (content: string, providerIdForReply: string) => {
      const conv = loadedRef.current
      if (!conv) return
      await persist({
        ...conv,
        messages: [
          ...conv.messages,
          {
            id: newId(),
            role: 'assistant',
            content: content.trim(),
            createdAt: now(),
            source: 'pasted',
            providerId: providerIdForReply,
          },
        ],
      })
    },
    [persist],
  )

  const stop = useCallback(() => {
    const turn = pendingRef.current
    if (turn?.provider.capabilities.cancellation) void teachmate.ai.cancel(turn.requestId)
  }, [])

  // ── Conversation management ──────────────────────────────────────────────
  const rename = useCallback(
    async (id: string, title: string) => {
      const renamed = await teachmate.conversations.rename(id, title)
      if (loadedRef.current?.id === id) setLoaded(renamed)
      refreshList()
    },
    [refreshList, setLoaded],
  )

  const remove = useCallback(
    async (id: string) => {
      await teachmate.conversations.delete(id)
      if (loadedRef.current?.id === id) {
        setLoaded(null)
      }
      if (activeId === id) setActiveId(null)
      refreshList()
    },
    [activeId, refreshList, setActiveId, setLoaded],
  )

  return {
    providers,
    providersStatus: providersState.status,
    provider,
    setProviderId,
    query,
    setQuery,
    summaries,
    listError,
    conversation,
    conversationError,
    isLoadingConversation,
    pending,
    streamText,
    turnError:
      turnError && turnError.conversationId === conversation?.id ? turnError.message : null,
    send,
    regenerate,
    editAndResend,
    retry,
    addPastedResponse,
    stop,
    rename,
    remove,
  }
}

export type AssistantState = ReturnType<typeof useAssistant>
