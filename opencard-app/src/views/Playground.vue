<!-- 组件实验页：用单一 OcPanel 可视化验证 V2.2+ 语义与交互效果。 -->
<template>
  <main class="playground-page">
    <OcBar title="OpenCard Playground">
      <template #append>
        <OcButton variant="ghost" @click="goToIde">Back To IDE</OcButton>
      </template>
    </OcBar>

    <div class="playground-layout">
      <section class="playground-controls">
        <OcText size="title">OcPanel Controls</OcText>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">tone</OcText>
          <OcOptionGroup v-model="tone" :options="toneOptions" :columns="5" aria-label="panel tone" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">border</OcText>
          <OcOptionGroup v-model="border" :options="borderOptions" :columns="4" aria-label="panel border" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">background</OcText>
          <OcOptionGroup v-model="background" :options="backgroundOptions" :columns="4" aria-label="panel background" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">radius</OcText>
          <OcOptionGroup v-model="radius" :options="radiusOptions" :columns="4" aria-label="panel radius" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">elevation</OcText>
          <OcOptionGroup v-model="elevation" :options="elevationOptions" :columns="4" aria-label="panel elevation" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">orientation</OcText>
          <OcOptionGroup v-model="orientation" :options="orientationOptions" :columns="2"
            aria-label="panel orientation" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">horizontalAlignment</OcText>
          <OcOptionGroup v-model="horizontalAlignment" :options="alignmentOptions" :columns="4"
            aria-label="panel horizontal alignment" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">verticalAlignment</OcText>
          <OcOptionGroup v-model="verticalAlignment" :options="alignmentOptions" :columns="4"
            aria-label="panel vertical alignment" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">position</OcText>
          <OcOptionGroup v-model="position" :options="positionOptions" :columns="3" aria-label="panel position" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">anchor</OcText>
          <OcOptionGroup v-model="anchor" :options="anchorOptions" :columns="3" aria-label="panel anchor" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">width</OcText>
          <OcOptionGroup v-model="width" :options="dimensionOptions" :columns="4" aria-label="panel width" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">height</OcText>
          <OcOptionGroup v-model="height" :options="dimensionOptions" :columns="4" aria-label="panel height" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">interaction</OcText>
          <OcOptionGroup v-model="interaction" :options="interactionOptions" :columns="2"
            aria-label="panel interaction" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">overflowX</OcText>
          <OcOptionGroup v-model="overflowX" :options="overflowOptions" :columns="4" aria-label="panel overflow x" />
        </div>

        <div class="playground-control-group">
          <OcText tone="secondary" size="label">overflowY</OcText>
          <OcOptionGroup v-model="overflowY" :options="overflowOptions" :columns="4" aria-label="panel overflow y" />
        </div>

        <div class="playground-toggle-grid">
          <OcCheckbox :checked="fill" label="Fill" @update:checked="fill = $event" />
          <OcCheckbox :checked="grow" label="Grow" @update:checked="grow = $event" />
          <OcCheckbox :checked="hoverable" label="Hoverable" @update:checked="hoverable = $event" />
        </div>
      </section>

      <section class="playground-preview">
        <div class="playground-preview-stage">
          <OcPanel class="playground-outer-shell" tone="transparent" border="black" radius="md" padding="compact"
            orientation="vertical" horizontal-alignment="start" vertical-alignment="start">
            <OcText tone="muted" size="label">Outer wrapper (irrelevant panel)</OcText>
            <OcPanel class="playground-target" :tone="tone" :border="border" :background="background" :radius="radius"
              :elevation="elevation" :orientation="orientation" :horizontal-alignment="horizontalAlignment"
              :vertical-alignment="verticalAlignment" :position="position" :anchor="anchor" :interaction="interaction"
              :width="width" :height="height" :overflow-x="overflowX" :overflow-y="overflowY" :fill="fill" :grow="grow"
              :hoverable="hoverable" padding="standard">
              <OcText size="label" tone="muted">OcBar Showcase</OcText>
              <OcPanel class="playground-bar-showcase" tone="transparent" border="soft" radius="sm" padding="compact">
                <OcBar icon="data.list-tree" title="Top Bar">
                  <template #append>
                    <OcButton variant="ghost" icon="action.refresh">Refresh</OcButton>
                  </template>
                </OcBar>
                <OcBar icon="data.symbol-string" title="Section Bar">
                  <template #append>
                    <OcButton variant="ghost" icon-only icon="tool.settings-gear" title="Settings" />
                  </template>
                </OcBar>
                <OcBar icon="tool.search" title="Ready">
                  <template #append>
                    <OcText tone="secondary" size="label">Ln 12, Col 8</OcText>
                  </template>
                </OcBar>
              </OcPanel>

              <OcText size="title">Preview Panel</OcText>
              <OcText tone="secondary">
                tone={{ tone }} / border={{ border }} / background={{ background }} / radius={{ radius }} / elevation={{
                  elevation }}
              </OcText>
              <OcText tone="secondary">
                orientation={{ orientation }} / hAlign={{ horizontalAlignment }} / vAlign={{ verticalAlignment }}
              </OcText>
              <OcText tone="secondary">
                position={{ position }} / anchor={{ anchor }} / width={{ width }} / height={{ height }}
              </OcText>
              <OcText tone="secondary">
                interaction={{ interaction }} / overflowX={{ overflowX }} / overflowY={{ overflowY }}
              </OcText>
              <OcText tone="info" size="label">Hoverable: {{ hoverable ? 'ON' : 'OFF' }} (move mouse over this panel)
              </OcText>
              <div class="playground-target__probe">Overflow Probe:
                1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ-abcdefghijklmnopqrstuvwxyz</div>
            </OcPanel>
          </OcPanel>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  OcBar,
  OcButton,
  OcCheckbox,
  OcPanel,
  OcText,
} from '../components/base'
import OcOptionGroup, { type OcOptionGroupItem } from '../components/standard/OcOptionGroup.vue'

