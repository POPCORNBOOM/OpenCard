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
          <OcButton icon="action.add" variant="soft" :aria-label="t('projectConfig.fonts.addFont')"
            @click="emit('register-family')">{{ t('projectConfig.fonts.addFont') }}</OcButton>
          <OcButton icon="action.add" variant="soft" :aria-label="t('projectConfig.fonts.addSet')"
            @click="emit('register-composition')">{{ t('projectConfig.fonts.addSet') }}</OcButton>
        </div>
      </header>

      <OcText v-if="error" class="project-font-registry-workbench__error" tone="danger" size="sm" role="alert">
        {{ error }}
      </OcText>

      <div class="project-font-registry-workbench__list">
        <OcTree fill role="listbox" selection-mode="single"
          activation-mode="double-click" scroll-to-selection :data="treeData" :actions="treeActions"
          :expanded-keys="['families', 'compositions']"
          :selected-keys="selectedTreeKeys" :action-overflow-title="t('projectConfig.fonts.entryActions')"
          @intent="handleTreeIntent" />
      </div>
    </section>

    <section class="project-font-registry-workbench__right">
      <template v-if="selectedEntry">
        <header class="project-font-registry-workbench__preview-toolbar">
          <OcFieldInput full-width :value="previewText" :aria-label="t('projectConfig.fonts.previewText')"
            @input="updatePreviewText" />
          <div v-if="previewDiagnostics.length" class="project-font-registry-workbench__preview-diagnostics" role="status">
            <OcText v-for="diagnostic in previewDiagnostics" :key="diagnostic" tone="danger" size="xs">
              {{ diagnostic }}
            </OcText>
          </div>
        </header>
        <div class="project-font-registry-workbench__preview" :style="previewStyle">
          <span class="project-font-registry-workbench__preview-content">
            <span
              v-for="(run, index) in previewRuns"
              :key="`${index}:${run.faceKey ?? run.familyKey ?? 'fallback'}`"
              class="project-font-registry-workbench__preview-run"
              :data-font-key="run.familyKey ?? 'fallback'"
              :data-face-key="run.faceKey ?? 'fallback'"
              :style="runStyle(run.familyKey, run.faceKey)"
              @pointerenter="showFontInfo(run.familyKey, run.faceKey, $event)"
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
                <dd>{{ hoveredFace?.source ?? hoveredFont.faces.map(face => face.source).join('; ') }}</dd>
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
        <OcIcon :name="activePage === 'families' ? 'file.font' : 'data.layers'" size="lg" tone="muted" />
        <OcEmpty tone="muted" inset="none">
          {{ activePage === 'families' ? t('projectConfig.fonts.noFontSelected') : t('projectConfig.fonts.noSetSelected') }}
        </OcEmpty>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectFontComposition, ProjectFontFamily } from '../../features/workspace/model/projectFontRegistry'
import { createProjectFontFamilyCssFamily } from '../../features/workspace/model/projectFonts'
import type { ProjectFontLoadError } from '../../features/workspace/services/projectFontLoader'
import {
  characterSetToUnicodeRanges,
  createProjectFontPreviewRuns,
  mergeUnicodeRanges,
  readProjectFontCharacterSet,
  subtractUnicodeRanges,
  type ProjectFontPreviewCandidate,
} from '../../features/workspace/services/projectFontCoverage'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent, OcTreeItem } from '../../shared/ui/tree/tree.types'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcFloatingLayer from '../standard/OcFloatingLayer.vue'
import OcTree from '../standard/OcTree.vue'

