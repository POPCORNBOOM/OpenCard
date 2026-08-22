import {
  createCardFace,
  createCustomBlock,
  type CardDocument,
} from '../../../entities/card/model'
import { fillDefaults } from '../../../entities/card/schema'
import { buildProjectFontRegistry, type ProjectFontRegistry } from '../model/projectFontRegistry'
import type { ProjectIconRegistryDocument } from '../model/projectIconRegistry'
import type { ProjectIconSeries } from '../model/projectIcons'
import type { ProjectRemoteResourcePolicy } from '../model/projectMetadata'
import type { ProjectCustomBlockPackageIssue } from '../model/projectCustomBlocks'
import { prepareCardRender, type PreparedCardRender } from '../../card-rendering/renderPipeline'
import type { CustomBlockRuntimeCatalog, CustomBlockRuntimeEntry } from '../../card-rendering/expandCustomBlocks'
import {
  projectIconIdentity,
  type ProjectIconCatalog,
} from './projectIconCatalog'
import type { PreparedProjectCustomBlockExport } from './exportProjectCustomBlock'
import {
  createSelectedProjectCustomBlockFontDocument,
  type ProjectCustomBlockResourceCandidate,
} from './projectCustomBlockResources'
import {
  normalizeProjectResourcePath,
  type ProjectResourceAccessPolicy,
  type ProjectResourceEnvironment,
} from './projectResourceEnvironment'

export type ProjectCustomBlockPreview = {
  render: PreparedCardRender
  issues: readonly ProjectCustomBlockPackageIssue[]
}

function packageIssue(
  code: ProjectCustomBlockPackageIssue['code'],
  path: string,
  message: string,
): ProjectCustomBlockPackageIssue {
  return { code, path, message }
}

function selectedCandidates(
  prepared: PreparedProjectCustomBlockExport,
  selectedIds: ReadonlySet<string>,
): readonly ProjectCustomBlockResourceCandidate[] {
  return prepared.resourceAnalysis.candidates.filter(candidate => selectedIds.has(candidate.id))
}

