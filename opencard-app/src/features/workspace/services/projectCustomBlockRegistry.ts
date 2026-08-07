import {
  normalizeProjectCustomBlockArchivePath,
  parseProjectCustomBlockRegistry,
  type ProjectCustomBlockRegistryDocument,
} from '../model/projectCustomBlocks'

export function registerProjectCustomBlockPath(
  document: ProjectCustomBlockRegistryDocument,
  archivePath: string,
): ProjectCustomBlockRegistryDocument {
  const normalized = normalizeProjectCustomBlockArchivePath(archivePath)
  if (!normalized) throw new Error('Invalid custom block archive path')
  const current = parseProjectCustomBlockRegistry(document)
  if (!current) throw new Error('Invalid custom block registry')
  const blocks = [...(current.blocks ?? [])]
  const existing = blocks.findIndex(path => path.toLocaleLowerCase() === normalized.toLocaleLowerCase())
  if (existing >= 0) blocks[existing] = normalized
  else blocks.push(normalized)
  return { blocks }
}

export function unregisterProjectCustomBlockPath(
  document: ProjectCustomBlockRegistryDocument,
  archivePath: string,
): ProjectCustomBlockRegistryDocument {
  const normalized = normalizeProjectCustomBlockArchivePath(archivePath)
  if (!normalized) throw new Error('Invalid custom block archive path')
  const current = parseProjectCustomBlockRegistry(document)
  if (!current) throw new Error('Invalid custom block registry')
  const blocks = (current.blocks ?? []).filter(path => path.toLocaleLowerCase() !== normalized.toLocaleLowerCase())
  return blocks.length ? { blocks } : {}
}