const props = withDefaults(defineProps<{
  heading: string
  description: string
  families: readonly ProjectFontFamily[]
  compositions?: readonly ProjectFontComposition[]
  resolveAssetSrc: (source: string) => string
  readFontBytes: (source: string) => Promise<Uint8Array>
  error?: string
  loadErrors?: readonly ProjectFontLoadError[]
}>(), { compositions: () => [], error: '', loadErrors: () => [] })
const emit = defineEmits<{
  'update:families': [families: ProjectFontFamily[]]
  'update:compositions': [compositions: ProjectFontComposition[]]
  'register-family': []
  'configure-family': [familyKey: string]
  'remove-family': [familyKey: string]
  'register-composition': []
  'configure-composition': [compositionKey: string]
}>()
const { t } = useI18n()
const activePage = ref<'families' | 'compositions'>('families')
const selectedFamilyKey = ref<string | null>(null)
const selectedCompositionKey = ref<string | null>(null)
const previewText = ref(t('projectConfig.fonts.previewSample'))
const characterSets = ref<ReadonlyMap<string, ReadonlySet<number>>>(new Map())
const failedCoverageKeys = ref<ReadonlySet<string>>(new Set())
const hoveredFontKey = ref<string | null>(null)
const hoveredFaceKey = ref<string | null>(null)
const hoveredFontAnchor = ref<HTMLElement | null>(null)
let coverageGeneration = 0
const selectedFamily = computed(() => props.families.find(family => family.key === selectedFamilyKey.value) ?? null)
const selectedComposition = computed(() => props.compositions.find(entry => entry.key === selectedCompositionKey.value) ?? null)
const selectedEntry = computed(() => activePage.value === 'families' ? selectedFamily.value : selectedComposition.value)
const selectedTreeKeys = computed(() => {
  const key = activePage.value === 'families' ? selectedFamilyKey.value : selectedCompositionKey.value
  return key ? [treeKey(activePage.value, key)] : []
})
const referencedFamilyKeys = computed(() => new Set(
  props.compositions.flatMap(composition => composition.members.map(member => member.familyKey.toLocaleLowerCase())),
))
const treeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['configure-family', { title: t('projectConfig.fonts.configure'), icon: 'tool.settings' }],
  ['configure-composition', { title: t('projectConfig.fonts.configureSet'), icon: 'tool.settings' }],
  ['delete-family', { title: t('projectConfig.fonts.remove'), icon: 'action.delete', iconTone: 'danger' }],
  ['delete-composition', { title: t('projectConfig.fonts.removeSet'), icon: 'action.delete', iconTone: 'danger' }],
]))
const treeData = computed<OcTreeData>(() => {
  const familyKeys = props.families.map(entry => treeKey('families', entry.key))
  const compositionKeys = props.compositions.map(entry => treeKey('compositions', entry.key))
  const items = new Map<string, OcTreeItem>([
    ['families', { label: t('projectConfig.fonts.projectFonts'), icon: 'file.font' }],
    ['compositions', { label: t('projectConfig.fonts.compositions'), icon: 'data.layers' }],
    ...props.families.map(entry => {
      const actions = referencedFamilyKeys.value.has(entry.key.toLocaleLowerCase())
        ? ['configure-family']
        : ['configure-family', 'delete-family']
      return [treeKey('families', entry.key), {
        label: entry.name, icon: 'file.font', actions, contextActions: actions,
      }] as const
    }),
    ...props.compositions.map(entry => [treeKey('compositions', entry.key), {
      label: entry.name,
      icon: 'data.layers',
      actions: ['configure-composition', 'delete-composition'],
      contextActions: ['configure-composition', 'delete-composition'],
    }] as const),
  ])
  return {
    rootKeys: ['families', 'compositions'],
    items,
    children: new Map([['families', familyKeys], ['compositions', compositionKeys]]),
  }
})
const previewStyle = computed<CSSProperties>(() => ({
  fontFamily: activePage.value === 'families' && selectedFamily.value
    ? JSON.stringify(createProjectFontFamilyCssFamily(selectedFamily.value.key))
    : '',
}))
const previewFontCss = computed(() => props.families.flatMap(family => family.faces.map(face => {
  const style = face.style.kind === 'oblique'
    ? `oblique ${face.style.angle.min}deg ${face.style.angle.max}deg`
    : face.style.kind
  return `@font-face { font-family: ${JSON.stringify(createProjectFontFamilyCssFamily(family.key))}; src: url(${JSON.stringify(props.resolveAssetSrc(face.source))}); font-weight: ${face.weight.min} ${face.weight.max}; font-stretch: ${face.stretch.min}% ${face.stretch.max}%; font-style: ${style}; }`
})).join('\n'))
const previewFamilies = computed(() => activePage.value === 'families'
  ? selectedFamily.value ? [selectedFamily.value] : []
  : (selectedComposition.value?.members ?? [])
      .map(member => props.families.find(family => family.key.toLocaleLowerCase() === member.familyKey.toLocaleLowerCase()))
      .filter((family): family is ProjectFontFamily => Boolean(family)))
const previewCandidates = computed<ProjectFontPreviewCandidate[]>(() => activePage.value === 'families'
  ? selectedFamily.value ? selectedFamily.value.faces.map(face => ({
      familyKey: selectedFamily.value!.key,
      faceKey: previewFaceKey(selectedFamily.value!.key, face.source),
    })) : []
  : (selectedComposition.value?.members ?? []).flatMap(member => {
      const family = props.families.find(candidate => (
        candidate.key.toLocaleLowerCase() === member.familyKey.toLocaleLowerCase()
      ))
      return (family?.faces ?? []).map(face => ({
        familyKey: member.familyKey,
        faceKey: previewFaceKey(member.familyKey, face.source),
        ...(member.ranges ? { ranges: member.ranges } : {}),
      }))
    }))
