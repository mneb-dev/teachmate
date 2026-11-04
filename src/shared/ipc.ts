/**
 * Single source of truth for IPC between the main process and the renderer.
 *
 * Every channel the renderer may call is listed here with its argument and
 * return types. The preload script exposes one function per channel, and the
 * main process registers exactly one handler per channel. There is no
 * generic "invoke any channel" escape hatch.
 */
import type { AppSettings, ChatRequest, ChatResult, ChatStreamEvent, ProviderInfo } from './ai'
import type { Attachment, Conversation, ConversationSummary } from './conversations'
import type {
  DocumentGenerateRequest,
  DocumentKind,
  DocumentPromptPreview,
  DocumentPromptRequest,
  DocumentSummary,
  TeachingDocument,
} from './documents'
import type {
  ResourceDetail,
  ResourceFilter,
  ResourceImportResult,
  ResourceMeta,
  ResourceUpdate,
} from './resources'
import type { TeacherProfile, TeachingDefaults } from './teaching'

export type ExportVariant = 'full' | 'student'

export type ExportResult = { status: 'saved'; path: string } | { status: 'canceled' }

export interface DocumentGenerateResult {
  result: ChatResult
  /** The saved document, including the new request record (and content, for API providers). */
  document: TeachingDocument
}

export const IpcChannel = {
  AppGetInfo: 'app:get-info',
  AppPing: 'app:ping',

  ConversationsList: 'conversations:list',
  ConversationsSearch: 'conversations:search',
  ConversationsGet: 'conversations:get',
  ConversationsCreate: 'conversations:create',
  ConversationsSave: 'conversations:save',
  ConversationsRename: 'conversations:rename',
  ConversationsDelete: 'conversations:delete',

  AttachmentsPick: 'attachments:pick',

  AiListProviders: 'ai:list-providers',
  AiSend: 'ai:send',
  AiCancel: 'ai:cancel',

  HandoffCopyPrompt: 'handoff:copy-prompt',
  HandoffOpen: 'handoff:open',
  HandoffRevealFile: 'handoff:reveal-file',

  DocumentsList: 'documents:list',
  DocumentsGet: 'documents:get',
  DocumentsCreate: 'documents:create',
  DocumentsSave: 'documents:save',
  DocumentsDelete: 'documents:delete',
  DocumentsPreviewPrompt: 'documents:preview-prompt',
  DocumentsGenerate: 'documents:generate',
  DocumentsApplyReply: 'documents:apply-reply',
  DocumentsRestoreVersion: 'documents:restore-version',
  DocumentsExportDocx: 'documents:export-docx',
  DocumentsRevealExport: 'documents:reveal-export',
  DocumentsExportMarkdown: 'documents:export-markdown',
  DocumentsRename: 'documents:rename',
  DocumentsImport: 'documents:import',
  DocumentsAddActivitiesToLessonPlan: 'documents:add-activities-to-lesson-plan',
  DocumentsSaveRevisionAsLessonPlan: 'documents:save-revision-as-lesson-plan',

  ResourcesList: 'resources:list',
  ResourcesGet: 'resources:get',
  ResourcesImport: 'resources:import',
  ResourcesImportDuplicate: 'resources:import-duplicate',
  ResourcesUpdate: 'resources:update',
  ResourcesDelete: 'resources:delete',
  ResourcesAsAttachment: 'resources:as-attachment',
  ResourcesOpenOriginal: 'resources:open-original',
  ResourcesReveal: 'resources:reveal',

  SettingsGet: 'settings:get',
  SettingsUpdateTeaching: 'settings:update-teaching',
  SettingsUpdateProfile: 'settings:update-profile',
  SettingsChooseClaudeWorkspace: 'settings:choose-claude-workspace',
  SettingsClearClaudeWorkspace: 'settings:clear-claude-workspace',

  ClipboardWriteText: 'clipboard:write-text',
} as const

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel]

/** Main → renderer event channels (the renderer can only subscribe). */
export const IpcEvent = {
  AiStream: 'ai:stream',
} as const

export interface AppInfo {
  name: string
  version: string
  platform: string
  versions: {
    electron: string
    chrome: string
    node: string
  }
  isPackaged: boolean
  /** Per-user folder where TeachMate stores its local data. */
  dataPath: string
}

export interface PingResult {
  message: string
  receivedAt: string
}

export interface AttachmentError {
  name: string
  reason: string
}

export interface PickAttachmentsResult {
  attachments: Attachment[]
  errors: AttachmentError[]
}

export interface HandoffActionResult {
  ok: boolean
  error?: string
}

/** Maps each channel to its handler signature (args → return value). */
export interface IpcContract {
  [IpcChannel.AppGetInfo]: { args: []; result: AppInfo }
  [IpcChannel.AppPing]: { args: [message: string]; result: PingResult }

