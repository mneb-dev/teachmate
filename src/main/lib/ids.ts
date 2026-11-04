import { randomUUID } from 'node:crypto'

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

export function newId(): string {
  return randomUUID()
}

/** IDs are used in file names, so only allow a strict character set (no path traversal). */
export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value)
}

export function assertSafeId(value: unknown, label = 'id'): string {
  if (!isSafeId(value)) throw new Error(`Invalid ${label}`)
  return value
}
