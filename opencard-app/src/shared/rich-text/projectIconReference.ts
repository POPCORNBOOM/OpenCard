/**
 * Project icon reference protocol.
 *
 * Canonical spelling is the resource reference for icons: `[package@]icon:collection/icon`.
 * A leading `package@` names an icon owned by a package; without it the icon belongs to the
 * current project. Paths without the `icon:` prefix are the pre-package spelling of a
 * current-project icon and stay readable.
 *
 * This module owns the spelling only. Naming, lookup, and drawing belong to `projectIconCatalog`;
 * resolving a package-qualified reference belongs to the resource reference layer.
 */

export type ProjectIconReference = {
  /** Package the icon belongs to. `null` means the current project. */
  packageKey: string | null
  seriesKey: string
  iconKey: string
}

const projectIconKeyPattern = /^[a-z0-9][a-z0-9._-]*$/
const qualifiedReferencePattern = /^(?:([a-z0-9._-]+)@)?icon:(.+)$/i

export function parseProjectIconPath(path: string): ProjectIconReference | null {
  const value = path.trim()
  if (!value) return null
  const qualified = qualifiedReferencePattern.exec(value)
  const body = qualified ? qualified[2]! : value
  const separator = body.indexOf('/')
  if (separator <= 0 || separator === body.length - 1) return null
  const seriesKey = body.slice(0, separator).trim()
  const iconKey = body.slice(separator + 1).trim()
  if (!projectIconKeyPattern.test(seriesKey) || !projectIconKeyPattern.test(iconKey)) return null
  return { packageKey: qualified?.[1] ?? null, seriesKey, iconKey }
}

export function formatProjectIconPath(reference: ProjectIconReference): string {
  return `${reference.packageKey ? `${reference.packageKey}@` : ''}icon:${reference.seriesKey}/${reference.iconKey}`
}
