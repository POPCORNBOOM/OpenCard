import { resolveAppStoragePath } from '../../../shared/storage/appStoragePaths'
import type { HistoryResourceLifecycle } from '../../editor-runtime/history/contentHistory'
import { fileSystemService, type FileSystemService } from './fileSystemService'

export const PROJECT_FONT_HISTORY_DIRECTORY = 'history/fonts'

type StagedFontFile = {
  originalPath: string
  stagedPath: string
}

export async function stageProjectFontFiles(
  originalPaths: readonly string[],
  operationId: string = crypto.randomUUID(),
  fs: FileSystemService = fileSystemService,
): Promise<HistoryResourceLifecycle> {
  const uniquePaths = [...new Set(originalPaths.map(normalizePath))]
  if (uniquePaths.length === 0) throw new Error('No project font files were provided for staging.')

  const operationDirectory = await resolveAppStoragePath(...PROJECT_FONT_HISTORY_DIRECTORY.split('/'), operationId)
  const files = uniquePaths.map((originalPath, index): StagedFontFile => ({
    originalPath,
    stagedPath: `${normalizePath(operationDirectory)}/${index}-${basename(originalPath)}`,
  }))

  await fs.createDirectory(operationDirectory)
  try {
    await transferFiles(files, 'originalPath', 'stagedPath', fs)
  } catch (error) {
    const originalsIntact = (await Promise.all(files.map(file => fs.fileExists(file.originalPath)))).every(Boolean)
    if (originalsIntact) await removeDirectoryIfPresent(operationDirectory, fs)
    throw error
  }

  return {
    undo: async () => transferFiles(files, 'stagedPath', 'originalPath', fs),
    redo: async () => transferFiles(files, 'originalPath', 'stagedPath', fs),
    release: async () => removeDirectoryIfPresent(operationDirectory, fs),
  }
}

async function transferFiles(
  files: readonly StagedFontFile[],
  sourceKey: keyof StagedFontFile,
  targetKey: keyof StagedFontFile,
  fs: FileSystemService,
): Promise<void> {
  const copied: StagedFontFile[] = []
  try {
    for (const file of files) {
      const source = file[sourceKey]
      const target = file[targetKey]
      if (!await fs.fileExists(source)) throw new Error(`Font history source does not exist: ${source}`)
      if (await fs.fileExists(target)) throw new Error(`Font history target already exists: ${target}`)
      await fs.copyFile(source, target)
      copied.push(file)
    }
  } catch (error) {
    await Promise.allSettled(copied.map(file => fs.deleteFile(file[targetKey])))
    throw error
  }

  const removed: StagedFontFile[] = []
  try {
    for (const file of files) {
      await fs.deleteFile(file[sourceKey])
      removed.push(file)
    }
  } catch (error) {
    const restoredTargets = new Set<string>()
    for (const file of removed) {
      try {
        await fs.copyFile(file[targetKey], file[sourceKey])
        restoredTargets.add(file[targetKey])
      } catch {
        // Keep the staged copy when restoration fails so the user's font bytes are not lost.
      }
    }
    await Promise.allSettled(copied
      .filter(file => !removed.includes(file) || restoredTargets.has(file[targetKey]))
      .map(file => fs.deleteFile(file[targetKey])))
    throw error
  }
}

async function removeDirectoryIfPresent(path: string, fs: FileSystemService): Promise<void> {
  if (await fs.fileExists(path)) await fs.deleteFile(path)
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function basename(path: string): string {
  const normalized = normalizePath(path)
  return normalized.slice(normalized.lastIndexOf('/') + 1) || 'font-file'
}
