import type { IconToken } from '../ui/icon/iconRegistry'

export type FilePathFilter = {
  target?: 'file' | 'directory' | 'both'
  extensions?: readonly string[]
}

export type FilePathDirectoryEntry = {
  name: string
  label?: string
  isDirectory?: boolean
  icon?: IconToken
}

export type FilePathDirectoryProvider = (
  relativeDirectory: string,
) => Promise<readonly FilePathDirectoryEntry[]>

/** Normalizes separators to `/` and drops trailing slashes. */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

/** Returns the last segment of `path`, or the normalized path when it has no separator. */
export function getPathBasename(path: string): string {
  const normalizedPath = normalizePath(path)
  const lastSlashIndex = normalizedPath.lastIndexOf('/')
  return lastSlashIndex === -1 ? normalizedPath : normalizedPath.slice(lastSlashIndex + 1)
}

/** Returns the directory part of `path`, or an empty string when there is no parent directory. */
export function getPathDirectory(path: string): string {
  const normalizedPath = normalizePath(path)
  const separatorIndex = normalizedPath.lastIndexOf('/')
  return separatorIndex > 0 ? normalizedPath.slice(0, separatorIndex) : ''
}

/** Whether `path` is `ancestor` itself or lives inside it, comparing normalized paths. */
export function isSameOrDescendantPath(path: string, ancestor: string): boolean {
  const normalizedPath = normalizePath(path)
  const normalizedAncestor = normalizePath(ancestor)
  return normalizedPath === normalizedAncestor || normalizedPath.startsWith(`${normalizedAncestor}/`)
}
