import { normalizeKeySlug } from '../../../shared/model/keySlug'
import {
  PROJECT_INTERNAL_DIRECTORY_NAME,
  PROJECT_PACKAGE_DIRECTORY,
  PROJECT_PACKAGE_MANIFEST_FILE_NAME,
} from './projectStructure'

export type ScopedResourcePathIssueCode =
  | 'invalid-reference'
  | 'unsafe-path'
  | 'reserved-path'
  | 'source-outside-project'
  | 'target-outside-project'
  | 'unrepresentable-scope'

export type ScopedResourcePathResult =
  | { ok: true, value: string }
  | { ok: false, code: ScopedResourcePathIssueCode, message: string }

type ScopedResourcePathFailure = Extract<ScopedResourcePathResult, { ok: false }>

type ResourceReference =
  | { anchor: 'scope', path: string }
  | { anchor: 'project', path: string }
  | { anchor: 'package', packageKey: string, path: string }

type LocatedScope = {
  rootPath: string
  keys: readonly string[]
  relativePath: string
}

const PACKAGE_STORAGE_PATH = `${PROJECT_INTERNAL_DIRECTORY_NAME}/${PROJECT_PACKAGE_DIRECTORY}`
const PACKAGE_INDEX_FILE_NAME = PROJECT_PACKAGE_MANIFEST_FILE_NAME.split('/').pop()!
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

function failure(code: ScopedResourcePathIssueCode, message: string): ScopedResourcePathFailure {
  return { ok: false, code, message }
}

function normalizeAbsolutePath(value: string): string | null {
  const path = value.replace(/\\/g, '/')
  const drive = path.match(/^([a-z]):\//i)?.[1]
  const isPosix = path.startsWith('/') && !path.startsWith('//')
  const unc = path.match(/^\/\/([^/]+)\/([^/]+)(?:\/|$)/)
  if (!drive && !isPosix && !unc) return null

  const root = drive ? `${drive.toLocaleUpperCase()}:` : unc ? `//${unc[1]}/${unc[2]}` : ''
  const remainder = drive
    ? path.slice(3)
    : unc
      ? path.slice(unc[0].length)
      : path.slice(1)
  const segments: string[] = []
  for (const segment of remainder.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) return null
      segments.pop()
      continue
    }
    if (/[\u0000-\u001f\u007f]/.test(segment)) return null
    segments.push(segment)
  }
  if (drive) return segments.length > 0 ? `${root}/${segments.join('/')}` : `${root}/`
  if (unc) return segments.length > 0 ? `${root}/${segments.join('/')}` : root
  return `/${segments.join('/')}`
}

function usesCaseInsensitivePaths(path: string): boolean {
  return /^[a-z]:\//i.test(path) || path.startsWith('//')
}

function relativeInside(rootPath: string, targetPath: string): string | null {
  const insensitive = usesCaseInsensitivePaths(rootPath)
  const root = rootPath.replace(/\/+$/, '')
  const target = targetPath.replace(/\/+$/, '')
  const comparableRoot = insensitive ? root.toLocaleLowerCase() : root
  const comparableTarget = insensitive ? target.toLocaleLowerCase() : target
  if (comparableTarget === comparableRoot) return ''
  return comparableTarget.startsWith(`${comparableRoot}/`)
    ? target.slice(root.length + 1)
    : null
}

function startsWithPath(value: string, prefix: string, insensitive: boolean): boolean {
  return insensitive
    ? value.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())
    : value.startsWith(prefix)
}

function normalizePackageKey(value: string): string | null {
  const key = normalizeKeySlug(value)
  return key && key.toLocaleLowerCase() !== PACKAGE_INDEX_FILE_NAME.toLocaleLowerCase() ? key : null
}

function locateScope(projectRootPath: string, filePath: string): LocatedScope | null {
  const relative = relativeInside(projectRootPath, filePath)
  if (relative === null) return null

  const insensitive = usesCaseInsensitivePaths(projectRootPath)
  const packagePrefix = `${PACKAGE_STORAGE_PATH}/`
  let rootPath = projectRootPath.replace(/\/+$/, '')
  let remainder = relative
  const keys: string[] = []

  while (startsWithPath(remainder, packagePrefix, insensitive)) {
    const afterPrefix = remainder.slice(packagePrefix.length)
    const separatorIndex = afterPrefix.indexOf('/')
    const rawKey = separatorIndex < 0 ? afterPrefix : afterPrefix.slice(0, separatorIndex)
    const packageKey = normalizePackageKey(rawKey)
    if (!packageKey) return null
    rootPath = `${rootPath}/${PACKAGE_STORAGE_PATH}/${packageKey}`
    keys.push(packageKey)
    remainder = separatorIndex < 0 ? '' : afterPrefix.slice(separatorIndex + 1)
  }

  if ((insensitive ? remainder.toLocaleLowerCase() : remainder)
    === (insensitive ? PACKAGE_STORAGE_PATH.toLocaleLowerCase() : PACKAGE_STORAGE_PATH)) return null
  return { rootPath, keys, relativePath: remainder }
}

