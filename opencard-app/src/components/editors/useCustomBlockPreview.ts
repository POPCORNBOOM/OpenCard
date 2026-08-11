import { computed, ref, shallowRef, watch, type DeepReadonly, type Ref } from 'vue'
import {
  createCardFace,
  getAdditionalFieldPropertyDefinition,
  type CardDocument,
} from '../../entities/card/model'
import {
  createPropertyDefaultValue,
  fillDefaults,
  getTypePropertyEditorSchema,
  parseAdditionalFieldDefinitions,
  type EditorPropertyDefinition,
} from '../../entities/card/schema'
import { resolveCardPropertyFields } from '../../features/card-properties/cardPropertyFieldDefinitions'
import { prepareCardRender, type CardRenderEnvironment } from '../../features/card-rendering/renderPipeline'
import type { RenderReadyCardFace } from '../../features/card-rendering/render.types'
import type {
  ProjectCustomBlockCatalogEntry,
  ProjectCustomBlockManifestCatalogEntry,
  ProjectCustomBlockRegistryDocument,
} from '../../features/workspace/model/projectCustomBlocks'
import { createProjectCustomBlockInstance } from '../../features/workspace/services/createProjectCustomBlockInstance'
import type {
  PropertyEditorCategoryDefinition,
  PropertyEditorInput,
  PropertyEditorMutation,
} from '../../shared/ui/property-editor/propertyEditor.types'

const PREVIEW_INPUT_KEY = 'custom-block-preview'
const PREVIEW_BLOCK_ID = 'custom-block-preview-host'
const PUBLIC_FIELDS_CATEGORY_KEY = 'publicFields'

export type CustomBlockPreviewEntry = {
  path: string
  catalogEntry: DeepReadonly<ProjectCustomBlockCatalogEntry> | null
}

export type CustomBlockPreviewFitRect = {
  left: number
  top: number
  width: number
  height: number
}

type PreviewValueState = {
  block: DeepReadonly<ProjectCustomBlockCatalogEntry['block']>
  values: Record<string, unknown>
}

type UseCustomBlockPreviewOptions = {
  document: Readonly<Ref<ProjectCustomBlockRegistryDocument | null>>
  catalog: Readonly<Ref<ReadonlyMap<string, DeepReadonly<ProjectCustomBlockCatalogEntry>>>>
  manifestCatalog: Readonly<Ref<ReadonlyMap<string, DeepReadonly<ProjectCustomBlockManifestCatalogEntry>>>>
  ensureLoaded: (customBlockKey: string) => Promise<ProjectCustomBlockCatalogEntry | null>
  renderEnvironment: Readonly<Ref<CardRenderEnvironment>>
  resourceRootPath: Readonly<Ref<string | null>>
  translate: (messageKey: string) => string
  hasMessage: (messageKey: string) => boolean
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').toLocaleLowerCase()
}

function createDefaultValues(entry: DeepReadonly<ProjectCustomBlockCatalogEntry>): Record<string, unknown> {
  const rootDefinitions = parseAdditionalFieldDefinitions(entry.block.additionalFieldDefinition)
  const nativeSchema = getTypePropertyEditorSchema(entry.block.type)
  return Object.fromEntries(entry.manifest.publicFieldKeys.map(fieldKey => {
    const additional = rootDefinitions[fieldKey]
    const editorDefinition = additional ? getAdditionalFieldPropertyDefinition(additional) : nativeSchema[fieldKey]
    return [fieldKey, Object.prototype.hasOwnProperty.call(entry.block, fieldKey)
      ? structuredClone((entry.block as Readonly<Record<string, unknown>>)[fieldKey])
      : editorDefinition ? createPropertyDefaultValue(editorDefinition) : '']
  }))
}

