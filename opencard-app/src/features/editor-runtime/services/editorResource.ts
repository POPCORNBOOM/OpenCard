import { convertFileSrc } from '@tauri-apps/api/core'

export function resolveEditorResourcePath(rootPath: string | null, path: string): string | null {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) return null
  if (isAbsolutePath(normalizedPath)) return normalizedPath

  const normalizedRoot = normalizePath(rootPath ?? '')
  return normalizedRoot ? `${normalizedRoot}/${normalizedPath}` : null
}

export function resolveEditorAssetSrc(rootPath: string | null, path: string): string {
  const resolvedPath = resolveEditorResourcePath(rootPath, path)
  return resolvedPath ? convertFileSrc(resolvedPath) : ''
}

export function getEditorResourceRelativePath(rootPath: string | null, path: string): string | null {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath || /^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedPath)) return null
  if (!isAbsolutePath(normalizedPath)) return normalizedPath

  const normalizedRoot = normalizePath(rootPath ?? '')
  if (!normalizedRoot) return null
  const rootPrefix = `${normalizedRoot}/`
  if (!normalizedPath.toLowerCase().startsWith(rootPrefix.toLowerCase())) return null
  return normalizedPath.slice(rootPrefix.length)
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function isAbsolutePath(path: string): boolean {
  return /^[a-z]:\//i.test(path) || path.startsWith('/')
}
