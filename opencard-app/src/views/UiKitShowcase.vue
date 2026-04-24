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
    <div>
      <OcSurface variant="glass" radius="md" shadow="sm" fill>
        <OcBox stack fill>
          <Header>
            ass
          </Header>

          <Body>
            body
          </Body>
        </OcBox>
      </OcSurface>
    </div>

    <div class="ui-kit-layout">
      <aside class="ui-kit-nav">
        <a v-for="section in uiKitSections" :key="section.id" :href="`#${section.id}`">{{ section.label }}</a>
      </aside>

      <section class="ui-kit-content">
        <article v-for="section in uiKitSections" :id="section.id" :key="section.id" class="ui-kit-section">
          <header class="ui-kit-section__header">
            <p class="ui-kit-section__kicker">Section</p>
            <h2>{{ section.title }}</h2>
          </header>
          <p class="ui-kit-section__desc">{{ section.description }}</p>

          <div class="catalog-row">
            <span v-for="item in section.catalog" :key="`${section.id}-${item}`">{{ item }}</span>
          </div>

          <div class="ui-kit-cards">
            <ShowcaseCard v-for="example in section.examples" :key="example.id" :title="example.title"
              :description="buildExampleDescription(example)" :code-by-column="getShowcaseCode(example.id)">
              <template #default>
                <ShowcaseExampleRenderer :example-id="example.id" column="default" />
              </template>
              <template #variants>
                <ShowcaseExampleRenderer :example-id="example.id" column="variants" />
              </template>
              <template #states>
                <ShowcaseExampleRenderer :example-id="example.id" column="states" />
              </template>
              <template #layout>
                <ShowcaseExampleRenderer :example-id="example.id" column="layout" />
              </template>
            </ShowcaseCard>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import OcButton from '../components/base/OcButton.vue'
import ShowcaseCard from '../components/ui-kit/ShowcaseCard.vue'
import ShowcaseExampleRenderer from '../components/ui-kit/ShowcaseExampleRenderer.vue'
import { UI_KIT_SECTIONS, type ShowcaseExample } from './ui-kit/catalog'
import { getShowcaseCode } from './ui-kit/showcaseCode'
import OcBox from '../shared/ui/primitives/OcBox.vue'
import OcText from '../shared/ui/primitives/OcText.vue'
import OcSurface from '../shared/ui/primitives/OcSurface.vue'

defineOptions({ name: 'UiKitShowcase' })

const uiKitSections = UI_KIT_SECTIONS

// Bridge theme from app-level DOM dataset to avoid view -> foundation direct import.
function readThemeFromDataset(): string {
  if (typeof document === 'undefined') {
    return 'light'
  }

  return document.documentElement.dataset.ocTheme ?? 'light'
}

const currentTheme = ref(readThemeFromDataset())
let themeObserver: MutationObserver | null = null

onMounted(() => {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return
  }

  const root = document.documentElement
  themeObserver = new MutationObserver(() => {
    currentTheme.value = readThemeFromDataset()
  })
  themeObserver.observe(root, { attributes: true, attributeFilter: ['data-oc-theme'] })
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  themeObserver = null
})

function buildExampleDescription(example: ShowcaseExample): string {
  const stateLine = example.stateCoverage.join(' / ')
  return `${example.purpose} · State: ${stateLine}`
}

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
