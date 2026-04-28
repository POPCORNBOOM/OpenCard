<!-- Standard IDE 标签布局：提供结构化 tabs、内置标签渲染与面板切换容器。 -->
<template>
  <section class="oc-tab-layout" :class="{ 'is-fill': props.fill }">
    <div v-if="tabs.length > 0" class="oc-tab-layout__bar" role="tablist" aria-orientation="horizontal"
      :aria-label="ariaLabel" @keydown="handleBarKeydown">
      <OcPanel v-for="tab in tabs" :key="tab.key" class="oc-tab-layout__tab" :class="{
        'is-active': isActive(tab),
        'is-disabled': Boolean(tab.disabled),
      }" radius="none" tone="panel" border="none" padding="none" orientation="horizontal"
        horizontal-alignment="start" vertical-alignment="center" :data-oc-tab-key="tab.key" role="tab"
        :tabindex="resolveTabIndex(tab)"
        :aria-selected="isActive(tab) ? 'true' : 'false'" :aria-disabled="tab.disabled ? 'true' : undefined"
        :title="tab.title ?? tab.label" @click="handleTabClick(tab)">
        <span class="oc-tab-layout__tab-main">
          <OcIcon v-if="tab.icon" class="oc-tab-layout__tab-icon" :name="tab.icon" size="sm" />
          <span v-if="tab.dirty" class="oc-tab-layout__tab-dirty-dot" aria-hidden="true" />
          <OcText>{{ tab.label }}</OcText>
        </span>
        <OcButton v-if="isClosable(tab) && isEnabled(tab)" class="oc-tab-layout__tab-close" variant="ghost" size="sm"
          radius="sm" icon="icon.close" icon-only :aria-label="`Close ${tab.label}`" tabindex="-1" data-oc-tab-close
          @click.stop="handleTabClose(tab)" />
      </OcPanel>
    </div>

    <div v-if="$slots.panel" class="oc-tab-layout__panel">
      <slot name="panel" :active-key="activeKey" :active-tab="activeTab" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IconResolvable } from '../../shared/ui/icon/iconRegistry'
import OcButton from '../base/OcButton.vue'
import OcIcon from '../base/OcIcon.vue'
import OcPanel from '../base/OcPanel.vue'
import OcText from '../base/OcText.vue'

export interface OcTabItem {
  /** 标签唯一 key。 */
  key: string
  /** 标签展示文案。 */
  label: string
  /** 标签图标。 */
  icon?: IconResolvable
  /** 标签 hover title。 */
  title?: string
  /** 是否禁用标签。 */
  disabled?: boolean
  /** 是否显示脏标记。 */
  dirty?: boolean
  /** 是否允许关闭。 */
  closable?: boolean
}

interface OcTabLayoutProps {
  /** 标签数据列表。 */
  tabs: readonly OcTabItem[]
  /** 当前激活标签 key。 */
  activeKey: string | null
  /** tablist 的 aria-label。 */
  ariaLabel?: string
  /** 是否占满父容器。 */
  fill?: boolean
}

interface OcTabLayoutEmits {
  /** 请求切换激活标签。 */
  'update:activeKey': [value: string]
  /** 标签被选中时抛出。 */
  select: [key: string]
  /** 标签关闭按钮被触发时抛出。 */
  close: [payload: { key: string }]
}

defineOptions({ name: 'OcTabLayout' })

const props = withDefaults(defineProps<OcTabLayoutProps>(), {
  ariaLabel: undefined,
  fill: false,
})

const emit = defineEmits<OcTabLayoutEmits>()

const activeTab = computed(() =>
  props.tabs.find((tab) => tab.key === props.activeKey) ?? null,
)

function isActive(tab: OcTabItem): boolean {
  return props.activeKey === tab.key
}

function isEnabled(tab: OcTabItem): boolean {
  return !tab.disabled
}

function isClosable(tab: OcTabItem): boolean {
  return tab.closable !== false
}

function resolveFirstEnabledTabKey(): string | null {
  const first = props.tabs.find(isEnabled)
  return first?.key ?? null
}

function resolveTabIndex(tab: OcTabItem): number {
  if (!isEnabled(tab)) {
    return -1
  }

  if (isActive(tab)) {
    return 0
  }

  const fallbackKey = resolveFirstEnabledTabKey()
  return fallbackKey === tab.key ? 0 : -1
}

