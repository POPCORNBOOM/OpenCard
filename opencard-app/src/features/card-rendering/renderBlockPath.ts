/** Joins a parent card block path and a block name into a dotted block path. */
export function joinBlockPath(parentPath: string, blockName: string): string {
  if (!blockName) return parentPath
  return parentPath ? `${parentPath}.${blockName}` : blockName
}
