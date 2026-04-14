<template>
  <div class="design-prototype">
    <header class="shell-header">
      <div class="shell-brand">
        <button class="shell-back" @click="goBack">{{ t('app.menu.backToIde') }}</button>
        <div class="brand-copy">
          <span class="brand-copy__eyebrow">OpenCard / Workbench Reference</span>
          <strong>统一工作台原型</strong>
        </div>
      </div>

      <div class="command-bar">
        <span class="command-bar__key">Ctrl + Shift + P</span>
        <span class="command-bar__text">新建角色卡、验证所有数据表、修复资源引用、批量导出 PDF</span>
      </div>

      <div class="shell-actions">
        <button class="ui-button ui-button--primary">Open Project</button>
        <button class="ui-button">Preview</button>
      </div>
    </header>

    <section class="workbench-shell">
      <aside class="activity-rail">
        <button
          v-for="item in activityItems"
          :key="item.label"
          :class="['activity-rail__button', { 'activity-rail__button--active': item.active }]"
          :title="item.label"
        >
          <span>{{ item.short }}</span>
        </button>
      </aside>

      <aside class="panel explorer-panel">
        <header class="panel-header">
          <div>
            <p class="panel-header__eyebrow">Explorer</p>
            <h2>OpenCard Project</h2>
          </div>
          <span class="status-pill">Watching</span>
        </header>

        <div class="panel-body">
          <section v-for="section in explorerSections" :key="section.title" class="panel-section">
            <div class="section-row">
              <span class="section-row__title">{{ section.title }}</span>
              <span class="section-row__meta">{{ section.meta }}</span>
            </div>

            <div class="tree-list">
              <button
                v-for="entry in section.entries"
                :key="entry.name"
                :class="['tree-entry', `tree-entry--${entry.tone}`]"
              >
                <span class="tree-entry__name">{{ entry.name }}</span>
                <span class="tree-entry__detail">{{ entry.detail }}</span>
              </button>
            </div>
          </section>

          <section class="panel-section panel-note">
            <p class="panel-note__title">交互原则</p>
            <p>真实文件树始终可见。自动修复属于明确命令，不在浏览阶段悄悄接管文件系统。</p>
          </section>
        </div>
      </aside>

      <main class="workspace">
        <header class="workspace-header">
          <div class="tab-strip">
            <button
              v-for="tab in editorTabs"
              :key="tab.name"
              :class="['tab-strip__item', { 'tab-strip__item--active': tab.active }]"
            >
              <span>{{ tab.name }}</span>
              <small>{{ tab.meta }}</small>
            </button>
          </div>

          <div class="workspace-header__meta">
            <span class="status-dot status-dot--success"></span>
            <span>Live Preview</span>
            <span class="workspace-header__sep">·</span>
            <span>2 warnings</span>
          </div>
        </header>

        <div class="workspace-stage">
          <section class="editor-plane">
            <div class="plane-toolbar">
              <div class="segmented-control">
                <button
                  v-for="mode in editorModes"
                  :key="mode.name"
                  :class="['segmented-control__item', { 'segmented-control__item--active': mode.active }]"
                >
                  {{ mode.name }}
                </button>
              </div>

              <div class="plane-toolbar__meta">
                <span>Blueprint / hero-knight.blueprint.json</span>
              </div>
            </div>

            <div class="blueprint-canvas">
              <div
                v-for="node in blueprintNodes"
                :key="node.title"
                :class="['blueprint-node', `blueprint-node--${node.tone}`]"
              >
                <strong>{{ node.title }}</strong>
                <span>{{ node.detail }}</span>
              </div>
            </div>
          </section>

          <section class="preview-plane">
            <div class="preview-card">
              <div class="preview-card__header">
                <span class="preview-card__tag">Card Preview</span>
                <span class="status-pill status-pill--accent">Blueprint Linked</span>
              </div>

              <div class="preview-card__frame">
                <div class="frame-art"></div>
                <div class="frame-title">
                  <strong>Hero Knight</strong>
                  <span>front / zh-CN / 744 x 1039</span>
                </div>
                <div class="frame-stats">
                  <span>ATK 8</span>
                  <span>DEF 6</span>
                  <span>Cost 3</span>
                </div>
                <div class="frame-body">
                  <p>当本卡被部署时，若技能表已更新，则触发预览同步提示。</p>
                </div>
              </div>
            </div>

            <div class="preview-insights">
              <div v-for="item in previewInsights" :key="item.label" class="insight-chip">
                <span class="insight-chip__label">{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </section>
        </div>

        <footer class="workspace-principles">
          <div v-for="item in workbenchPrinciples" :key="item.title" class="principle-cell">
            <span class="principle-cell__title">{{ item.title }}</span>
            <p>{{ item.detail }}</p>
          </div>
        </footer>
      </main>

      <aside class="panel inspector-panel">
        <header class="panel-header">
          <div>
            <p class="panel-header__eyebrow">Inspector</p>
            <h2>Properties</h2>
          </div>
          <button class="ui-button ui-button--ghost">Apply</button>
        </header>

        <div class="panel-body">
          <section class="panel-section">
            <div class="section-row">
              <span class="section-row__title">Selected Node</span>
              <span class="section-row__meta">card.header</span>
            </div>

            <div class="field-stack">
              <label v-for="field in inspectorFields" :key="field.label" class="field">
                <span class="field__label">{{ field.label }}</span>
                <div :class="['field__control', `field__control--${field.kind}`]">
                  <span>{{ field.value }}</span>
                </div>
              </label>
            </div>
          </section>

          <section class="panel-section">
            <div class="section-row">
              <span class="section-row__title">Validation</span>
              <span class="section-row__meta">auto check</span>
            </div>

            <div class="validation-list">
              <div
                v-for="item in validationItems"
                :key="item.title"
                :class="['validation-item', `validation-item--${item.tone}`]"
              >
                <strong>{{ item.title }}</strong>
                <p>{{ item.detail }}</p>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </section>

    <section class="spec-board">
      <div class="spec-board__intro">
        <p class="spec-board__eyebrow">Unified Design System</p>
        <h2>控件、间距、配色和字体在同一套规则里收口，避免页面靠临时感觉拼出来。</h2>
      </div>

      <div class="spec-grid">
        <article class="spec-panel">
          <header class="spec-panel__header">
            <p>控件设计</p>
            <span>Buttons · Inputs · Segments</span>
          </header>

          <div class="control-stack">
            <div class="control-row">
              <button class="ui-button ui-button--primary">Primary</button>
              <button class="ui-button">Secondary</button>
              <button class="ui-button ui-button--ghost">Ghost</button>
            </div>

            <div class="control-row">
              <div class="demo-input">
                <span>搜索卡牌、资源或命令</span>
                <kbd>/</kbd>
              </div>
            </div>

            <div class="control-row">
              <div class="segmented-control segmented-control--compact">
                <button class="segmented-control__item segmented-control__item--active">Blueprint</button>
                <button class="segmented-control__item">Data</button>
                <button class="segmented-control__item">Preview</button>
              </div>
            </div>
          </div>

          <ul class="rule-list">
            <li v-for="rule in controlRules" :key="rule">{{ rule }}</li>
          </ul>
        </article>

        <article class="spec-panel">
          <header class="spec-panel__header">
            <p>布局间距</p>
            <span>8px base scale</span>
          </header>

          <div class="spacing-stack">
            <div v-for="space in spacingScale" :key="space.label" class="spacing-row">
              <span class="spacing-row__label">{{ space.label }}</span>
              <div class="spacing-row__track">
                <div class="spacing-row__bar" :style="{ width: `${space.size * 3}px` }"></div>
              </div>
              <code>{{ space.size }}px</code>
            </div>
          </div>

          <ul class="rule-list">
            <li v-for="rule in spacingRules" :key="rule">{{ rule }}</li>
          </ul>
        </article>

        <article class="spec-panel">
          <header class="spec-panel__header">
            <p>配色方案</p>
            <span>Surface-first, one accent</span>
          </header>

          <div class="palette-grid">
            <div v-for="color in paletteTokens" :key="color.name" class="palette-chip">
              <span class="palette-chip__swatch" :style="{ background: color.value }"></span>
              <div>
                <strong>{{ color.name }}</strong>
                <code>{{ color.hex }}</code>
              </div>
            </div>
          </div>

          <ul class="rule-list">
            <li v-for="rule in colorRules" :key="rule">{{ rule }}</li>
          </ul>
        </article>

        <article class="spec-panel">
          <header class="spec-panel__header">
            <p>字体方案</p>
            <span>Display · Text · Code</span>
          </header>

          <div class="type-stack">
            <div v-for="sample in typographySamples" :key="sample.label" class="type-sample">
              <span class="type-sample__label">{{ sample.label }}</span>
              <div :class="['type-sample__preview', `type-sample__preview--${sample.kind}`]">
                {{ sample.preview }}
              </div>
              <code>{{ sample.stack }}</code>
            </div>
          </div>

          <ul class="rule-list">
            <li v-for="rule in typographyRules" :key="rule">{{ rule }}</li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const activityItems = [
  { short: 'EX', label: 'Explorer', active: true },
  { short: 'BP', label: 'Blueprint', active: false },
  { short: 'DT', label: 'Data Table', active: false },
  { short: 'PB', label: 'Publish', active: false },
] as const

const explorerSections = [
  {
    title: 'Workspace',
    meta: '真实文件',
    entries: [
      { name: 'opencard.json', detail: 'settings', tone: 'file' },
      { name: 'cards/hero-knight.json', detail: 'card doc', tone: 'active' },
      { name: 'data/skills.csv', detail: 'table', tone: 'file' },
      { name: 'i18n/zh-CN.json', detail: 'locale', tone: 'file' },
    ],
  },
  {
    title: 'Quick Commands',
    meta: '明确触发',
    entries: [
      { name: '新建角色卡', detail: 'template', tone: 'command' },
      { name: '验证所有数据表', detail: 'validation', tone: 'command' },
      { name: '修复资源引用', detail: 'optional', tone: 'command' },
    ],
  },
] as const

const editorTabs = [
  { name: 'hero-knight.blueprint.json', meta: 'Blueprint', active: true },
  { name: 'skills.csv', meta: 'Table', active: false },
  { name: 'zh-CN.json', meta: 'Locale', active: false },
] as const

const editorModes = [
  { name: 'Blueprint', active: true },
  { name: 'Data Table', active: false },
  { name: 'Preview', active: false },
] as const

const blueprintNodes = [
  { title: 'Card Blueprint', detail: 'layout · slots · rules', tone: 'accent' },
  { title: 'Artwork Slot', detail: 'resource linked', tone: 'neutral' },
  { title: 'Stats Block', detail: 'table driven', tone: 'info' },
  { title: 'Localized Copy', detail: 'zh-CN / en-US', tone: 'success' },
] as const

const previewInsights = [
  { label: '当前预览', value: 'Hero Card' },
  { label: '文件状态', value: 'Dirty' },
  { label: '同步方式', value: 'Live' },
] as const

const workbenchPrinciples = [
  { title: '文件透明', detail: '路径、来源和真实文件结构始终可见。' },
  { title: '编辑器分层', detail: '不同复杂度的问题进入不同编辑界面。' },
  { title: '提示优先', detail: '问题先被解释，再决定是否自动修复。' },
] as const

const inspectorFields = [
  { label: 'Name', value: 'Hero Knight', kind: 'input' },
  { label: 'Layout', value: 'front-card-default', kind: 'select' },
  { label: 'Artwork', value: 'assets/hero_knight.png', kind: 'input' },
  { label: 'Auto Preview', value: 'Enabled', kind: 'toggle' },
] as const

const validationItems = [
  { title: 'Image Linked', detail: '素材路径存在，资源库已同步定位。', tone: 'success' },
  { title: 'Locale Missing', detail: 'en-US 缺少 1 条描述文本。', tone: 'warning' },
  { title: 'Export Ready', detail: '当前卡牌可直接进入批量导出队列。', tone: 'neutral' },
] as const

const controlRules = [
  '主按钮统一 36px 高度，圆角 10px，图标与文字间距 8px。',
  '输入框、下拉框、分段控件共享同一边框、背景和焦点态。',
  '强调色只用于主操作、当前选中和关键状态反馈。',
] as const

const spacingScale = [
  { label: 'XS', size: 8 },
  { label: 'SM', size: 12 },
  { label: 'MD', size: 16 },
  { label: 'LG', size: 24 },
  { label: 'XL', size: 32 },
] as const

const spacingRules = [
  '页面主栅格间距用 12px，面板内区块用 16px，字段堆叠用 10px。',
  '顶部栏、标签栏、检视器等重复区域，统一使用 16px 内边距。',
  '不要为“看起来空”随意加块；优先靠栅格和留白建立层级。',
] as const

const paletteTokens = [
  { name: 'Canvas', value: '#0f131a', hex: '#0F131A' },
  { name: 'Surface', value: '#161c25', hex: '#161C25' },
  { name: 'Surface +1', value: '#1c2430', hex: '#1C2430' },
  { name: 'Border', value: '#2b3648', hex: '#2B3648' },
  { name: 'Accent', value: '#d8a24d', hex: '#D8A24D' },
  { name: 'Info', value: '#58a8ff', hex: '#58A8FF' },
  { name: 'Success', value: '#5dc48d', hex: '#5DC48D' },
  { name: 'Danger', value: '#ff8a7a', hex: '#FF8A7A' },
] as const

const colorRules = [
  '底色以深灰蓝为主，避免黑白强硬对比造成视觉疲劳。',
  '整个工作台只保留一组品牌强调色，状态色只负责语义提示。',
  '不要在日常面板背后堆装饰渐变；重点区域才允许轻微光感。',
] as const

const typographySamples = [
  {
    label: 'Display',
    preview: 'OpenCard Workbench',
    stack: 'Segoe UI Variable Display, Aptos Display',
    kind: 'display',
  },
  {
    label: 'Body',
    preview: '属性、状态、提示、帮助信息统一用可读性优先的正文体系。',
    stack: 'Segoe UI Variable Text, Microsoft YaHei UI',
    kind: 'body',
  },
  {
    label: 'Code',
    preview: 'cards/hero-knight.json',
    stack: 'Cascadia Code, Consolas',
    kind: 'code',
  },
] as const

const typographyRules = [
  '标题只在页面层和主区域名里放大，业务字段不要追求戏剧化字号。',
  '正文默认 13px 到 14px，辅助说明 12px，代码与路径固定等宽字。',
  '字体职责分离：展示字体管结构，正文字体管密度，代码字体管路径与配置。',
] as const

function goBack() {
  if (typeof window === 'undefined') {
    return
  }

  window.location.hash = '#/'
}
</script>

<style scoped>
.design-prototype {
  --oc-bg: #0f131a;
  --oc-surface: #161c25;
  --oc-surface-2: #1c2430;
  --oc-surface-3: #242f3d;
  --oc-border: #2b3648;
  --oc-border-strong: #3a475e;
  --oc-text: #e8eef8;
  --oc-text-muted: #97a4b8;
  --oc-accent: #d8a24d;
  --oc-accent-soft: rgba(216, 162, 77, 0.14);
  --oc-info: #58a8ff;
  --oc-success: #5dc48d;
  --oc-warning: #ffbf63;
  --oc-danger: #ff8a7a;
  --oc-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
  min-height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(circle at top left, rgba(88, 168, 255, 0.08), transparent 24%),
    linear-gradient(180deg, #0e1218 0%, #0f131a 100%);
  color: var(--oc-text);
  font-family: 'Segoe UI Variable Text', 'Aptos', 'Microsoft YaHei UI', sans-serif;
  padding: 16px;
}

.shell-header,
.workbench-shell,
.spec-panel {
  animation: panel-in 0.42s ease both;
}

.shell-header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: grid;
  grid-template-columns: auto minmax(320px, 1fr) auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid var(--oc-border);
  border-radius: 16px;
  background: rgba(15, 19, 26, 0.92);
  backdrop-filter: blur(20px);
  box-shadow: var(--oc-shadow);
}

.shell-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-copy strong {
  font-family: 'Segoe UI Variable Display', 'Aptos Display', 'Aptos', sans-serif;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.brand-copy__eyebrow,
.panel-header__eyebrow,
.spec-board__eyebrow {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--oc-text-muted);
}

.shell-back,
.ui-button,
.activity-rail__button,
.tree-entry,
.tab-strip__item,
.segmented-control__item {
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.shell-back,
.ui-button {
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--oc-border);
  background: var(--oc-surface-2);
  color: var(--oc-text);
  padding: 0 14px;
  font: inherit;
  cursor: pointer;
}

.shell-back:hover,
.ui-button:hover {
  transform: translateY(-1px);
  border-color: var(--oc-border-strong);
}

.ui-button--primary {
  border-color: rgba(216, 162, 77, 0.3);
  background: linear-gradient(180deg, rgba(216, 162, 77, 0.22), rgba(216, 162, 77, 0.14));
  color: #f5dfb5;
}

.ui-button--ghost {
  background: transparent;
}

.shell-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.command-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--oc-border);
  border-radius: 12px;
  background: rgba(22, 28, 37, 0.92);
}