function selectTabByKey(key: string): void {
  const tab = props.tabs.find((candidate) => candidate.key === key)
  if (!tab || !isEnabled(tab)) {
    return
  }

  emit('update:activeKey', key)
  emit('select', key)
}

function handleTabClick(tab: OcTabItem): void {
  if (!isEnabled(tab)) {
    return
  }

  selectTabByKey(tab.key)
}

function handleTabClose(tab: OcTabItem): void {
  if (!isEnabled(tab) || !isClosable(tab)) {
    return
  }

  emit('close', { key: tab.key })
}

function focusTabByKey(container: HTMLElement, key: string): void {
  const target = container.querySelector<HTMLElement>(`[data-oc-tab-key="${key}"]`)
  target?.focus()
  if (typeof target?.scrollIntoView === 'function') {
    target.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }
}

function handleBarKeydown(event: KeyboardEvent): void {
  const target = event.target
  const currentTarget = event.currentTarget
  if (!(target instanceof HTMLElement) || !(currentTarget instanceof HTMLElement)) {
    return
  }

  if (target.closest('[data-oc-tab-close]')) {
    return
  }

  const currentTab = target.closest<HTMLElement>('[data-oc-tab-key]')
  if (!currentTab || currentTab.getAttribute('aria-disabled') === 'true') {
    return
  }

  const enabledTabs = props.tabs.filter(isEnabled)
  if (enabledTabs.length === 0) {
    return
  }

  const currentKey = currentTab.dataset.ocTabKey
  if (!currentKey) {
    return
  }

  const currentIndex = enabledTabs.findIndex((tab) => tab.key === currentKey)
  if (currentIndex < 0) {
    return
  }

  let nextIndex = currentIndex
  if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % enabledTabs.length
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = enabledTabs.length - 1
  } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    selectTabByKey(currentKey)
    return
  } else {
    return
  }

  event.preventDefault()
  const nextTab = enabledTabs[nextIndex]
  selectTabByKey(nextTab.key)
  focusTabByKey(currentTarget, nextTab.key)
}
</script>

<style scoped>
.oc-tab-layout {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.oc-tab-layout.is-fill {
  width: 100%;
  height: 100%;
}

.oc-tab-layout__bar {
  display: flex;
  align-items: stretch;
  min-width: 0;
  min-height: 33px;
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--oc-bg-elevated);
  border-bottom: 1px solid var(--oc-border-strong);
  scrollbar-width: thin;
}

.oc-tab-layout__bar::-webkit-scrollbar {
  height: 8px;
}

.oc-tab-layout__bar::-webkit-scrollbar-thumb {
  background: var(--oc-border-strong);
  border-radius: var(--oc-radius-pill);
}

.oc-tab-layout__bar::-webkit-scrollbar-track {
  background: transparent;
}

.oc-tab-layout__tab {
  min-width: 0;
  max-width: 240px;
  min-height: 32px;
  padding: 0 var(--oc-space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-2);
  color: var(--oc-text-secondary);
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    border-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-tab-layout__tab:hover {
  background: var(--oc-bg-hover);
  color: var(--oc-text-primary);
}

.oc-tab-layout__tab:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: -2px;
  position: relative;
  z-index: 1;
}

.oc-tab-layout__tab.is-active {
  background: var(--oc-bg-base);
  color: var(--oc-text-primary);
  border-bottom-color: var(--oc-bg-base);
}

.oc-tab-layout__tab.is-disabled {
  color: var(--oc-text-disabled);
  cursor: default;
  background: var(--oc-bg-elevated);
}

.oc-tab-layout__tab-main {
  min-width: 0;
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.oc-tab-layout__tab-icon {
  color: inherit;
}

.oc-tab-layout__tab-dirty-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: var(--oc-radius-pill);
  background: var(--oc-bg-accent);
}

.oc-tab-layout__tab:hover .oc-tab-layout__tab-close,
.oc-tab-layout__tab.is-active .oc-tab-layout__tab-close {
  opacity: 1;
}

.oc-tab-layout__panel {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
}

.oc-tab-layout__panel> :deep(*) {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
