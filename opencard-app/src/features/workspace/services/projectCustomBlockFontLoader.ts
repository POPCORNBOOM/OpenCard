import { convertFileSrc } from '@tauri-apps/api/core'
import type { ProjectFont, UnicodeRange } from '../model/projectFontRegistry'
import { projectFontFileEntries, projectFontWeightValues } from '../model/projectFontRegistry'
import type { ProjectResourceEnvironment } from './projectResourceEnvironment'
import {
  createScopedProjectFontFamily,
  resolveProjectInternalResourceFilePath,
} from './projectResourceEnvironment'
import { fileSystemService } from './fileSystemService'
import {
  characterSetToUnicodeRanges,
  mergeUnicodeRanges,
  readProjectFontCharacterSet,
  subtractUnicodeRanges,
} from './projectFontCoverage'

export type ProjectCustomBlockFontLoadError = {
  packageId: string
  fontKey: string
  source: string
  reason: 'load-failed'
}

export type ProjectCustomBlockFontSession = {
  errors: readonly ProjectCustomBlockFontLoadError[]
  release: () => void
}

export type ProjectCustomBlockFontRuntime = {
  createFontFace: (family: string, source: string, descriptors?: FontFaceDescriptors) => FontFace
  addFont: (face: FontFace) => void
  deleteFont: (face: FontFace) => void
}

function defaultRuntime(): ProjectCustomBlockFontRuntime | null {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return null
  return {
    createFontFace: (family, source, descriptors) => new FontFace(family, source, descriptors),
    addFont: face => document.fonts.add(face),
    deleteFont: face => document.fonts.delete(face),
  }
}

function cssUnicodeRanges(ranges: readonly UnicodeRange[]): string {
  return ranges.map(range => range.start === range.end
    ? `U+${range.start.toString(16).toUpperCase()}`
    : `U+${range.start.toString(16).toUpperCase()}-${range.end.toString(16).toUpperCase()}`)
    .join(', ')
}

export async function createProjectCustomBlockFontSession(
  environments: Iterable<ProjectResourceEnvironment>,
  runtime = defaultRuntime(),
  readBytes: (path: string) => Promise<Uint8Array> = path => fileSystemService.readBinaryFile(path),
): Promise<ProjectCustomBlockFontSession> {
  if (!runtime) return { errors: [], release: () => undefined }
  const loadedFaces: FontFace[] = []
  const errors: ProjectCustomBlockFontLoadError[] = []

  for (const environment of environments) {
    if (environment.kind !== 'package') continue
    const packageId = environment.namespace.slice('package-'.length)
    const families = environment.fontDocument.families ?? []
    const compositions = environment.fontDocument.compositions ?? []
    const familiesByKey = new Map(families.map(font => [font.key.toLocaleLowerCase(), font]))
    const characterSets = new Map<string, Promise<ReadonlySet<number>>>()

    const loadFace = async (
      fontKey: string,
      familyName: string,
      slot: ReturnType<typeof projectFontFileEntries>[number],
      unicodeRanges?: readonly UnicodeRange[],
    ): Promise<void> => {
      let face: FontFace | null = null
      try {
        const path = resolveProjectInternalResourceFilePath(environment, slot.source)
        if (!path) throw new Error('Invalid package font path')
        face = runtime.createFontFace(familyName, `url(${JSON.stringify(convertFileSrc(path))})`, {
          weight: String(projectFontWeightValues[slot.weight]),
          style: slot.style === 'upright' ? 'normal' : 'italic',
          ...(unicodeRanges?.length ? { unicodeRange: cssUnicodeRanges(unicodeRanges) } : {}),
        })
        await face.load()
        runtime.addFont(face)
        loadedFaces.push(face)
      } catch {
        if (face) runtime.deleteFont(face)
        errors.push({ packageId, fontKey, source: slot.source, reason: 'load-failed' })
      }
    }

    for (const font of families) {
      const familyName = createScopedProjectFontFamily(environment.namespace, font.key)
      for (const slot of projectFontFileEntries(font)) await loadFace(font.key, familyName, slot)
    }

    for (const composition of compositions) {
      const familyName = createScopedProjectFontFamily(environment.namespace, composition.key)
      const claimedByDescriptor = new Map<string, UnicodeRange[]>()
      for (const member of composition.members) {
        const font: ProjectFont | undefined = familiesByKey.get(member.fontKey.toLocaleLowerCase())
        if (!font) continue
        for (const slot of projectFontFileEntries(font)) {
          try {
            const path = resolveProjectInternalResourceFilePath(environment, slot.source)
            if (!path) throw new Error('Invalid package font path')
            let pending = characterSets.get(path)
            if (!pending) {
              pending = readProjectFontCharacterSet(await readBytes(path))
              characterSets.set(path, pending)
            }
            const available = characterSetToUnicodeRanges(await pending, member.ranges)
            const descriptorKey = `${slot.weight}:${slot.style}`
            const claimed = claimedByDescriptor.get(descriptorKey) ?? []
            const effective = subtractUnicodeRanges(available, claimed)
            if (effective.length === 0) continue
            claimedByDescriptor.set(descriptorKey, mergeUnicodeRanges([...claimed, ...effective]))
            await loadFace(font.key, familyName, slot, effective)
          } catch {
            errors.push({ packageId, fontKey: font.key, source: slot.source, reason: 'load-failed' })
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
      for (const face of loadedFaces) runtime.deleteFont(face)
    },
  }
}
