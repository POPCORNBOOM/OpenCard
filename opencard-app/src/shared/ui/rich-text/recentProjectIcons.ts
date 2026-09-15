import { readonly, ref, type Ref } from 'vue'

const RECENT_PROJECT_ICON_LIMIT = 5
const identities = ref<string[]>([])

export const recentProjectIconIdentities = readonly(identities) as Readonly<Ref<readonly string[]>>

/**
 * A recent icon is identified by its package as well as its keys: the same collection and icon
 * key can exist in the current project and in a package at the same time.
 */
export function projectIconRecentIdentity(
  packageKey: string | null,
  seriesKey: string,
  iconKey: string,
): string {
  return `${(packageKey ?? '').toLocaleLowerCase()}\u0000${seriesKey.toLocaleLowerCase()}\u0000${iconKey.toLocaleLowerCase()}`
}

export function rememberRecentProjectIcon(
  packageKey: string | null,
  seriesKey: string,
  iconKey: string,
): void {
  const identity = projectIconRecentIdentity(packageKey, seriesKey, iconKey)
  identities.value = [identity, ...identities.value.filter(candidate => candidate !== identity)]
    .slice(0, RECENT_PROJECT_ICON_LIMIT)
}
