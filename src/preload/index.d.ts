import type { TeachMateApi } from '../shared/ipc'

declare global {
  interface Window {
    teachmate: TeachMateApi
  }
}

export {}
