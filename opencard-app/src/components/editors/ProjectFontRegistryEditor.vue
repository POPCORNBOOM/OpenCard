<template>
  <div class="project-font-registry-workbench">
    <component :is="'style'" v-if="previewFontCss" v-text="previewFontCss" />

    <section class="project-font-registry-workbench__left">
      <header class="project-font-registry-workbench__titlebar">
        <div class="project-font-registry-workbench__title">
          <OcIcon name="file.font" size="lg" />
          <div>
            <h1>{{ heading }}</h1>
            <OcText tone="muted" size="sm">{{ description }}</OcText>
          </div>
        </div>
        <div class="project-font-registry-workbench__title-actions">
          <OcButton icon="action.add" variant="soft" :aria-label="addLabel"
            @click="addCurrentEntry">{{ addLabel }}</OcButton>
        </div>
      </header>

      <div class="project-font-registry-workbench__modebar">
        <OcOptionGroup :model-value="activePage" :options="modeOptions" appearance="sliding-outline"
          :columns="2" fill @update:model-value="selectPage" />
      </div>

      <OcText v-if="error" class="project-font-registry-workbench__error" tone="danger" size="sm" role="alert">
        {{ error }}
      </OcText>

      <div class="project-font-registry-workbench__list">
        <OcTree v-if="currentEntries.length" fill role="listbox" selection-mode="single"
          activation-mode="double-click" scroll-to-selection :data="treeData" :actions="treeActions"
          :selected-keys="selectedTreeKeys" :action-overflow-title="t('projectConfig.fonts.entryActions')"
          @intent="handleTreeIntent" />
        <OcEmpty v-else tone="muted">
          {{ activePage === 'fonts' ? t('projectConfig.fonts.empty') : t('projectConfig.fonts.emptySets') }}
        </OcEmpty>
      </div>
    </section>

    <section class="project-font-registry-workbench__right">
      <template v-if="selectedEntry">
        <header class="project-font-registry-workbench__preview-toolbar">
          <OcFieldInput full-width :value="previewText" :aria-label="t('projectConfig.fonts.previewText')"
            @input="updatePreviewText" />
        </header>
        <div class="project-font-registry-workbench__preview" :style="previewStyle">
          <span class="project-font-registry-workbench__preview-content">
            <span
              v-for="(run, index) in previewRuns"
              :key="`${index}:${run.fontKey ?? 'fallback'}`"
              class="project-font-registry-workbench__preview-run"
              :data-font-key="run.fontKey ?? 'fallback'"
              :style="runStyle(run.fontKey)"
              @pointerenter="showFontInfo(run.fontKey, $event)"
              @pointerleave="hideFontInfo"
            >{{ run.text }}</span>
          </span>
        </div>
        <OcFloatingLayer
          :open="Boolean(hoveredFontAnchor)"
          :anchor="hoveredFontAnchor"
          placement="top"
          class="project-font-registry-workbench__font-info-layer"
          role="tooltip"
        >
          <section v-if="hoveredFont" class="project-font-registry-workbench__font-info">
            <strong>{{ hoveredFont.name }}</strong>
            <dl>
              <div>
                <dt>{{ t('projectConfig.fonts.previewFontKey') }}</dt>
                <dd>{{ hoveredFont.key }}</dd>
              </div>
              <div>
                <dt>{{ t('projectConfig.fonts.previewFontSource') }}</dt>
                <dd>{{ hoveredFont.source }}</dd>
              </div>
            </dl>
          </section>
          <section v-else class="project-font-registry-workbench__font-info">
            <strong>{{ coverageFailed ? t('projectConfig.fonts.previewCoverageUnavailable')
              : t('projectConfig.fonts.previewSystemFallback') }}</strong>
            <OcText tone="muted" size="sm">{{ coverageFailed
              ? t('projectConfig.fonts.previewCoverageUnavailableDescription')
              : t('projectConfig.fonts.previewSystemFallbackDescription') }}</OcText>
          </section>
        </OcFloatingLayer>
      </template>
      <div v-else class="project-font-registry-workbench__placeholder">
        <OcIcon :name="activePage === 'fonts' ? 'file.font' : 'data.layers'" size="lg" tone="muted" />
        <OcEmpty tone="muted" inset="none">
          {{ activePage === 'fonts' ? t('projectConfig.fonts.noFontSelected') : t('projectConfig.fonts.noSetSelected') }}
        </OcEmpty>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectFont, ProjectFontSet } from '../../features/workspace/model/projectFontRegistry'