.command-bar__key,
.status-pill,
.section-row__meta,
.preview-card__tag {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.command-bar__key {
  color: var(--oc-accent);
  white-space: nowrap;
}

.command-bar__text {
  color: var(--oc-text-muted);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workbench-shell {
  display: grid;
  grid-template-columns: 56px 280px minmax(0, 1fr) 320px;
  gap: 12px;
  min-height: min(76vh, 860px);
}

.activity-rail,
.panel,
.workspace,
.spec-panel {
  border: 1px solid var(--oc-border);
  border-radius: 18px;
  background: var(--oc-surface);
  box-shadow: var(--oc-shadow);
}

.activity-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 12px 8px;
}

.activity-rail__button {
  width: 40px;
  height: 40px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--oc-text-muted);
  font: inherit;
  cursor: pointer;
}

.activity-rail__button:hover {
  background: var(--oc-surface-2);
  color: var(--oc-text);
}

.activity-rail__button--active {
  border-color: rgba(216, 162, 77, 0.28);
  background: var(--oc-accent-soft);
  color: #f2d7a0;
}

.panel,
.workspace {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header,
.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--oc-border);
}

.panel-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(93, 196, 141, 0.12);
  color: #9de0b7;
}

.status-pill--accent {
  background: rgba(216, 162, 77, 0.14);
  color: #f1cf93;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-row__title {
  font-size: 13px;
  font-weight: 600;
}

