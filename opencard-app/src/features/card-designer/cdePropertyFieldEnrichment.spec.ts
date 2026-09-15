import { describe, expect, it } from 'vitest'
import type { ProjectIconSeries } from '../workspace/model/projectIcons'
import { buildProjectIconCatalog } from '../workspace/services/projectIconCatalog'
import { enrichCardPropertyFieldDefinition } from './cdePropertyFieldEnrichment'

const iconSeries: ProjectIconSeries[] = [{
  name: 'Status icons',
  key: 'status',
  icons: [{ iconKey: 'warning', name: 'Warning', source: 'assets/icons/warning.svg', tint: 'theme' }],
}]

/** The image block's `source` field exactly as entities/card/schema.ts declares it. */
const imageSourceDefinition = {
  title: 'Source',
  fieldType: 'filePath' as const,
  allowRemote: true,
  minLength: 0,
  categoryId: 'content' as const,
  filter: { target: 'file' as const, extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] },
}

const translate = (key: string) => key

describe('card property field enrichment', () => {
  it('offers project icons while an image source holds an icon reference', async () => {
    const definition = enrichCardPropertyFieldDefinition({
      translate,
      definition: imageSourceDefinition,
      fieldKey: 'source',
      record: {},
      fontCatalog: [],
      projectIconCatalog: buildProjectIconCatalog(iconSeries, source => `asset://${source}`),
    })

    const provider = definition.completion?.provider
    expect(provider).toBeTruthy()

    const seriesResult = await provider!({ value: 'icon:', cursor: 5 })
    expect(seriesResult?.items).toContainEqual(expect.objectContaining({
      label: 'Status icons',
      insertText: 'status/',
    }))

    const iconValue = 'icon:status/'
    const iconResult = await provider!({ value: iconValue, cursor: iconValue.length })
    expect(iconResult?.items).toContainEqual(expect.objectContaining({
      label: 'Warning',
      insertText: 'icon:status/warning',
    }))
  })
})
