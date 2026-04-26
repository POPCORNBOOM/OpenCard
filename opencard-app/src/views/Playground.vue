<!-- 组件实验页：用于独立调试 OcSurface 及基础组件组合效果。 -->
<template>
  <main class="playground-page">
    <OcBar kind="top" border="bottom">
      <template #start>
        <OcText size="title">OpenCard Playground</OcText>
      </template>
      <template #end>
        <OcButton variant="ghost" @click="goToIde">Back To IDE</OcButton>
      </template>
    </OcBar>

    <div class="playground-layout">
      <OcSurface>
        <OcScrollArea>
          <OcText size="title">OcSurface Controls</OcText>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">tone</OcText>
            <OcOptionGroup v-model="tone" :options="toneOptions" :columns="5" aria-label="surface tone" />
          </div>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">border</OcText>
            <OcOptionGroup v-model="border" :options="borderOptions" :columns="5" aria-label="surface border" />
          </div>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">radius</OcText>
            <OcOptionGroup v-model="radius" :options="radiusOptions" :columns="4" aria-label="surface radius" />
          </div>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">elevation</OcText>
            <OcOptionGroup v-model="elevation" :options="elevationOptions" :columns="4"
              aria-label="surface elevation" />
          </div>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">pattern</OcText>
            <OcOptionGroup v-model="pattern" :options="patternOptions" :columns="3" aria-label="surface pattern" />
          </div>

          <OcCheckbox :checked="fill" label="Fill Parent" @update:checked="fill = $event" />

          <OcText size="title">OcBox Controls</OcText>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">layout</OcText>
            <OcOptionGroup v-model="boxLayout" :options="boxLayoutOptions" :columns="3" aria-label="box layout" />
          </div>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">align</OcText>
            <OcOptionGroup v-model="boxAlign" :options="boxAlignOptions" :columns="4" aria-label="box align" />
          </div>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">justify</OcText>
            <OcOptionGroup v-model="boxJustify" :options="boxJustifyOptions" :columns="4" aria-label="box justify" />
          </div>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">overflow</OcText>
            <OcOptionGroup v-model="boxOverflow" :options="boxOverflowOptions" :columns="3" aria-label="box overflow" />
          </div>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">width</OcText>
            <OcOptionGroup v-model="boxWidth" :options="boxDimensionOptions" :columns="4" aria-label="box width" />
          </div>

          <div class="playground-control-group">
            <OcText tone="secondary" size="label">height</OcText>
            <OcOptionGroup v-model="boxHeight" :options="boxDimensionOptions" :columns="4" aria-label="box height" />
          </div>

          <div class="playground-toggle-grid">
            <OcCheckbox :checked="boxCenter" label="Center" @update:checked="boxCenter = $event" />
            <OcCheckbox :checked="boxGrow" label="Grow" @update:checked="boxGrow = $event" />
            <OcCheckbox :checked="boxFill" label="Fill" @update:checked="boxFill = $event" />
            <OcCheckbox :checked="boxScrollY" label="ScrollY" @update:checked="boxScrollY = $event" />
          </div>
        </OcScrollArea>
      </OcSurface>

      <section class="playground-preview">
        <OcOverlay>

          <OcSurface fill pattern="checker-preview">
            <!--Some RGB shit-->
            <div style="background: linear-gradient(red,blue);min-width: 100%;min-height: 100%;opacity: 0.3;">

              <span style="font-size: 256px;">ass</span>
            </div>


          </OcSurface>
          <template #overlay>
            <OcSurface :tone="tone" :border="border" :radius="radius" :elevation="elevation" :pattern="pattern"
              :fill="fill">
              <OcBox class="playground-preview-content" :inline="boxLayout === 'inline'" :stack="boxLayout === 'stack'"
                :center="boxCenter" :grow="boxGrow" :fill="boxFill" :scroll-y="boxScrollY" :align="boxAlign"
                :justify="boxJustify" :overflow="boxOverflow" :width="boxWidth" :height="boxHeight">
                <OcText size="title">Preview</OcText>
                <OcText tone="secondary">
                  tone={{ tone }} / border={{ border }} / radius={{ radius }} / elevation={{ elevation }} / pattern={{
                    pattern
                  }}
                </OcText>
                <OcText tone="secondary">
                  box: layout={{ boxLayout }} / align={{ boxAlign }} / justify={{ boxJustify }} / overflow={{
                    boxOverflow }}
                  / width={{ boxWidth }} / height={{ boxHeight }} / center={{ boxCenter }} / grow={{ boxGrow }} /
                  fill={{
                    boxFill
                  }} / scrollY={{ boxScrollY }}
                </OcText>
                <OcBox inline class="playground-preview-actions">
                  <OcButton variant="primary">Primary</OcButton>
                  <OcButton variant="secondary">Secondary</OcButton>
                  <OcButton variant="ghost">Ghost</OcButton>
                </OcBox>
                <OcCard radius="md" tone="glass" border="overlay" title="OcCard Demo" class="playground-preview-card">
                  <template #content>
                    <OcText>Primary</OcText>
                    <OcText tone="secondary">Secondary</OcText>
                    <OcText tone="muted">muted</OcText>
                    <OcText tone="label">label</OcText>
                    <OcText tone="info">info</OcText>
                  </template>
                </OcCard>
              </OcBox>
            </OcSurface>

          </template>
        </OcOverlay>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  OcBar,
  OcBox,
  OcButton,
  OcCard,
  OcCheckbox,
  OcSurface,
  OcText,
} from '../components/base'
import OcOptionGroup, { type OcOptionGroupItem } from '../components/standard/OcOptionGroup.vue'
import OcOverlay from '../components/base/OcOverlay.vue'
import OcScrollArea from '../components/base/OcScrollArea.vue'