.section-row__meta {
  color: var(--oc-text-muted);
}

.tree-list,
.field-stack,
.validation-list,
.control-stack,
.spacing-stack,
.type-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tree-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--oc-text);
  font: inherit;
  cursor: pointer;
  text-align: left;
}

.tree-entry:hover {
  background: var(--oc-surface-2);
}

.tree-entry--active {
  border-color: rgba(88, 168, 255, 0.2);
  background: rgba(88, 168, 255, 0.12);
}

.tree-entry--command {
  color: #f1d39d;
}

.tree-entry__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-entry__detail {
  color: var(--oc-text-muted);
  font-size: 12px;
}

.panel-note {
  margin-top: auto;
  padding: 14px;
  border-radius: 12px;
  background: rgba(88, 168, 255, 0.08);
  color: var(--oc-text-muted);
}

.panel-note__title {
  margin-bottom: 6px;
  color: var(--oc-text);
  font-size: 13px;
  font-weight: 600;
}

.workspace-header {
  min-height: 68px;
}

.tab-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.tab-strip__item {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 180px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--oc-text-muted);
  font: inherit;
  cursor: pointer;
}

.tab-strip__item small {
  color: inherit;
  font-size: 12px;
}

.tab-strip__item:hover,
.tab-strip__item--active {
  background: var(--oc-surface-2);
  color: var(--oc-text);
}

