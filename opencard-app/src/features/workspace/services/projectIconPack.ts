import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { FileSystemService } from './fileSystemService'
import { parseProjectIconSeries, type ProjectIcon, type ProjectIconSeries } from '../model/projectIcons'
import { isRecord } from '../../../shared/model/record'

export const PROJECT_ICON_PACK_EXTENSION = 'ociconpack'
export const PROJECT_ICON_PACK_SUFFIX = `.${PROJECT_ICON_PACK_EXTENSION}`
export const PROJECT_ICON_PACK_MANIFEST_FILE_NAME = 'iconpack.json'
export const PROJECT_ICON_PACK_SCHEMA_VERSION = '1'
/** Archive directory holding one file per icon, independent of the project's own folder layout. */
export const PROJECT_ICON_PACK_ICON_DIRECTORY = 'icons'

const MAX_ICON_PACK_BYTES = 128 * 1024 * 1024
const MAX_ICON_PACK_UNPACKED_BYTES = 256 * 1024 * 1024
const ICON_EXTENSION_PATTERN = /\.(?:svg|png|jpe?g|webp)$/i

export type ProjectIconPackLocalizedText = Readonly<Record<string, string>>

export type ProjectIconPackLocalization = {
  name?: ProjectIconPackLocalizedText
}

export type ProjectIconPackManifest = {
  type: 'opencard-icon-pack'
  schemaVersion: typeof PROJECT_ICON_PACK_SCHEMA_VERSION
  name: string
  key: string
  i18n?: ProjectIconPackLocalization
  /** Sources are archive-relative paths such as `icons/warn.svg`. */
  icons: readonly ProjectIcon[]
}

export type ProjectIconPack = {
  manifest: ProjectIconPackManifest
  /** One archive file per declared icon source. */
  iconSources: ReadonlyMap<string, Uint8Array>
}

function parseLocalizedText(value: unknown): ProjectIconPackLocalizedText | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value)
  if (entries.some(([locale, text]) => !locale || typeof text !== 'string' || !text.trim())) return null
  return Object.fromEntries(entries.map(([locale, text]) => [locale, (text as string).trim()]))
}

function normalizeArchivePath(value: string): string | null {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/g, '')
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) return null
  if (normalized.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null
  return normalized
}

export function createProjectIconPackManifest(
  series: ProjectIconSeries,
  archivePaths: ReadonlyMap<string, string>,
): ProjectIconPackManifest {
  return {
    type: 'opencard-icon-pack',
    schemaVersion: PROJECT_ICON_PACK_SCHEMA_VERSION,
    name: series.name,
    key: series.key,
    icons: series.icons.map(icon => {
      const path = archivePaths.get(icon.source)
      if (!path) throw new Error(`Icon pack is missing an archive path for '${icon.source}'`)
      return { ...icon, source: path }
    }),
  }
}

export function parseProjectIconPackManifest(value: unknown): ProjectIconPackManifest | null {
  if (!isRecord(value)
    || value.type !== 'opencard-icon-pack'
    || value.schemaVersion !== PROJECT_ICON_PACK_SCHEMA_VERSION
    || typeof value.name !== 'string'
    || typeof value.key !== 'string'
    || !Array.isArray(value.icons)) return null

  let i18n: ProjectIconPackLocalization | undefined
  if (value.i18n !== undefined) {
    if (!isRecord(value.i18n)) return null
    const name = value.i18n.name === undefined ? undefined : parseLocalizedText(value.i18n.name)
    if (value.i18n.name !== undefined && !name) return null
    i18n = name ? { name } : {}
  }

  const series = parseProjectIconSeries([{
    name: value.name,
    key: value.key,
    icons: value.icons,
  }])?.[0]
  if (!series) return null
  return {
    type: 'opencard-icon-pack',
    schemaVersion: PROJECT_ICON_PACK_SCHEMA_VERSION,
    name: series.name,
    key: series.key,
    ...(i18n && Object.keys(i18n).length > 0 ? { i18n } : {}),
    icons: series.icons,
  }
}

export function serializeProjectIconPackManifest(manifest: ProjectIconPackManifest): string {
  const normalized = parseProjectIconPackManifest(manifest)
  if (!normalized) throw new Error('Invalid icon pack manifest')
  return JSON.stringify(normalized, null, 2)
}

/** Archive path for one icon: its Key plus the extension of the file it came from. */
export function projectIconPackArchivePath(icon: ProjectIcon): string {
  const extension = icon.source.slice(icon.source.lastIndexOf('.'))
  if (!ICON_EXTENSION_PATTERN.test(`x${extension}`)) {
    throw new Error(`Unsupported icon pack source: ${icon.source}`)
  }
  return `${PROJECT_ICON_PACK_ICON_DIRECTORY}/${icon.iconKey}${extension.toLocaleLowerCase()}`
}

/**
 * Writes one `.ociconpack` archive holding a single manifest plus one archive-relative file per icon,
 * so a pack is independent of the project's own folder layout. `onProgress` reports how many icon
 * files have been read, so a long export can drive the shell's global progress.
 */
export async function exportProjectIconPack(options: {
  fs: Pick<FileSystemService, 'readBinaryFile' | 'writeBinaryFile'>
  series: ProjectIconSeries
  resolveSourcePath: (source: string) => string
  outputPath: string
  onProgress?: (completed: number) => void
}): Promise<string> {
  const archivePaths = new Map<string, string>()
  const files: Record<string, Uint8Array> = {}
  let completed = 0
  for (const icon of options.series.icons) {
    const path = projectIconPackArchivePath(icon)
    archivePaths.set(icon.source, path)
    files[path] = await options.fs.readBinaryFile(options.resolveSourcePath(icon.source))
    completed += 1
    options.onProgress?.(completed)
  }
  const manifest = createProjectIconPackManifest(options.series, archivePaths)
  const archive = zipSync({
    [PROJECT_ICON_PACK_MANIFEST_FILE_NAME]: strToU8(serializeProjectIconPackManifest(manifest)),
    ...files,
  }, { level: 6 })
  const outputPath = options.outputPath.toLowerCase().endsWith(`.${PROJECT_ICON_PACK_EXTENSION}`)
    ? options.outputPath
    : `${options.outputPath}.${PROJECT_ICON_PACK_EXTENSION}`
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

  const iconSources = new Map<string, Uint8Array>()
  for (const icon of manifest.icons) {
    if (iconSources.has(icon.source)) continue
    const content = normalized.get(icon.source)
    if (!content) throw new Error(`Icon pack is missing '${icon.source}'`)
    iconSources.set(icon.source, content)
  }
  if (normalized.size !== iconSources.size + 1) {
    throw new Error('Icon pack must contain one manifest and only the icons it declares')
  }
  return { manifest, iconSources }
}