  [IpcChannel.ConversationsList]: { args: []; result: ConversationSummary[] }
  [IpcChannel.ConversationsSearch]: { args: [query: string]; result: ConversationSummary[] }
  [IpcChannel.ConversationsGet]: { args: [id: string]; result: Conversation | null }
  [IpcChannel.ConversationsCreate]: { args: []; result: Conversation }
  [IpcChannel.ConversationsSave]: { args: [conversation: Conversation]; result: Conversation }
  [IpcChannel.ConversationsRename]: { args: [id: string, title: string]; result: Conversation }
  [IpcChannel.ConversationsDelete]: { args: [id: string]; result: void }

  [IpcChannel.AttachmentsPick]: { args: []; result: PickAttachmentsResult }

  [IpcChannel.AiListProviders]: { args: []; result: ProviderInfo[] }
  [IpcChannel.AiSend]: { args: [request: ChatRequest]; result: ChatResult }
  [IpcChannel.AiCancel]: { args: [requestId: string]; result: void }

  [IpcChannel.HandoffCopyPrompt]: { args: [handoffId: string]; result: HandoffActionResult }
  [IpcChannel.HandoffOpen]: { args: [handoffId: string]; result: HandoffActionResult }
  [IpcChannel.HandoffRevealFile]: { args: [handoffId: string]; result: HandoffActionResult }

  [IpcChannel.DocumentsList]: { args: [kind?: DocumentKind]; result: DocumentSummary[] }
  [IpcChannel.DocumentsGet]: { args: [id: string]; result: TeachingDocument | null }
  [IpcChannel.DocumentsCreate]: { args: [kind: DocumentKind]; result: TeachingDocument }
  [IpcChannel.DocumentsSave]: { args: [document: TeachingDocument]; result: TeachingDocument }
  [IpcChannel.DocumentsDelete]: { args: [id: string]; result: void }
  [IpcChannel.DocumentsPreviewPrompt]: {
    args: [request: DocumentPromptRequest]
    result: DocumentPromptPreview
  }
  [IpcChannel.DocumentsGenerate]: {
    args: [request: DocumentGenerateRequest]
    result: DocumentGenerateResult
  }
  [IpcChannel.DocumentsApplyReply]: {
    args: [documentId: string, requestRecordId: string | null, content: string]
    result: TeachingDocument
  }
  [IpcChannel.DocumentsRestoreVersion]: {
    args: [documentId: string, versionIndex: number]
    result: TeachingDocument
  }

  [IpcChannel.DocumentsExportDocx]: {
    args: [documentId: string, variant: ExportVariant]
    result: ExportResult
  }
  [IpcChannel.DocumentsRevealExport]: { args: [path: string]; result: void }
  [IpcChannel.DocumentsExportMarkdown]: { args: [documentId: string]; result: ExportResult }
  [IpcChannel.DocumentsRename]: {
    args: [documentId: string, title: string]
    result: TeachingDocument
  }
  [IpcChannel.DocumentsImport]: { args: [kind: DocumentKind]; result: TeachingDocument | null }
  [IpcChannel.DocumentsAddActivitiesToLessonPlan]: {
    args: [activitiesId: string, activityPositions: number[], lessonPlanId: string]
    result: TeachingDocument
  }
  [IpcChannel.DocumentsSaveRevisionAsLessonPlan]: {
    args: [reviewId: string, revisionId: string]
    result: TeachingDocument
  }

  [IpcChannel.ResourcesList]: { args: [filter?: ResourceFilter]; result: ResourceMeta[] }
  [IpcChannel.ResourcesGet]: { args: [id: string]; result: ResourceDetail }
  [IpcChannel.ResourcesImport]: { args: []; result: ResourceImportResult }
  [IpcChannel.ResourcesImportDuplicate]: { args: [token: string]; result: ResourceMeta }
  [IpcChannel.ResourcesUpdate]: { args: [id: string, update: ResourceUpdate]; result: ResourceMeta }
  [IpcChannel.ResourcesDelete]: { args: [id: string]; result: void }
  [IpcChannel.ResourcesAsAttachment]: { args: [id: string]; result: Attachment }
  [IpcChannel.ResourcesOpenOriginal]: { args: [id: string]; result: HandoffActionResult }
  [IpcChannel.ResourcesReveal]: { args: [id: string]; result: void }

  [IpcChannel.SettingsGet]: { args: []; result: AppSettings }
  [IpcChannel.SettingsUpdateTeaching]: { args: [defaults: TeachingDefaults]; result: AppSettings }
  [IpcChannel.SettingsUpdateProfile]: { args: [profile: TeacherProfile]; result: AppSettings }
  [IpcChannel.SettingsChooseClaudeWorkspace]: { args: []; result: AppSettings }
  [IpcChannel.SettingsClearClaudeWorkspace]: { args: []; result: AppSettings }

