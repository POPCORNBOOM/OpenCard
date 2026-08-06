export type ProjectFontPreviewRun = {
  text: string
  fontKey: string | null
}

type FontKitFont = {
  characterSet: number[]
}

type FontKitCollection = {
  fonts: FontKitFont[]
}

const ignoredCoverageCodePoints = new Set([
  0x0009,
  0x000a,
  0x000d,
  0x200d,
  0xfe0e,
  0xfe0f,
])

export async function readProjectFontCharacterSet(bytes: Uint8Array): Promise<ReadonlySet<number>> {
  const { create } = await import('fontkit')
  const parsed = create(bytes as never) as unknown as FontKitFont | FontKitCollection
  const font = 'characterSet' in parsed ? parsed : parsed.fonts[0]
  if (!font) throw new Error('Font collection does not contain a font')
  return new Set(font.characterSet)
}

export function createProjectFontPreviewRuns(
  text: string,
  orderedFontKeys: readonly string[],
  characterSets: ReadonlyMap<string, ReadonlySet<number>>,
): ProjectFontPreviewRun[] {
  const runs: ProjectFontPreviewRun[] = []
  for (const segment of splitGraphemes(text)) {
    const codePoints = [...segment]
      .map(character => character.codePointAt(0))
      .filter((codePoint): codePoint is number => (
        codePoint !== undefined && !ignoredCoverageCodePoints.has(codePoint)
      ))
    const fontKey = codePoints.length === 0
      ? runs[runs.length - 1]?.fontKey ?? orderedFontKeys[0] ?? null
      : orderedFontKeys.find(key => {
          const characterSet = characterSets.get(key)
          return characterSet !== undefined && codePoints.every(codePoint => characterSet.has(codePoint))
        }) ?? null
    const previous = runs[runs.length - 1]
    if (previous?.fontKey === fontKey) previous.text += segment
    else runs.push({ text: segment, fontKey })
  }
  return runs
}

function splitGraphemes(text: string): string[] {
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => {
      segment: (value: string) => Iterable<{ segment: string }>
    }
  }).Segmenter
  if (!Segmenter) return [...text]
  return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)]
    .map(segment => segment.segment)
}
