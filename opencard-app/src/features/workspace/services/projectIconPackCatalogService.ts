import { basename, join, resolveResource } from '@tauri-apps/api/path'
import type { DirEntry } from '@tauri-apps/plugin-fs'
import { readProjectIconPack } from './projectIconPack'
import { resolveAppStorageRoot } from '../../../shared/storage/appStoragePaths'
import { fileSystemService, type FileSystemService } from './fileSystemService'
import {
  PROJECT_ICON_PACK_CATALOG_SCHEMA_VERSION,
  PROJECT_ICON_PACK_PACKAGE_SUFFIX,
  createProjectIconPackCatalogEntry,
  type ProjectIconPackCatalogEntry,
  type ProjectIconPackCatalogSnapshot,
  type ProjectIconPackIndex,
  type ProjectIconPackSource,
} from '../model/projectIconPackCatalog'

const BUILTIN_ICON_PACK_INDEX_PATH = 'icon-packs/index.json'
const ICON_PACK_DIRECTORY_NAME = 'icon-packs'

export interface ProjectIconPackPathService {
  appStorageDir(): Promise<string>
  basename(path: string): Promise<string>
  join(...paths: string[]): Promise<string>
  resolveResource(path: string): Promise<string>
}

const defaultPathService: ProjectIconPackPathService = {
  appStorageDir: resolveAppStorageRoot,
  basename,
  join,
  resolveResource,
}

function describeError(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

function parseIndex(value: unknown): ProjectIconPackIndex | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion !== PROJECT_ICON_PACK_CATALOG_SCHEMA_VERSION
    || !Array.isArray(candidate.packs)
    || !candidate.packs.every((pack) => typeof pack === 'string' && isSafePackPath(pack))) return null
  return {
    schemaVersion: PROJECT_ICON_PACK_CATALOG_SCHEMA_VERSION,
    packs: [...candidate.packs] as string[],
  }
}

function isSafePackPath(value: string): boolean {
  const normalized = value.replace(/\\/g, '/').trim()
  return normalized.length > 0
    && normalized.toLowerCase().endsWith(PROJECT_ICON_PACK_PACKAGE_SUFFIX)
    && !normalized.startsWith('/')
    && !/^[a-z]:/i.test(normalized)
    && !normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')
}

function isPackFile(entry: DirEntry): boolean {
  return entry.isFile && entry.name.toLowerCase().endsWith(PROJECT_ICON_PACK_PACKAGE_SUFFIX)
}

function packId(path: string): string {
  const normalized = path.replace(/\\/g, '/').split('/').pop() ?? path
  return normalized.slice(0, -PROJECT_ICON_PACK_PACKAGE_SUFFIX.length)
}

function safePackFileName(name: string): string {
  const safe = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '')
  return `${safe || 'icon-pack'}${PROJECT_ICON_PACK_PACKAGE_SUFFIX}`
}

export class ProjectIconPackCatalogService {
  constructor(
    private readonly fs: FileSystemService = fileSystemService,
    private readonly paths: ProjectIconPackPathService = defaultPathService,
  ) {}

  async loadCatalog(): Promise<ProjectIconPackCatalogSnapshot> {
    const builtin = await this.loadBuiltinPacks()
    const user = await this.loadUserPacks()
    return {
      packs: [...builtin.packs, ...user.packs.sort((a, b) => a.name.localeCompare(b.name))],
      warnings: [...builtin.warnings, ...user.warnings],
    }
  }

  async pickUserIconPack(title: string): Promise<string | null> {
    return await this.fs.pickFile({
      title,
      fileTypeName: 'OpenCard Icon Pack',
      extensions: ['ociconpack'],
    })
  }

  async importUserIconPack(sourcePath: string): Promise<string> {
    const iconPack = await readProjectIconPack(this.fs, sourcePath)
    const userRoot = await this.resolveUserRoot()
    await this.fs.createDirectory(userRoot)
    const sourceBytes = await this.fs.readBinaryFile(sourcePath)
    const baseName = safePackFileName(iconPack.manifest.name)
    let candidateName = baseName
    let candidatePath = await this.paths.join(userRoot, candidateName)
    let suffix = 2
    while (await this.fs.fileExists(candidatePath)) {
      candidateName = `${baseName.slice(0, -PROJECT_ICON_PACK_PACKAGE_SUFFIX.length)} (${suffix})${PROJECT_ICON_PACK_PACKAGE_SUFFIX}`
      candidatePath = await this.paths.join(userRoot, candidateName)
      suffix += 1
    }
    await this.fs.writeBinaryFile(candidatePath, sourceBytes)
    return candidatePath
  }

  private async loadBuiltinPacks(): Promise<ProjectIconPackCatalogSnapshot> {
    const warnings: ProjectIconPackCatalogSnapshot['warnings'] = []
    const indexPath = await this.paths.resolveResource(BUILTIN_ICON_PACK_INDEX_PATH)
    let index: ProjectIconPackIndex | null = null
    try {
      index = parseIndex(JSON.parse(await this.fs.readFile(indexPath)))
    } catch (cause) {
      warnings.push({ path: indexPath, reason: describeError(cause) })
    }
    if (!index) {
      if (warnings.length === 0) warnings.push({ path: indexPath, reason: 'Invalid icon pack catalog' })
      return { packs: [], warnings }
    }

    const root = await this.paths.resolveResource(ICON_PACK_DIRECTORY_NAME)
    const packs: ProjectIconPackCatalogEntry[] = []
    for (const relativePath of index.packs) {
      const path = await this.paths.join(root, ...relativePath.replace(/\\/g, '/').split('/'))
      const result = await this.loadPack(path, 'builtin', packId(relativePath))
      if (result.entry) packs.push(result.entry)
      else warnings.push({ path, reason: result.reason ?? 'Invalid icon pack' })
    }
    return { packs, warnings }
  }

  private async loadUserPacks(): Promise<ProjectIconPackCatalogSnapshot> {
    const root = await this.resolveUserRoot()
    await this.fs.createDirectory(root)
    const packs: ProjectIconPackCatalogEntry[] = []
    const warnings: ProjectIconPackCatalogSnapshot['warnings'] = []
    for (const entry of await this.fs.readDirectory(root)) {
      if (!isPackFile(entry)) continue
      const path = await this.paths.join(root, entry.name)
      const result = await this.loadPack(path, 'user', packId(entry.name))
      if (result.entry) packs.push(result.entry)
      else warnings.push({ path, reason: result.reason ?? 'Invalid icon pack' })
    }
    return { packs, warnings }
  }

  private async loadPack(
    path: string,
    source: ProjectIconPackSource,
    id: string,
  ): Promise<{ entry: ProjectIconPackCatalogEntry | null; reason?: string }> {
    try {
      const iconPack = await readProjectIconPack(this.fs, path)
      return { entry: createProjectIconPackCatalogEntry(iconPack.manifest, path, source, id) }
    } catch (cause) {
      return { entry: null, reason: describeError(cause) }
    }
  }

  private async resolveUserRoot(): Promise<string> {
    return await this.paths.join(await this.paths.appStorageDir(), ICON_PACK_DIRECTORY_NAME)
  }
}

export const projectIconPackCatalogService = new ProjectIconPackCatalogService()