function normalizeReferencePath(value: string): ScopedResourcePathResult {
  if (!value || value.startsWith('//') || value.includes('\\')) {
    return failure('unsafe-path', 'Resource paths must use non-empty forward-slash relative paths')
  }
  const path = value.startsWith('/') ? value.slice(1) : value
  const segments = path.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..'
    || segment.normalize('NFC') !== segment
    || /[<>:"|?*\u0000-\u001f\u007f]/.test(segment)
    || /[. ]$/.test(segment)
    || WINDOWS_RESERVED_NAME.test(segment))) {
    return failure('unsafe-path', 'Resource path contains an unsafe or non-portable segment')
  }
  if (segments[0]?.toLocaleLowerCase() === PROJECT_INTERNAL_DIRECTORY_NAME
    && segments[1]?.toLocaleLowerCase() === PROJECT_PACKAGE_DIRECTORY) {
    return failure('reserved-path', 'Package storage must be addressed through a package Key')
  }
  return { ok: true, value: segments.join('/') }
}

function parseReference(value: string): ResourceReference | ScopedResourcePathFailure {
  const reference = value.trim()
  const firstAt = reference.indexOf('@')
  if (firstAt !== reference.lastIndexOf('@')) return failure('invalid-reference', 'Resource references may contain at most one @')

  if (firstAt === 0) {
    const path = normalizeReferencePath(reference.slice(1))
    return path.ok ? { anchor: 'project', path: path.value } : path
  }
  if (firstAt > 0) {
    const packageKey = normalizePackageKey(reference.slice(0, firstAt))
    if (!packageKey) return failure('invalid-reference', 'Resource reference has an invalid package Key')
    const path = normalizeReferencePath(reference.slice(firstAt + 1))
    return path.ok ? { anchor: 'package', packageKey, path: path.value } : path
  }

  const path = normalizeReferencePath(reference)
  return path.ok ? { anchor: 'scope', path: path.value } : path
}

function isFailure(value: ResourceReference | ScopedResourcePathFailure): value is ScopedResourcePathFailure {
  return 'ok' in value && !value.ok
}

function sameScope(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index])
}

export function resolveResourcePath(
  projectRootPath: string,
  sourceFilePath: string,
  reference: string,
): ScopedResourcePathResult {
  const projectRoot = normalizeAbsolutePath(projectRootPath)
  const sourceFile = normalizeAbsolutePath(sourceFilePath)
  if (!projectRoot || !sourceFile) return failure('unsafe-path', 'Project root and source file must be absolute paths')
  const sourceScope = locateScope(projectRoot, sourceFile)
  if (!sourceScope) return failure('source-outside-project', 'Source file is outside a valid project resource scope')

  const parsed = parseReference(reference)
  if (isFailure(parsed)) return parsed
  const targetRoot = parsed.anchor === 'project'
    ? projectRoot.replace(/\/+$/, '')
    : parsed.anchor === 'package'
      ? `${sourceScope.rootPath}/${PACKAGE_STORAGE_PATH}/${parsed.packageKey}`
      : sourceScope.rootPath
  return { ok: true, value: `${targetRoot}/${parsed.path}` }
}

export function relativizeResourcePath(
  projectRootPath: string,
  sourceFilePath: string,
  targetPath: string,
): ScopedResourcePathResult {
  const projectRoot = normalizeAbsolutePath(projectRootPath)
  const sourceFile = normalizeAbsolutePath(sourceFilePath)
  const targetFile = normalizeAbsolutePath(targetPath)
  if (!projectRoot || !sourceFile || !targetFile) return failure('unsafe-path', 'Project root, source file, and target must be absolute paths')
  const sourceScope = locateScope(projectRoot, sourceFile)
  if (!sourceScope) return failure('source-outside-project', 'Source file is outside a valid project resource scope')
  const targetScope = locateScope(projectRoot, targetFile)
  if (!targetScope) return failure('target-outside-project', 'Target is outside a valid project resource scope')

  const normalizedTarget = normalizeReferencePath(targetScope.relativePath)
  if (!normalizedTarget.ok) return normalizedTarget
  if (sameScope(sourceScope.keys, targetScope.keys)) return normalizedTarget
  if (targetScope.keys.length === 0) return { ok: true, value: `@${normalizedTarget.value}` }
  if (targetScope.keys.length === sourceScope.keys.length + 1
    && sourceScope.keys.every((key, index) => key === targetScope.keys[index])) {
    return { ok: true, value: `${targetScope.keys[targetScope.keys.length - 1]}@${normalizedTarget.value}` }
  }
  return failure('unrepresentable-scope', 'Target scope cannot be expressed from the source scope')
}
