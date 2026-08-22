import type { CustomBlockRuntimeCatalog, CustomBlockRuntimeEntry } from '../../card-rendering/expandCustomBlocks'
import type { ProjectCustomBlockCatalogEntry, ProjectCustomBlockPackageIssue } from '../model/projectCustomBlocks'
import {
  discoverInstalledProjectCustomBlocks,
  MAX_CUSTOM_BLOCK_DEPENDENCIES,
  MAX_CUSTOM_BLOCK_DEPENDENCY_DEPTH,
  readInstalledProjectCustomBlockPackage,
} from './projectCustomBlock'
import type { FileSystemService } from './fileSystemService'
import type { ProjectImageDimensionLoader } from './projectIconCatalog'
import {
  loadProjectResourceEnvironment,
  type ProjectResourceEnvironment,
} from './projectResourceEnvironment'
import { resolveProjectCustomBlockSizeEditPolicy } from './projectCustomBlockPublicFields'

export type InstalledProjectCustomBlockRuntime = {
  entry: ProjectCustomBlockCatalogEntry
  runtimeEntry: CustomBlockRuntimeEntry
  environments: readonly ProjectResourceEnvironment[]
  issues: readonly ProjectCustomBlockPackageIssue[]
}

type RuntimeLoadState = {
  dependencyCount: number
  readonly loadDimensions?: ProjectImageDimensionLoader
}

function dependencyIssue(
  code: 'dependency-unavailable' | 'dependency-cycle',
  path: string,
  message: string,
): ProjectCustomBlockPackageIssue {
  return { code, path, message }
}

async function loadRuntime(options: {
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'readFile' | 'fileExists'>
  installationPath: string
  ancestors: readonly string[]
  depth: number
  state: RuntimeLoadState
}): Promise<InstalledProjectCustomBlockRuntime> {
  const pkg = await readInstalledProjectCustomBlockPackage(options.fs, options.installationPath)
  if (!pkg.block) throw new Error(`Custom block is unavailable: ${pkg.manifest.packageId}`)
  const packageId = pkg.manifest.packageId.toLocaleLowerCase()
  const resourceRootPath = `${options.installationPath.replace(/[\\/]+$/, '')}/resources`
  const issues: ProjectCustomBlockPackageIssue[] = [...pkg.issues]
  const baseEnvironment = await loadProjectResourceEnvironment({
    fs: options.fs,
    rootPath: resourceRootPath,
    kind: 'package',
    identity: pkg.manifest.packageId,
    loadDimensions: options.state.loadDimensions,
  })

  const dependencies = new Map<string, CustomBlockRuntimeEntry>()
  const environments: ProjectResourceEnvironment[] = []
  if (options.depth >= MAX_CUSTOM_BLOCK_DEPENDENCY_DEPTH) {
    issues.push(dependencyIssue(
      'dependency-unavailable',
      pkg.manifest.packageId,
      'Custom block dependency depth limit was reached',
    ))
  } else {
    const descriptors = await discoverInstalledProjectCustomBlocks(options.fs, resourceRootPath)
    for (const descriptor of descriptors.values()) {
      const dependencyId = descriptor.manifest.packageId.toLocaleLowerCase()
      if (options.ancestors.includes(dependencyId) || dependencyId === packageId) {
        issues.push(dependencyIssue(
          'dependency-cycle',
          descriptor.manifest.packageId,
          `Custom block dependency cycle: ${[...options.ancestors, packageId, dependencyId].join(' -> ')}`,
        ))
        continue
      }
      options.state.dependencyCount += 1
      if (options.state.dependencyCount > MAX_CUSTOM_BLOCK_DEPENDENCIES) {
        issues.push(dependencyIssue(
          'dependency-unavailable',
          descriptor.manifest.packageId,
          'Custom block dependency count limit was reached',
        ))
        break
      }
      try {
        const loaded = await loadRuntime({
          ...options,
          installationPath: descriptor.installationPath,
          ancestors: [...options.ancestors, packageId],
          depth: options.depth + 1,
        })
        dependencies.set(dependencyId, loaded.runtimeEntry)
        environments.push(...loaded.environments)
        issues.push(...loaded.issues)
      } catch (cause) {
        issues.push(dependencyIssue(
          'dependency-unavailable',
          descriptor.installationPath,
          cause instanceof Error ? cause.message : String(cause),
        ))
      }
    }
  }

  const environment: ProjectResourceEnvironment = {
    ...baseEnvironment,
    customBlockCatalog: dependencies,
  }
  environments.unshift(environment)
  const hasResourceErrors = issues.some(issue => (
    issue.code === 'resource-unavailable'
    || issue.code === 'dependency-unavailable'
    || issue.code === 'dependency-cycle'
  )) || environment.issues.length > 0
  const entry: ProjectCustomBlockCatalogEntry = {
    manifest: pkg.manifest,
    block: pkg.block,
    installationPath: options.installationPath,
    resourceRootPath,
    issues,
    ...(hasResourceErrors ? { hasResourceErrors: true } : {}),
  }
  const runtimeEntry: CustomBlockRuntimeEntry = {
    manifest: pkg.manifest,
    block: pkg.block,
    sizeEditPolicy: resolveProjectCustomBlockSizeEditPolicy(pkg.block),
    environment,
    dependencies,
    ...(hasResourceErrors ? { hasResourceErrors: true } : {}),
  }
  return { entry, runtimeEntry, environments, issues }
}

export async function loadInstalledProjectCustomBlockRuntime(options: {
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'readFile' | 'fileExists'>
  installationPath: string
  loadDimensions?: ProjectImageDimensionLoader
}): Promise<InstalledProjectCustomBlockRuntime> {
  return await loadRuntime({
    fs: options.fs,
    installationPath: options.installationPath,
    ancestors: [],
    depth: 0,
    state: { dependencyCount: 0, loadDimensions: options.loadDimensions },
  })
}

/** Flattens all lexical package catalogs for diagnostics and session lifecycle only. */
export function flattenCustomBlockRuntimeCatalog(catalog: CustomBlockRuntimeCatalog): CustomBlockRuntimeCatalog {
  const flattened = new Map<string, CustomBlockRuntimeEntry>()
  const visit = (scope: CustomBlockRuntimeCatalog): void => {
    for (const [packageId, entry] of scope) {
      if (!flattened.has(packageId)) flattened.set(packageId, entry)
      visit(entry.dependencies)
    }
  }
  visit(catalog)
  return flattened
}
