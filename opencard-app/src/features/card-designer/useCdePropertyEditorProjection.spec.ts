import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createSimpleContainerBlock,
  createTextBlock,
  type CardDocument,
} from '../../entities/card/model'
import { buildParentLookup } from '../../entities/card/tree'
import type { FilePathDirectoryProvider } from '../../shared/model/filePath'
import type { CdePropertyEditorInput } from './cdePropertyFieldDefinitions'
import { useCdePropertyEditorProjection } from './useCdePropertyEditorProjection'
import { setProjectFonts } from '../workspace/model/projectFonts'

function createHarness() {
  const text = createTextBlock({
    id: 'text',
    name: 'Text',
    content: 'Instance content',
    fontFamily: 'font:body; Arial; sans-serif',
    fontSize: '18px',
  })
  const parent = createSimpleContainerBlock({ id: 'parent', name: 'Parent' })
  parent.children.push({
    block: text,
    location: { id: 'text-location', type: 'simple-container-location', anchor: 'lt' },
  })
  const document: CardDocument = {
    type: 'card-document',
    schemaVersion: '2',
    id: 'document',
    name: 'Blueprint',
    version: '1.0.0',
    width: '540',
    height: '850',
    faces: {
      front: {
        type: 'card-face',
        id: 'front',
        background: '#fff',
        children: [{
          block: parent,
          location: { id: 'parent-location', type: 'simple-container-location', anchor: 'lt' },
        }],
      },
      back: { type: 'card-face', id: 'back', background: '#000', children: [] },
    },
    instances: [{
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: { text: { content: 'Instance content' } },
    }],
  }
  const rawPropertyInputs = ref<readonly CdePropertyEditorInput[]>([{
    key: text.id,
    record: { ...text, image: '' } as unknown as Record<string, unknown>,
    fields: {
      content: { fieldType: 'string', title: 'Content', richText: true },
      fontFamily: { fieldType: 'string', title: 'Font family' },
      image: { fieldType: 'filePath', title: 'Image' },
      optional: { fieldType: 'string', title: 'Optional' },
    },
  }])
  const directoryProvider = vi.fn<FilePathDirectoryProvider>(async () => [{ name: 'portrait.png' }])
  const state = useCdePropertyEditorProjection({
    cardDoc: ref(document),
    documentRevision: ref(0),
    activeFaceKey: ref('front'),
    selectedCardId: ref('instance'),
    selectedBlock: ref(text),
    parentLookup: ref(buildParentLookup(document)),
    rawPropertyInputs,
    projectContext: computed(() => ({
      fonts: {
        body: { name: 'Body Font', source: 'fonts/body.woff2' },
      },
      information: { name: 'Project', description: 'Description', version: '2.0.0' },
      dictionary: { greeting: 'Hello' },
    })),
    directoryProvider: ref(directoryProvider),
    blueprintCardId: '__blueprint__',
    translate: (key, parameters) => parameters?.depth ? `${key}:${parameters.depth}` : key,
    hasMessage: () => false,
  })
  return { directoryProvider, state }
}

async function completionItems(
  provider: ((request: { value: string; cursor: number }) => unknown) | undefined,
  value: string,
  cursor: number,
) {
  const result = await Promise.resolve(provider?.({ value, cursor })) as {
    items?: Array<{ insertText: string; value?: unknown; labelStyle?: Readonly<Record<string, string>> }>
  } | null
  return result?.items ?? []
}

describe('useCdePropertyEditorProjection', () => {
  it('builds instance, parent, project, and dictionary binding scopes', async () => {
    const { state } = createHarness()
    const definition = state.propertyEditorInputs.value[0]!.fields.content!
    const provider = definition.completion?.provider

    expect((await completionItems(provider, '{{card:}}', 7)).map(item => item.insertText))
      .toContain('card:name')
    expect((await completionItems(provider, '{{card:}}', 7)).map(item => item.insertText))
      .not.toContain('card:version')
    expect((await completionItems(provider, '{{parent:}}', 9)).map(item => item.insertText))
      .toContain('parent:name')
    expect((await completionItems(provider, '{{project:}}', 10)).map(item => item.insertText))
      .toContain('project:version')
    expect((await completionItems(provider, '{{dictionary:}}', 13)).map(item => item.insertText))
      .toContain('dictionary:greeting')
  })

  it('adds project fonts and rich-text base styles without owning UI state', async () => {
    setProjectFonts([{ key: 'body', name: 'Body Font', source: 'fonts/body.woff2' }])
    const { state } = createHarness()
    const fields = state.propertyEditorInputs.value[0]!.fields
    const fontItems = await completionItems(fields.fontFamily?.completion?.provider, 'Body', 4)

    expect(fontItems.map(item => item.value)).toContain('font:body')
    expect(fontItems.find(item => item.value === 'font:body')?.labelStyle)
      .toEqual({ fontFamily: '"OpenCardProjectFont-body"' })
    expect(fields.content?.fontOptions?.map(item => item.value)).toContain('font:body')
    expect(fields.content?.richTextBaseStyle).toEqual({
      fontFamily: '"OpenCardProjectFont-body", Arial, sans-serif',
      fontSize: '18px',
    })

    const fallbackValue = 'font:body; Ar'
    const completion = await fields.fontFamily?.completion?.provider?.({
      value: fallbackValue,
      cursor: fallbackValue.length,
    })
    expect(completion).toMatchObject({ replaceStart: 10, replaceEnd: fallbackValue.length })
    expect(completion?.items.find(item => item.value === ' Arial')?.insertText).toBe(' Arial')
  })

  it('passes file-path directory reads through the injected provider', async () => {
    const { directoryProvider, state } = createHarness()
    const definition = state.propertyEditorInputs.value[0]!.fields.image
    expect(definition?.fieldType).toBe('filePath')
    if (!definition || definition.fieldType !== 'filePath') return
    const entries = await definition.directoryProvider?.('images')

    expect(entries).toEqual([{ name: 'portrait.png' }])
    expect(directoryProvider).toHaveBeenCalledWith('images')
  })

  it('does not invent binding context for schema fields absent from the record', () => {
    const { state } = createHarness()
    const definition = state.propertyEditorInputs.value[0]!.fields.optional

    expect(definition?.binding).toBeUndefined()
    expect(definition?.completion).toBeUndefined()
  })
})