.tab-strip__item--active {
  border-color: var(--oc-border);
}

.workspace-header__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--oc-text-muted);
  font-size: 12px;
}

.workspace-header__sep {
  opacity: 0.5;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.status-dot--success {
  background: var(--oc-success);
}

.workspace-stage {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) 320px;
  gap: 12px;
  padding: 16px;
  min-height: 0;
}

.editor-plane,
.preview-plane {
  border: 1px solid var(--oc-border);
  border-radius: 16px;
  background: var(--oc-surface-2);
  min-height: 0;
}

.editor-plane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.plane-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--oc-border);
}

.plane-toolbar__meta {
  color: var(--oc-text-muted);
  font-size: 12px;
}

.segmented-control {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--oc-border);
  border-radius: 12px;
  background: rgba(15, 19, 26, 0.66);
}

.segmented-control--compact {
  width: fit-content;
}

.segmented-control__item {
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--oc-text-muted);
  font: inherit;
  cursor: pointer;
}

.segmented-control__item--active,
.segmented-control__item:hover {
  background: var(--oc-surface-3);
  color: var(--oc-text);
}

.blueprint-canvas {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 22px 22px;
}

.blueprint-node {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-height: 112px;
  padding: 16px;
  border: 1px solid var(--oc-border);
  border-radius: 14px;
  background: rgba(15, 19, 26, 0.72);
}

