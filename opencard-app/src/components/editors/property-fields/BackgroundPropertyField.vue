<template>
  <div class="background-field">
    <div class="mode-tabs">
      <OcButton
        v-for="option in modeOptions"
        :key="option.value"
        class="mode-tab"
        variant="choice"
        :class="{ active: mode === option.value }"
        :active="mode === option.value"
        @click="setMode(option.value)"
      >
        {{ option.label }}
      </OcButton>
    </div>

    <div class="preview" :style="previewStyle" />

    <template v-if="mode === 'color'">
      <div class="row">
        <input class="prop-input oc-input" type="text" :value="draftColor" @input="updateColor(($event.target as HTMLInputElement).value)" />
        <input class="color-picker" type="color" :value="pickerValue" @input="updateColor(($event.target as HTMLInputElement).value)" />
      </div>
    </template>

    <template v-else-if="mode === 'gradient'">
      <textarea class="raw-input oc-input" :value="draftGradient" rows="3"
        @input="updateGradient(($event.target as HTMLTextAreaElement).value)" />
    </template>

    <template v-else-if="mode === 'image'">
      <div class="stack">
        <input class="prop-input oc-input" type="text" :value="draftImage.image" placeholder="Image URL or path"
          @input="updateImageField('image', ($event.target as HTMLInputElement).value)" />
        <div class="row">
          <input class="prop-input oc-input" type="text" :value="draftImage.position" placeholder="Position"
            @input="updateImageField('position', ($event.target as HTMLInputElement).value)" />
          <input class="prop-input oc-input" type="text" :value="draftImage.size" placeholder="Size"
            @input="updateImageField('size', ($event.target as HTMLInputElement).value)" />
        </div>
        <select class="prop-input oc-input" :value="draftImage.repeat" @change="updateImageField('repeat', ($event.target as HTMLSelectElement).value)">
          <option v-for="option in repeatOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
    </template>

    <template v-else>
      <textarea class="raw-input oc-input" :value="stringValue" rows="3"
        @input="emit('update:value', ($event.target as HTMLTextAreaElement).value)" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import OcButton from '../../base/OcButton.vue'
import type { EditorPropertyDefinition } from '../../../core/propertyEditorSchema'

type BackgroundMode = 'color' | 'gradient' | 'image' | 'raw'
type ParsedBackground =
  | { kind: 'color'; value: string }
  | { kind: 'gradient'; value: string }
  | { kind: 'image'; image: string; position: string; size: string; repeat: string }

const modeOptions: Array<{ value: BackgroundMode; label: string }> = [
  { value: 'color', label: 'Color' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'image', label: 'Image' },
  { value: 'raw', label: 'Raw' },
]

const repeatOptions = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] as const

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'background' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const stringValue = computed(() => (props.value == null ? '' : String(props.value)).trim())
const parsedBackground = computed(() => parseBackground(stringValue.value))
const mode = ref<BackgroundMode>('raw')
const draftColor = ref('')
const draftGradient = ref('')
const draftImage = ref({
  image: '',
  position: 'center',
  size: 'cover',
  repeat: 'no-repeat',
})

watch(
  parsedBackground,
  (parsed) => {
    if (!parsed) {
      mode.value = 'raw'
      return
    }

    mode.value = parsed.kind
    if (parsed.kind === 'color') {
      draftColor.value = parsed.value
    } else if (parsed.kind === 'gradient') {
      draftGradient.value = parsed.value
    } else {
      draftImage.value = {
        image: parsed.image,
        position: parsed.position,
        size: parsed.size,
        repeat: parsed.repeat,
      }
    }
  },
  { immediate: true }
)

const previewStyle = computed(() => ({
  background: stringValue.value || 'transparent',
}))

const pickerValue = computed(() => toHexColor(draftColor.value) ?? '#000000')

function setMode(nextMode: BackgroundMode) {
  mode.value = nextMode
  if (nextMode === 'color' && !draftColor.value) {
    draftColor.value = '#000000'
    emit('update:value', draftColor.value)
  } else if (nextMode === 'gradient' && !draftGradient.value) {
    draftGradient.value = 'linear-gradient(180deg, #ffffff, #000000)'
    emit('update:value', draftGradient.value)
  } else if (nextMode === 'image' && !draftImage.value.image) {
    emit('update:value', serializeImageBackground(draftImage.value))
  }
}

function updateColor(value: string) {
  draftColor.value = value
  emit('update:value', value)
}

function updateGradient(value: string) {
  draftGradient.value = value
  emit('update:value', value)
}

function updateImageField(field: 'image' | 'position' | 'size' | 'repeat', value: string) {
  draftImage.value = {
    ...draftImage.value,
    [field]: value,
  }
  emit('update:value', serializeImageBackground(draftImage.value))
}

function parseBackground(value: string): ParsedBackground | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (isColorValue(trimmed)) {
    return { kind: 'color', value: trimmed }
  }

  if (/^(linear-gradient|radial-gradient|conic-gradient)\(/i.test(trimmed)) {
    return { kind: 'gradient', value: trimmed }
  }

  const imageMatch = trimmed.match(/^url\((.+?)\)(?:\s+([^/]+?))?(?:\s*\/\s*([^\s]+(?:\s+[^\s]+)?))?(?:\s+(no-repeat|repeat-x|repeat-y|repeat))?$/i)
  if (imageMatch) {
    return {
      kind: 'image',
      image: stripWrappingQuotes(imageMatch[1].trim()),
      position: imageMatch[2]?.trim() ?? 'center',
      size: imageMatch[3]?.trim() ?? 'cover',
      repeat: imageMatch[4]?.trim() ?? 'no-repeat',
    }
  }

  return null
}

function serializeImageBackground(value: { image: string; position: string; size: string; repeat: string }): string {
  const image = value.image.trim()
  if (!image) {
    return ''
  }

  const quotedImage = wrapUrl(image)
  const position = value.position.trim() || 'center'
  const size = value.size.trim() || 'cover'
  const repeat = value.repeat.trim() || 'no-repeat'
  return `url(${quotedImage}) ${position} / ${size} ${repeat}`
}

function isColorValue(value: string): boolean {
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value)
  }
  return /^#([\da-f]{3}|[\da-f]{6})$/i.test(value)
}

function toHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (/^#[\da-fA-F]{6}$/.test(trimmed)) {
    return trimmed
  }
  if (/^#[\da-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
  }
  return null
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}

function wrapUrl(value: string): string {
  if (/^['"].*['"]$/.test(value)) {
    return value
  }
  return `"${value}"`
}
</script>

<style scoped>
.background-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.mode-tabs {
  display: flex;
  gap: 4px;
}

.mode-tab {
  padding: 2px 6px;
  font-size: var(--oc-label-size);
}

.mode-tab.active {
  border-color: var(--oc-accent);
  background: var(--oc-bg-active);
}

.preview {
  height: 28px;
  border: 1px solid var(--oc-border-input);
  background-image:
    linear-gradient(45deg, #666 25%, transparent 25%),
    linear-gradient(-45deg, #666 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #666 75%),
    linear-gradient(-45deg, transparent 75%, #666 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0;
}

.row {
  display: flex;
  gap: 8px;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prop-input,
.raw-input {
  padding: 2px 6px;
}

.prop-input:focus,
.raw-input:focus {
  border-color: var(--oc-accent);
}

.raw-input {
  resize: vertical;
  font-family: Consolas, monospace;
}

.color-picker {
  width: 28px;
  height: 24px;
  border: none;
  padding: 0;
  background: transparent;
  flex-shrink: 0;
}
</style>
