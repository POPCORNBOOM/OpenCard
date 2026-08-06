import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { FileSystemService } from './fileSystemService'
import {
  parseProjectIconSeries,
  type ProjectIcon,
  type ProjectIconGridSettings,
  type ProjectIconSeries,
} from '../model/projectIcons'

export const PROJECT_ICON_PACK_EXTENSION = 'ociconpack'
export const PROJECT_ICON_PACK_MANIFEST_FILE_NAME = 'iconpack.json'
export const PROJECT_ICON_PACK_SCHEMA_VERSION = '1'

const MAX_ICON_PACK_BYTES = 128 * 1024 * 1024
const MAX_ICON_PACK_UNPACKED_BYTES = 256 * 1024 * 1024
const SPRITESHEET_EXTENSION_PATTERN = /^(?:png|jpe?g|webp)$/i

export type ProjectIconPackLocalizedText = Readonly<Record<string, string>>

export type ProjectIconPackLocalization = {
  name?: ProjectIconPackLocalizedText
}

export type ProjectIconPackManifest = {
  type: 'opencard-icon-pack'
  schemaVersion: typeof PROJECT_ICON_PACK_SCHEMA_VERSION
  name: string
  key: string
  spritesheet: string
  i18n?: ProjectIconPackLocalization
  grid?: ProjectIconGridSettings
  icons: readonly ProjectIcon[]
}

export type ProjectIconPack = {
  manifest: ProjectIconPackManifest
  spritesheetBytes: Uint8Array
}

export function createProjectIconPackSpritesheetName(packName: string, originalFileName: string): string {
  const sourceName = originalFileName.replace(/\\/g, '/').split('/').pop() ?? originalFileName
  const extension = sourceName.slice(sourceName.lastIndexOf('.'))
  const safeName = packName.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '') || 'icon-pack'
  return `${safeName}${extension}`
}

function parseLocalizedText(value: unknown): ProjectIconPackLocalizedText | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value)
  if (entries.some(([locale, text]) => !locale || typeof text !== 'string' || !text.trim())) return null
  return Object.fromEntries(entries.map(([locale, text]) => [locale, (text as string).trim()]))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeArchivePath(value: string): string | null {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/g, '')
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) return null
  if (normalized.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null
  return normalized
}

function spritesheetExtension(path: string): string | null {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  return SPRITESHEET_EXTENSION_PATTERN.test(extension) ? extension : null
}

function normalizeSpritesheetName(value: string): string | null {
  const normalized = normalizeArchivePath(value)
  if (!normalized || normalized.includes('/') || !spritesheetExtension(normalized)) return null
  return normalized
}

export function createProjectIconPackManifest(
  series: ProjectIconSeries,
  spritesheet: string,
): ProjectIconPackManifest {
  const normalizedSpritesheet = normalizeSpritesheetName(spritesheet)
  if (!normalizedSpritesheet) throw new Error('Invalid icon pack spritesheet name')
  return {
    type: 'opencard-icon-pack',
    schemaVersion: PROJECT_ICON_PACK_SCHEMA_VERSION,
    name: series.name,
    key: series.key,
    spritesheet: normalizedSpritesheet,
    ...(series.grid ? { grid: series.grid } : {}),
    icons: [...series.icons],
  }
}

