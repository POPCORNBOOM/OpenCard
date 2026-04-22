<template>
  <main class="ui-kit-page">
    <header class="ui-kit-hero">
      <div class="ui-kit-hero__meta">
        <p class="ui-kit-kicker">OpenCard Design System</p>
        <h1>UI Kit</h1>
        <p class="ui-kit-summary">
          展示 Foundation、Primitives、Base 的统一矩阵页。修改组件代码后会通过 Vite HMR 在这里立即反映。
        </p>
      </div>
      <div class="ui-kit-hero__actions">
        <OcButton variant="secondary" @click="goToIde">Back To IDE</OcButton>
        <OcButton variant="ghost" disabled>Theme: {{ currentTheme }}</OcButton>
      </div>
    </header>

    <div class="ui-kit-layout">
      <aside class="ui-kit-nav">
        <a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.label }}</a>
      </aside>

      <section class="ui-kit-content">
        <article id="foundation" class="ui-kit-section">
          <header class="ui-kit-section__header">
            <p class="ui-kit-section__kicker">Section</p>
            <h2>Foundation</h2>
          </header>
          <p class="ui-kit-section__desc">主题 token、排版层级、圆角阴影与密度节奏。</p>

          <div class="ui-kit-cards">
            <ShowcaseCard title="Theme Tokens" description="核心颜色语义和状态色预览。">
              <template #default>
                <div class="token-swatch token-swatch--base">bg-base</div>
                <div class="token-swatch token-swatch--panel">bg-panel</div>
                <div class="token-swatch token-swatch--text">text-primary</div>
              </template>
              <template #variants>
                <div class="token-swatch token-swatch--accent">accent</div>
                <div class="token-swatch token-swatch--accent-soft">accent-soft</div>
                <div class="token-swatch token-swatch--highlight">text-highlight</div>
              </template>
              <template #states>
                <div class="token-swatch token-swatch--success">success</div>
                <div class="token-swatch token-swatch--warning">warning</div>
                <div class="token-swatch token-swatch--danger">danger</div>
              </template>
              <template #layout>
                <OcSurface variant="elevated" bordered radius="md" class="token-layout-box">
                  <OcText tone="secondary" size="label">Surface + Border + Radius</OcText>
                </OcSurface>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="Typography Scale" description="标签、正文、标题的可读性层级。">
              <template #default>
                <OcText size="label" tone="muted">Label / 11px</OcText>
                <OcText size="body" tone="primary">Body / 12px</OcText>
                <OcText size="title" tone="primary">Title / 13px</OcText>
              </template>
              <template #variants>
                <OcText size="body" tone="primary">Primary</OcText>
                <OcText size="body" tone="secondary">Secondary</OcText>
                <OcText size="body" tone="info">Info</OcText>
              </template>
              <template #states>
                <OcText size="body" tone="muted">Muted text</OcText>
                <OcText size="body" tone="label">Label tone</OcText>
                <OcText size="body" tone="secondary" truncate class="truncate-box">Long text for truncate preview in UI kit matrix.</OcText>
              </template>
              <template #layout>
                <OcBox stack class="demo-stack">
                  <OcText size="label" tone="muted">Section Label</OcText>
                  <OcText size="title" tone="primary">Card Heading</OcText>
                  <OcText size="body" tone="secondary">Support line with stable reading density.</OcText>
                </OcBox>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="Radius & Shadow" description="统一圆角与阴影层级。">
              <template #default>
                <OcSurface variant="panel" bordered radius="sm" class="shape-box">sm</OcSurface>
                <OcSurface variant="panel" bordered radius="md" class="shape-box">md</OcSurface>
                <OcSurface variant="panel" bordered radius="lg" class="shape-box">lg</OcSurface>
              </template>
              <template #variants>
                <OcSurface variant="elevated" bordered radius="md" shadow="sm" class="shape-box">shadow-sm</OcSurface>
                <OcSurface variant="elevated" bordered radius="md" shadow="md" class="shape-box">shadow-md</OcSurface>
              </template>
              <template #states>
                <OcSurface variant="input" bordered radius="md" class="shape-box">input</OcSurface>
                <OcSurface variant="floating" bordered radius="md" class="shape-box">floating</OcSurface>
              </template>
              <template #layout>
                <OcBox class="shadow-layout">
                  <OcSurface variant="panel" bordered radius="md" class="shadow-layout__top">Layer 1</OcSurface>
                  <OcSurface variant="elevated" bordered radius="md" shadow="sm" class="shadow-layout__bottom">Layer 2</OcSurface>
                </OcBox>
              </template>
            </ShowcaseCard>
          </div>
        </article>

        <article id="primitives" class="ui-kit-section">
          <header class="ui-kit-section__header">
            <p class="ui-kit-section__kicker">Section</p>
            <h2>Primitives</h2>
          </header>
          <p class="ui-kit-section__desc">底层原语组件。每个组件统一展示 Default / Variants / States / Layout。</p>
          <div class="catalog-row">
            <span v-for="item in primitiveCatalog" :key="`primitive-${item}`">{{ item }}</span>
          </div>

          <div class="ui-kit-cards">
            <ShowcaseCard title="OcBox" description="基础布局容器，处理 stack/inline/grow/center。">
              <template #default>
                <OcBox class="demo-box">Box</OcBox>
              </template>
              <template #variants>
                <OcBox inline class="demo-box">inline</OcBox>
                <OcBox stack class="demo-box">stack</OcBox>
              </template>
              <template #states>
                <OcBox stack class="demo-box">
                  <OcText size="label">stateless primitive</OcText>
                </OcBox>
              </template>
              <template #layout>
                <OcBox inline class="demo-row">
                  <OcBox class="demo-box demo-box--grow">grow</OcBox>
                  <OcBox class="demo-box">fixed</OcBox>
                </OcBox>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcText" description="统一文本语义与尺寸层级。">
              <template #default>
                <OcText>Default text</OcText>
              </template>
              <template #variants>
                <OcText tone="secondary">Secondary</OcText>
                <OcText tone="muted">Muted</OcText>
                <OcText tone="info">Info</OcText>
              </template>
              <template #states>
                <OcText tone="label">Label style</OcText>
              </template>
              <template #layout>
                <OcText truncate class="truncate-box">This is a long line to verify truncation behavior in the layout cell.</OcText>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcSurface" description="统一背景、边框、圆角、阴影的表面抽象。">
              <template #default>
                <OcSurface variant="panel" bordered class="surface-sample">panel</OcSurface>
              </template>
              <template #variants>
                <OcSurface variant="elevated" bordered class="surface-sample">elevated</OcSurface>
                <OcSurface variant="input" bordered class="surface-sample">input</OcSurface>
              </template>
              <template #states>
                <OcSurface variant="floating" bordered shadow="md" class="surface-sample">floating</OcSurface>
              </template>
              <template #layout>
                <OcSurface variant="panel" bordered class="surface-stack">
                  <OcText size="label" tone="muted">title</OcText>
                  <OcText size="body">body content</OcText>
                </OcSurface>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcPressable" description="底层交互按钮原语，覆盖状态机。">
              <template #default>
                <OcPressable>Default</OcPressable>
              </template>
              <template #variants>
                <OcPressable variant="primary">Primary</OcPressable>
                <OcPressable variant="ghost">Ghost</OcPressable>
                <OcPressable variant="choice">Choice</OcPressable>
              </template>
              <template #states>
                <OcPressable variant="icon" icon-only active>
                  <OcIcon name="codicon-star-full" />
                </OcPressable>
                <OcPressable disabled>Disabled</OcPressable>
              </template>
              <template #layout>
                <OcPressable block>Block Action</OcPressable>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcFocusRing" description="键盘焦点可视化容器。">
              <template #default>
                <OcFocusRing class="focus-shell">
                  <OcButton variant="secondary">Tab Focus</OcButton>
                </OcFocusRing>
              </template>
              <template #variants>
                <OcFocusRing class="focus-shell">
                  <OcPressable variant="primary">Action</OcPressable>
                </OcFocusRing>
              </template>
              <template #states>
                <OcFocusRing class="focus-shell">
                  <OcFieldCore as="input" value="focus me" />
                </OcFocusRing>
              </template>
              <template #layout>
                <OcFocusRing class="focus-shell focus-shell--block">
                  <OcPressable block>Row Focus Region</OcPressable>
                </OcFocusRing>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcFieldCore" description="统一 input/select/textarea 的输入内核与字段字体 token。">
              <template #default>
                <OcFieldCore as="input" value="Aa 字体预览 123" />
              </template>
              <template #variants>
                <OcFieldCore as="select">
                  <option selected>Option A</option>
                  <option>Option B</option>
                </OcFieldCore>
              </template>
              <template #states>
                <OcFieldCore as="textarea" rows="2">Multi script: OpenCard 字段文本</OcFieldCore>
              </template>
              <template #layout>
                <OcBox stack class="demo-stack">
                  <OcFieldCore as="input" value="first field" />
                  <OcFieldCore as="input" value="second field" />
                </OcBox>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcScrollArea" description="统一滚动容器语义。">
              <template #default>
                <OcSurface variant="elevated" bordered class="scroll-shell">
                  <OcScrollArea axis="y" class="scroll-area">
                    <OcText v-for="line in scrollLines" :key="`y-${line}`" tone="secondary">Line {{ line }}</OcText>
                  </OcScrollArea>
                </OcSurface>
              </template>
              <template #variants>
                <OcSurface variant="elevated" bordered class="scroll-shell">
                  <OcScrollArea axis="x" class="scroll-area scroll-area--x">
                    <OcBox inline class="scroll-row">
                      <OcSurface v-for="line in 6" :key="`x-${line}`" variant="panel" bordered class="scroll-chip">Item {{ line }}</OcSurface>
                    </OcBox>
                  </OcScrollArea>
                </OcSurface>
              </template>
              <template #states>
                <OcSurface variant="panel" bordered class="scroll-shell">
                  <OcText tone="muted" size="label">No state variant</OcText>
                </OcSurface>
              </template>
              <template #layout>
                <OcSurface variant="elevated" bordered class="scroll-shell scroll-shell--layout">
                  <OcScrollArea axis="both" class="scroll-area">
                    <div class="scroll-big-plane" />
                  </OcScrollArea>
                </OcSurface>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcIcon" description="统一 icon 尺寸和语义色。">
              <template #default>
                <OcIcon name="codicon-symbol-color" />
              </template>
              <template #variants>
                <OcIcon name="codicon-folder" tone="folder-default" />
                <OcIcon name="codicon-folder-opened" tone="folder-open" />
                <OcIcon name="codicon-warning" tone="warning" />
              </template>
              <template #states>
                <OcIcon name="codicon-error" tone="danger" size="lg" />
                <OcIcon name="codicon-check" tone="success" size="lg" />
              </template>
              <template #layout>
                <OcBox inline class="demo-row">
                  <OcIcon name="codicon-file-code" tone="typescript" />
                  <OcText tone="secondary">src/main.ts</OcText>
                </OcBox>
              </template>
            </ShowcaseCard>
          </div>
        </article>

        <article id="base" class="ui-kit-section">
          <header class="ui-kit-section__header">
            <p class="ui-kit-section__kicker">Section</p>
            <h2>Base</h2>
          </header>
          <p class="ui-kit-section__desc">业务可复用基础控件，统一由 primitives 组合实现。</p>
          <div class="catalog-row">
            <span v-for="item in baseCatalog" :key="`base-${item}`">{{ item }}</span>
          </div>

          <div class="ui-kit-cards">
            <ShowcaseCard title="OcButton" description="统一按钮入口。">
              <template #default>
                <OcButton variant="secondary">Button</OcButton>
              </template>
              <template #variants>
                <OcButton variant="primary">Primary</OcButton>
                <OcButton variant="ghost">Ghost</OcButton>
                <OcButton variant="choice">Choice</OcButton>
              </template>
              <template #states>
                <OcButton variant="icon" icon="codicon-settings-gear" icon-only :active="true" />
                <OcButton disabled>Disabled</OcButton>
              </template>
              <template #layout>
                <OcButton block variant="primary">Block Action</OcButton>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcFieldInput" description="字段编辑器统一输入壳层。">
              <template #default>
                <OcFieldInput as="input" value="text input" />
              </template>
              <template #variants>
                <OcFieldInput as="select">
                  <option selected>Selected Option</option>
                  <option>Option B</option>
                </OcFieldInput>
              </template>
              <template #states>
                <OcFieldInput as="textarea" rows="2">multi-line</OcFieldInput>
              </template>
              <template #layout>
                <OcBox stack class="demo-stack">
                  <OcFieldInput as="input" value="field A" />
                  <OcFieldInput as="input" value="field B" />
                </OcBox>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcMenuItemButton" description="菜单项入口按钮语义。">
              <template #default>
                <OcMenuItemButton label="Open Project" icon="codicon-folder-opened" />
              </template>
              <template #variants>
                <OcMenuItemButton label="Export All" icon="codicon-export" />
                <OcMenuItemButton label="Submenu Item" icon="codicon-list-tree" has-children />
              </template>
              <template #states>
                <OcMenuItemButton label="Disabled Item" icon="codicon-circle-slash" :disabled="true" />
              </template>
              <template #layout>
                <OcSurface variant="floating" bordered radius="md" class="menu-shell">
                  <OcMenuItemButton label="Action One" icon="codicon-play" />
                  <OcMenuItemButton label="Action Two" icon="codicon-debug-restart" />
                </OcSurface>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcOptionGroup" description="分段选择组控件。">
              <template #default>
                <OcOptionGroup v-model="alignValue" :options="alignOptions" :columns="3" aria-label="align" />
              </template>
              <template #variants>
                <OcOptionGroup v-model="modeValue" :options="modeOptions" :columns="2" size="sm" aria-label="mode" />
              </template>
              <template #states>
                <OcOptionGroup v-model="alignValue" :options="alignOptions" :columns="3" :disabled="true" aria-label="align-disabled" />
              </template>
              <template #layout>
                <OcOptionGroup v-model="alignValue" :options="alignOptions" :columns="1" square aria-label="align-square" />
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcPanelSection" description="带标题和滚动区的面板块。">
              <template #default>
                <OcPanelSection title="Panel Title" class="panel-demo">
                  <OcText tone="secondary">Panel content</OcText>
                </OcPanelSection>
              </template>
              <template #variants>
                <OcPanelSection title="Actions">
                  <template #actions>
                    <OcButton variant="icon" icon="codicon-add" icon-only />
                  </template>
                  <OcText tone="secondary">With action slot</OcText>
                </OcPanelSection>
              </template>
              <template #states>
                <OcPanelSection :header="false">
                  <OcText tone="muted">Header disabled mode</OcText>
                </OcPanelSection>
              </template>
              <template #layout>
                <OcPanelSection title="Scrollable" :scroll-body="true" class="panel-demo panel-demo--scroll">
                  <OcText v-for="line in scrollLines" :key="`panel-${line}`">Row {{ line }}</OcText>
                </OcPanelSection>
              </template>
            </ShowcaseCard>

            <ShowcaseCard title="OcPropertyRow" description="属性编辑行结构。">
              <template #default>
                <OcPropertyRow label="Name" label-icon="codicon-symbol-string">
                  <OcFieldInput as="input" value="OpenCard" />
                </OcPropertyRow>
              </template>
              <template #variants>
                <OcPropertyRow label="Width" label-icon="codicon-arrow-left-right">
                  <OcFieldInput as="input" value="540" />
                </OcPropertyRow>
              </template>
              <template #states>
                <OcPropertyRow label="ReadOnly" label-icon="codicon-lock">
                  <OcFieldInput as="input" value="Locked value" readonly />
                </OcPropertyRow>
              </template>
              <template #layout>
                <OcBox stack class="demo-stack">
                  <OcPropertyRow label="X">
                    <OcFieldInput as="input" value="24" />
                  </OcPropertyRow>
                  <OcPropertyRow label="Y">
                    <OcFieldInput as="input" value="48" />
                  </OcPropertyRow>
                </OcBox>
              </template>
            </ShowcaseCard>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import OcButton from '../components/base/OcButton.vue'