defineOptions({ name: 'Playground' })

type PlaygroundSurfaceTone =
  | 'base'
  | 'panel'
  | 'elevated'
  | 'input'
  | 'floating'
  | 'transparent'
  | 'glass'
  | 'accent'
  | 'accent-hover'
  | 'hover'
  | 'active'

type PlaygroundSurfaceBorder = 'none' | 'strong' | 'overlay' | 'accent'
type PlaygroundSurfaceRadius = 'none' | 'sm' | 'md' | 'lg'
type PlaygroundSurfaceElevation = 'none' | 'sm' | 'md' | 'overlay'
type PlaygroundSurfacePattern = 'none' | 'dot-grid' | 'checker-preview'
type PlaygroundBoxLayout = 'none' | 'inline' | 'stack'
type PlaygroundBoxAlign = 'start' | 'center' | 'end' | 'stretch'
type PlaygroundBoxJustify = 'start' | 'center' | 'end' | 'between'
type PlaygroundBoxOverflow = 'visible' | 'hidden' | 'auto'
type PlaygroundBoxDimension = 'auto' | 'content' | 'full' | 'screen'

const tone = ref<PlaygroundSurfaceTone>('panel')
const border = ref<PlaygroundSurfaceBorder>('overlay')
const radius = ref<PlaygroundSurfaceRadius>('md')
const elevation = ref<PlaygroundSurfaceElevation>('none')
const pattern = ref<PlaygroundSurfacePattern>('none')
const fill = ref(false)
const boxLayout = ref<PlaygroundBoxLayout>('stack')
const boxAlign = ref<PlaygroundBoxAlign>('start')
const boxJustify = ref<PlaygroundBoxJustify>('start')
const boxOverflow = ref<PlaygroundBoxOverflow>('visible')
const boxWidth = ref<PlaygroundBoxDimension>('full')
const boxHeight = ref<PlaygroundBoxDimension>('full')
const boxCenter = ref(false)
const boxGrow = ref(false)
const boxFill = ref(false)
const boxScrollY = ref(false)

const toneOptions: OcOptionGroupItem[] = [
  { value: 'base', label: 'base' },
  { value: 'panel', label: 'panel' },
  { value: 'elevated', label: 'elevated' },
  { value: 'input', label: 'input' },
  { value: 'glass', label: 'glass' },
  { value: 'transparent', label: 'transparent' },
]

const borderOptions: OcOptionGroupItem[] = [
  { value: 'none', label: 'none' },
  { value: 'strong', label: 'strong' },
  { value: 'overlay', label: 'overlay' },
  { value: 'accent', label: 'accent' },
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
  { value: 'overlay', label: 'overlay' },
]

const patternOptions: OcOptionGroupItem[] = [
  { value: 'none', label: 'none' },
  { value: 'dot-grid', label: 'dot-grid' },
  { value: 'checker-preview', label: 'checker' },
]

const boxLayoutOptions: OcOptionGroupItem[] = [
  { value: 'none', label: 'none' },
  { value: 'inline', label: 'inline' },
  { value: 'stack', label: 'stack' },
]

const boxAlignOptions: OcOptionGroupItem[] = [
  { value: 'start', label: 'start' },
  { value: 'center', label: 'center' },
  { value: 'end', label: 'end' },
  { value: 'stretch', label: 'stretch' },
]

const boxJustifyOptions: OcOptionGroupItem[] = [
  { value: 'start', label: 'start' },
  { value: 'center', label: 'center' },
  { value: 'end', label: 'end' },
  { value: 'between', label: 'between' },
]

const boxOverflowOptions: OcOptionGroupItem[] = [
  { value: 'visible', label: 'visible' },
  { value: 'hidden', label: 'hidden' },
  { value: 'auto', label: 'auto' },
]

const boxDimensionOptions: OcOptionGroupItem[] = [
  { value: 'auto', label: 'auto' },
  { value: 'content', label: 'content' },
  { value: 'full', label: 'full' },
  { value: 'screen', label: 'screen' },
]

function goToIde(): void {
  window.location.search = ''
}
</script>

<style scoped>
.playground-page {
  min-height: 100%;
  background: var(--oc-bg-base);
  color: var(--oc-text-primary);
}

.playground-layout {
  padding: 16px;
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 16px;
}

.playground-controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--oc-border-strong);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-panel);
}

.playground-control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playground-toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.playground-preview {
  min-width: 0;
  min-height: 0;
}

.playground-preview-content {
  padding: 14px;
  gap: 10px;
}

.playground-preview-actions {
  gap: 8px;
}

.playground-preview-card {
  width: min(420px, 100%);
}

@media (max-width: 1200px) {
  .playground-layout {
    grid-template-columns: 1fr;
  }
}
</style>