function createPreviewDocument(
  entry: DeepReadonly<ProjectCustomBlockCatalogEntry>,
  values: Readonly<Record<string, unknown>>,
): CardDocument {
  const host = createProjectCustomBlockInstance(entry, { id: PREVIEW_BLOCK_ID })
  Object.assign(host, values)
  const front = createCardFace({
    id: 'custom-block-preview-front',
    background: 'transparent',
    children: [{
      block: host,
      location: {
        id: 'custom-block-preview-location',
        type: 'simple-container-location',
        anchor: 'lt',
        x: '0px',
        y: '0px',
      },
    }],
  })
  const back = createCardFace({ id: 'custom-block-preview-back', background: 'transparent' })
  return fillDefaults('card-document', {
    type: 'card-document',
    id: `custom-block-preview-${entry.manifest.customBlockKey}`,
    name: entry.manifest.name,
    faces: { front, back },
    instances: [],
  }) as unknown as CardDocument
}

function resolvePreviewLength(value: string, parentSize: number): number | null {
  const normalized = value.trim()
  const numeric = Number.parseFloat(normalized)
  if (!Number.isFinite(numeric)) return null
  return normalized.endsWith('%') ? parentSize * numeric / 100 : numeric
}

export function useCustomBlockPreview(options: UseCustomBlockPreviewOptions) {
  const selectedPath = ref<string | null>(null)
  const valueStates = shallowRef(new Map<string, PreviewValueState>())

  const entries = computed<CustomBlockPreviewEntry[]>(() => {
    const catalogByPath = new Map([...options.catalog.value.values()].map(entry => [
      normalizePath(entry.archivePath),
      entry,
    ]))
    return (options.document.value?.blocks ?? []).map(path => ({
      path,
      catalogEntry: catalogByPath.get(normalizePath(path)) ?? null,
    }))
  })

  watch(selectedPath, path => {
    if (!path) return
    const descriptor = [...options.manifestCatalog.value.values()].find(
      entry => normalizePath(entry.archivePath) === normalizePath(path),
    )
    if (descriptor) void options.ensureLoaded(descriptor.manifest.customBlockKey)
  }, { immediate: true })

  watch(
    () => entries.value.map(entry => entry.path),
    (paths, previousPaths = []) => {
      if (selectedPath.value && paths.includes(selectedPath.value)) return
      if (paths.length === 0) {
        selectedPath.value = null
        return
      }
      const previousIndex = selectedPath.value ? previousPaths.indexOf(selectedPath.value) : -1
      selectedPath.value = paths[Math.min(Math.max(previousIndex, 0), paths.length - 1)] ?? paths[0]!
    },
    { immediate: true },
  )

  const selectedEntry = computed(() => (
    entries.value.find(entry => entry.path === selectedPath.value) ?? null
  ))

  watch(
    () => selectedEntry.value?.catalogEntry,
    entry => {
      if (!entry || !selectedPath.value) return
      const identity = normalizePath(selectedPath.value)
      const current = valueStates.value.get(identity)
      if (current?.block === entry.block) return
      const next = new Map(valueStates.value)
      next.set(identity, {
        block: entry.block,
        values: createDefaultValues(entry),
      })
      valueStates.value = next
    },
    { immediate: true },
  )

  const activeValues = computed<Readonly<Record<string, unknown>>>(() => {
    if (!selectedPath.value) return {}
    return valueStates.value.get(normalizePath(selectedPath.value))?.values ?? {}
  })

  const pipelineResult = computed(() => {
    const entry = selectedEntry.value?.catalogEntry
    if (!entry) return null
    return prepareCardRender({
      document: createPreviewDocument(entry, activeValues.value),
      instance: null,
      resourceRootPath: options.resourceRootPath.value,
      environment: options.renderEnvironment.value,
    })
  })

  const previewFace = computed<RenderReadyCardFace | null>(() => (
    pipelineResult.value?.document.faces.front ?? null
  ))
  const previewResources = computed(() => pipelineResult.value?.resources ?? null)
  const previewFitRect = computed<CustomBlockPreviewFitRect | undefined>(() => {
    const face = previewFace.value
    const child = face?.children[0]
    if (!face || !child) return undefined
    const width = resolvePreviewLength(child.block.width, face.width)
    const height = resolvePreviewLength(child.block.height, face.height)
    if (width === null || height === null || width <= 0 || height <= 0) return undefined
    return {
      left: resolvePreviewLength(child.location.x, face.width) ?? 0,
      top: resolvePreviewLength(child.location.y, face.height) ?? 0,
      width,
      height,
    }
  })
  const issues = computed(() => pipelineResult.value?.issues ?? [])

  const propertyInputs = computed<readonly PropertyEditorInput[]>(() => {
    const entry = selectedEntry.value?.catalogEntry
    if (!entry || entry.manifest.publicFieldKeys.length === 0) return []
    const rootDefinitions = parseAdditionalFieldDefinitions(entry.block.additionalFieldDefinition)
    const nativeSchema = getTypePropertyEditorSchema(entry.block.type)
    const publicKeys = new Set(entry.manifest.publicFieldKeys)
    const override = Object.fromEntries(entry.manifest.publicFieldKeys.flatMap(fieldKey => {
      const additional = rootDefinitions[fieldKey]
      const definition = additional ? getAdditionalFieldPropertyDefinition(additional) : nativeSchema[fieldKey]
      return definition ? [[fieldKey, {
        ...definition,
        required: true,
        resettable: false,
      } satisfies Partial<EditorPropertyDefinition>] as const] : []
    }))
    const labels = Object.fromEntries(entry.manifest.publicFieldKeys.map(fieldKey => [
      fieldKey,
      rootDefinitions[fieldKey]?.title
        ?? (options.hasMessage(`propertyEditor.fields.${fieldKey}`)
          ? options.translate(`propertyEditor.fields.${fieldKey}`)
          : fieldKey),
    ]))
    const fields = resolveCardPropertyFields({
      type: 'custom-block',
      ...activeValues.value,
    }, {
      allowDelete: false,
      translate: options.translate,
      hasMessage: options.hasMessage,
      override,
      labels,
      customKeys: new Set([...publicKeys].filter(fieldKey => Boolean(rootDefinitions[fieldKey]))),
    })
    return [{
      key: PREVIEW_INPUT_KEY,
      title: entry.manifest.name,
      record: activeValues.value,
      fields: Object.fromEntries(Object.entries(fields)
        .filter(([fieldKey]) => publicKeys.has(fieldKey))
        .map(([fieldKey, definition]) => [fieldKey, {
          ...definition,
          category: PUBLIC_FIELDS_CATEGORY_KEY,
        }])),
    }]
  })

  const propertyCategories = computed<ReadonlyMap<string, PropertyEditorCategoryDefinition>>(() => new Map([
    [PUBLIC_FIELDS_CATEGORY_KEY, {
      title: options.translate('customBlockRegistry.preview.publicFields'),
      icon: 'entity.block-custom',
    }],
  ]))

  function selectPath(path: string): void {
    if (entries.value.some(entry => entry.path === path)) selectedPath.value = path
  }

  function updateProperty(mutation: PropertyEditorMutation): void {
    const entry = selectedEntry.value?.catalogEntry
    const path = selectedPath.value
    if (!entry || !path || mutation.key !== PREVIEW_INPUT_KEY
      || !entry.manifest.publicFieldKeys.includes(mutation.fieldKey)) return
    const identity = normalizePath(path)
    const next = new Map(valueStates.value)
    next.set(identity, {
      block: entry.block,
      values: { ...activeValues.value, [mutation.fieldKey]: mutation.value },
    })
    valueStates.value = next
  }

  function resetActiveValues(): void {
    const entry = selectedEntry.value?.catalogEntry
    const path = selectedPath.value
    if (!entry || !path) return
    const next = new Map(valueStates.value)
    next.set(normalizePath(path), {
      block: entry.block,
      values: createDefaultValues(entry),
    })
    valueStates.value = next
  }

  return {
    entries,
    selectedPath,
    selectedEntry,
    activeValues,
    previewFace,
    previewResources,
    previewFitRect,
    issues,
    propertyInputs,
    propertyCategories,
    selectPath,
    updateProperty,
    resetActiveValues,
  }
}
