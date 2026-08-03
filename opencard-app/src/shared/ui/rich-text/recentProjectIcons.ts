import { readonly, ref, type Ref } from 'vue'

const RECENT_PROJECT_ICON_LIMIT = 5
const identities = ref<string[]>([])

export const recentProjectIconIdentities = readonly(identities) as Readonly<Ref<readonly string[]>>

export function projectIconRecentIdentity(seriesKey: string, iconKey: string): string {
  return `${seriesKey.toLocaleLowerCase()}\u0000${iconKey.toLocaleLowerCase()}`
}

export function rememberRecentProjectIcon(seriesKey: string, iconKey: string): void {
  const identity = projectIconRecentIdentity(seriesKey, iconKey)
  identities.value = [identity, ...identities.value.filter(candidate => candidate !== identity)]
    .slice(0, RECENT_PROJECT_ICON_LIMIT)
}

export function clearRecentProjectIcons(): void {
  identities.value = []
}
