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
  packageId: string
  descriptor: DeepReadonly<ProjectCustomBlockManifestCatalogEntry>
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
  overrides: Record<string, unknown>
}

type UseCustomBlockPreviewOptions = {
  catalog: Readonly<Ref<ReadonlyMap<string, DeepReadonly<ProjectCustomBlockCatalogEntry>>>>
  manifestCatalog: Readonly<Ref<ReadonlyMap<string, DeepReadonly<ProjectCustomBlockManifestCatalogEntry>>>>
  ensureLoaded: (packageId: string) => Promise<ProjectCustomBlockCatalogEntry | null>
  renderEnvironment: Readonly<Ref<CardRenderEnvironment>>
  resourceRootPath: Readonly<Ref<string | null>>
  translate: (messageKey: string) => string
  hasMessage: (messageKey: string) => boolean
}

function createDefaultValues(entry: DeepReadonly<ProjectCustomBlockCatalogEntry>): Record<string, unknown> {
  const definitions = parseAdditionalFieldDefinitions(entry.block.additionalFieldDefinition)
  const nativeSchema = getTypePropertyEditorSchema(entry.block.type)
  return Object.fromEntries(entry.manifest.publicFieldKeys.map(fieldKey => {
    const additional = definitions[fieldKey]
    const editorDefinition = additional ? getAdditionalFieldPropertyDefinition(additional) : nativeSchema[fieldKey]
    return [fieldKey, Object.prototype.hasOwnProperty.call(entry.block, fieldKey)
      ? structuredClone((entry.block as Readonly<Record<string, unknown>>)[fieldKey])
      : editorDefinition ? createPropertyDefaultValue(editorDefinition) : '']
  }))
}

function createPreviewDocument(
  entry: DeepReadonly<ProjectCustomBlockCatalogEntry>,
  overrides: Readonly<Record<string, unknown>>,
): CardDocument {
  const host = createProjectCustomBlockInstance(entry, { id: PREVIEW_BLOCK_ID })
  Object.assign(host, overrides)
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
    id: `custom-block-preview-${entry.manifest.packageId.replace('/', '-')}`,
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
  const selectedPackageId = ref<string | null>(null)
  const valueStates = shallowRef(new Map<string, PreviewValueState>())

  const entries = computed<CustomBlockPreviewEntry[]>(() => [...options.manifestCatalog.value.entries()]
    .map(([packageId, descriptor]) => ({
      packageId,
      descriptor,
      catalogEntry: options.catalog.value.get(packageId) ?? null,
    }))
    .sort((left, right) => left.packageId.localeCompare(right.packageId)))

  watch(selectedPackageId, packageId => {
    if (packageId) void options.ensureLoaded(packageId)
  }, { immediate: true })

  watch(
    () => entries.value.map(entry => entry.packageId),
    packageIds => {
      if (selectedPackageId.value && packageIds.includes(selectedPackageId.value)) return
      selectedPackageId.value = packageIds[0] ?? null
    },
    { immediate: true },
  )

  const selectedEntry = computed(() => (
    entries.value.find(entry => entry.packageId === selectedPackageId.value) ?? null
  ))

  watch(
    () => selectedEntry.value?.catalogEntry,
    entry => {
      if (!entry || !selectedPackageId.value) return
      const current = valueStates.value.get(selectedPackageId.value)
      if (current?.block === entry.block) return
      const next = new Map(valueStates.value)
      next.set(selectedPackageId.value, { block: entry.block, overrides: {} })
      valueStates.value = next
    },
    { immediate: true },
  )

  const activeOverrides = computed<Readonly<Record<string, unknown>>>(() => (
    selectedPackageId.value ? valueStates.value.get(selectedPackageId.value)?.overrides ?? {} : {}
  ))
  const activeValues = computed<Readonly<Record<string, unknown>>>(() => {
    const entry = selectedEntry.value?.catalogEntry
    return entry ? { ...createDefaultValues(entry), ...activeOverrides.value } : {}
  })

  const pipelineResult = computed(() => {
    const entry = selectedEntry.value?.catalogEntry
    if (!entry) return null
    return prepareCardRender({
      document: createPreviewDocument(entry, activeOverrides.value),
      instance: null,
      resourceRootPath: options.resourceRootPath.value,
      environment: options.renderEnvironment.value,
    })
  })

  const previewFace = computed<RenderReadyCardFace | null>(() => pipelineResult.value?.document.faces.front ?? null)
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
        resettable: Object.prototype.hasOwnProperty.call(activeOverrides.value, fieldKey),
      } satisfies Partial<EditorPropertyDefinition>] as const] : []
    }))
    const labels = Object.fromEntries(entry.manifest.publicFieldKeys.map(fieldKey => [
      fieldKey,
      rootDefinitions[fieldKey]?.title
        ?? (options.hasMessage(`propertyEditor.fields.${fieldKey}`)
          ? options.translate(`propertyEditor.fields.${fieldKey}`)
          : fieldKey),
    ]))
    const fields = resolveCardPropertyFields({ type: 'custom-block', ...activeValues.value }, {
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
        .map(([fieldKey, definition]) => [fieldKey, { ...definition, category: PUBLIC_FIELDS_CATEGORY_KEY }])),
    }]
  })

  const propertyCategories = computed<ReadonlyMap<string, PropertyEditorCategoryDefinition>>(() => new Map([
    [PUBLIC_FIELDS_CATEGORY_KEY, {
      title: options.translate('customBlockRegistry.preview.publicFields'),
      icon: 'entity.block-custom',
    }],
  ]))

  function selectPackage(packageId: string): void {
    if (entries.value.some(entry => entry.packageId === packageId)) selectedPackageId.value = packageId
  }

  function updateProperty(mutation: PropertyEditorMutation): void {
    const entry = selectedEntry.value?.catalogEntry
    const packageId = selectedPackageId.value
    if (!entry || !packageId || mutation.key !== PREVIEW_INPUT_KEY
      || !entry.manifest.publicFieldKeys.includes(mutation.fieldKey)) return
    const next = new Map(valueStates.value)
    const overrides = { ...activeOverrides.value }
    if (mutation.value === undefined) delete overrides[mutation.fieldKey]
    else overrides[mutation.fieldKey] = mutation.value
    next.set(packageId, { block: entry.block, overrides })
    valueStates.value = next
  }

  function resetActiveValues(): void {
    const entry = selectedEntry.value?.catalogEntry
    const packageId = selectedPackageId.value
    if (!entry || !packageId) return
    const next = new Map(valueStates.value)
    next.set(packageId, { block: entry.block, overrides: {} })
    valueStates.value = next
  }

  return {
    entries,
    selectedPath: selectedPackageId,
    selectedPackageId,
    selectedEntry,
    activeValues,
    activeOverrides,
    previewFace,
    previewResources,
    previewFitRect,
    issues,
    propertyInputs,
    propertyCategories,
    selectPath: selectPackage,
    selectPackage,
    updateProperty,
    resetActiveValues,
  }
}