const previewRuns = computed(() => createProjectFontPreviewRuns(
  previewText.value,
  previewCandidates.value,
  characterSets.value,
))
const hoveredFont = computed(() => hoveredFontKey.value
  ? props.families.find(family => family.key.toLocaleLowerCase() === hoveredFontKey.value?.toLocaleLowerCase()) ?? null
  : null)
const hoveredFace = computed(() => hoveredFont.value?.faces.find(face => (
  previewFaceKey(hoveredFont.value!.key, face.source) === hoveredFaceKey.value
)) ?? null)
const coverageFailed = computed(() => previewFamilies.value.some(family => failedCoverageKeys.value.has(family.key)))
const shadowedMemberKeys = computed(() => {
  if (activePage.value !== 'compositions' || !selectedComposition.value) return []
  const claimedByDescriptor = new Map<string, { start: number; end: number }[]>()
  const shadowed: string[] = []
  for (const member of selectedComposition.value.members) {
    const family = props.families.find(candidate => candidate.key.toLocaleLowerCase() === member.familyKey.toLocaleLowerCase())
    let readable = false
    let contributes = false
    for (const face of family?.faces ?? []) {
      const coverage = characterSets.value.get(previewFaceKey(member.familyKey, face.source))
      if (!coverage) continue
      readable = true
      const descriptorKey = JSON.stringify([face.weight, face.stretch, face.style])
      const claimed = claimedByDescriptor.get(descriptorKey) ?? []
      const effective = subtractUnicodeRanges(characterSetToUnicodeRanges(coverage, member.ranges), claimed)
      if (effective.length) contributes = true
      claimedByDescriptor.set(descriptorKey, mergeUnicodeRanges([
        ...claimed,
        ...effective,
      ]))
    }
    if (readable && !contributes) shadowed.push(member.familyKey)
  }
  return shadowed
})
const previewDiagnostics = computed(() => {
  const selectedKeys = new Set(previewFamilies.value.map(family => family.key.toLocaleLowerCase()))
  return [
    ...props.loadErrors
      .filter(error => selectedKeys.has(error.familyKey.toLocaleLowerCase()))
      .map(error => t('projectConfig.fonts.previewLoadFailed', { key: error.familyKey, source: error.source })),
    ...[...failedCoverageKeys.value]
      .filter(key => selectedKeys.has(key.toLocaleLowerCase()))
      .map(key => t('projectConfig.fonts.previewCoverageFailed', { key })),
    ...shadowedMemberKeys.value.map(key => t('projectConfig.fonts.previewMemberShadowed', { key })),
  ]
})

watch(() => props.families, families => {
  if (!families.some(family => family.key === selectedFamilyKey.value)) selectedFamilyKey.value = families[0]?.key ?? null
}, { immediate: true })
watch(() => props.compositions, compositions => {
  if (!compositions.some(entry => entry.key === selectedCompositionKey.value)) selectedCompositionKey.value = compositions[0]?.key ?? null
}, { immediate: true })
watch(
  () => previewFamilies.value.map(family => `${family.key}\0${family.faces.map(face => face.source).join('\0')}`),
  async () => {
    const generation = ++coverageGeneration
    const nextCharacterSets = new Map<string, ReadonlySet<number>>()
    const nextFailedKeys = new Set<string>()
    await Promise.all(previewFamilies.value.map(async family => {
      let loaded = false
      for (const face of family.faces) {
        try {
          const characterSet = await readProjectFontCharacterSet(await props.readFontBytes(face.source))
          nextCharacterSets.set(previewFaceKey(family.key, face.source), characterSet)
          loaded = true
        } catch {
          // A family remains previewable when at least one of its faces is readable.
        }
      }
      if (!loaded) nextFailedKeys.add(family.key)
    }))
    if (generation !== coverageGeneration) return
    characterSets.value = nextCharacterSets
    failedCoverageKeys.value = nextFailedKeys
  },
  { immediate: true },
)