import OcFieldInput from '../components/base/OcFieldInput.vue'
import OcMenuItemButton from '../components/base/OcMenuItemButton.vue'
import OcOptionGroup from '../components/base/OcOptionGroup.vue'
import OcPanelSection from '../components/base/OcPanelSection.vue'
import OcPropertyRow from '../components/base/OcPropertyRow.vue'
import ShowcaseCard from '../components/ui-kit/ShowcaseCard.vue'
import { getOcTheme } from '../shared/ui/foundation'
import {
  OcBox,
  OcFieldCore,
  OcFocusRing,
  OcIcon,
  OcPressable,
  OcScrollArea,
  OcSurface,
  OcText,
} from '../shared/ui/primitives'

type OptionItem = {
  value: string
  label: string
  shortLabel?: string
}

const sections = [
  { id: 'foundation', label: 'Foundation' },
  { id: 'primitives', label: 'Primitives' },
  { id: 'base', label: 'Base' },
]

const currentTheme = computed(() => getOcTheme())
const scrollLines = Array.from({ length: 8 }, (_, index) => index + 1)

const alignValue = ref('center')
const modeValue = ref('color')

const alignOptions: OptionItem[] = [
  { value: 'left', label: 'Left', shortLabel: 'L' },
  { value: 'center', label: 'Center', shortLabel: 'C' },
  { value: 'right', label: 'Right', shortLabel: 'R' },
]

