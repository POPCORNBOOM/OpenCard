import { strToU8 } from 'fflate'
import type { CardBlock } from '../../../entities/card/model'
import { visitCardBlockTree } from '../../../entities/card/tree'
import { collectProjectIconReferences } from '../../../shared/rich-text/projectIconReference'
import type { ProjectFontRegistry, ProjectFontRegistryDocument } from '../model/projectFontRegistry'
import { projectFontFileEntries, serializeProjectFontRegistry } from '../model/projectFontRegistry'
import type { ProjectIconSeries } from '../model/projectIcons'
import { serializeProjectIconRegistry } from '../model/projectIconRegistry'
import type {
  ProjectCustomBlockManifestCatalog,
  ProjectCustomBlockPackageIssue,
} from '../model/projectCustomBlocks'
import {
  MAX_CUSTOM_BLOCK_ENTRIES,
  MAX_CUSTOM_BLOCK_UNPACKED_BYTES,
} from './projectCustomBlock'
import type { FileSystemService } from './fileSystemService'
import { normalizeProjectResourcePath } from './projectResourceEnvironment'

export type ProjectCustomBlockResourceCandidateKind = 'image' | 'font' | 'icon' | 'custom-block'

export type ProjectCustomBlockResourceCandidate = {
  id: string
  kind: ProjectCustomBlockResourceCandidateKind
  path: string
  label: string
  automatic: boolean
  suggested: boolean
  referenceCount: number
  references: readonly string[]
  fontKey?: string
  iconSeriesKey?: string
  packageId?: string
  iconKeys?: readonly string[]
  missing?: boolean
}

export type ProjectCustomBlockResourceAnalysis = {
  candidates: readonly ProjectCustomBlockResourceCandidate[]
  defaultSelectedIds: ReadonlySet<string>
  issues: readonly ProjectCustomBlockPackageIssue[]
}

export type MaterializedProjectCustomBlockResources = {
  files: ReadonlyMap<string, Uint8Array>
  issues: readonly ProjectCustomBlockPackageIssue[]
  selectedCandidates: readonly ProjectCustomBlockResourceCandidate[]
}