.blueprint-node strong {
  font-size: 15px;
}

.blueprint-node span {
  color: var(--oc-text-muted);
  font-size: 13px;
}

.blueprint-node--accent {
  border-color: rgba(216, 162, 77, 0.28);
  background: linear-gradient(180deg, rgba(216, 162, 77, 0.12), rgba(15, 19, 26, 0.76));
}

.blueprint-node--info {
  border-color: rgba(88, 168, 255, 0.22);
}

.blueprint-node--success {
  border-color: rgba(93, 196, 141, 0.22);
}

.preview-plane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.preview-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--oc-border);
  border-radius: 14px;
  background: rgba(15, 19, 26, 0.78);
}

.preview-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.preview-card__tag {
  color: var(--oc-text-muted);
}

.preview-card__frame {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(28, 36, 48, 0.96), rgba(15, 19, 26, 0.96));
}

.frame-art {
  height: 172px;
  border-radius: 14px;
  background:
    radial-gradient(circle at 30% 20%, rgba(216, 162, 77, 0.52), transparent 28%),
    linear-gradient(135deg, rgba(88, 168, 255, 0.24), rgba(93, 196, 141, 0.12)),
    #243042;
}

.frame-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.frame-title strong {
  font-family: 'Segoe UI Variable Display', 'Aptos Display', 'Aptos', sans-serif;
  font-size: 20px;
}

