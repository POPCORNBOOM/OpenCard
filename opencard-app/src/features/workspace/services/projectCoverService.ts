/**
 * 模块说明：
 * - 解析项目与资源包清单中声明的封面，并给出可渲染的资源地址
 * 职责边界：
 * - 只读取清单与封面文件 不写入任何内容 列出的失败一律降级为“无封面”
 */
import { convertFileSrc } from '@tauri-apps/api/core'
import {
  isProjectCoverPath,
  normalizeProjectRelativeCoverPath,
  resolveCoverAbsolutePath,
  type ProjectCover,
} from '../model/projectCover'
import { parseProjectMetadataText, type ProjectProfile } from '../model/projectMetadata'
import { PROJECT_PROFILE_FILE_NAME } from '../model/projectStructure'
import type { FileSystemService } from './fileSystemService'

type CoverFileSystem = Pick<FileSystemService, 'fileExists' | 'readFile'>

function normalizeRootPath(rootPath: string): string {
  return rootPath.replace(/\\/g, '/').replace(/\/+$/, '')
}

/** 容错读取任意项目根目录的项目清单；清单缺失、损坏或不可读时返回 null。 */
async function readProjectProfile(options: {
  fs: CoverFileSystem
  projectRootPath: string
}): Promise<ProjectProfile | null> {
  const rootPath = normalizeRootPath(options.projectRootPath)
  if (!rootPath) return null
  try {
    const profilePath = resolveCoverAbsolutePath(rootPath, PROJECT_PROFILE_FILE_NAME)
    if (!await options.fs.fileExists(profilePath)) return null
    return parseProjectMetadataText(await options.fs.readFile(profilePath))
  } catch {
    return null
  }
}

/**
 * 解析宿主根目录下的封面引用；缺失、越界或非图片文件都返回 null（不抛错）。
 */
export async function resolveProjectCover(options: {
  fs: CoverFileSystem
  rootPath: string
  relativePath?: string | null
}): Promise<ProjectCover | null> {
  const rootPath = normalizeRootPath(options.rootPath)
  const relativePath = normalizeProjectRelativeCoverPath(options.relativePath ?? null)
  if (!rootPath || !relativePath || !isProjectCoverPath(relativePath)) return null
  const absolutePath = resolveCoverAbsolutePath(rootPath, relativePath)
  try {
    if (!await options.fs.fileExists(absolutePath)) return null
  } catch {
    return null
  }
  return { relativePath, absolutePath, src: convertFileSrc(absolutePath) }
}

/**
 * 读取项目清单声明的封面（清单缺失或未声明封面时按无封面处理）。
 */
export async function readProjectCover(options: {
  fs: CoverFileSystem
  projectRootPath: string
}): Promise<ProjectCover | null> {
  const rootPath = normalizeRootPath(options.projectRootPath)
  if (!rootPath) return null
  const profile = await readProjectProfile({ fs: options.fs, projectRootPath: rootPath })
  return await resolveProjectCover({ fs: options.fs, rootPath, relativePath: profile?.cover })
}