export function parseProjectIconPackManifest(value: unknown): ProjectIconPackManifest | null {
  if (!isRecord(value)
    || value.type !== 'opencard-icon-pack'
    || value.schemaVersion !== PROJECT_ICON_PACK_SCHEMA_VERSION
    || typeof value.name !== 'string'
    || typeof value.key !== 'string'
    || typeof value.spritesheet !== 'string'
    || !Array.isArray(value.icons)) return null

  const spritesheet = normalizeSpritesheetName(value.spritesheet)
  if (!spritesheet) return null
  let i18n: ProjectIconPackLocalization | undefined
  if (value.i18n !== undefined) {
    if (!isRecord(value.i18n)) return null
    const name = value.i18n.name === undefined ? undefined : parseLocalizedText(value.i18n.name)
    if (value.i18n.name !== undefined && !name) return null
    i18n = name ? { name } : {}
  }
  const parsed = parseProjectIconSeries([{
    name: value.name,
    key: value.key,
    source: spritesheet,
    ...(value.grid !== undefined ? { grid: value.grid } : {}),
    icons: value.icons,
  }])
  const series = parsed?.[0]
  if (!series) return null
  return {
    type: 'opencard-icon-pack',
    schemaVersion: PROJECT_ICON_PACK_SCHEMA_VERSION,
    name: series.name,
    key: series.key,
    spritesheet,
    ...(i18n && Object.keys(i18n).length > 0 ? { i18n } : {}),
    ...(series.grid ? { grid: series.grid } : {}),
    icons: series.icons,
  }
}

export function serializeProjectIconPackManifest(manifest: ProjectIconPackManifest): string {
  const normalized = parseProjectIconPackManifest(manifest)
  if (!normalized) throw new Error('Invalid icon pack manifest')
  return JSON.stringify(normalized, null, 2)
}

export async function exportProjectIconPack(options: {
  fs: Pick<FileSystemService, 'readBinaryFile' | 'writeBinaryFile'>
  series: ProjectIconSeries
  spritesheetPath: string
  outputPath: string
}): Promise<string> {
  const sourceName = options.series.source.replace(/\\/g, '/').split('/').pop() ?? ''
  const extension = spritesheetExtension(sourceName)
  if (!extension) throw new Error('Unsupported icon pack spritesheet')
  const spritesheet = `spritesheet.${extension}`
  const manifest = createProjectIconPackManifest(options.series, spritesheet)
  const outputPath = options.outputPath.toLowerCase().endsWith(`.${PROJECT_ICON_PACK_EXTENSION}`)
    ? options.outputPath
    : `${options.outputPath}.${PROJECT_ICON_PACK_EXTENSION}`
  const archive = zipSync({
    [PROJECT_ICON_PACK_MANIFEST_FILE_NAME]: strToU8(serializeProjectIconPackManifest(manifest)),
    [spritesheet]: await options.fs.readBinaryFile(options.spritesheetPath),
  }, { level: 6 })
  await options.fs.writeBinaryFile(outputPath, archive)
  return outputPath
}

export async function readProjectIconPack(
  fs: Pick<FileSystemService, 'readBinaryFile'>,
  sourcePath: string,
): Promise<ProjectIconPack> {
  const bytes = await fs.readBinaryFile(sourcePath)
  if (bytes.byteLength > MAX_ICON_PACK_BYTES) throw new Error('Icon pack is too large')
  const unpacked = unzipSync(bytes)
  const normalized = new Map<string, Uint8Array>()
  let unpackedBytes = 0
  for (const [rawPath, content] of Object.entries(unpacked)) {
    const path = normalizeArchivePath(rawPath)
    if (!path || normalized.has(path)) throw new Error('Invalid icon pack path')
    unpackedBytes += content.byteLength
    if (unpackedBytes > MAX_ICON_PACK_UNPACKED_BYTES) throw new Error('Unpacked icon pack is too large')
    normalized.set(path, content)
  }

  const manifestBytes = normalized.get(PROJECT_ICON_PACK_MANIFEST_FILE_NAME)
  if (!manifestBytes) throw new Error('Icon pack manifest is missing')
  let parsed: unknown
  try {
    parsed = JSON.parse(strFromU8(manifestBytes))
  } catch {
    throw new Error('Icon pack manifest is invalid')
  }
  const manifest = parseProjectIconPackManifest(parsed)
  if (!manifest) throw new Error('Icon pack manifest is invalid')
  if (normalized.size !== 2 || !normalized.has(manifest.spritesheet)) {
    throw new Error('Icon pack must contain one manifest and one spritesheet')
  }
  return { manifest, spritesheetBytes: normalized.get(manifest.spritesheet)! }
}
