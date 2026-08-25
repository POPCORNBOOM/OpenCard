import { parseResourceReferenceList } from '../workspace/services/resourceReference'
import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { fileSystemService } from '../workspace/services/fileSystemService'
import { convertFileSrc } from '@tauri-apps/api/core'
import { materializeRevision, readFileAtRevision } from './gitService'
import type { DiffRevisionOption, DiffSession, DiffSnapshot } from './diff.types'
import { compareOcdocuments, type OcdocumentDiffModel } from './ocdocumentDiff'
import { PROJECT_PROFILE_FILE_NAME, parseProjectMetadataText, toProjectInformation } from '../workspace/model/projectMetadata'
import { PROJECT_DICTIONARY_FILE_NAME, parseProjectDictionaryText, resolveProjectDictionary } from '../workspace/model/projectDictionary'
import { PROJECT_ICON_REGISTRY_FILE_NAME, parseProjectIconRegistryText } from '../workspace/model/projectIconRegistry'
import { PROJECT_FONT_REGISTRY_FILE_NAME, parseProjectFontRegistryText, projectFontFileEntries, projectFontWeightValues } from '../workspace/model/projectFontRegistry'
import { buildProjectIconCatalog, EMPTY_PROJECT_ICON_CATALOG, loadProjectImageDimensions } from '../workspace/services/projectIconCatalog'
import { discoverProjectCustomBlockDefinitions } from '../workspace/services/projectCustomBlockDefinition'
import { loadProjectCustomBlockDefinitionRuntime } from '../workspace/services/projectCustomBlockAssetLoader'
import { createProjectCustomBlockFontSession } from '../workspace/services/projectCustomBlockFontLoader'
import { resolveProjectInternalRelativePath } from '../workspace/model/projectStructure'

export interface OcdocumentDiffSessionOptions {
  projectRoot: Ref<string | null | undefined>
  filePath: Ref<string | null | undefined>
  fileName: Ref<string | null | undefined>
  revisions: Ref<readonly DiffRevisionOption[]>
}

function resolveProjectFile(root: string, path: string): string {
  const normalizedRoot = root.replace(/[\\/]$/, '')
  return `${normalizedRoot}/${path.replace(/^[\\/]+/, '').replace(/\\/g, '/')}`
}

const DIFF_RESOURCE_SNAPSHOT_EXTENSIONS = new Set([
  'woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
])

export function isResourceSnapshotDiffPath(path: string): boolean {
  const extension = path.split('.').pop()?.toLocaleLowerCase()
  return Boolean(extension && DIFF_RESOURCE_SNAPSHOT_EXTENSIONS.has(extension))
}

const snapshotContextCache = new Map<string, Promise<Pick<DiffSnapshot, 'project' | 'dictionary' | 'projectIconCatalog' | 'customBlockCatalog' | 'resolveFontFamily'>>>()
const SNAPSHOT_RESOURCE_LOAD_TIMEOUT_MS = 2_000

async function loadSnapshotImageDimensions(src: string): Promise<{ width: number; height: number }> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      loadProjectImageDimensions(src),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('Project image dimensions timed out')), SNAPSHOT_RESOURCE_LOAD_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle)
  }
}

function createSnapshotFontResolver(root: string, fontDocument: NonNullable<ReturnType<typeof parseProjectFontRegistryText>>, namespace: string): (references: string) => string {
  const families = new Map((fontDocument.families ?? []).map(font => [font.key.toLowerCase(), `OpenCardSnapshot-${namespace}-${font.key}`]))
  const compositions = new Map((fontDocument.compositions ?? []).map(composition => [composition.key.toLowerCase(), composition.members[0]?.fontKey?.toLowerCase()]))
  if (typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.dataset.opencardDiffFonts = namespace
    style.textContent = (fontDocument.families ?? []).flatMap(font => projectFontFileEntries(font).map(entry => (
      `@font-face{font-family:${JSON.stringify(families.get(font.key.toLowerCase()) ?? font.key)};src:url(${JSON.stringify(convertFileSrc(resolveProjectFile(root, resolveProjectInternalRelativePath(entry.source))))});font-weight:${projectFontWeightValues[entry.weight]};font-style:${entry.style === 'italic' ? 'italic' : 'normal'};}`
    ))).join('')
    document.head.appendChild(style)
  }
  return references => parseResourceReferenceList(references, 'font').map(token => {
    if (token.diagnostics.length > 0) return ''
    if (!token.reference) return token.source
    if (token.reference.scope !== 'current') return ''
    const key = token.reference.key.toLocaleLowerCase()
    const family = families.get(key) ?? (compositions.get(key) ? families.get(compositions.get(key)!) : undefined)
    return family ? JSON.stringify(family) : ''
  }).filter(Boolean).join(', ')
}

