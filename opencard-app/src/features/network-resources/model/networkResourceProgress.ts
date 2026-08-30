export type NetworkResourceProgressValue = {
  receivedBytes: number
  totalBytes: number | null
}

export type AggregatedNetworkResourceProgress = {
  progress: number
  receivedBytes: number
  hasUnknownSize: boolean
}

export function aggregateNetworkResourceProgress(
  downloads: readonly NetworkResourceProgressValue[],
): AggregatedNetworkResourceProgress | null {
  if (downloads.length === 0) return null
  const known = downloads.filter(download => download.totalBytes !== null && download.totalBytes > 0)
  const totalBytes = known.reduce((total, download) => total + (download.totalBytes ?? 0), 0)
  const receivedKnownBytes = known.reduce((total, download) => total + download.receivedBytes, 0)
  return {
    progress: totalBytes > 0 ? Math.min(1, receivedKnownBytes / totalBytes) : 0,
    receivedBytes: downloads.reduce((total, download) => total + download.receivedBytes, 0),
    hasUnknownSize: known.length !== downloads.length,
  }
}