function treeKey(page: 'families' | 'compositions', key: string): string { return `${page}:${key}` }
function entryKey(key: string): string { return key.slice(key.indexOf(':') + 1) }
function entryPage(key: string): 'families' | 'compositions' | null {
  if (key === 'families' || key.startsWith('families:')) return 'families'
  if (key === 'compositions' || key.startsWith('compositions:')) return 'compositions'
  return null
}
function configureEntry(page: 'families' | 'compositions', key: string): void {
  if (page === 'families') emit('configure-family', key)
  else emit('configure-composition', key)
}
function removeEntry(page: 'families' | 'compositions', key: string): void {
  if (page === 'families') removeFamily(props.families.findIndex(family => family.key === key))
  else removeComposition(props.compositions.findIndex(composition => composition.key === key))
}
function handleTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    const selectedKey = intent.selectedKeys[0] ?? intent.triggerKey
    const page = entryPage(selectedKey)
    if (!page) return
    activePage.value = page
    if (selectedKey === page) return
    const key = entryKey(selectedKey)
    if (page === 'families') selectedFamilyKey.value = key
    else selectedCompositionKey.value = key
    return
  }
  if (intent.type === 'node.activate' && (intent.key === 'families' || intent.key === 'compositions')) {
    activePage.value = intent.key
    return
  }
  if (intent.type === 'node.activate') {
    const page = entryPage(intent.key)
    if (page) configureEntry(page, entryKey(intent.key))
    return
  }
  if (intent.type !== 'action.invoke') return
  const key = entryKey(intent.key)
  if (intent.actionKey === 'configure-family') configureEntry('families', key)
  else if (intent.actionKey === 'configure-composition') configureEntry('compositions', key)
  else if (intent.actionKey === 'delete-family') removeEntry('families', key)
  else if (intent.actionKey === 'delete-composition') removeEntry('compositions', key)
}
function removeFamily(index: number): void {
  if (index < 0) return
  const family = props.families[index]
  if (!family || referencedFamilyKeys.value.has(family.key.toLocaleLowerCase())) return
  selectedFamilyKey.value = props.families[
    Math.min(index + 1, props.families.length - 1)
  ]?.key === family.key
    ? props.families[Math.max(0, index - 1)]?.key ?? null
    : props.families[Math.min(index + 1, props.families.length - 1)]?.key ?? null
  emit('remove-family', family.key)
}
function removeComposition(index: number): void {
  if (index < 0) return
  const next = props.compositions.filter((_, candidate) => candidate !== index)
  if (props.compositions[index]?.key === selectedCompositionKey.value) {
    selectedCompositionKey.value = next[Math.min(index, next.length - 1)]?.key ?? null
  }
  emit('update:compositions', next)
}
function updatePreviewText(event: Event): void { if (event.target instanceof HTMLInputElement) previewText.value = event.target.value }
function previewFaceKey(familyKey: string, source: string): string {
  return `${familyKey.toLocaleLowerCase()}\0${source}`
}
function runStyle(familyKey: string | null, faceKey: string | null): CSSProperties | undefined {
  if (!familyKey) return undefined
  const family = props.families.find(candidate => candidate.key.toLocaleLowerCase() === familyKey.toLocaleLowerCase())
  const face = family?.faces.find(candidate => previewFaceKey(familyKey, candidate.source) === faceKey)
  return {
    fontFamily: JSON.stringify(createProjectFontFamilyCssFamily(familyKey)),
    ...(face ? {
      fontWeight: face.weight.min,
      fontStretch: `${face.stretch.min}%`,
      fontStyle: face.style.kind === 'oblique' ? `oblique ${face.style.angle.min}deg` : face.style.kind,
    } : {}),
  }
}
function showFontInfo(familyKey: string | null, faceKey: string | null, event: PointerEvent): void {
  hoveredFontKey.value = familyKey
  hoveredFaceKey.value = faceKey
  hoveredFontAnchor.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
}
function hideFontInfo(): void {
  hoveredFontKey.value = null
  hoveredFaceKey.value = null
  hoveredFontAnchor.value = null
}
async function navigateToFont(kind: 'family' | 'composition', key: string): Promise<boolean> {
  if (kind === 'family') {
    if (!props.families.some(family => family.key === key)) return false
    selectedFamilyKey.value = key
    activePage.value = 'families'
    return true
  }
  if (!props.compositions.some(composition => composition.key === key)) return false
  selectedCompositionKey.value = key
  activePage.value = 'compositions'
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
  grid-template-rows: auto auto minmax(0, 1fr);
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
  background: var(--oc-bg-base);
  color: var(--oc-fg-default);
}
.project-font-registry-workbench__title { min-width: 0; gap: var(--oc-space-3); }
.project-font-registry-workbench__title > div { display: grid; min-width: 0; gap: var(--oc-space-1); }
.project-font-registry-workbench__title-actions { flex: 0 0 auto; gap: var(--oc-space-1); }
.project-font-registry-workbench h1 { margin: 0; font-size: var(--oc-text-lg); font-weight: var(--font-weight-ui-title); letter-spacing: 0; }
.project-font-registry-workbench__error { grid-row: 2; padding: var(--oc-space-2); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-registry-workbench__list { position: relative; grid-row: 3; min-height: 0; overflow: hidden; }
.project-font-registry-workbench__list > .oc-tree { position: absolute; inset: 0; }
.project-font-registry-workbench__right { display: grid; grid-template-rows: auto minmax(0, 1fr); background: var(--oc-bg-base); }
.project-font-registry-workbench__preview-toolbar { display: grid; gap: var(--oc-space-2); padding: var(--oc-space-3); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-registry-workbench__preview-diagnostics { display: grid; gap: var(--oc-space-1); }
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

(Background: j-xagavb exited 1.)
