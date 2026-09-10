import { createPackageKey } from '../../../shared/model/keySlug'
import { fileSystemService } from './fileSystemService'

export type RemotePackagePlatform = 'github'
export type RemotePackageSource = { readonly platform: RemotePackagePlatform; readonly owner: string; readonly repo: string; readonly version: string }
/** 远程包的身份来自来源本身：`<平台>:作者/包名` 决定包 Key，与包内 manifest 写什么无关。 */
export type RemotePackageDeclaration = RemotePackageSource & { readonly key: string }

type RemotePackagePlatformDescriptor = {
  /** 完整网页地址的来源前缀，用于把粘贴的 URL 还原成 `作者/包名`。 */
  readonly urlPrefix: RegExp
  /** 按标签下载包归档的地址。 */
  readonly archiveUrl: (source: RemotePackageSource) => string
}

const PLATFORMS = {
  github: {
    urlPrefix: /^https?:\/\/(?:www\.)?github\.com\//i,
    archiveUrl: source => `https://github.com/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/archive/refs/tags/${encodeURIComponent(source.version)}.zip`,
  },
} satisfies Record<RemotePackagePlatform, RemotePackagePlatformDescriptor>

const PLATFORM_NAMES = Object.keys(PLATFORMS) as RemotePackagePlatform[]

/** 识别来源所属平台。省略平台前缀时只在唯一平台下成立；出现第二个平台后必须写明。 */
function resolvePlatform(locator: string): { platform: RemotePackagePlatform; locator: string } | null {
  const lower = locator.toLocaleLowerCase()
  for (const platform of PLATFORM_NAMES) {
    const token = `${platform}:`
    if (lower.startsWith(token)) return { platform, locator: locator.slice(token.length) }
    const { urlPrefix } = PLATFORMS[platform]
    if (urlPrefix.test(locator)) return { platform, locator: locator.replace(urlPrefix, '') }
  }
  return PLATFORM_NAMES.length === 1 ? { platform: PLATFORM_NAMES[0]!, locator } : null
}

/** 远程包声明的唯一解析入口：编辑器校验和安装下载共用同一套规则。 */
export function parseRemotePackageEntry(entry: string): RemotePackageDeclaration | null {
  const text = entry.trim()
  const separator = text.lastIndexOf('@')
  if (separator <= 0) return null
  const version = text.slice(separator + 1).trim()
  const located = resolvePlatform(text.slice(0, separator).trim())
  if (!located || !version) return null
  const parts = located.locator.replace(/\.git$/i, '').replace(/\/+$/, '').split('/')
  if (parts.length !== 2) return null
  const [owner, repo] = parts as [string, string]
  if (!owner || !repo || /\s/.test(`${owner}${repo}${version}`)) return null
  return {
    platform: located.platform,
    key: createPackageKey({ source: located.platform, author: owner, name: repo }),
    owner,
    repo,
    version,
  }
}

/** 声明里保存的来源地址，始终带平台前缀。 */
export function createRemotePackageLocator(source: Pick<RemotePackageSource, 'platform' | 'owner' | 'repo'>): string {
  return `${source.platform}:${source.owner}/${source.repo}`
}

export function parseRemotePackageSource(source: string, version: string): RemotePackageSource {
  const parsed = parseRemotePackageEntry(`${source.trim()}@${version.trim()}`)
  if (!parsed) throw new Error('Invalid remote package source')
  return { platform: parsed.platform, owner: parsed.owner, repo: parsed.repo, version: parsed.version }
}

export async function downloadRemotePackage(source: RemotePackageSource, targetPath: string, onProgress?: (progress: number) => void): Promise<string> {
  const response = await fetch(PLATFORMS[source.platform].archiveUrl(source))
  if (!response.ok) throw new Error(`Remote package download failed (${response.status})`)
  const total = Number(response.headers.get('content-length')) || 0
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Remote package response has no body')
  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    if (part.value) { chunks.push(part.value); received += part.value.length; if (total) onProgress?.(received / total) }
  }
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  await fileSystemService.writeBinaryFile(targetPath, bytes)
  onProgress?.(1)
  return targetPath
}
