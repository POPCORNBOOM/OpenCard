import { pinyin } from 'pinyin-pro'

export function toKeySlug(value: string, fallback = 'item'): string {
  const transliterated = pinyin(value, { toneType: 'none', nonZh: 'consecutive', separator: ' ' })
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
  let candidate = ''

  for (const character of transliterated) {
    if (/[a-z0-9._-]/.test(character)) candidate += character
    else if (/\p{Letter}|\p{Number}/u.test(character)) candidate += `-u${character.codePointAt(0)!.toString(16)}-`
    else candidate += '-'
  }

  const normalized = candidate
    .replace(/-+/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
  return normalized || fallback
}

export function normalizeKeySlug(value: string): string | null {
  const normalized = value.trim().toLocaleLowerCase()
  return normalized && toKeySlug(normalized, '') === normalized ? normalized : null
}

export function isKeySlug(value: string): boolean {
  return normalizeKeySlug(value) !== null
}

/** 身份短哈希：FNV-1a 32 位取 6 位十六进制，跨平台与语言环境结果一致。 */
function shortKeyHash(identity: string): string {
  const normalized = identity.normalize('NFKC').toLowerCase()
  let hash = 0x811c9dc5
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0').slice(0, 6)
}

export type PackageKeyIdentity = {
  /** 来源平台，例如 github、local。 */
  readonly source: string
  /** 作者：远程包是仓库所有者，本地包是发布者身份。 */
  readonly author: string
  /** 包名。 */
  readonly name: string
}

/**
 * 包身份 Key：`来源-作者-包名` 的可读前缀 + 身份短哈希。
 * 本地包和远程包使用同一套规则，前缀相同也不会撞（哈希覆盖完整三元组）。
 */
export function createPackageKey(identity: PackageKeyIdentity): string {
  const composed = `${identity.source}/${identity.author}/${identity.name}`
  return `${toKeySlug(composed)}-${shortKeyHash(composed)}`
}

export function createAvailableKey(
  value: string,
  existingKeys: Iterable<string>,
  fallback = 'item',
): string {
  const base = toKeySlug(value, fallback)
  const identities = new Set(Array.from(existingKeys, key => key.toLocaleLowerCase()))
  let candidate = base
  let suffix = 2
  while (identities.has(candidate.toLocaleLowerCase())) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}
