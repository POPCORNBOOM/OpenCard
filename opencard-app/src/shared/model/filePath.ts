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