async function loadSnapshotContext(root: string): Promise<Pick<DiffSnapshot, 'project' | 'dictionary' | 'projectIconCatalog' | 'customBlockCatalog' | 'resolveFontFamily'>> {
  const readOptional = async (relativePath: string): Promise<string | null> => {
    const path = resolveProjectFile(root, relativePath)
    return await fileSystemService.fileExists(path) ? await fileSystemService.readFile(path) : null
  }
  let project: DiffSnapshot['project'] = null
  let dictionary: DiffSnapshot['dictionary']
  let projectIconCatalog = EMPTY_PROJECT_ICON_CATALOG
  let customBlockCatalog: DiffSnapshot['customBlockCatalog'] = new Map()
  let resolveFontFamily: DiffSnapshot['resolveFontFamily']
  const profileText = await readOptional(PROJECT_PROFILE_FILE_NAME)
  if (profileText) {
    const profile = parseProjectMetadataText(profileText)
    if (profile) project = toProjectInformation(profile)
  }
  const dictionaryText = await readOptional(PROJECT_DICTIONARY_FILE_NAME)
  if (dictionaryText) {
    const document = parseProjectDictionaryText(dictionaryText)
    if (document) dictionary = resolveProjectDictionary(document).values
  }
  const fontText = await readOptional(PROJECT_FONT_REGISTRY_FILE_NAME)
  if (fontText) {
    const document = parseProjectFontRegistryText(fontText)
    if (document) {
      resolveFontFamily = createSnapshotFontResolver(root, document, root.replace(/[^a-z0-9]+/gi, '-').slice(-24))
    }
  }
  const iconText = await readOptional(PROJECT_ICON_REGISTRY_FILE_NAME)
  if (iconText) {
    const document = parseProjectIconRegistryText(iconText)
    if (document) {
      projectIconCatalog = await buildProjectIconCatalog(
        document.iconSeries,
        source => convertFileSrc(resolveProjectFile(root, resolveProjectInternalRelativePath(source))),
        loadSnapshotImageDimensions,
      )
    }
  }
  const customBlockDescriptors = await discoverProjectCustomBlockDefinitions(fileSystemService, root)
  if (customBlockDescriptors.size > 0) {
    const catalog = new Map()
    const environments = []
    for (const descriptor of customBlockDescriptors.values()) {
      const loaded = await loadProjectCustomBlockDefinitionRuntime({
        fs: fileSystemService,
        entry: descriptor,
        environment: { kind: 'project', namespace: root, rootPath: root, fontDocument: {}, fonts: {}, iconDocument: {}, iconCatalog: EMPTY_PROJECT_ICON_CATALOG, issues: [] },
        loadDimensions: loadSnapshotImageDimensions,
      })
      catalog.set(`block:${descriptor.definition.key}`.toLocaleLowerCase(), loaded.runtimeEntry)
      environments.push(...loaded.environments)
    }
    await createProjectCustomBlockFontSession(environments)
    customBlockCatalog = catalog
  }
  return { project, dictionary, projectIconCatalog, customBlockCatalog, resolveFontFamily }
}