defineOptions({ name: 'Playground' })

type PlaygroundPanelTone =
  | 'base'
  | 'panel'
  | 'elevated'
  | 'input'
  | 'transparent'
  | 'glass'
  | 'accent'
  | 'active'
type PlaygroundPanelBorder = 'none' | 'black' | 'soft' | 'accent'
type PlaygroundPanelBackground = 'none' | 'tri-dot' | 'squ-dot' | 'checker'
type PlaygroundPanelRadius = 'none' | 'sm' | 'md' | 'lg'
type PlaygroundPanelElevation = 'none' | 'sm' | 'md' | 'lg'
type PlaygroundPanelOrientation = 'horizontal' | 'vertical'
type PlaygroundPanelAlignment = 'start' | 'center' | 'end' | 'stretch'
type PlaygroundPanelPosition = 'static' | 'relative' | 'absolute'
type PlaygroundPanelAnchor = 'none' | 'cover' | 'origin'
type PlaygroundPanelInteraction = 'auto' | 'passthrough'
type PlaygroundPanelDimension = 'auto' | 'content' | 'full' | 'screen' | 'size-xs' | 'size-sm' | 'size-md' | 'size-lg' | 'size-xl' | 'size-2xl'
type PlaygroundPanelOverflow = 'visible' | 'clip' | 'auto' | 'scroll'

const tone = ref<PlaygroundPanelTone>('panel')
const border = ref<PlaygroundPanelBorder>('soft')
const background = ref<PlaygroundPanelBackground>('none')
const radius = ref<PlaygroundPanelRadius>('md')
const elevation = ref<PlaygroundPanelElevation>('none')
const orientation = ref<PlaygroundPanelOrientation>('vertical')
const horizontalAlignment = ref<PlaygroundPanelAlignment>('start')
const verticalAlignment = ref<PlaygroundPanelAlignment>('start')
const position = ref<PlaygroundPanelPosition>('static')
const anchor = ref<PlaygroundPanelAnchor>('none')
const interaction = ref<PlaygroundPanelInteraction>('auto')
const width = ref<PlaygroundPanelDimension>('auto')
const height = ref<PlaygroundPanelDimension>('auto')
const overflowX = ref<PlaygroundPanelOverflow>('visible')
const overflowY = ref<PlaygroundPanelOverflow>('visible')
const fill = ref(false)
const grow = ref(false)
const hoverable = ref(true)

