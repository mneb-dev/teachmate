import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ChatStreamEvent } from '@shared/ai'
import { IpcChannel, IpcEvent, type TeachMateApi } from '@shared/ipc'

/**
 * The only surface the renderer can reach. Each function maps to one
 * whitelisted channel; ipcRenderer itself is never exposed.
 */
const api: TeachMateApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannel.AppGetInfo),
    ping: (message) => ipcRenderer.invoke(IpcChannel.AppPing, message),
  },
  conversations: {
    list: () => ipcRenderer.invoke(IpcChannel.ConversationsList),
    search: (query) => ipcRenderer.invoke(IpcChannel.ConversationsSearch, query),
    get: (id) => ipcRenderer.invoke(IpcChannel.ConversationsGet, id),
    create: () => ipcRenderer.invoke(IpcChannel.ConversationsCreate),
    save: (conversation) => ipcRenderer.invoke(IpcChannel.ConversationsSave, conversation),
    rename: (id, title) => ipcRenderer.invoke(IpcChannel.ConversationsRename, id, title),
    delete: (id) => ipcRenderer.invoke(IpcChannel.ConversationsDelete, id),
  },
  attachments: {
    pick: () => ipcRenderer.invoke(IpcChannel.AttachmentsPick),
  },
  ai: {
    listProviders: () => ipcRenderer.invoke(IpcChannel.AiListProviders),
    send: (request) => ipcRenderer.invoke(IpcChannel.AiSend, request),
    cancel: (requestId) => ipcRenderer.invoke(IpcChannel.AiCancel, requestId),
    onStream: (listener) => {
      // Forward only the payload; never hand the IpcRendererEvent to the page.
      const handler = (_event: IpcRendererEvent, data: ChatStreamEvent) => listener(data)
      ipcRenderer.on(IpcEvent.AiStream, handler)
      return () => {
        ipcRenderer.removeListener(IpcEvent.AiStream, handler)
      }
    },
  },
  handoff: {
    copyPrompt: (id) => ipcRenderer.invoke(IpcChannel.HandoffCopyPrompt, id),
    open: (id) => ipcRenderer.invoke(IpcChannel.HandoffOpen, id),
    revealFile: (id) => ipcRenderer.invoke(IpcChannel.HandoffRevealFile, id),
  },
  documents: {
    list: (kind) => ipcRenderer.invoke(IpcChannel.DocumentsList, kind),
    get: (id) => ipcRenderer.invoke(IpcChannel.DocumentsGet, id),
    create: (kind) => ipcRenderer.invoke(IpcChannel.DocumentsCreate, kind),
    save: (document) => ipcRenderer.invoke(IpcChannel.DocumentsSave, document),
    delete: (id) => ipcRenderer.invoke(IpcChannel.DocumentsDelete, id),
    previewPrompt: (request) => ipcRenderer.invoke(IpcChannel.DocumentsPreviewPrompt, request),
    generate: (request) => ipcRenderer.invoke(IpcChannel.DocumentsGenerate, request),
    applyReply: (documentId, requestRecordId, content) =>
      ipcRenderer.invoke(IpcChannel.DocumentsApplyReply, documentId, requestRecordId, content),
    restoreVersion: (documentId, versionIndex) =>
      ipcRenderer.invoke(IpcChannel.DocumentsRestoreVersion, documentId, versionIndex),
    exportDocx: (documentId, variant) =>
      ipcRenderer.invoke(IpcChannel.DocumentsExportDocx, documentId, variant),
    revealExport: (path) => ipcRenderer.invoke(IpcChannel.DocumentsRevealExport, path),
    exportMarkdown: (documentId) =>
      ipcRenderer.invoke(IpcChannel.DocumentsExportMarkdown, documentId),
    rename: (documentId, title) =>
      ipcRenderer.invoke(IpcChannel.DocumentsRename, documentId, title),
    import: (kind) => ipcRenderer.invoke(IpcChannel.DocumentsImport, kind),
    addActivitiesToLessonPlan: (activitiesId, activityPositions, lessonPlanId) =>
      ipcRenderer.invoke(
        IpcChannel.DocumentsAddActivitiesToLessonPlan,
        activitiesId,
        activityPositions,
        lessonPlanId,
      ),
    saveRevisionAsLessonPlan: (reviewId, revisionId) =>
      ipcRenderer.invoke(IpcChannel.DocumentsSaveRevisionAsLessonPlan, reviewId, revisionId),
  },
  resources: {
    list: (filter) => ipcRenderer.invoke(IpcChannel.ResourcesList, filter),
    get: (id) => ipcRenderer.invoke(IpcChannel.ResourcesGet, id),
    import: () => ipcRenderer.invoke(IpcChannel.ResourcesImport),
    importDuplicate: (token) => ipcRenderer.invoke(IpcChannel.ResourcesImportDuplicate, token),
    update: (id, update) => ipcRenderer.invoke(IpcChannel.ResourcesUpdate, id, update),
    delete: (id) => ipcRenderer.invoke(IpcChannel.ResourcesDelete, id),
    asAttachment: (id) => ipcRenderer.invoke(IpcChannel.ResourcesAsAttachment, id),
    openOriginal: (id) => ipcRenderer.invoke(IpcChannel.ResourcesOpenOriginal, id),
    reveal: (id) => ipcRenderer.invoke(IpcChannel.ResourcesReveal, id),
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannel.SettingsGet),
    updateTeaching: (defaults) => ipcRenderer.invoke(IpcChannel.SettingsUpdateTeaching, defaults),
    updateProfile: (profile) => ipcRenderer.invoke(IpcChannel.SettingsUpdateProfile, profile),
    chooseClaudeWorkspace: () => ipcRenderer.invoke(IpcChannel.SettingsChooseClaudeWorkspace),
    clearClaudeWorkspace: () => ipcRenderer.invoke(IpcChannel.SettingsClearClaudeWorkspace),
  },
  clipboard: {
    writeText: (text) => ipcRenderer.invoke(IpcChannel.ClipboardWriteText, text),
  },
}

contextBridge.exposeInMainWorld('teachmate', api)