import { createProjectFontCssFamily, resolveProjectFontExpression } from '../../features/workspace/model/projectFonts'
import type { ProjectFontLoadError } from '../../features/workspace/services/projectFontLoader'
import {
  createProjectFontPreviewRuns,
  readProjectFontCharacterSet,
} from '../../features/workspace/services/projectFontCoverage'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcFloatingLayer from '../standard/OcFloatingLayer.vue'
import OcOptionGroup, { type OcOption } from '../standard/OcOptionGroup.vue'
import OcTree from '../standard/OcTree.vue'

const props = withDefaults(defineProps<{
  heading: string
  description: string
  fonts: readonly ProjectFont[]
  fontSets?: readonly ProjectFontSet[]
  resolveAssetSrc: (source: string) => string
  readFontBytes: (source: string) => Promise<Uint8Array>
  error?: string
  loadErrors?: readonly ProjectFontLoadError[]
}>(), { fontSets: () => [], error: '', loadErrors: () => [] })
const emit = defineEmits<{
  'update:fonts': [fonts: ProjectFont[]]
  'update:fontSets': [fontSets: ProjectFontSet[]]
  'register-font': []
  'configure-font': [fontKey: string]
  'register-font-set': []
  'configure-font-set': [fontSetKey: string]
}>()
const { t } = useI18n()
const activePage = ref<'fonts' | 'sets'>('fonts')
const selectedFontKey = ref<string | null>(null)
const selectedFontSetKey = ref<string | null>(null)
const previewText = ref(t('projectConfig.fonts.previewSample'))
const characterSets = ref<ReadonlyMap<string, ReadonlySet<number>>>(new Map())
const failedCoverageKeys = ref<ReadonlySet<string>>(new Set())
const hoveredFontKey = ref<string | null>(null)
const hoveredFontAnchor = ref<HTMLElement | null>(null)
let coverageGeneration = 0
const selectedFont = computed(() => props.fonts.find(font => font.key === selectedFontKey.value) ?? null)
const selectedFontSet = computed(() => props.fontSets.find(fontSet => fontSet.key === selectedFontSetKey.value) ?? null)
const selectedEntry = computed(() => activePage.value === 'fonts' ? selectedFont.value : selectedFontSet.value)
const currentEntries = computed(() => activePage.value === 'fonts' ? props.fonts : props.fontSets)
const modeOptions = computed<readonly OcOption[]>(() => [
  { value: 'fonts', label: t('projectConfig.fonts.projectFonts') },
  { value: 'sets', label: t('projectConfig.fonts.fontSets') },
])
const addLabel = computed(() => activePage.value === 'fonts'
  ? t('projectConfig.fonts.addFont') : t('projectConfig.fonts.addSet'))
const selectedTreeKeys = computed(() => {
  const key = activePage.value === 'fonts' ? selectedFontKey.value : selectedFontSetKey.value
  return key ? [treeKey(activePage.value, key)] : []
})
const treeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['configure', {
    title: activePage.value === 'fonts'
      ? t('projectConfig.fonts.configure') : t('projectConfig.fonts.configureSet'),
    icon: 'tool.settings',
  }],
  ['delete', {
    title: activePage.value === 'fonts'
      ? t('projectConfig.fonts.remove') : t('projectConfig.fonts.removeSet'),
    icon: 'action.delete',
    iconTone: 'danger',
  }],
]))
const treeData = computed<OcTreeData>(() => {
  const entries = currentEntries.value
  const rootKeys = entries.map(entry => treeKey(activePage.value, entry.key))
  return {
    rootKeys,
    items: new Map(entries.map(entry => [treeKey(activePage.value, entry.key), {
      label: entry.name,
      icon: activePage.value === 'fonts' ? 'file.font' as const : 'data.layers' as const,
      actions: ['configure', 'delete'],
      contextActions: ['configure', 'delete'],
    }])),
    children: new Map(),
  }
})
const resolvedSet = computed(() => selectedFontSet.value
  ? resolveProjectFontExpression(`font:${selectedFontSet.value.key}`, { fonts: props.fonts, fontSets: props.fontSets })
  : { fontKeys: [], cssFontFamily: '', issues: [] })
