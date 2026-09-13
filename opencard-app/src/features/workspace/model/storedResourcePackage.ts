/**
 * 模块说明：
 * - 描述软件存储里的“附加包”：沿用项目的 `.ocpack` 归档格式（见 model/resourcePackage），
 *   但不属于任何项目，创建项目时按需装入。
 * 职责边界：
 * - 只有数据类型与存储目录名；读写、校验和归档命名都在 services/storedResourcePackageLibrary。
 */
export const STORED_RESOURCE_PACKAGE_DIRECTORY_NAME = 'packages'

export type StoredResourcePackage = {
  /** 归档在软件存储中的完整路径，同时作为列表与“是否已附加”的标识。 */
  path: string
  key: string
  name: string
  version: string
}

export type StoredResourcePackageWarning = {
  path: string
  reason: string
}

export type StoredResourcePackageSnapshot = {
  packs: StoredResourcePackage[]
  warnings: StoredResourcePackageWarning[]
}