function createAccessPolicy(
  selected: readonly ProjectCustomBlockResourceCandidate[],
  sourceIconCatalog: ProjectIconCatalog,
): ProjectResourceAccessPolicy {
  const assetPaths = new Set<string>()
  const fontFiles = new Map<string, Set<string>>()
  const icons = new Map<string, Set<string>>()
  const packageIds = new Set<string>()

  for (const candidate of selected) {
    if (candidate.kind === 'image') {
      const path = normalizeProjectResourcePath(candidate.path)
      if (path) assetPaths.add(path.toLocaleLowerCase())
      continue
    }
    if (candidate.kind === 'font' && candidate.fontKey) {
      const source = normalizeProjectResourcePath(candidate.path.replace(/^\.opencard\//i, ''))
      if (!source) continue
      const key = candidate.fontKey.toLocaleLowerCase()
      const files = fontFiles.get(key) ?? new Set<string>()
      files.add(source.toLocaleLowerCase())
      fontFiles.set(key, files)
      continue
    }
    if (candidate.kind === 'icon' && candidate.iconSeriesKey) {
      const seriesKey = candidate.iconSeriesKey.toLocaleLowerCase()
      const requested = new Set((candidate.iconKeys ?? []).map(key => key.toLocaleLowerCase()))
      if (requested.size === 0) {
        for (const entry of sourceIconCatalog.entries) {
          if (entry.seriesKey.toLocaleLowerCase() === seriesKey) requested.add(entry.iconKey.toLocaleLowerCase())
        }
      }
      icons.set(seriesKey, requested)
      continue
    }
    if (candidate.kind === 'custom-block' && candidate.packageId) {
      packageIds.add(candidate.packageId.toLocaleLowerCase())
    }
  }

  return { mode: 'allow-list', assetPaths, fontFiles, icons, packageIds }
}

function projectIconDocument(
  source: readonly ProjectIconSeries[],
  access: ProjectResourceAccessPolicy,
): ProjectIconRegistryDocument {
  const iconSeries = source.flatMap(series => {
    const allowed = access.icons.get(series.key.toLocaleLowerCase())
    if (!allowed) return []
    return [{
      ...series,
      icons: series.icons.filter(icon => allowed.has(icon.iconKey.toLocaleLowerCase())),
    }]
  })
  return iconSeries.length > 0 ? { iconSeries } : {}
}

function projectIconCatalog(
  source: ProjectIconCatalog,
  access: ProjectResourceAccessPolicy,
): ProjectIconCatalog {
  const series = source.series.filter(candidate => access.icons.has(candidate.key.toLocaleLowerCase()))
  const entries = source.entries.filter(entry => access.icons
    .get(entry.seriesKey.toLocaleLowerCase())?.has(entry.iconKey.toLocaleLowerCase()) === true)
  const errors = source.errors.filter(error => {
    const allowed = access.icons.get(error.seriesKey.toLocaleLowerCase())
    return Boolean(allowed) && (!error.iconKey || allowed?.has(error.iconKey.toLocaleLowerCase()))
  })
  return {
    series,
    entries,
    errors,
    seriesByKey: new Map(series.map(entry => [entry.key.toLocaleLowerCase(), entry])),
    entriesByIdentity: new Map(entries.map(entry => [projectIconIdentity(entry.seriesKey, entry.iconKey), entry])),
  }
}

function dependencyCatalog(
  source: CustomBlockRuntimeCatalog,
  access: ProjectResourceAccessPolicy,
): CustomBlockRuntimeCatalog {
  return new Map([...access.packageIds].flatMap(packageId => {
    const entry = source.get(packageId)
    return entry ? [[packageId, entry] as const] : []
  }))
}

function createPreviewDocument(
  prepared: PreparedProjectCustomBlockExport,
  overrides: Readonly<Record<string, unknown>>,
): CardDocument {
  const block = createCustomBlock({
    id: 'custom-block-export-preview-instance',
    name: prepared.manifest.name,
    packageId: prepared.manifest.packageId,
  })
  for (const [fieldKey, value] of Object.entries(overrides)) {
    ;(block as Record<string, unknown>)[fieldKey] = value
  }
  const front = createCardFace({ id: 'custom-block-export-preview-front', background: 'transparent' })
  front.children.push({
    block,
    location: {
      id: 'custom-block-export-preview-location',
      type: 'simple-container-location',
      anchor: 'lt',
      x: '0px',
      y: '0px',
    },
  })
  return fillDefaults('card-document', {
    type: 'card-document',
    id: 'custom-block-export-preview-document',
    name: prepared.manifest.name,
    ...(prepared.previewHostSize ? prepared.previewHostSize : {}),
    faces: {
      front,
      back: createCardFace({ id: 'custom-block-export-preview-back', background: 'transparent' }),
    },
    instances: [],
  }) as unknown as CardDocument
}

export function collectProjectCustomBlockSelectionIssues(
  prepared: PreparedProjectCustomBlockExport,
  selectedResourceIds: ReadonlySet<string>,
): readonly ProjectCustomBlockPackageIssue[] {
  const selected = selectedCandidates(prepared, selectedResourceIds)
  const excludedReferenced = prepared.resourceAnalysis.candidates.filter(candidate => (
    (candidate.automatic || candidate.suggested) && !selectedResourceIds.has(candidate.id)
  ))
  const missingSelected = selected.filter(candidate => candidate.missing)
  return [
    ...prepared.resourceAnalysis.issues,
    ...excludedReferenced.map(candidate => packageIssue(
      candidate.kind === 'custom-block' ? 'dependency-unavailable' : 'resource-unavailable',
      candidate.path,
      'Detected or suggested resource was excluded by the author',
    )),
    ...missingSelected.map(candidate => packageIssue(
      candidate.kind === 'custom-block' ? 'dependency-unavailable' : 'resource-unavailable',
      candidate.path,
      'Selected resource is unavailable',
    )),
  ]
}

export async function createProjectCustomBlockPreview(options: {
  prepared: PreparedProjectCustomBlockExport
  selectedResourceIds: ReadonlySet<string>
  overrides: Readonly<Record<string, unknown>>
  sourceEnvironment: ProjectResourceEnvironment
  sourceFonts: ProjectFontRegistry
  sourceIconSeries: readonly ProjectIconSeries[]
  sourceIconCatalog: ProjectIconCatalog
  sourceCustomBlockCatalog: CustomBlockRuntimeCatalog
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
}): Promise<ProjectCustomBlockPreview> {
  const selected = selectedCandidates(options.prepared, options.selectedResourceIds)
  const accessPolicy = createAccessPolicy(selected, options.sourceIconCatalog)
  const fontDocument = createSelectedProjectCustomBlockFontDocument(selected, options.sourceFonts)
  const icons = projectIconCatalog(options.sourceIconCatalog, accessPolicy)
  const dependencies = dependencyCatalog(options.sourceCustomBlockCatalog, accessPolicy)
  const environment: ProjectResourceEnvironment = {
    kind: 'package',
    namespace: options.sourceEnvironment.namespace,
    rootPath: options.sourceEnvironment.rootPath,
    fontDocument,
    fonts: buildProjectFontRegistry(fontDocument),
    iconDocument: projectIconDocument(options.sourceIconSeries, accessPolicy),
    iconCatalog: icons,
    issues: [],
    customBlockCatalog: dependencies,
    accessPolicy,
  }
  const runtimeEntry: CustomBlockRuntimeEntry = {
    manifest: options.prepared.manifest,
    block: options.prepared.block,
    environment,
    dependencies,
  }
  const catalog = new Map([[options.prepared.manifest.packageId.toLocaleLowerCase(), runtimeEntry]])
  const hostEnvironment: ProjectResourceEnvironment = {
    ...options.sourceEnvironment,
    customBlockCatalog: catalog,
  }
  const unavailableDependencies = [...accessPolicy.packageIds].filter(packageId => !dependencies.has(packageId))
  const selectionIssues = collectProjectCustomBlockSelectionIssues(
    options.prepared, options.selectedResourceIds,
  )
  const issues = [
    ...selectionIssues,
    ...unavailableDependencies.map(packageId => packageIssue(
      'dependency-unavailable', packageId, 'Selected nested custom block is unavailable',
    )),
  ]
  const render = prepareCardRender({
    document: createPreviewDocument(options.prepared, options.overrides),
    instance: null,
    resourceRootPath: options.sourceEnvironment.rootPath,
    environment: {
      project: null,
      dictionary: null,
      remoteResourcePolicy: options.remoteResourcePolicy,
      projectIconCatalog: options.sourceEnvironment.iconCatalog,
      projectResourceEnvironment: hostEnvironment,
      customBlockCatalog: catalog,
    },
  })
  return { render, issues }
}
