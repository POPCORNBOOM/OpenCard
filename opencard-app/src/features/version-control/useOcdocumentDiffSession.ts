import { computed, ref, type Ref } from 'vue'
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
import { buildProjectIconCatalog, EMPTY_PROJECT_ICON_CATALOG } from '../workspace/services/projectIconCatalog'
import { parseProjectCustomBlockRegistryText, PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME, type ProjectCustomBlockCatalogEntry } from '../workspace/model/projectCustomBlocks'
import { readProjectCustomBlockPackage } from '../workspace/services/projectCustomBlock'
import { createProjectCustomBlockAssetSession } from '../workspace/services/projectCustomBlockAssetLoader'

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

const snapshotContextCache = new Map<string, Promise<Pick<DiffSnapshot, 'project' | 'dictionary' | 'projectIconCatalog' | 'customBlockCatalog' | 'resolveFontFamily'>>>()

function createSnapshotFontResolver(root: string, fontDocument: NonNullable<ReturnType<typeof parseProjectFontRegistryText>>, namespace: string): (references: string) => string {
  const families = new Map((fontDocument.families ?? []).map(font => [font.key.toLowerCase(), `OpenCardSnapshot-${namespace}-${font.key}`]))
  const compositions = new Map((fontDocument.compositions ?? []).map(composition => [composition.key.toLowerCase(), composition.members[0]?.fontKey?.toLowerCase()]))
  if (typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.dataset.opencardDiffFonts = namespace
    style.textContent = (fontDocument.families ?? []).flatMap(font => projectFontFileEntries(font).map(entry => (
      `@font-face{font-family:${JSON.stringify(families.get(font.key.toLowerCase()) ?? font.key)};src:url(${JSON.stringify(convertFileSrc(resolveProjectFile(root, entry.source)))});font-weight:${projectFontWeightValues[entry.weight]};font-style:${entry.style === 'italic' ? 'italic' : 'normal'};}`
    ))).join('')
    document.head.appendChild(style)
  }
  return references => references.split(';').map(reference => {
    const value = reference.trim()
    if (!value.toLowerCase().startsWith('font:')) return value
    const key = value.slice(5).trim().toLowerCase()
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
      projectIconCatalog = await buildProjectIconCatalog(document.iconSeries, source => (
        convertFileSrc(resolveProjectFile(root, source))
      ))
    }
  }
  const customBlockText = await readOptional(PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME)
  if (customBlockText) {
    const registry = parseProjectCustomBlockRegistryText(customBlockText)
    if (registry) {
      const catalog = new Map<string, ProjectCustomBlockCatalogEntry>()
      for (const relativePath of registry.blocks ?? []) {
        const archivePath = relativePath.replace(/\\/g, '/').replace(/^[/]+/, '')
        const packageEntry = await readProjectCustomBlockPackage(fileSystemService, resolveProjectFile(root, archivePath))
        const block = packageEntry.block
        if (!block) continue
        const key = packageEntry.manifest.customBlockKey.toLowerCase()
        catalog.set(key, { ...packageEntry, block, archivePath })
      }
      if (catalog.size > 0) {
        const assets = await createProjectCustomBlockAssetSession(catalog)
        customBlockCatalog = assets.customBlockCatalog
      }
    }
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
  let requestRevision = 0

  const diffSession = computed<DiffSession | null>(() => {
    const path = options.filePath.value
    const fileName = options.fileName.value
    if (!path || !fileName || !before.value || !after.value) return null
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

  async function loadSnapshot(commitId: string | null, label: string): Promise<DiffSnapshot> {
    const root = options.projectRoot.value
    const path = options.filePath.value
    if (!root || !path) throw new Error('项目或文件不可用')
    let content: string
    let resourceRootPath: string
    if (commitId === null) {
      resourceRootPath = root
      content = await fileSystemService.readFile(resolveProjectFile(root, path))
    } else {
      const result = await readFileAtRevision(root, { revision: commitId, path })
      if (!result.ok || !result.value) throw new Error(result.error?.message ?? '无法读取历史版本')
      if (result.value.binary) throw new Error('该版本不是文本文件')
      content = result.value.content
      const materialized = await materializeRevision(root, { revision: commitId })
      if (!materialized.ok || !materialized.value) throw new Error(materialized.error?.message ?? '无法准备历史资源')
      resourceRootPath = materialized.value.rootPath
    }
    const context = commitId === null
      ? await loadSnapshotContext(resourceRootPath)
      : await (async () => {
        const cacheKey = `${root.toLowerCase()}|${commitId}`
        let contextPromise = snapshotContextCache.get(cacheKey)
        if (!contextPromise) {
          contextPromise = loadSnapshotContext(resourceRootPath)
          snapshotContextCache.set(cacheKey, contextPromise)
        }
        return await contextPromise
      })()
    return { commitId, label, content, resourceRootPath, ...context }
  }

  async function loadSnapshotRoot(commitId: string | null): Promise<string | null> {
    const root = options.projectRoot.value
    if (!root || !commitId) return root ?? null
    const result = await materializeRevision(root, { revision: commitId })
    if (!result.ok || !result.value) throw new Error(result.error?.message ?? '无法准备历史资源')
    return result.value.rootPath
  }

  async function selectComparison(beforeCommitId: string | null, afterCommitId: string | null) {
    if (beforeCommitId === afterCommitId) {
      error.value = t('sidebar.diffViewer.sameVersion')
      return
    }
    const revision = ++requestRevision
    loading.value = true
    error.value = null
    const optionById = new Map(options.revisions.value.map(item => [item.commitId, item]))
    try {
      const [nextBefore, nextAfter, nextBeforeRoot, nextAfterRoot] = await Promise.all([
        loadSnapshot(beforeCommitId, optionById.get(beforeCommitId)?.label ?? '版本 A'),
        loadSnapshot(afterCommitId, optionById.get(afterCommitId)?.label ?? '版本 B'),
        loadSnapshotRoot(beforeCommitId),
        loadSnapshotRoot(afterCommitId),
      ])
      if (revision !== requestRevision) return
      before.value = nextBefore
      after.value = nextAfter
      beforeSnapshotRoot.value = nextBeforeRoot
      afterSnapshotRoot.value = nextAfterRoot
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