const modeOptions: OptionItem[] = [
  { value: 'color', label: 'Color' },
  { value: 'image', label: 'Image' },
]

const primitiveCatalog = [
  'OcBox',
  'OcText',
  'OcSurface',
  'OcPressable',
  'OcFocusRing',
  'OcFieldCore',
  'OcScrollArea',
  'OcIcon',
]

const baseCatalog = [
  'OcButton',
  'OcFieldInput',
  'OcMenuItemButton',
  'OcOptionGroup',
  'OcPanelSection',
  'OcPropertyRow',
]

function goToIde() {
  window.location.search = ''
}
</script>

<style scoped>
.ui-kit-page {
  min-height: 100%;
  background: var(--oc-bg-base);
  color: var(--oc-text-primary);
  padding: 20px;
}

.ui-kit-hero {
  border: 1px solid var(--oc-border-strong);
  background: var(--oc-bg-panel);
  border-radius: 12px;
  box-shadow: var(--oc-shadow-overlay);
  padding: 20px;
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-end;
}

.ui-kit-hero__meta {
  max-width: 760px;
}

.ui-kit-kicker {
  margin: 0 0 8px;
  color: var(--oc-text-info);
  font-size: var(--oc-label-size);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.ui-kit-hero h1 {
  margin: 0;
  font-size: clamp(32px, 6vw, 56px);
  line-height: 0.95;
}

.ui-kit-summary {
  margin: 12px 0 0;
  color: var(--oc-text-secondary);
  line-height: 1.6;
}

.ui-kit-hero__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ui-kit-layout {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
}

.ui-kit-nav {
  position: sticky;
  top: 20px;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--oc-bg-panel);
  border: 1px solid var(--oc-border-subtle);
  border-radius: 10px;
  padding: 10px;
}

