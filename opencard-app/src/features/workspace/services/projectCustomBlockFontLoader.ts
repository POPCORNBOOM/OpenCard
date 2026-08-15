import type { ProjectFont, UnicodeRange } from '../model/projectFontRegistry'
import { projectFontFileEntries, projectFontWeightValues } from '../model/projectFontRegistry'
import type {
  ProjectCustomBlockFontResourceFile,
  ProjectCustomBlockResourceIndex,
} from '../model/projectCustomBlocks'
import { createProjectCustomBlockFontFamily } from './projectCustomBlockResources'
import { findProjectCustomBlockFile } from './projectCustomBlock'
import {
  characterSetToUnicodeRanges,
  mergeUnicodeRanges,
  readProjectFontCharacterSet,
  subtractUnicodeRanges,
} from './projectFontCoverage'

type LoadedFont = { face: FontFace; url: string }

export type ProjectCustomBlockFontLoadError = {
  packageKey: string
  fontKey: string
  source: string
  reason: 'load-failed'
}

export type ProjectCustomBlockFontSession = {
  errors: readonly ProjectCustomBlockFontLoadError[]
  release: () => void
}

export type ProjectCustomBlockFontRuntime = {
  createObjectUrl: (blob: Blob) => string
  revokeObjectUrl: (url: string) => void
  createFontFace: (family: string, source: string, descriptors?: FontFaceDescriptors) => FontFace
  addFont: (face: FontFace) => void
  deleteFont: (face: FontFace) => void
}

function defaultRuntime(): ProjectCustomBlockFontRuntime | null {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return null
  return {
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url),
    createFontFace: (family, source, descriptors) => new FontFace(family, source, descriptors),
    addFont: face => document.fonts.add(face),
    deleteFont: face => document.fonts.delete(face),
  }
}

function fontMimeForPath(path: string): string {
  if (/\.woff2$/i.test(path)) return 'font/woff2'
  if (/\.woff$/i.test(path)) return 'font/woff'
  if (/\.otf$/i.test(path)) return 'font/otf'
  if (/\.ttf$/i.test(path)) return 'font/ttf'
  return 'application/octet-stream'
}

export type ProjectCustomBlockFontCatalog = ReadonlyMap<string, {
  readonly manifest: {
    readonly customBlockKey: string
    readonly resources?: ProjectCustomBlockResourceIndex
  }
  readonly files: ReadonlyMap<string, Uint8Array>
}>

function cssUnicodeRanges(ranges: readonly UnicodeRange[]): string {
  return ranges.map(range => range.start === range.end
    ? `U+${range.start.toString(16).toUpperCase()}`
    : `U+${range.start.toString(16).toUpperCase()}-${range.end.toString(16).toUpperCase()}`)
    .join(', ')
}

export async function createProjectCustomBlockFontSession(
  catalog: ProjectCustomBlockFontCatalog,
  runtime = defaultRuntime(),
): Promise<ProjectCustomBlockFontSession> {
  if (!runtime) return { errors: [], release: () => undefined }
  const next: LoadedFont[] = []
  const errors: ProjectCustomBlockFontLoadError[] = []
  for (const entry of catalog.values()) {
    const fonts = entry.manifest.resources?.fonts ?? []
    const projectFonts = new Map(fonts.flatMap(font => font.kind === 'font'
      ? [[font.key.toLowerCase(), font] as const]
      : []))
    const characterSets = new Map<string, Promise<ReadonlySet<number>>>()
    const loadFace = async (
      fontKey: string,
      familyName: string,
      slot: ReturnType<typeof projectFontFileEntries>[number],
      unicodeRanges?: readonly UnicodeRange[],
    ): Promise<void> => {
      let url: string | null = null
      let face: FontFace | null = null
      try {
        const bytes = findProjectCustomBlockFile(entry.files, slot.source)
        if (!bytes) throw new Error(`Custom block font resource is missing: ${slot.source}`)
        url = runtime.createObjectUrl(new Blob([bytes.slice().buffer], { type: fontMimeForPath(slot.source) }))
        face = runtime.createFontFace(familyName, `url(${JSON.stringify(url)})`, {
          weight: String(projectFontWeightValues[slot.weight]),
          style: slot.style === 'upright' ? 'normal' : 'italic',
          ...(unicodeRanges?.length ? { unicodeRange: cssUnicodeRanges(unicodeRanges) } : {}),
        })
        await face.load()
        runtime.addFont(face)
        next.push({ face, url })
      } catch {
        if (face) runtime.deleteFont(face)
        if (url) runtime.revokeObjectUrl(url)
        errors.push({
          packageKey: entry.manifest.customBlockKey,
          fontKey,
          source: slot.source,
          reason: 'load-failed',
        })
      }
    }
    for (const font of fonts) {
      if (font.kind !== 'font') continue
      const familyName = createProjectCustomBlockFontFamily(entry.manifest.customBlockKey, font.key)
      for (const slot of projectFontFileEntries(font)) await loadFace(font.key, familyName, slot)
    }
    for (const font of fonts) {
      if (font.kind !== 'composition') continue
      const familyName = createProjectCustomBlockFontFamily(entry.manifest.customBlockKey, font.key)
      const claimedByDescriptor = new Map<string, UnicodeRange[]>()
      for (const member of font.members) {
        const font: ProjectCustomBlockFontResourceFile | undefined = projectFonts.get(member.fontKey.toLowerCase())
        if (!font) continue
        for (const slot of projectFontFileEntries(font as ProjectFont)) {
          try {
            const bytes = findProjectCustomBlockFile(entry.files, slot.source)
            if (!bytes) throw new Error(`Custom block font resource is missing: ${slot.source}`)
            let characterSet = characterSets.get(slot.source)
            if (!characterSet) {
              characterSet = readProjectFontCharacterSet(bytes)
              characterSets.set(slot.source, characterSet)
            }
            const available = characterSetToUnicodeRanges(await characterSet, member.ranges)
            const descriptorKey = `${slot.weight}:${slot.style}`
            const claimed = claimedByDescriptor.get(descriptorKey) ?? []
            const effective = subtractUnicodeRanges(available, claimed)
            if (effective.length === 0) continue
            claimedByDescriptor.set(descriptorKey, mergeUnicodeRanges([...claimed, ...effective]))
            await loadFace(font.key, familyName, slot, effective)
          } catch {
            errors.push({
              packageKey: entry.manifest.customBlockKey,
              fontKey: font.key,
              source: slot.source,
              reason: 'load-failed',
            })
          }
        }
      }
    }
  }
  let released = false
  return {
    errors,
    release: () => {
      if (released) return
      released = true
      for (const loaded of next) {
        runtime.deleteFont(loaded.face)
        runtime.revokeObjectUrl(loaded.url)
      }
    },
  }
}