.frame-title span,
.frame-body p {
  color: var(--oc-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.frame-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.frame-stats span {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  color: var(--oc-text);
  font-size: 12px;
}

.preview-insights {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.insight-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--oc-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
}

.insight-chip__label {
  color: var(--oc-text-muted);
  font-size: 12px;
}

.workspace-principles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 0 16px 16px;
}

.principle-cell {
  padding: 12px;
  border: 1px solid var(--oc-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
}

.principle-cell__title {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
}

.principle-cell p {
  color: var(--oc-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  color: var(--oc-text-muted);
  font-size: 12px;
}

.field__control {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border: 1px solid var(--oc-border);
  border-radius: 10px;
  background: var(--oc-surface-2);
  font-size: 13px;
}

.field__control--toggle::after {
  content: '';
  width: 26px;
  height: 16px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 75% 50%, #ffffff 0 28%, transparent 29%),
    rgba(93, 196, 141, 0.22);
}

.validation-item {
  padding: 12px;
  border: 1px solid var(--oc-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}

.validation-item strong {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
}

.validation-item p {
  color: var(--oc-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.validation-item--success {
  border-color: rgba(93, 196, 141, 0.24);
}

.validation-item--warning {
  border-color: rgba(255, 191, 99, 0.24);
}

.spec-board {
  margin-top: 12px;
  padding-bottom: 24px;
}

.spec-board__intro {
  padding: 18px 6px 14px;
}

.spec-board__intro h2 {
  max-width: 860px;
  font-family: 'Segoe UI Variable Display', 'Aptos Display', 'Aptos', sans-serif;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.18;
  letter-spacing: -0.03em;
}

.spec-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.spec-panel {
  padding: 16px;
}

.spec-panel__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--oc-border);
}

.spec-panel__header p {
  font-size: 15px;
  font-weight: 600;
}

.spec-panel__header span,
.rule-list li,
.spacing-row code,
.palette-chip code,
.type-sample code {
  color: var(--oc-text-muted);
  font-size: 12px;
}

.control-stack,
.spacing-stack,
.palette-grid,
.type-stack,
.rule-list {
  margin-top: 14px;
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.demo-input {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px;
  border: 1px solid var(--oc-border);
  border-radius: 10px;
  background: var(--oc-surface-2);
  color: var(--oc-text-muted);
  font-size: 13px;
}

.demo-input kbd {
  min-width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--oc-border);
  border-radius: 6px;
  background: var(--oc-bg);
  color: var(--oc-text);
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 11px;
}

.rule-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rule-list li {
  position: relative;
  padding-left: 14px;
  line-height: 1.7;
}

.rule-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--oc-accent);
}

.spacing-row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 10px;
}

.spacing-row__label {
  font-size: 12px;
  color: var(--oc-text);
}

.spacing-row__track {
  height: 12px;
  display: flex;
  align-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
}

.spacing-row__bar {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(88, 168, 255, 0.78), rgba(216, 162, 77, 0.78));
}

