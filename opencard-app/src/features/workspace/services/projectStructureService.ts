import type { FileSystemService } from './fileSystemService'
import {
  PROJECT_INTERNAL_DIRECTORIES,
  PROJECT_INTERNAL_DIRECTORY_NAME,
  PROJECT_INTERNAL_FILE_DEFAULTS,
  PROJECT_PROFILE_FILE_NAME,
} from '../model/projectStructure'

export type ProjectDirectoryKind = 'project' | 'uninitialized' | 'invalid'

function joinPath(root: string, relativePath: string): string {
  return `${root.replace(/[\\/]+$/, '')}/${relativePath}`
}

async function assertExistingPathKind(
  fs: FileSystemService,
  path: string,
  expected: 'file' | 'directory',
): Promise<void> {
  if (!await fs.fileExists(path)) return
  const info = await fs.getFileInfo(path)
  const matches = expected === 'file' ? info.isFile : info.isDirectory
  if (info.isSymlink || !matches) throw new Error(`Invalid OpenCard project ${expected}: ${path}`)
}

export async function classifyProjectDirectory(
  fs: FileSystemService,
  projectRoot: string,
): Promise<ProjectDirectoryKind> {
  const internalDirectory = joinPath(projectRoot, PROJECT_INTERNAL_DIRECTORY_NAME)
  if (await fs.fileExists(internalDirectory)) {
    const info = await fs.getFileInfo(internalDirectory)
    if (info.isSymlink || !info.isDirectory) return 'invalid'
    return await fs.fileExists(joinPath(projectRoot, PROJECT_PROFILE_FILE_NAME))
      ? 'project'
      : 'uninitialized'
  }
  return 'uninitialized'
}

export async function ensureProjectStructure(
  fs: FileSystemService,
  projectRoot: string,
): Promise<void> {
  const internalDirectory = joinPath(projectRoot, PROJECT_INTERNAL_DIRECTORY_NAME)
  await assertExistingPathKind(fs, internalDirectory, 'directory')
  for (const directory of PROJECT_INTERNAL_DIRECTORIES) {
    await assertExistingPathKind(fs, joinPath(projectRoot, directory), 'directory')
  }
  for (const relativePath of Object.keys(PROJECT_INTERNAL_FILE_DEFAULTS)) {
    await assertExistingPathKind(fs, joinPath(projectRoot, relativePath), 'file')
  }

  await fs.createDirectory(internalDirectory)
  for (const directory of PROJECT_INTERNAL_DIRECTORIES) {
    const path = joinPath(projectRoot, directory)
    if (!await fs.fileExists(path)) await fs.createDirectory(path)
  }
  for (const [relativePath, content] of Object.entries(PROJECT_INTERNAL_FILE_DEFAULTS)) {
    const path = joinPath(projectRoot, relativePath)
    if (!await fs.fileExists(path)) await fs.writeFile(path, content)
  }
}

export async function initializeProjectStructure(
  fs: FileSystemService,
  projectRoot: string,
  createId: () => string = () => crypto.randomUUID(),
): Promise<void> {
  const kind = await classifyProjectDirectory(fs, projectRoot)
  if (kind === 'invalid') throw new Error('The .opencard path is not a safe directory')
  if (await fs.fileExists(joinPath(projectRoot, PROJECT_INTERNAL_DIRECTORY_NAME))) {
    await ensureProjectStructure(fs, projectRoot)
    return
  }

  const temporaryName = `.opencard-init-${createId()}`
  const temporaryPath = joinPath(projectRoot, temporaryName)
  const targetPath = joinPath(projectRoot, PROJECT_INTERNAL_DIRECTORY_NAME)
  if (await fs.fileExists(temporaryPath)) throw new Error('The temporary OpenCard project path already exists')

  try {
    await fs.createDirectory(temporaryPath)
    for (const directory of PROJECT_INTERNAL_DIRECTORIES) {
      const suffix = directory.slice(PROJECT_INTERNAL_DIRECTORY_NAME.length + 1)
      await fs.createDirectory(joinPath(temporaryPath, suffix))
    }
    for (const [relativePath, content] of Object.entries(PROJECT_INTERNAL_FILE_DEFAULTS)) {
      const suffix = relativePath.slice(PROJECT_INTERNAL_DIRECTORY_NAME.length + 1)
      await fs.writeFile(joinPath(temporaryPath, suffix), content)
    }
    await fs.renameFile(temporaryPath, targetPath)
  } catch (error) {
    if (await fs.fileExists(temporaryPath)) await fs.deleteFile(temporaryPath).catch(() => undefined)
    throw error
  }
}
