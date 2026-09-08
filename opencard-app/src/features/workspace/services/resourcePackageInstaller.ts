import { invoke } from '@tauri-apps/api/core'
import { normalizeResourcePackageManifest, serializeResourcePackageManifest, type ResourcePackageManifest } from '../model/resourcePackage'
import { parseProjectFontRegistryText, projectFontSources } from '../model/projectFontRegistry'
import { parseProjectIconRegistryText } from '../model/projectIconRegistry'
import { resolveResourcePath } from '../model/scopedResourcePath'

type NativeInspection = { manifestJson: string; contentHash: string; existingManifestJson: string | null; existingFingerprint: string | null; entryCount: number; unpackedBytes: number; packageKey: string; entryPaths: string[]; fontsJson: string | null; iconsJson: string | null }
export type ResourcePackagePreview = { manifest: ResourcePackageManifest; contentHash: string; existingManifest: ResourcePackageManifest | null; existingFingerprint: string | null; targetPath: string; projectRootPath: string; entryCount: number; unpackedBytes: number; sourcePath: string }
export type ResourcePackageInstallResult = { manifest: ResourcePackageManifest; targetPath: string; replaced: boolean; unchanged: boolean; fingerprint: string }
export type ResourcePackageInstallDecision = 'install' | 'unchanged' | 'replace'

export function decideResourcePackageInstallation(next: ResourcePackageManifest, existing: ResourcePackageManifest | null): ResourcePackageInstallDecision {
  if (!existing) return 'install'
  return existing.version === next.version ? 'unchanged' : 'replace'
}

function projectManifest(json: string): ResourcePackageManifest {
  let value: unknown
  try { value = JSON.parse(json) } catch { throw new Error('Invalid package manifest JSON') }
  const normalized = normalizeResourcePackageManifest(value)
  if (normalized.issues.length) throw new Error(`Invalid package manifest: ${normalized.issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`)
  return normalized.manifest
}

function validateProjection(native: NativeInspection, manifest: ResourcePackageManifest): void {
  const paths = new Set(native.entryPaths.map(path => path.toLocaleLowerCase()))
  const fonts = native.fontsJson ? parseProjectFontRegistryText(native.fontsJson) : {}
  if (native.fontsJson && !fonts) throw new Error('Invalid font registry in package')
  const families = fonts?.families ?? []
  const compositions = fonts?.compositions ?? []
  const fontKeys = new Set(families.map(font => font.key.toLocaleLowerCase()))
  for (const font of families) for (const source of projectFontSources(font)) if (!paths.has(archivePathForReference('.opencard/fonts/fonts.json', source).toLocaleLowerCase())) throw new Error(`Missing packaged font file: ${source}`)
  for (const composition of compositions) for (const member of composition.members) if (!fontKeys.has(member.fontKey.toLocaleLowerCase())) throw new Error(`Missing font composition member: ${member.fontKey}`)
  const availableFonts = new Set([...families, ...compositions].map(item => item.key.toLocaleLowerCase()))
  for (const item of manifest.public.fonts) if (!availableFonts.has(item.key.toLocaleLowerCase())) throw new Error(`Unknown public font: ${item.key}`)
  const icons = native.iconsJson ? parseProjectIconRegistryText(native.iconsJson) : {}
  if (native.iconsJson && !icons) throw new Error('Invalid icon registry in package')
  for (const series of icons?.iconSeries ?? []) if (!paths.has(archivePathForReference('.opencard/icons/icons.json', series.source).toLocaleLowerCase())) throw new Error(`Missing packaged icon spritesheet: ${series.source}`)
  for (const item of manifest.public.iconSeries) {
    const series = (icons?.iconSeries ?? []).find(candidate => candidate.key.toLocaleLowerCase() === item.key.toLocaleLowerCase())
    if (!series || series.icons.length !== item.count) throw new Error(`Invalid public icon series summary: ${item.key}`)
  }
}

function archivePathForReference(sourceFilePath: string, reference: string): string {
  const root = 'C:/package'
  const resolved = resolveResourcePath(root, `${root}/${sourceFilePath}`, reference)
  if (!resolved.ok) throw new Error(`Invalid packaged resource path: ${reference}`)
  return resolved.value.slice(root.length + 1)
}

export async function previewResourcePackage(options: { projectRootPath: string; sourcePath: string }): Promise<ResourcePackagePreview> {
  const native = await invoke<NativeInspection>('inspect_resource_package', { request: options })
  const manifest = projectManifest(native.manifestJson)
  validateProjection(native, manifest)
  if (manifest.contentHash !== native.contentHash) throw new Error('Package content hash does not match its manifest')
  return { manifest, contentHash: native.contentHash, existingManifest: native.existingManifestJson ? projectManifest(native.existingManifestJson) : null, existingFingerprint: native.existingFingerprint, targetPath: `${options.projectRootPath.replace(/[\\/]+$/, '')}/.opencard/packages/${native.packageKey}`, projectRootPath: options.projectRootPath, entryCount: native.entryCount, unpackedBytes: native.unpackedBytes, sourcePath: options.sourcePath }
}

export async function installResourcePackage(options: { preview: ResourcePackagePreview }): Promise<ResourcePackageInstallResult> {
  const native = await invoke<{ targetPath: string; replaced: boolean; fingerprint: string }>('install_resource_package', { request: { projectRootPath: options.preview.projectRootPath, sourcePath: options.preview.sourcePath, expectedContentHash: options.preview.contentHash, expectedExistingFingerprint: options.preview.existingFingerprint, manifestJson: serializeResourcePackageManifest(options.preview.manifest) } })
  return { manifest: options.preview.manifest, unchanged: false, ...native }
}

export async function recoverResourcePackageTransactions(projectRootPath: string): Promise<void> {
  await invoke('recover_resource_package_transactions', { projectRootPath })
}