.palette-grid {
  display: grid;
  gap: 10px;
}

.palette-chip {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.palette-chip__swatch {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.palette-chip strong,
.type-sample__label {
  font-size: 13px;
  font-weight: 600;
}

.type-sample {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.type-sample__preview {
  min-height: 38px;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--oc-border);
  border-radius: 12px;
  background: var(--oc-surface-2);
}

.type-sample__preview--display {
  font-family: 'Segoe UI Variable Display', 'Aptos Display', 'Aptos', sans-serif;
  font-size: 20px;
  letter-spacing: -0.03em;
}

.type-sample__preview--body {
  font-size: 13px;
  line-height: 1.6;
}

.type-sample__preview--code {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1380px) {
  .workbench-shell {
    grid-template-columns: 56px 240px minmax(0, 1fr) 280px;
  }

  .spec-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1120px) {
  .shell-header {
    grid-template-columns: 1fr;
  }

  .shell-actions {
    justify-content: flex-start;
  }

  .workbench-shell {
    grid-template-columns: 56px minmax(0, 1fr);
  }

  .explorer-panel,
  .inspector-panel {
    display: none;
  }

  .workspace-stage {
    grid-template-columns: 1fr;
  }

  .workspace-principles {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .design-prototype {
    padding: 10px;
  }

  .workbench-shell {
    grid-template-columns: 1fr;
  }

  .activity-rail {
    flex-direction: row;
    justify-content: flex-start;
    overflow-x: auto;
  }

  .workspace-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .blueprint-canvas,
  .spec-grid {
    grid-template-columns: 1fr;
  }
}
</style>