const toneOptions: OcOptionGroupItem[] = [
  { value: 'base', label: 'base' },
  { value: 'panel', label: 'panel' },
  { value: 'elevated', label: 'elevated' },
  { value: 'input', label: 'input' },
  { value: 'transparent', label: 'transparent' },
  { value: 'glass', label: 'glass' },
  { value: 'accent', label: 'accent' },
  { value: 'active', label: 'active' },
]

const borderOptions: OcOptionGroupItem[] = [
  { value: 'none', label: 'none' },
  { value: 'black', label: 'black' },
  { value: 'soft', label: 'soft' },
  { value: 'accent', label: 'accent' },
]

const backgroundOptions: OcOptionGroupItem[] = [
  { value: 'none', label: 'none' },
  { value: 'tri-dot', label: 'tri-dot' },
  { value: 'squ-dot', label: 'squ-dot' },
  { value: 'checker', label: 'checker' },
]

const radiusOptions: OcOptionGroupItem[] = [
  { value: 'none', label: 'none' },
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
  { value: 'lg', label: 'lg' },
]

const elevationOptions: OcOptionGroupItem[] = [
  { value: 'none', label: 'none' },
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
  { value: 'lg', label: 'lg' },
]

const orientationOptions: OcOptionGroupItem[] = [
  { value: 'horizontal', label: 'horizontal' },
  { value: 'vertical', label: 'vertical' },
]

const alignmentOptions: OcOptionGroupItem[] = [
  { value: 'start', label: 'start' },
  { value: 'center', label: 'center' },
  { value: 'end', label: 'end' },
  { value: 'stretch', label: 'stretch' },
]

const positionOptions: OcOptionGroupItem[] = [
  { value: 'static', label: 'static' },
  { value: 'relative', label: 'relative' },
  { value: 'absolute', label: 'absolute' },
]

const anchorOptions: OcOptionGroupItem[] = [
  { value: 'none', label: 'none' },
  { value: 'cover', label: 'cover' },
  { value: 'origin', label: 'origin' },
]

const interactionOptions: OcOptionGroupItem[] = [
  { value: 'auto', label: 'auto' },
  { value: 'passthrough', label: 'passthrough' },
]

const dimensionOptions: OcOptionGroupItem[] = [
  { value: 'auto', label: 'auto' },
  { value: 'content', label: 'content' },
  { value: 'full', label: 'full' },
  { value: 'screen', label: 'screen' },
  { value: 'size-xs', label: 'size-xs' },
  { value: 'size-sm', label: 'size-sm' },
  { value: 'size-md', label: 'size-md' },
  { value: 'size-lg', label: 'size-lg' },
  { value: 'size-xl', label: 'size-xl' },
  { value: 'size-2xl', label: 'size-2xl' },
]

const overflowOptions: OcOptionGroupItem[] = [
  { value: 'visible', label: 'visible' },
  { value: 'clip', label: 'clip' },
  { value: 'auto', label: 'auto' },
  { value: 'scroll', label: 'scroll' },
]

function goToIde(): void {
  window.location.search = ''
}
</script>

<style scoped>
.playground-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--oc-bg-base);
  color: var(--oc-text-primary);
}

.playground-layout {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  padding: 16px;
  display: grid;
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: 16px;
  overflow: hidden;
}

.playground-controls {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--oc-border-strong);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-panel);
  overflow-y: auto;
  overflow-x: hidden;
}

.playground-control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playground-toggle-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.playground-preview {
  min-width: 0;
  min-height: 0;
  display: flex;
}

.playground-preview-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border-radius: var(--oc-radius-md);
  border: 1px solid var(--oc-border-strong);
  background:
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%),
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%),
    var(--oc-bg-base);
  background-size: 12px 12px;
  background-position: 0 0, 6px 6px;
  overflow: hidden;
  padding: 18px;
}

.playground-target {
  min-width: 0;
  min-height: 0;
  gap: 10px;
}

.playground-bar-showcase {
  width: 100%;
  gap: 8px;
}

.playground-outer-shell {
  width: 100%;
  height: 100%;
  gap: 8px;
}

.playground-target__probe {
  width: 680px;
  white-space: nowrap;
  font-size: 12px;
  color: var(--oc-text-muted);
}

@media (max-width: 1200px) {
  .playground-page {
    height: auto;
    min-height: 100%;
  }

  .playground-layout {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .playground-controls {
    overflow: visible;
  }

  .playground-preview-stage {
    min-height: 420px;
  }
}
</style>

