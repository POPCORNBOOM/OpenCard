import type { PropertyCompletionProvider } from '../../../shared/ui/property-editor/propertyEditor.types'
import type { IconToken } from '../../../shared/ui/icon/iconRegistry'

export type FilePathCompletionEntry = {
  name: string
  isDirectory?: boolean
}

export type FilePathCompletionOptions = {
  listDirectory: (relativeDirectory: string) => Promise<readonly FilePathCompletionEntry[]>
  getRootEntries: () => readonly FilePathCompletionEntry[]
  extensions?: readonly string[]
  isAvailable?: () => boolean
}

export function createFilePathCompletionProvider(
  options: FilePathCompletionOptions,
): PropertyCompletionProvider {
  const extensions = normalizeExtensions(options.extensions ?? [])

  return async ({ value, cursor }) => {
    if (options.isAvailable && !options.isAvailable()) return null
    const normalizedValue = value.replace(/\\/g, '/')
    const beforeCursor = normalizedValue.slice(0, cursor)
    if (beforeCursor.lastIndexOf('{{') > beforeCursor.lastIndexOf('}}')) return null

    const slashIndex = beforeCursor.lastIndexOf('/')
    const directory = slashIndex < 0 ? '' : beforeCursor.slice(0, slashIndex)
    const fragment = beforeCursor.slice(slashIndex + 1).toLocaleLowerCase()

    try {
      let entries = await options.listDirectory(directory)
      if (!directory && entries.length === 0) {
        entries = options.getRootEntries().filter((entry) => !normalizePath(entry.name).includes('/'))
      }

      const items = entries
        .map((entry) => prepareEntry(entry, extensions))
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .filter((entry) => !fragment || entry.label.toLocaleLowerCase().includes(fragment))
        .sort((left, right) => {
          if (left.keepOpen !== right.keepOpen) return left.keepOpen ? -1 : 1
          const leftStarts = left.label.toLocaleLowerCase().startsWith(fragment)
          const rightStarts = right.label.toLocaleLowerCase().startsWith(fragment)
          if (leftStarts !== rightStarts) return leftStarts ? -1 : 1
          return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
        })

      return items.length > 0
        ? { replaceStart: slashIndex + 1, replaceEnd: cursor, items }
        : null
    } catch (error) {
      console.error('Failed to load file path completions:', error)
      return null
    }
  }
}

function prepareEntry(
  entry: FilePathCompletionEntry,
  extensions: readonly string[],
) {
  const normalizedPath = normalizePath(entry.name)
  const label = normalizedPath.split('/').pop() ?? normalizedPath
  const isDirectory = Boolean(entry.isDirectory)
  if (!isDirectory && extensions.length > 0 && !extensions.some((extension) => label.toLocaleLowerCase().endsWith(extension))) {
    return null
  }

  const value = isDirectory
    ? `${normalizedPath}/`
    : normalizedPath
  return {
    key: normalizedPath,
    label,
    icon: (isDirectory ? 'folder.generic' : 'file.generic') as IconToken,
    insertText: label + (isDirectory ? '/' : ''),
    value,
    keepOpen: isDirectory,
  }
}

function normalizeExtensions(extensions: readonly string[]): string[] {
  return extensions.map((extension) => (
    extension.startsWith('.') ? extension.toLocaleLowerCase() : `.${extension.toLocaleLowerCase()}`
  ))
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}
