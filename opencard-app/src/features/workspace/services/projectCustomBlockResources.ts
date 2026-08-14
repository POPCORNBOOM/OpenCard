import type { CardBlock } from '../../../entities/card/model'
import { visitCardBlockTree } from '../../../entities/card/tree'
import type { ProjectFontFace, ProjectFontRegistry } from '../model/projectFontRegistry'
import { PROJECT_INTERNAL_DIRECTORY_NAME } from '../model/projectStructure'
import type { ProjectRemoteResourcePolicy } from '../model/projectMetadata'
import { isRemoteResourceAllowed } from '../../editor-runtime/services/editorResource'
import type { FileSystemService } from './fileSystemService'
import type {
  ProjectCustomBlockFontResource,
  ProjectCustomBlockResourceIndex,
} from '../model/projectCustomBlocks'
import { findProjectCustomBlockFile } from './projectCustomBlock'
import type { ProjectIconSeries } from '../model/projectIcons'
import { findProjectIcon, projectIconIdentity, type ProjectIconCatalog, type ProjectIconCatalogEntry } from './projectIconCatalog'
import {
  composeProjectCustomBlockIconAtlas,
  createProjectCustomBlockIconSeries,
  type ProjectCustomBlockIconAtlas,
} from './projectCustomBlockIconAtlas'
import {
  collectProjectIconReferences,
  rewriteProjectIconReferences,
} from '../../../shared/rich-text/projectIconReference'
import { customBlockResourceOwnerIdentity } from '../../card-rendering/expandCustomBlocks'

export type CollectedCustomBlockResources = {
  files: ReadonlyMap<string, Uint8Array>
  index: ProjectCustomBlockResourceIndex
  imageSources: ReadonlyMap<string, string>
  fontSources: ReadonlyMap<string, string>
  fontFamilyReplacements: ReadonlyMap<string, string>
  localFontReplacements: ReadonlyMap<string, string>
  iconReplacements: ReadonlyMap<string, { seriesKey: string; iconKey: string }>
  resourceOwners?: ReadonlyMap<string, string>
}

type CustomBlockResourceCatalog = ReadonlyMap<string, {
  readonly manifest: {
    readonly customBlockKey: string
    readonly resources?: ProjectCustomBlockResourceIndex
  }
  readonly files?: ReadonlyMap<string, Uint8Array>
  readonly iconCatalog?: ProjectIconCatalog
}>

function ownedResourceIdentity(owner: string | undefined, value: string): string {
  return `${owner?.toLowerCase() ?? ''}\u0000${value.toLowerCase()}`
}

