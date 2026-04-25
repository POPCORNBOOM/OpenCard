<template>
  <main class="button-showcase">
    <header class="showcase-hero">
      <p class="showcase-kicker">OpenCard Base Component</p>
      <h1>OcButton</h1>
      <p class="showcase-summary">
        现在只展示一个统一入口：`OcButton`。所有按钮样式都通过受控参数表达，不再散落拼 class。
      </p>
      <div class="showcase-hero-actions">
        <OcButton variant="secondary" @click="goToIde">Back To IDE</OcButton>
        <OcButton variant="primary" icon="icon.add">Create Card</OcButton>
      </div>
    </header>

    <section class="showcase-section">
      <div class="section-header">
        <p class="section-label">Variant</p>
        <h2>语义类型</h2>
      </div>
      <div class="button-row">
        <OcButton variant="primary">Primary</OcButton>
        <OcButton variant="secondary">Secondary</OcButton>
        <OcButton variant="ghost">Ghost</OcButton>
        <OcButton variant="choice">Choice</OcButton>
        <OcButton variant="choice" :active="true">Choice Active</OcButton>
        <OcButton variant="icon" icon="icon.settings-gear" icon-only title="Icon Action" />
      </div>
    </section>

    <section class="showcase-section">
      <div class="section-header">
        <p class="section-label">Size</p>
        <h2>尺寸控制</h2>
      </div>
      <div class="button-row">
        <OcButton size="sm" variant="secondary">Small</OcButton>
        <OcButton size="md" variant="secondary">Medium</OcButton>
        <OcButton size="lg" variant="secondary">Large</OcButton>
        <OcButton size="sm" variant="icon" icon="icon.search" icon-only title="Small Icon" />
        <OcButton size="md" variant="icon" icon="icon.search" icon-only title="Medium Icon" />
        <OcButton size="lg" variant="icon" icon="icon.search" icon-only title="Large Icon" />
      </div>
    </section>

    <section class="showcase-section">
      <div class="section-header">
        <p class="section-label">Radius</p>
        <h2>圆角限定项</h2>
      </div>
      <div class="button-row">
        <OcButton radius="none" variant="secondary">none</OcButton>
        <OcButton radius="sm" variant="secondary">sm</OcButton>
        <OcButton radius="md" variant="secondary">md</OcButton>
        <OcButton radius="lg" variant="secondary">lg</OcButton>
      </div>
    </section>

    <section class="showcase-section">
      <div class="section-header">
        <p class="section-label">Icon</p>
        <h2>图标能力</h2>
      </div>
      <div class="button-row">
        <OcButton variant="secondary" icon="icon.folder-opened">Left Icon</OcButton>
        <OcButton variant="secondary" icon="icon.arrow-right" icon-position="right">Right Icon</OcButton>
        <OcButton variant="primary" icon="icon.save">Save</OcButton>
        <OcButton variant="icon" icon="icon.list-tree" icon-only title="Tree" />
      </div>
    </section>

    <section class="showcase-section">
      <div class="section-header">
        <p class="section-label">State</p>
        <h2>状态与布局</h2>
      </div>
      <div class="button-row">
        <OcButton variant="primary" disabled>Disabled</OcButton>
        <OcButton variant="icon" icon="icon.symbol-string" icon-only :active="true" title="Active Icon" />
      </div>
      <div class="block-row">
        <OcButton variant="primary" block icon="icon.add">Block Button</OcButton>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import OcButton from '../components/base/OcButton.vue'

function goToIde() {
  window.location.search = ''
}
</script>

<style scoped>
.button-showcase {
  min-height: 100%;
  padding: 48px;
  background:
    radial-gradient(circle at top left, rgba(88, 166, 255, 0.16), transparent 24%),
    linear-gradient(180deg, #171819 0%, #111214 100%);
  color: var(--oc-text-primary);
  font-family: "Segoe UI", "PingFang SC", sans-serif;
}

.showcase-hero {
  max-width: 720px;
  margin-bottom: 48px;
}

.showcase-kicker,
.section-label {
  margin-bottom: 8px;
  color: var(--oc-accent-preview-text);
  font-size: var(--oc-label-size);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.showcase-hero h1,
.showcase-section h2 {
  margin: 0;
}

.showcase-hero h1 {
  font-size: clamp(42px, 8vw, 72px);
  line-height: 0.95;
}

.showcase-summary {
  max-width: 560px;
  margin: 16px 0 0;
  color: var(--oc-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.showcase-hero-actions,
.button-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.showcase-hero-actions {
  margin-top: 24px;
}

.showcase-section {
  padding: 24px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.section-header {
  margin-bottom: 16px;
}

.block-row {
  display: flex;
  flex-direction: column;
  margin-top: 12px;
  max-width: 380px;
}
</style>
