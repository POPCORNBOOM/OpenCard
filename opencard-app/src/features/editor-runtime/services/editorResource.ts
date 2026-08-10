import type { ProjectRemoteResourcePolicy } from '../../workspace/model/projectMetadata'

export function resolveEditorResourcePath(rootPath: string | null, path: string): string | null {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) return null
  if (isAbsolutePath(normalizedPath)) return normalizedPath

  const normalizedRoot = normalizePath(rootPath ?? '')
  return normalizedRoot ? `${normalizedRoot}/${normalizedPath}` : null
}

export function isRemoteResourceAllowed(
  source: string,
  policy: ProjectRemoteResourcePolicy | undefined,
): boolean {
  let url: URL
  try {
    url = new URL(source)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || !policy || policy.mode === 'deny') return false
  if (policy.mode === 'allow-all') return true

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  return policy.allowedHosts.some((candidate) => {
    const allowedHost = candidate.toLowerCase().replace(/\.$/, '')
    if (!allowedHost.startsWith('*.')) return hostname === allowedHost
    const suffix = allowedHost.slice(1)
    return hostname.endsWith(suffix) && hostname.length > suffix.length
  })
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