const previewStyle = computed(() => ({ fontFamily: activePage.value === 'sets'
  ? resolvedSet.value.cssFontFamily
  : selectedFont.value ? JSON.stringify(createProjectFontCssFamily(selectedFont.value.key)) : '' }))
const previewFontCss = computed(() => props.fonts.map(font => (
  `@font-face { font-family: ${JSON.stringify(createProjectFontCssFamily(font.key))}; src: url(${JSON.stringify(props.resolveAssetSrc(font.source))}); }`
)).join('\n'))
const previewFonts = computed(() => activePage.value === 'fonts'
  ? selectedFont.value ? [selectedFont.value] : []
  : resolvedSet.value.fontKeys
      .map(key => props.fonts.find(font => font.key.toLocaleLowerCase() === key.toLocaleLowerCase()))
      .filter((font): font is ProjectFont => Boolean(font)))
const previewRuns = computed(() => createProjectFontPreviewRuns(
  previewText.value,
  previewFonts.value.map(font => font.key),
  characterSets.value,
))
const hoveredFont = computed(() => hoveredFontKey.value
  ? props.fonts.find(font => font.key.toLocaleLowerCase() === hoveredFontKey.value?.toLocaleLowerCase()) ?? null
  : null)
const coverageFailed = computed(() => previewFonts.value.some(font => failedCoverageKeys.value.has(font.key)))

watch(() => props.fonts, fonts => {
  if (!fonts.some(font => font.key === selectedFontKey.value)) selectedFontKey.value = fonts[0]?.key ?? null
}, { immediate: true })
watch(() => props.fontSets, fontSets => {
  if (!fontSets.some(fontSet => fontSet.key === selectedFontSetKey.value)) selectedFontSetKey.value = fontSets[0]?.key ?? null
}, { immediate: true })
watch(
  () => previewFonts.value.map(font => `${font.key}\0${font.source}`),
  async () => {
    const generation = ++coverageGeneration
    const nextCharacterSets = new Map<string, ReadonlySet<number>>()
    const nextFailedKeys = new Set<string>()
    await Promise.all(previewFonts.value.map(async font => {
      try {
        const bytes = await props.readFontBytes(font.source)
        nextCharacterSets.set(font.key, await readProjectFontCharacterSet(bytes))
      } catch {
        nextFailedKeys.add(font.key)
      }
    }))
    if (generation !== coverageGeneration) return
    characterSets.value = nextCharacterSets
    failedCoverageKeys.value = nextFailedKeys
  },
  { immediate: true },
)

function treeKey(page: 'fonts' | 'sets', key: string): string { return `${page}:${key}` }
function entryKey(key: string): string { return key.slice(key.indexOf(':') + 1) }
function selectPage(value: string): void { if (value === 'fonts' || value === 'sets') activePage.value = value }
function addCurrentEntry(): void {
  if (activePage.value === 'fonts') emit('register-font')
  else emit('register-font-set')
}
function configureEntry(key: string): void {
  if (activePage.value === 'fonts') emit('configure-font', key)
  else emit('configure-font-set', key)
}
function removeEntry(key: string): void {
  if (activePage.value === 'fonts') removeFont(props.fonts.findIndex(font => font.key === key))
  else removeFontSet(props.fontSets.findIndex(fontSet => fontSet.key === key))
}
function handleTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    const key = intent.selectedKeys[0] ? entryKey(intent.selectedKeys[0]) : null
    if (activePage.value === 'fonts') selectedFontKey.value = key
    else selectedFontSetKey.value = key
    return
  }
  if (intent.type === 'node.activate') {
    configureEntry(entryKey(intent.key))
    return
  }
  if (intent.type !== 'action.invoke') return
  const key = entryKey(intent.key)
  if (intent.actionKey === 'configure') configureEntry(key)
  else if (intent.actionKey === 'delete') removeEntry(key)
}
function removeFont(index: number): void {
  if (index < 0) return
  const next = props.fonts.filter((_, candidate) => candidate !== index)
  if (props.fonts[index]?.key === selectedFontKey.value) selectedFontKey.value = next[Math.min(index, next.length - 1)]?.key ?? null
  emit('update:fonts', next)
}
function removeFontSet(index: number): void {
  if (index < 0) return
  const next = props.fontSets.filter((_, candidate) => candidate !== index)
  if (props.fontSets[index]?.key === selectedFontSetKey.value) selectedFontSetKey.value = next[Math.min(index, next.length - 1)]?.key ?? null
  emit('update:fontSets', next)
}
function updatePreviewText(event: Event): void { if (event.target instanceof HTMLInputElement) previewText.value = event.target.value }
function runStyle(fontKey: string | null): CSSProperties | undefined {
  return fontKey ? { fontFamily: JSON.stringify(createProjectFontCssFamily(fontKey)) } : undefined
}
function showFontInfo(fontKey: string | null, event: PointerEvent): void {
  hoveredFontKey.value = fontKey
  hoveredFontAnchor.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
}
function hideFontInfo(): void {
  hoveredFontKey.value = null
  hoveredFontAnchor.value = null
}
async function navigateToFont(kind: 'font' | 'font-set', key: string): Promise<boolean> {
  if (kind === 'font') {
    if (!props.fonts.some(font => font.key === key)) return false
    selectedFontKey.value = key
    activePage.value = 'fonts'
    return true
  }
  if (!props.fontSets.some(fontSet => fontSet.key === key)) return false
  selectedFontSetKey.value = key
  activePage.value = 'sets'
  return true
}
defineExpose({ navigateToFont })
</script>