.ui-kit-nav a {
  text-decoration: none;
  color: var(--oc-text-secondary);
  font-size: var(--oc-body-size);
  border-radius: 6px;
  padding: 8px 10px;
}

.ui-kit-nav a:hover {
  background: var(--oc-bg-hover);
  color: var(--oc-text-highlight);
}

.ui-kit-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ui-kit-section {
  background: var(--oc-bg-panel);
  border: 1px solid var(--oc-border-subtle);
  border-radius: 10px;
  padding: 16px;
}

.ui-kit-section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ui-kit-section__header h2 {
  margin: 0;
  font-size: 24px;
}

.ui-kit-section__kicker {
  margin: 0;
  color: var(--oc-text-muted);
  font-size: var(--oc-label-size);
  text-transform: uppercase;
}

.ui-kit-section__desc {
  margin: 10px 0 0;
  color: var(--oc-text-secondary);
}

.ui-kit-cards {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.catalog-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.catalog-row span {
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
  background: var(--oc-bg-elevated);
  border: 1px solid var(--oc-border-subtle);
  padding: 4px 8px;
  border-radius: 999px;
}

.demo-row {
  width: 100%;
  gap: 8px;
}

.demo-stack {
  width: 100%;
  gap: 8px;
}

.demo-box {
  border: 1px dashed var(--oc-border-subtle);
  border-radius: 8px;
  background: var(--oc-bg-panel);
  padding: 8px;
  min-width: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.demo-box--grow {
  flex: 1;
}

.truncate-box {
  max-width: 200px;
}

.token-swatch {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--oc-border-subtle);
  padding: 8px;
  font-size: var(--oc-label-size);
}

.token-swatch--base {
  background: var(--oc-bg-base);
  color: var(--oc-text-primary);
}

.token-swatch--panel {
  background: var(--oc-bg-panel);
}

.token-swatch--text {
  background: var(--oc-bg-elevated);
  color: var(--oc-text-primary);
}

.token-swatch--accent {
  background: var(--oc-bg-accent);
  color: var(--oc-accent-contrast);
}

.token-swatch--accent-soft {
  background: var(--oc-bg-accent-soft);
}

.token-swatch--highlight {
  background: var(--oc-bg-hover);
  color: var(--oc-text-highlight);
}

.token-swatch--success {
  background: var(--oc-bg-panel);
  color: var(--icon-success);
}

.token-swatch--warning {
  background: var(--oc-bg-panel);
  color: var(--icon-warning);
}

.token-swatch--danger {
  background: var(--oc-bg-panel);
  color: var(--oc-danger);
}

.token-layout-box {
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shape-box {
  min-width: 68px;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--oc-label-size);
}

.shadow-layout {
  width: 100%;
  display: grid;
  gap: 8px;
}

.shadow-layout__top,
.shadow-layout__bottom {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--oc-label-size);
}

