import { RESOURCE_PACKAGE_MANIFEST_FILE_NAME } from '../model/resourcePackage'

export type ResourcePackageContentFile = {
  path: string
  bytes: Uint8Array
}

export type ResourcePackageContentProjection = {
  path: string
  bytes: Uint8Array
}

function normalizeContentPath(value: string): string | null {
  const path = value.trim().replace(/\\/g, '/')
  if (!path || path.startsWith('/') || path.startsWith('//') || /^[a-z]:/i.test(path)) return null
  const segments = path.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..'
    || /[\u0000-\u001f\u007f]/.test(segment))) return null
  return segments.join('/')
}

function encodeUint64(value: number): Uint8Array {
  const result = new Uint8Array(8)
  let remaining = value
  for (let index = 7; index >= 0; index -= 1) {
    result[index] = remaining % 256
    remaining = Math.floor(remaining / 256)
  }
  return result
}

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

export function normalizeResourcePackageContent(
  files: readonly ResourcePackageContentFile[],
  excludeManifest = true,
): ResourcePackageContentProjection[] {
  const normalized = new Map<string, ResourcePackageContentProjection>()
  for (const file of files) {
    const path = normalizeContentPath(file.path)
    if (!path) throw new Error(`Unsafe package path: ${file.path}`)
    if (excludeManifest && path.toLocaleLowerCase() === RESOURCE_PACKAGE_MANIFEST_FILE_NAME) continue
    const identity = path.toLocaleLowerCase()
    if (normalized.has(identity)) throw new Error(`Duplicate package path: ${path}`)
    normalized.set(identity, { path, bytes: new Uint8Array(file.bytes) })
  }
  return [...normalized.values()].sort((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ))
}


async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function createResourcePackageContentHash(
  files: readonly ResourcePackageContentFile[],
): Promise<string> {
  const projection = normalizeResourcePackageContent(files)
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = [encoder.encode('opencard-resource-package-content\u0000v1\n')]
  for (const file of projection) {
    const pathBytes = encoder.encode(file.path)
    chunks.push(encodeUint64(pathBytes.byteLength), pathBytes, encodeUint64(file.bytes.byteLength), file.bytes)
  }
  return await sha256Hex(concatChunks(chunks))
}