<style scoped>
.project-font-registry-workbench {
  display: grid;
  grid-template-columns: minmax(var(--oc-project-font-list-min-width), var(--oc-project-font-list-width)) minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--oc-bg-inset);
}
.project-font-registry-workbench__left,
.project-font-registry-workbench__right { min-width: 0; min-height: 0; overflow: hidden; }
.project-font-registry-workbench__left {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  border-right: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-base);
}
.project-font-registry-workbench__titlebar,
.project-font-registry-workbench__title,
.project-font-registry-workbench__title-actions { display: flex; align-items: center; }
.project-font-registry-workbench__titlebar {
  grid-row: 1;
  justify-content: space-between;
  gap: var(--oc-space-4);
  padding: var(--oc-space-5);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
}
.project-font-registry-workbench__title { min-width: 0; gap: var(--oc-space-3); }
.project-font-registry-workbench__title > div { display: grid; min-width: 0; gap: var(--oc-space-1); }
.project-font-registry-workbench__title-actions { flex: 0 0 auto; gap: var(--oc-space-1); }
.project-font-registry-workbench h1 { margin: 0; font-size: var(--oc-text-lg); font-weight: var(--font-weight-ui-title); letter-spacing: 0; }
.project-font-registry-workbench__modebar { grid-row: 2; padding: var(--oc-space-2); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-registry-workbench__error { grid-row: 3; padding: var(--oc-space-2); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-registry-workbench__list { position: relative; grid-row: 4; min-height: 0; overflow: hidden; }
.project-font-registry-workbench__list > .oc-tree { position: absolute; inset: 0; }
.project-font-registry-workbench__right { display: grid; grid-template-rows: auto minmax(0, 1fr); background: var(--oc-bg-base); }
.project-font-registry-workbench__preview-toolbar { padding: var(--oc-space-3); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-registry-workbench__preview { display: grid; place-items: center; min-width: 0; min-height: 0; padding: var(--oc-space-6); overflow: auto; overflow-wrap: anywhere; font-size: var(--oc-font-preview-size); text-align: center; }
.project-font-registry-workbench__preview-content { white-space: pre-wrap; }
.project-font-registry-workbench__preview-run {
  border-radius: var(--oc-radius-sm);
  transition: background-color var(--oc-duration-fast) var(--oc-ease);
}
.project-font-registry-workbench__preview-run:hover { background: var(--oc-bg-hover); }
.project-font-registry-workbench__font-info-layer {
  max-width: var(--oc-content-width-sm);
  border: var(--oc-border-width) solid var(--oc-border-muted);
  box-shadow: var(--oc-shadow-md);
  pointer-events: none;
}
.project-font-registry-workbench__font-info { padding: var(--oc-space-3); }
.project-font-registry-workbench__font-info strong { display: block; margin-bottom: var(--oc-space-2); }
.project-font-registry-workbench__font-info dl { display: grid; gap: var(--oc-space-1); margin: 0; }
.project-font-registry-workbench__font-info dl > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--oc-space-2);
}
.project-font-registry-workbench__font-info dt { color: var(--oc-fg-muted); }
.project-font-registry-workbench__font-info dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.project-font-registry-workbench__placeholder { display: grid; grid-row: 1 / -1; place-content: center; justify-items: center; gap: var(--oc-space-3); min-width: 0; min-height: 0; }
</style>
