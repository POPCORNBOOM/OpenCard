import { isRecord } from '../../../shared/model/record'

export type NetworkResourceCacheEntry = {
  uid: string
  extension: string
  refreshedAt: string
}

export type NetworkResourceRootManifest = {
  projects: Record<string, string>
}

export type NetworkResourceProjectManifest = {
  resources: Record<string, NetworkResourceCacheEntry>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EXTENSION_PATTERN = /^\.[a-z0-9]{1,10}$/i

export function normalizeNetworkResourceProjectPath(path: string): string | null {
  const normalized = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalized || (!/^[a-z]:\//i.test(normalized) && !normalized.startsWith('/'))) return null
  return /^[a-z]:\//i.test(normalized) || normalized.startsWith('//')
    ? normalized.toLocaleLowerCase()
    : normalized
}

export function normalizeNetworkResourceUrl(source: string): string | null {
  try {
    const url = new URL(source.trim())
    if (url.protocol !== 'https:') return null
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}

export function parseNetworkResourceRootManifest(value: unknown): NetworkResourceRootManifest {
  const projects: Record<string, string> = {}
  if (!isRecord(value) || !isRecord(value.projects)) return { projects }
  for (const [path, uid] of Object.entries(value.projects)) {
    const normalizedPath = normalizeNetworkResourceProjectPath(path)
    if (normalizedPath && typeof uid === 'string' && UUID_PATTERN.test(uid)) projects[normalizedPath] = uid
  }
  return { projects }
}

function parseCacheEntry(value: unknown): NetworkResourceCacheEntry | null {
  if (!isRecord(value)
    || typeof value.uid !== 'string' || !UUID_PATTERN.test(value.uid)
    || typeof value.extension !== 'string' || !EXTENSION_PATTERN.test(value.extension)
    || typeof value.refreshedAt !== 'string' || !Number.isFinite(Date.parse(value.refreshedAt))) return null
  return {
    uid: value.uid,
    extension: value.extension.toLocaleLowerCase(),
    refreshedAt: new Date(value.refreshedAt).toISOString(),
  }
}

export function parseNetworkResourceProjectManifest(value: unknown): NetworkResourceProjectManifest {
  const resources: Record<string, NetworkResourceCacheEntry> = {}
  if (!isRecord(value) || !isRecord(value.resources)) return { resources }
  for (const [source, candidate] of Object.entries(value.resources)) {
    const url = normalizeNetworkResourceUrl(source)
    const entry = parseCacheEntry(candidate)
    if (url && entry) resources[url] = entry
  }
  return { resources }
}

const CONTENT_TYPE_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'font/otf': '.otf',
  'font/ttf': '.ttf',
  'font/woff': '.woff',
  'font/woff2': '.woff2',
  'application/font-woff': '.woff',
}

export function networkResourceExtension(url: string, contentType?: string | null): string {
  const normalized = normalizeNetworkResourceUrl(url)
  if (normalized) {
    const match = /(?:^|\/)\.?.*?(\.[a-z0-9]{1,10})$/i.exec(new URL(normalized).pathname)
    if (match?.[1] && EXTENSION_PATTERN.test(match[1])) return match[1].toLocaleLowerCase()
  }
  const mime = contentType?.split(';', 1)[0]?.trim().toLocaleLowerCase() ?? ''
  return CONTENT_TYPE_EXTENSIONS[mime] ?? '.bin'
}