const imageExtensionPattern = /\.(?:png|jpe?g|webp|gif|svg|avif)$/i
const dynamicTokenPattern = /\{\{[^{}]+\}\}/
const dynamicIconSeriesPattern = /data-oc-icon-path\s*=\s*["']([a-z0-9][a-z0-9._-]*)\/[^{"']*\{\{/gi

function normalizeRelativeProjectPath(path: string): string | null {
  return normalizeProjectResourcePath(path.replace(/^[/\\]+/, ''))
}

function basename(path: string): string {
  return path.split('/').pop() ?? path
}

function issue(
  code: ProjectCustomBlockPackageIssue['code'],
  path: string,
  message: string,
): ProjectCustomBlockPackageIssue {
  return { code, path, message }
}

function stringValues(root: CardBlock): Array<{ blockId: string, fieldKey: string, value: string }> {
  const values: Array<{ blockId: string, fieldKey: string, value: string }> = []
  const seen = new Set<object>()
  const scan = (value: unknown, blockId: string, fieldKey: string): void => {
    if (typeof value === 'string') {
      values.push({ blockId, fieldKey, value })
      return
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    if (Array.isArray(value)) value.forEach(item => scan(item, blockId, fieldKey))
    else Object.values(value).forEach(item => scan(item, blockId, fieldKey))
  }
  visitCardBlockTree(root, block => {
    for (const [fieldKey, value] of Object.entries(block)) {
      if (fieldKey !== 'children') scan(value, block.id, fieldKey)
    }
  })
  return values
}

function addReference(
  references: Map<string, Set<string>>,
  id: string,
  reference: string,
): void {
  const current = references.get(id) ?? new Set<string>()
  current.add(reference)
  references.set(id, current)
}

function collectFontSources(
  key: string,
  registry: ProjectFontRegistry,
  seen: Set<string> = new Set(),
): Array<{ fontKey: string, source: string }> {
  const identity = key.toLocaleLowerCase()
  if (seen.has(identity)) return []
  seen.add(identity)
  const located = Object.entries(registry).find(([candidate]) => candidate.toLocaleLowerCase() === identity)?.[1]
  if (!located) return []
  if (located.kind === 'family') {
    return projectFontFileEntries(located.family).map(slot => ({ fontKey: located.family.key, source: slot.source }))
  }
  return located.composition.members.flatMap(member => collectFontSources(member.fontKey, registry, seen))
}

export async function analyzeProjectCustomBlockResources(options: {
  root: CardBlock
  projectRootPath: string
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'fileExists'>
  projectFonts?: ProjectFontRegistry
  projectIconSeries?: readonly ProjectIconSeries[]
  customBlockManifestCatalog?: ProjectCustomBlockManifestCatalog
}): Promise<ProjectCustomBlockResourceAnalysis> {
  const root = options.projectRootPath.replace(/[\\/]+$/, '')
  const issues: ProjectCustomBlockPackageIssue[] = []
  const allEntries = await options.fs.readDirectoryEntries(root, Number.POSITIVE_INFINITY)
  const iconSources = new Set((options.projectIconSeries ?? []).map(series => (
    `.opencard/${series.source}`.toLocaleLowerCase()
  )))
  const fontSources = new Map<string, string>()
  for (const entry of Object.values(options.projectFonts ?? {})) {
    if (entry.kind !== 'family') continue
    for (const slot of projectFontFileEntries(entry.family)) {
      fontSources.set(`.opencard/${slot.source}`.toLocaleLowerCase(), entry.family.key)
    }
  }

  const candidates = new Map<string, ProjectCustomBlockResourceCandidate>()
  const candidateByPath = new Map<string, string>()
  for (const entry of allEntries) {
    if (!entry.isFile || entry.isSymlink) continue
    const path = normalizeRelativeProjectPath(entry.name)
    if (!path) continue
    const identity = path.toLocaleLowerCase()
    if (identity.startsWith('.opencard/blocks/')) continue
    if (fontSources.has(identity)) {
      const fontKey = fontSources.get(identity)!
      const id = `font:${identity}`
      candidates.set(id, {
        id, kind: 'font', path, label: basename(path), automatic: false, suggested: false,
        referenceCount: 0, references: [], fontKey,
      })
      candidateByPath.set(identity, id)
      continue
    }
    if (iconSources.has(identity)) continue
    if (identity.startsWith('.opencard/')) continue
    if (!imageExtensionPattern.test(path)) continue
    const id = `image:${identity}`
    candidates.set(id, {
      id, kind: 'image', path, label: basename(path), automatic: false, suggested: false,
      referenceCount: 0, references: [],
    })
    candidateByPath.set(identity, id)
  }

  for (const series of options.projectIconSeries ?? []) {
    const path = `.opencard/${series.source}`
    const id = `icon:${series.key.toLocaleLowerCase()}`
    candidates.set(id, {
      id, kind: 'icon', path, label: series.name || series.key, automatic: false, suggested: false,
      referenceCount: 0, references: [], iconSeriesKey: series.key,
    })
  }
  for (const descriptor of options.customBlockManifestCatalog?.values() ?? []) {
    const packageId = descriptor.manifest.packageId
    const id = `custom-block:${packageId.toLocaleLowerCase()}`
    candidates.set(id, {
      id,
      kind: 'custom-block',
      path: `.opencard/blocks/${packageId}`,
      label: descriptor.manifest.name,
      automatic: false,
      suggested: false,
      referenceCount: 0,
      references: [],
      packageId,
    })
  }

  const references = new Map<string, Set<string>>()
  const automatic = new Set<string>()
  const suggested = new Set<string>()
  const referencedIconKeys = new Map<string, Set<string>>()
  const values = stringValues(options.root)
  for (const { blockId, fieldKey, value } of values) {
    const referenceLabel = `${blockId}.${fieldKey}`
    const directPath = !dynamicTokenPattern.test(value) ? normalizeRelativeProjectPath(value) : null
    let directId = directPath ? candidateByPath.get(directPath.toLocaleLowerCase()) : undefined
    if (!directId && directPath && imageExtensionPattern.test(directPath)) {
      const identity = directPath.toLocaleLowerCase()
      directId = `image:${identity}`
      candidates.set(directId, {
        id: directId, kind: 'image', path: directPath, label: basename(directPath),
        automatic: false, suggested: false, referenceCount: 0, references: [], missing: true,
      })
      candidateByPath.set(identity, directId)
    }
    if (directId) {
      automatic.add(directId)
      addReference(references, directId, referenceLabel)
    } else if (dynamicTokenPattern.test(value)) {
      const prefix = value.split('{{', 1)[0]!.replace(/[/\\]+$/, '').toLocaleLowerCase()
      if (prefix) {
        for (const [path, candidateId] of candidateByPath) {
          if (path.startsWith(prefix)) {
            suggested.add(candidateId)
            addReference(references, candidateId, referenceLabel)
          }
        }
      }
    }

    if (fieldKey === 'fontFamily') {
      for (const family of value.split(';').map(item => item.trim())) {
        if (!family.toLocaleLowerCase().startsWith('font:')) continue
        const fontKey = family.slice('font:'.length)
        const sources = collectFontSources(fontKey, options.projectFonts ?? {})
        if (sources.length === 0) {
          issues.push(issue('resource-unavailable', family, 'Referenced project font is unavailable'))
        }
        for (const source of sources) {
          const candidateId = candidateByPath.get(`.opencard/${source.source}`.toLocaleLowerCase())
          if (!candidateId) continue
          automatic.add(candidateId)
          addReference(references, candidateId, referenceLabel)
        }
      }
    }

    for (const iconReference of collectProjectIconReferences(value)) {
      const candidateId = `icon:${iconReference.seriesKey.toLocaleLowerCase()}`
      const series = (options.projectIconSeries ?? []).find(candidate => (
        candidate.key.toLocaleLowerCase() === iconReference.seriesKey.toLocaleLowerCase()
      ))
      const iconExists = series?.icons.some(icon => (
        icon.iconKey.toLocaleLowerCase() === iconReference.iconKey.toLocaleLowerCase()
      ))
      if (!candidates.has(candidateId) || !iconExists) {
        issues.push(issue('resource-unavailable', `${iconReference.seriesKey}/${iconReference.iconKey}`, 'Referenced project icon is unavailable'))
        continue
      }
      automatic.add(candidateId)
      addReference(references, candidateId, referenceLabel)
      const iconKeys = referencedIconKeys.get(candidateId) ?? new Set<string>()
      iconKeys.add(iconReference.iconKey.toLocaleLowerCase())
      referencedIconKeys.set(candidateId, iconKeys)
    }
    for (const match of value.matchAll(dynamicIconSeriesPattern)) {
      const candidateId = `icon:${match[1]!.toLocaleLowerCase()}`
      if (!candidates.has(candidateId)) continue
      suggested.add(candidateId)
      addReference(references, candidateId, referenceLabel)
    }
  }

  visitCardBlockTree(options.root, block => {
    if (block.type !== 'custom-block') return
    const candidateId = `custom-block:${block.packageId.toLocaleLowerCase()}`
    if (!candidates.has(candidateId)) {
      issues.push(issue('dependency-unavailable', block.packageId, 'Nested custom block is not installed'))
      return
    }
    automatic.add(candidateId)
    addReference(references, candidateId, block.id)
  })

  const enriched = [...candidates.values()].map(candidate => {
    const candidateReferences = [...(references.get(candidate.id) ?? [])]
    return {
      ...(candidate.kind === 'icon' ? { iconKeys: [...(referencedIconKeys.get(candidate.id) ?? [])] } : {}),
      ...candidate,
      automatic: automatic.has(candidate.id),
      suggested: !automatic.has(candidate.id) && suggested.has(candidate.id),
      referenceCount: candidateReferences.length,
      references: candidateReferences,
    }
  }).sort((left, right) => left.path.localeCompare(right.path))
  return {
    candidates: enriched,
    defaultSelectedIds: new Set(enriched.filter(candidate => candidate.automatic || candidate.suggested).map(candidate => candidate.id)),
    issues,
  }
}

function selectedFontDocument(
  selected: readonly ProjectCustomBlockResourceCandidate[],
  registry: ProjectFontRegistry,
): ProjectFontRegistryDocument {
  const selectedSources = new Set(selected.filter(candidate => candidate.kind === 'font')
    .map(candidate => candidate.path.replace(/^\.opencard\//, '').toLocaleLowerCase()))
  const families = Object.values(registry).flatMap(entry => {
    if (entry.kind !== 'family') return []
    const files = Object.fromEntries(Object.entries(entry.family.files).flatMap(([weight, styles]) => {
      const selectedStyles = Object.fromEntries(Object.entries(styles ?? {}).filter(([, source]) => (
        selectedSources.has(source.toLocaleLowerCase())
      )))
      return Object.keys(selectedStyles).length ? [[weight, selectedStyles]] : []
    })) as typeof entry.family.files
    return Object.keys(files).length ? [{ ...entry.family, files }] : []
  })
  const familyKeys = new Set(families.map(font => font.key.toLocaleLowerCase()))
  const compositions = Object.values(registry).flatMap(entry => (
    entry.kind === 'composition' && entry.composition.members.every(member => familyKeys.has(member.fontKey.toLocaleLowerCase()))
      ? [entry.composition]
      : []
  ))
  return {
    ...(families.length ? { families } : {}),
    ...(compositions.length ? { compositions } : {}),
  }
}

async function copyDirectoryToArchive(options: {
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'readBinaryFile'>
  sourceRoot: string
  archiveRoot: string
  files: Map<string, Uint8Array>
  budget: { entries: number, bytes: number }
}): Promise<void> {
  const entries = await options.fs.readDirectoryEntries(options.sourceRoot, Number.POSITIVE_INFINITY)
  for (const entry of entries) {
    if (entry.isSymlink) throw new Error('Custom block dependency contains a symbolic link')
    if (!entry.isFile) continue
    const relative = normalizeProjectResourcePath(entry.name)
    if (!relative) throw new Error('Custom block dependency contains an unsafe path')
    const bytes = await options.fs.readBinaryFile(`${options.sourceRoot}/${relative}`)
    options.budget.entries += 1
    options.budget.bytes += bytes.byteLength
    if (options.budget.entries > MAX_CUSTOM_BLOCK_ENTRIES
      || options.budget.bytes > MAX_CUSTOM_BLOCK_UNPACKED_BYTES) {
      throw new Error('Custom block resources exceed package limits')
    }
    options.files.set(`${options.archiveRoot}/${relative}`, bytes)
  }
}

export async function materializeProjectCustomBlockResources(options: {
  analysis: ProjectCustomBlockResourceAnalysis
  selectedIds: ReadonlySet<string>
  projectRootPath: string
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'readBinaryFile'>
  projectFonts?: ProjectFontRegistry
  projectIconSeries?: readonly ProjectIconSeries[]
  customBlockManifestCatalog?: ProjectCustomBlockManifestCatalog
}): Promise<MaterializedProjectCustomBlockResources> {
  const root = options.projectRootPath.replace(/[\\/]+$/, '')
  const files = new Map<string, Uint8Array>()
  const issues: ProjectCustomBlockPackageIssue[] = []
  const selected = options.analysis.candidates.filter(candidate => options.selectedIds.has(candidate.id))
  const budget = { entries: 0, bytes: 0 }

  for (const candidate of selected) {
    try {
      if (candidate.kind === 'custom-block') {
        const descriptor = candidate.packageId
          ? options.customBlockManifestCatalog?.get(candidate.packageId.toLocaleLowerCase())
          : undefined
        if (!descriptor || !candidate.packageId) throw new Error('Nested custom block is unavailable')
        await copyDirectoryToArchive({
          fs: options.fs,
          sourceRoot: descriptor.installationPath,
          archiveRoot: `resources/.opencard/blocks/${candidate.packageId}`,
          files,
          budget,
        })
        continue
      }
      const path = normalizeProjectResourcePath(candidate.path)
      if (!path) throw new Error('Resource path is unsafe')
      const bytes = await options.fs.readBinaryFile(`${root}/${path}`)
      budget.entries += 1
      budget.bytes += bytes.byteLength
      if (budget.entries > MAX_CUSTOM_BLOCK_ENTRIES || budget.bytes > MAX_CUSTOM_BLOCK_UNPACKED_BYTES) {
        throw new Error('Custom block resources exceed package limits')
      }
      files.set(`resources/${path}`, bytes)
    } catch (cause) {
      issues.push(issue(
        candidate.kind === 'custom-block' ? 'dependency-unavailable' : 'resource-unavailable',
        candidate.path,
        cause instanceof Error ? cause.message : String(cause),
      ))
    }
  }

  const fontDocument = selectedFontDocument(selected, options.projectFonts ?? {})
  if (Object.keys(fontDocument).length > 0) {
    files.set('resources/.opencard/.ocfonts', strToU8(serializeProjectFontRegistry(fontDocument)))
  }
  const selectedIconCandidates = new Map(selected.filter(candidate => candidate.kind === 'icon')
    .map(candidate => [candidate.iconSeriesKey?.toLocaleLowerCase(), candidate]))
  const iconSeries = (options.projectIconSeries ?? []).flatMap(series => {
    const candidate = selectedIconCandidates.get(series.key.toLocaleLowerCase())
    if (!candidate) return []
    const iconKeys = new Set(candidate.iconKeys ?? [])
    return [{
      ...series,
      icons: iconKeys.size > 0
        ? series.icons.filter(icon => iconKeys.has(icon.iconKey.toLocaleLowerCase()))
        : series.icons,
    }]
  })
  if (iconSeries.length > 0) {
    files.set('resources/.opencard/.ocicons', strToU8(serializeProjectIconRegistry({ iconSeries })))
  }

  for (const candidate of options.analysis.candidates) {
    if (!candidate.automatic || options.selectedIds.has(candidate.id)) continue
    issues.push(issue('resource-unavailable', candidate.path, 'Automatically detected resource was excluded by the author'))
  }
  return { files, issues: [...options.analysis.issues, ...issues], selectedCandidates: selected }
}