export function createProjectCustomBlockFontFamily(packageKey: string, fontKey: string): string {
  return `OpenCardCustomBlock-${packageKey}-${fontKey}`
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function decodeDataUrl(source: string): { bytes: Uint8Array; extension: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(source)
  if (!match) return null
  const mime = match[1] ?? 'application/octet-stream'
  const decoded = match[2]
    ? Uint8Array.from(atob(match[3]), char => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(match[3]))
  const extension = mime === 'image/png' ? 'png'
    : mime === 'image/jpeg' ? 'jpg'
      : mime === 'image/webp' ? 'webp'
        : 'bin'
  return { bytes: decoded, extension }
}

function extensionOf(source: string, fallback: string): string {
  const path = source.split(/[?#]/, 1)[0]
  return /\.([a-z0-9]+)$/i.exec(path)?.[1].toLowerCase() ?? fallback
}

export async function collectProjectCustomBlockResources(options: {
  root: CardBlock
  projectRootPath: string
  projectFonts?: ProjectFontRegistry
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  fs: Pick<FileSystemService, 'readBinaryFile'>
  fetchBytes?: (url: string) => Promise<Uint8Array>
  packageKey: string
  projectIconCatalog?: ProjectIconCatalog
  customBlockCatalog?: CustomBlockResourceCatalog
  resourceOwners?: ReadonlyMap<string, string>
  composeIconAtlas?: (
    entries: readonly ProjectIconCatalogEntry[],
    loadSourceBytes: (entry: ProjectIconCatalogEntry) => Promise<Uint8Array>,
  ) => Promise<ProjectCustomBlockIconAtlas>
}): Promise<CollectedCustomBlockResources> {
  const imageSources = new Map<string, { source: string; owner?: string }>()
  const fontKeys = new Set<string>()
  const localFontKeys = new Map<string, { key: string; owner: string }>()
  const iconIdentities = new Map<string, { seriesKey: string; iconKey: string; owner?: string }>()
  const packagedFontFamilies = new Set<string>()
  visitCardBlockTree(options.root, block => {
    const imageOwner = options.resourceOwners?.get(customBlockResourceOwnerIdentity(block.id, 'image'))
    if (block.type === 'image-block' && block.image?.trim()) {
      const source = block.image.trim()
      imageSources.set(ownedResourceIdentity(imageOwner, source), { source, owner: imageOwner })
    }
    const fontFamily = 'fontFamily' in block ? block.fontFamily : undefined
    const fontOwner = options.resourceOwners?.get(customBlockResourceOwnerIdentity(block.id, 'fontFamily'))
    for (const entry of fontFamily?.split(';') ?? []) {
      const value = entry.trim()
      if (value.toLowerCase().startsWith('resource:font:') && fontOwner) {
        const key = value.slice('resource:font:'.length)
        localFontKeys.set(ownedResourceIdentity(fontOwner, key), { key, owner: fontOwner })
      } else if (value.toLowerCase().startsWith('font:')) fontKeys.add(value.slice(5).toLowerCase())
      else if (value.toLowerCase().startsWith('opencardcustomblock-')) packagedFontFamilies.add(value.toLowerCase())
    }
    for (const [fieldKey, value] of Object.entries(block)) {
      if (typeof value !== 'string') continue
      const owner = options.resourceOwners?.get(customBlockResourceOwnerIdentity(block.id, fieldKey))
      for (const reference of collectProjectIconReferences(value)) {
        iconIdentities.set(ownedResourceIdentity(owner, projectIconIdentity(reference.seriesKey, reference.iconKey)), { ...reference, owner })
      }
    }
  })

  const files = new Map<string, Uint8Array>()
  const images: { key: string; source: string }[] = []
  const imageArchivePaths = new Map<string, string>()
  const fonts: ProjectCustomBlockFontResource[] = []
  const imageSourceMap = new Map<string, string>()
  const fontSourceMap = new Map<string, string>()
  const fontFamilyReplacements = new Map<string, string>()
  const localFontReplacements = new Map<string, string>()
  const iconReplacements = new Map<string, { seriesKey: string; iconKey: string }>()
  let resourcesIconSeries: ProjectIconSeries[] = []
  const root = options.projectRootPath.replace(/\\/g, '/').replace(/\/$/, '')

  const resourceKeys = new Set<string>()
  const projectFontKeys = new Map<string, string>()
  const packagedFontKeys = new Map<string, string>()
  const availableResourceKey = (preferred: string): string => {
    const base = preferred.toLowerCase()
    if (!resourceKeys.has(base)) {
      resourceKeys.add(base)
      return preferred
    }
    let suffix = 2
    while (resourceKeys.has(`${base}-${suffix}`)) suffix += 1
    const key = `${preferred}-${suffix}`
    resourceKeys.add(key.toLowerCase())
    return key
  }
  const archiveFontFace = async (
    face: ProjectFontFace,
    loadBytes: (source: string) => Promise<Uint8Array>,
  ): Promise<ProjectFontFace> => {
    const bytes = await loadBytes(face.source)
    const hash = await sha256(bytes)
    const archivePath = `resources/fonts/${hash}.${extensionOf(face.source, 'bin')}`
    if (!files.has(archivePath)) files.set(archivePath, bytes)
    return { ...face, source: archivePath }
  }
  const findProjectFont = (key: string) => Object.entries(options.projectFonts ?? {})
    .find(([candidate]) => candidate.toLowerCase() === key.toLowerCase())?.[1]
  const ensureProjectFont = async (sourceKey: string): Promise<string> => {
    const identity = sourceKey.toLowerCase()
    const existing = projectFontKeys.get(identity)
    if (existing) return existing
    const entry = findProjectFont(sourceKey)
    if (!entry) throw new Error(`Custom block font is missing: font:${sourceKey}`)
    const key = availableResourceKey(entry.kind === 'family' ? entry.family.key : entry.composition.key)
    projectFontKeys.set(identity, key)
    if (entry.kind === 'family') {
      const faces = await Promise.all(entry.family.faces.map(face => archiveFontFace(
        face,
        source => options.fs.readBinaryFile(`${root}/${PROJECT_INTERNAL_DIRECTORY_NAME}/${source.replace(/\\/g, '/')}`),
      )))
      if (faces.length === 0) throw new Error(`Custom block font has no available face: font:${sourceKey}`)
      fonts.push({ kind: 'family', key, name: entry.family.name, faces })
      return key
    }
    const members = []
    for (const member of entry.composition.members) {
      members.push({ ...member, familyKey: await ensureProjectFont(member.familyKey) })
    }
    fonts.push({ kind: 'composition', key, name: entry.composition.name, members })
    return key
  }
  const ensurePackagedFont = async (owner: string, sourceKey: string): Promise<string> => {
    const identity = ownedResourceIdentity(owner, sourceKey)
    const existing = packagedFontKeys.get(identity)
    if (existing) return existing
    const entry = options.customBlockCatalog?.get(owner)
    const font = entry?.manifest.resources?.fonts?.find(candidate => candidate.key.toLowerCase() === sourceKey.toLowerCase())
    if (!entry || !font) throw new Error(`Custom block font resource is missing: ${owner}/${sourceKey}`)
    const key = availableResourceKey(`${owner}-${font.key}`)
    packagedFontKeys.set(identity, key)
    if (font.kind === 'family') {
      const faces = await Promise.all(font.faces.map(face => archiveFontFace(face, async source => {
        const bytes = entry.files && findProjectCustomBlockFile(entry.files, source)
        if (!bytes) throw new Error(`Custom block font resource is missing: ${source}`)
        return bytes
      })))
      fonts.push({ kind: 'family', key, name: font.name, faces })
      return key
    }
    const members = []
    for (const member of font.members) {
      members.push({ ...member, familyKey: await ensurePackagedFont(owner, member.familyKey) })
    }
    fonts.push({ kind: 'composition', key, name: font.name, members })
    return key
  }

  for (const { source, owner } of imageSources.values()) {
    let bytes: Uint8Array
    let extension = extensionOf(source, 'bin')
    const data = decodeDataUrl(source)
    if (data) {
      bytes = data.bytes
      extension = data.extension
    } else if (/^https?:\/\//i.test(source)) {
      if (!isRemoteResourceAllowed(source, options.remoteResourcePolicy) || !options.fetchBytes) {
        throw new Error(`Custom block image cannot be downloaded: ${source}`)
      }
      bytes = await options.fetchBytes(source)
    } else if (source.toLowerCase().startsWith('resource:image:') && owner) {
      const key = source.slice('resource:image:'.length).toLowerCase()
      const entry = options.customBlockCatalog?.get(owner)
      const resourcePath = entry?.manifest.resources?.images?.find(image => image.key.toLowerCase() === key)?.source
      const resourceBytes = entry?.files && resourcePath ? findProjectCustomBlockFile(entry.files, resourcePath) : undefined
      if (!resourceBytes) {
        throw new Error(`Custom block image resource is missing: ${source}`)
      }
      bytes = resourceBytes
      extension = extensionOf(resourcePath!, 'bin')
    } else {
      const relative = source.replace(/\\/g, '/').replace(/^\/+/, '')
      if (relative.split('/').includes('..')) throw new Error(`Invalid custom block image path: ${source}`)
      bytes = await options.fs.readBinaryFile(`${root}/${relative}`)
    }
    const hash = await sha256(bytes)
    const archivePath = imageArchivePaths.get(hash) ?? `resources/images/${hash}.${extension}`
    imageArchivePaths.set(hash, archivePath)
    if (!files.has(archivePath)) files.set(archivePath, bytes)
    if (!images.some(image => image.key === hash)) images.push({ key: hash, source: archivePath })
    imageSourceMap.set(ownedResourceIdentity(owner, source), archivePath)
  }

  for (const { key: sourceKey, owner } of localFontKeys.values()) {
    const key = await ensurePackagedFont(owner, sourceKey)
    localFontReplacements.set(ownedResourceIdentity(owner, sourceKey), `resource:font:${key}`)
  }

  for (const key of fontKeys) {
    const packagedKey = await ensureProjectFont(key)
    fontSourceMap.set(key, packagedKey)
  }

  for (const family of packagedFontFamilies) {
    let match: { owner: string; key: string } | null = null
    for (const entry of options.customBlockCatalog?.values() ?? []) {
      for (const font of entry.manifest.resources?.fonts ?? []) {
        if (createProjectCustomBlockFontFamily(entry.manifest.customBlockKey, font.key).toLowerCase() !== family) continue
        match = { owner: entry.manifest.customBlockKey, key: font.key }
      }
    }
    if (!match) throw new Error(`Custom block font is missing: ${family}`)
    const key = await ensurePackagedFont(match.owner, match.key)
    fontFamilyReplacements.set(family, `resource:font:${key}`)
  }

  if (iconIdentities.size > 0) {
    const iconEntryOwners = new Map<ProjectIconCatalogEntry, string | undefined>()
    const entries = [...iconIdentities.values()].map(reference => {
      const scopedCatalog = reference.owner ? options.customBlockCatalog?.get(reference.owner)?.iconCatalog : undefined
      const entry = findProjectIcon(scopedCatalog ?? options.projectIconCatalog, reference.seriesKey, reference.iconKey)
      if (!entry) throw new Error(`Custom block icon is missing: ${reference.seriesKey}/${reference.iconKey}`)
      iconEntryOwners.set(entry, reference.owner)
      return entry
    })
    const loadIconSourceBytes = async (icon: ProjectIconCatalogEntry): Promise<Uint8Array> => {
      const owner = iconEntryOwners.get(icon)
      if (owner) {
        const customBlock = options.customBlockCatalog?.get(owner)
        const series = customBlock?.manifest.resources?.iconSeries?.find(candidate => (
          candidate.key.toLowerCase() === icon.seriesKey.toLowerCase()
        ))
        const bytes = customBlock?.files && series
          ? findProjectCustomBlockFile(customBlock.files, series.source)
          : undefined
        if (!bytes) throw new Error(`Custom block icon resource is missing: ${owner}/${icon.seriesKey}`)
        return bytes
      }
      for (const customBlock of options.customBlockCatalog?.values() ?? []) {
        const series = customBlock.manifest.resources?.iconSeries?.find(candidate => (
          candidate.key.toLowerCase() === icon.seriesKey.toLowerCase()
        ))
        if (!series) continue
        const bytes = customBlock.files ? findProjectCustomBlockFile(customBlock.files, series.source) : undefined
        if (!bytes) throw new Error(`Custom block icon resource is missing: ${series.source}`)
        return bytes
      }
      const relative = icon.source.replace(/\\/g, '/').replace(/^\/+/, '')
      if (!relative || relative.split('/').includes('..')) {
        throw new Error(`Invalid project icon path: ${icon.source}`)
      }
      return await options.fs.readBinaryFile(`${root}/${relative}`)
    }
    const atlas = await (options.composeIconAtlas ?? composeProjectCustomBlockIconAtlas)(entries, loadIconSourceBytes)
    const hash = await sha256(atlas.bytes)
    const archivePath = `resources/icons/${hash}.png`
    files.set(archivePath, atlas.bytes)
    const series = createProjectCustomBlockIconSeries({ packageKey: options.packageKey, source: archivePath, icons: atlas.icons })
    ;[...iconIdentities.entries()].forEach(([identity], index) => {
      iconReplacements.set(identity, { seriesKey: series.key, iconKey: atlas.icons[index]!.iconKey })
    })
    resourcesIconSeries = [series]
  }

  return {
    files,
    index: {
      ...(images.length ? { images } : {}),
      ...(fonts.length ? { fonts } : {}),
      ...(resourcesIconSeries.length ? { iconSeries: resourcesIconSeries } : {}),
    },
    imageSources: imageSourceMap,
    fontSources: fontSourceMap,
    fontFamilyReplacements,
    localFontReplacements,
    iconReplacements,
    resourceOwners: options.resourceOwners,
  }
}

export function rewriteProjectCustomBlockResourceReferences(
  root: CardBlock,
  resources: CollectedCustomBlockResources,
): void {
  visitCardBlockTree(root, block => {
    if (block.type === 'image-block') {
      const owner = resources.resourceOwners?.get(customBlockResourceOwnerIdentity(block.id, 'image'))
      const archivePath = resources.imageSources.get(ownedResourceIdentity(owner, block.image))
      const resource = resources.index.images?.find(image => image.source === archivePath)
      if (resource) block.image = `resource:image:${resource.key}`
    }
    if ('fontFamily' in block && block.fontFamily) {
      block.fontFamily = block.fontFamily.split(';').map(entry => {
        const value = entry.trim()
        const owner = resources.resourceOwners?.get(customBlockResourceOwnerIdentity(block.id, 'fontFamily'))
        const localReplacement = value.toLowerCase().startsWith('resource:font:')
          ? resources.localFontReplacements.get(ownedResourceIdentity(owner, value.slice('resource:font:'.length)))
          : undefined
        if (localReplacement) return localReplacement
        const packagedReplacement = resources.fontFamilyReplacements.get(value.toLowerCase())
        if (packagedReplacement) return packagedReplacement
        if (!value.toLowerCase().startsWith('font:')) return value
        const key = value.slice(5).toLowerCase()
        const packagedKey = resources.fontSources.get(key)
        return packagedKey ? `resource:font:${packagedKey}` : value
      }).join('; ')
    }
    for (const [fieldKey, fieldValue] of Object.entries(block)) {
      if (typeof fieldValue !== 'string') continue
      const rewritten = rewriteProjectIconReferences(fieldValue, reference => (
        resources.iconReplacements.get(ownedResourceIdentity(
          resources.resourceOwners?.get(customBlockResourceOwnerIdentity(block.id, fieldKey)),
          projectIconIdentity(reference.seriesKey, reference.iconKey),
        )) ?? reference
      ))
      if (rewritten !== fieldValue) (block as unknown as Record<string, unknown>)[fieldKey] = rewritten
    }
  })
}
