import type { FilePathDirectoryProvider } from '../../../shared/model/filePath'
import type { FileSystemService } from './fileSystemService'
import { resolveResourcePath } from '../model/scopedResourcePath'
import type { ProjectResourceEnvironment } from './projectResourceEnvironment'

/** `pkg@` with nothing after it: the one place inside a package where an icon reference can start. */
function isPackageRoot(directory: string): boolean {
  return /^[^/]+@$/.test(directory)
}

export function createResourceDirectoryProvider(
  rootPath: string,
  sourceFilePath: string,
  environment: ProjectResourceEnvironment,
  fs: Pick<FileSystemService, 'readDirectoryEntries'>,
  options: { hideDotFiles?: boolean, iconEntryLabel?: string } = {},
): FilePathDirectoryProvider {
  const source = /^[a-z]:[\\/]/i.test(sourceFilePath) || sourceFilePath.startsWith('/')
    ? sourceFilePath : `${rootPath.replace(/[\\/]+$/, '')}/${sourceFilePath}`
  const scope = resolveResourcePath(rootPath, source, '__oc_browse__')
  function findScope(candidate: ProjectResourceEnvironment): ProjectResourceEnvironment | undefined {
    if (!scope.ok || !candidate.rootPath) return undefined
    const located = resolveResourcePath(rootPath, `${candidate.rootPath}/__oc_browse__`, '__oc_browse__')
    if (located.ok && located.value === scope.value) return candidate
    for (const child of candidate.packageEnvironments?.values() ?? []) {
      const found = findScope(child)
      if (found) return found
    }
    return undefined
  }
  const current = findScope(environment)
  return async directory => {
    const prefix = directory.replace(/\/+$/, '')
    const resolved = resolveResourcePath(rootPath, source, `${prefix ? `${prefix}/` : ''}__oc_browse__`)
    if (!resolved.ok) return []
    const entries = (await fs.readDirectoryEntries(resolved.value.slice(0, -'/__oc_browse__'.length), 1))
      .filter(entry => !options.hideDotFiles || !entry.name.split(/[\\/]/).some(segment => segment.startsWith('.')))
    // Selecting `icon:` writes the prefix without a separator, and the field's icon completion
    // takes over from there.
    const iconEntry = {
      name: 'icon:',
      label: options.iconEntryLabel,
      isDirectory: true,
      icon: 'file.project-icon' as const,
    }
    // A package root offers it as well, so `pkg@` can continue into `pkg@icon:` and reach the icons
    // the package ships. Deeper paths inside a package have no icon scope, so they get no entry.
    if (prefix) return isPackageRoot(prefix) ? [...entries, iconEntry] : entries
    return [
      ...entries,
      iconEntry,
      ...[...(current?.packages ?? [])].filter(([, pkg]) => !pkg.unavailable).map(([key, pkg]) => ({
        name: `${key}@`, label: pkg.manifest.name, isDirectory: true, icon: 'file.package' as const,
      })),
    ]
  }
}
