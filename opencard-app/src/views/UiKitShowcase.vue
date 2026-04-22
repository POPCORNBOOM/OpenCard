<template>
  <main class="ui-kit-page">
    <header class="ui-kit-hero">
      <div class="ui-kit-hero__meta">
        <p class="ui-kit-kicker">OpenCard Design System</p>
        <h1>UI Kit</h1>
        <p class="ui-kit-summary">
          一个用于沉淀 OpenCard 基础组件与原语的单页工作台。修改组件代码后，这里会通过 Vite HMR 立即反映结果。
        </p>
      </div>
      <div class="ui-kit-hero__actions">
        <OcButton variant="secondary" @click="goToIde">Back To IDE</OcButton>
        <OcButton variant="ghost" disabled>Theme: {{ currentTheme }}</OcButton>
      </div>
    </header>

    <div class="ui-kit-layout">
      <aside class="ui-kit-nav">
        <a href="#foundation">Foundation</a>
        <a href="#primitives">Primitives</a>
        <a href="#base">Base</a>
      </aside>

      <section class="ui-kit-content">
        <article id="foundation" class="ui-kit-section">
          <header class="ui-kit-section__header">
            <p class="ui-kit-section__kicker">Section</p>
            <h2>Foundation</h2>
          </header>
          <p class="ui-kit-section__desc">主题 token、排版语义、密度节奏的可视化样本。</p>
        </article>

        <article id="primitives" class="ui-kit-section">
          <header class="ui-kit-section__header">
            <p class="ui-kit-section__kicker">Section</p>
            <h2>Primitives</h2>
          </header>
          <p class="ui-kit-section__desc">OcBox / OcText / OcSurface / OcPressable 等底层原语矩阵。</p>
        </article>

        <article id="base" class="ui-kit-section">
          <header class="ui-kit-section__header">
            <p class="ui-kit-section__kicker">Section</p>
            <h2>Base</h2>
          </header>
          <p class="ui-kit-section__desc">OcButton / OcPanelSection / OcFieldInput 等业务可复用控件矩阵。</p>
        </article>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import OcButton from '../components/base/OcButton.vue'
import { getOcTheme } from '../shared/ui/foundation'

const currentTheme = getOcTheme()

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
  border-radius: 10px;
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
  padding: 7px 10px;
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

