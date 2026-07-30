export type FilePathFilter = {
  target?: 'file' | 'directory' | 'both'
  extensions?: readonly string[]
}

export type FilePathDirectoryEntry = {
  name: string
  isDirectory?: boolean
}

export type FilePathDirectoryProvider = (
  relativeDirectory: string,
) => Promise<readonly FilePathDirectoryEntry[]>