.surface-sample {
  min-height: 42px;
  min-width: 86px;
  padding: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.surface-stack {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}

.focus-shell {
  width: 100%;
  border: 1px dashed var(--oc-border-subtle);
  border-radius: 8px;
  padding: 8px;
}

.focus-shell--block {
  display: block;
}

.scroll-shell {
  width: 100%;
  min-height: 76px;
  padding: 8px;
}

.scroll-shell--layout {
  min-height: 116px;
}

.scroll-area {
  max-height: 58px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scroll-area--x {
  max-height: unset;
  overflow-y: hidden;
}

.scroll-row {
  gap: 6px;
  width: max-content;
}

.scroll-chip {
  min-width: 70px;
  padding: 6px 10px;
}

.scroll-big-plane {
  width: 280px;
  height: 180px;
  border-radius: 8px;
  border: 1px dashed var(--oc-border-subtle);
  background: var(--oc-bg-elevated);
}

.menu-shell {
  width: 100%;
  padding: 6px;
  display: grid;
  gap: 4px;
}

.panel-demo {
  width: 100%;
  min-height: 100px;
}

.panel-demo--scroll {
  max-height: 120px;
}

@media (max-width: 1024px) {
  .ui-kit-layout {
    grid-template-columns: 1fr;
  }

  .ui-kit-nav {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