  [IpcChannel.ClipboardWriteText]: { args: [text: string]; result: void }
}

/** The API object exposed to the renderer as `window.teachmate`. */
export interface TeachMateApi {
  app: {
    getInfo: () => Promise<AppInfo>
    ping: (message: string) => Promise<PingResult>
  }
  conversations: {
    list: () => Promise<ConversationSummary[]>
    search: (query: string) => Promise<ConversationSummary[]>
    get: (id: string) => Promise<Conversation | null>
    create: () => Promise<Conversation>
    save: (conversation: Conversation) => Promise<Conversation>
    rename: (id: string, title: string) => Promise<Conversation>
    delete: (id: string) => Promise<void>
  }
  attachments: {
    /** Opens a native file picker (DOCX, PDF, TXT, MD) and returns extracted text. */
    pick: () => Promise<PickAttachmentsResult>
  }
  ai: {
    listProviders: () => Promise<ProviderInfo[]>
    send: (request: ChatRequest) => Promise<ChatResult>
    cancel: (requestId: string) => Promise<void>
    /** Subscribe to streamed output. Returns an unsubscribe function. */
    onStream: (listener: (event: ChatStreamEvent) => void) => () => void
  }
  handoff: {
    copyPrompt: (handoffId: string) => Promise<HandoffActionResult>
    open: (handoffId: string) => Promise<HandoffActionResult>
    revealFile: (handoffId: string) => Promise<HandoffActionResult>
  }
  documents: {
    list: (kind?: DocumentKind) => Promise<DocumentSummary[]>
    get: (id: string) => Promise<TeachingDocument | null>
    create: (kind: DocumentKind) => Promise<TeachingDocument>
    save: (document: TeachingDocument) => Promise<TeachingDocument>
    delete: (id: string) => Promise<void>
    /** Validate the saved form and return the exact prompt that would be sent. */
    previewPrompt: (request: DocumentPromptRequest) => Promise<DocumentPromptPreview>
    /** Build the prompt from the saved document and pass it to a provider. */
    generate: (request: DocumentGenerateRequest) => Promise<DocumentGenerateResult>
    /** Use text pasted from an external tool (e.g. Claude Code) as the document content. */
    applyReply: (
      documentId: string,
      requestRecordId: string | null,
      content: string,
    ) => Promise<TeachingDocument>
    restoreVersion: (documentId: string, versionIndex: number) => Promise<TeachingDocument>
    /** Export the saved document as a Word file (asks where to save). */
    exportDocx: (documentId: string, variant: ExportVariant) => Promise<ExportResult>
    /** Show a file this app exported in the system file manager. */
    revealExport: (path: string) => Promise<void>
    exportMarkdown: (documentId: string) => Promise<ExportResult>
    rename: (documentId: string, title: string) => Promise<TeachingDocument>
    /** Pick a file and create a new document of `kind` from it (null if canceled). */
    import: (kind: DocumentKind) => Promise<TeachingDocument | null>
    /**
     * Append the chosen activities (1-based positions) to the end of a saved
     * lesson plan; its previous content is kept in version history.
     */
    addActivitiesToLessonPlan: (
      activitiesId: string,
      activityPositions: number[],
      lessonPlanId: string,
    ) => Promise<TeachingDocument>
    /**
     * Save a review's revised plan as a new lesson plan (the original plan is
     * not changed). Returns the new lesson plan.
     */
    saveRevisionAsLessonPlan: (reviewId: string, revisionId: string) => Promise<TeachingDocument>
  }
  resources: {
    list: (filter?: ResourceFilter) => Promise<ResourceMeta[]>
    get: (id: string) => Promise<ResourceDetail>
    /** Pick files and add them to the library (originals are preserved). */
    import: () => Promise<ResourceImportResult>
    /** Add a file that was held back as a duplicate. */
    importDuplicate: (token: string) => Promise<ResourceMeta>
    update: (id: string, update: ResourceUpdate) => Promise<ResourceMeta>
    delete: (id: string) => Promise<void>
    asAttachment: (id: string) => Promise<Attachment>
    openOriginal: (id: string) => Promise<HandoffActionResult>
    reveal: (id: string) => Promise<void>
  }
  settings: {
    get: () => Promise<AppSettings>
    updateTeaching: (defaults: TeachingDefaults) => Promise<AppSettings>
    /** Name and form of address (Ma’am / Sir) used to greet the teacher. */
    updateProfile: (profile: TeacherProfile) => Promise<AppSettings>
    chooseClaudeWorkspace: () => Promise<AppSettings>
    clearClaudeWorkspace: () => Promise<AppSettings>
  }
  clipboard: {
    writeText: (text: string) => Promise<void>
  }
}