export function useOcdocumentDiffSession(options: OcdocumentDiffSessionOptions) {
  const { t } = useI18n()
  const before = ref<DiffSnapshot | null>(null)
  const after = ref<DiffSnapshot | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const beforeSnapshotRoot = ref<string | null>(null)
  const afterSnapshotRoot = ref<string | null>(null)
  const loadedPath = ref<string | null>(null)
  let requestRevision = 0

  const diffSession = computed<DiffSession | null>(() => {
    const path = options.filePath.value
    const fileName = options.fileName.value
    if (!path || path !== loadedPath.value || !fileName || !before.value || !after.value) return null
    return {
      id: `diff:${path}`,
      fileTypeId: 'ocdocument',
      path,
      name: fileName,
      before: before.value,
      after: after.value,
    }
  })
  const diffModel = computed<OcdocumentDiffModel | null>(() => (
    before.value && after.value ? compareOcdocuments(before.value.content, after.value.content) : null
  ))

  async function loadSnapshot(root: string, path: string, commitId: string | null, label: string): Promise<DiffSnapshot> {
    const resourceSnapshot = isResourceSnapshotDiffPath(path)
    let content = ''
    let resourceRootPath: string
    if (commitId === null) {
      resourceRootPath = root
      const filePath = resolveProjectFile(root, path)
      if (resourceSnapshot) await fileSystemService.readBinaryFile(filePath)
      else content = await fileSystemService.readFile(filePath)
    } else {
      const result = await readFileAtRevision(root, { revision: commitId, path })
      if (!result.ok || !result.value) throw new Error(result.error?.message ?? '无法读取历史版本')
      if (result.value.binary && !resourceSnapshot) throw new Error('该版本不是文本文件')
      if (!result.value.binary) content = result.value.content
      const materialized = await materializeRevision(root, { revision: commitId })
      if (!materialized.ok || !materialized.value) throw new Error(materialized.error?.message ?? '无法准备历史资源')
      resourceRootPath = materialized.value.rootPath
    }
    const contextLoad = commitId === null
      ? loadSnapshotContext(resourceRootPath)
      : (() => {
          const cacheKey = `${root.toLowerCase()}|${commitId}`
          let contextPromise = snapshotContextCache.get(cacheKey)
          if (!contextPromise) {
            contextPromise = loadSnapshotContext(resourceRootPath)
            snapshotContextCache.set(cacheKey, contextPromise)
          }
          return contextPromise
        })()
    const context = await contextLoad
    return { commitId, label, content, resourceRootPath, ...context }
  }

  async function selectComparison(beforeCommitId: string | null, afterCommitId: string | null) {
    if (beforeCommitId === afterCommitId) {
      error.value = t('sidebar.diffViewer.sameVersion')
      return
    }
    const root = options.projectRoot.value
    const path = options.filePath.value
    if (!root || !path) {
      error.value = '项目或文件不可用'
      return
    }
    const revision = ++requestRevision
    loading.value = true
    error.value = null
    loadedPath.value = null
    const optionById = new Map(options.revisions.value.map(item => [item.commitId, item]))
    try {
      const [nextBefore, nextAfter] = await Promise.all([
        loadSnapshot(root, path, beforeCommitId, optionById.get(beforeCommitId)?.label ?? '版本 A'),
        loadSnapshot(root, path, afterCommitId, optionById.get(afterCommitId)?.label ?? '版本 B'),
      ])
      if (revision !== requestRevision) return
      before.value = nextBefore
      after.value = nextAfter
      beforeSnapshotRoot.value = nextBefore.resourceRootPath ?? null
      afterSnapshotRoot.value = nextAfter.resourceRootPath ?? null
      loadedPath.value = path
    } catch (cause) {
      if (revision === requestRevision) error.value = cause instanceof Error ? cause.message : '差异版本读取失败'
    } finally {
      if (revision === requestRevision) loading.value = false
    }
  }

  async function refresh() {
    const history = options.revisions.value.filter(item => item.commitId !== null)
    const beforeId = history[0]?.commitId ?? null
    await selectComparison(beforeId, null)
  }

  watch([options.projectRoot, options.filePath], () => {
    requestRevision += 1
    before.value = null
    after.value = null
    beforeSnapshotRoot.value = null
    afterSnapshotRoot.value = null
    loadedPath.value = null
    loading.value = false
    error.value = null
  }, { flush: 'sync' })

  return {
    before,
    after,
    diffSession,
    diffModel,
    loading,
    error,
    beforeSnapshotRoot,
    afterSnapshotRoot,
    refresh,
    selectComparison,
  }
}
