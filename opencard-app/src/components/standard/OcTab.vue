<!-- Standard IDE 标签布局：提供结构化 tabs、内置标签渲染与面板切换容器。 -->
<template>
  <section class="oc-tab" :class="{ 'is-fill': props.fill }">
    <OcPanel
      v-if="tabs.length > 0"
      padding="none"
      border="none"
      orientation="horizontal"
      horizontal-alignment="start"
      vertical-alignment="stretch"
      overflow-x="auto"
      overflow-y="clip"
      role="tablist"
      aria-orientation="horizontal"
      :aria-label="ariaLabel"
      @keydown="handleBarKeydown"
    >
      <OcPanel min-width="size-xl" v-for="tab in tabs" :key="tab.key" :hoverable="isEnabled(tab)"
        :tone="resolveTabPanelTone(tab)" :border="isActive(tab) ? 'accent' : 'soft'" radius="none" elevation="none"
        padding="none" overflow-x="clip" overflow-y="clip" :data-oc-tab-disabled="tab.disabled ? 'true' : undefined">
        <OcBar :icon="tab.icon" :title="tab.label" :data-oc-tab-key="tab.key" role="tab"
          :tabindex="resolveTabIndex(tab)" :aria-selected="isActive(tab) ? 'true' : 'false'"
          :aria-disabled="tab.disabled ? 'true' : undefined" @click="handleTabClick(tab)">
          <template v-if="tab.dirty" #append>
            <span class="oc-tab__tab-dirty-mark" aria-hidden="true">
              <span class="oc-tab__tab-dirty-dot" />
            </span>
          </template>
          <template v-if="isClosable(tab) && isEnabled(tab)" #append-hover>
            <OcButton variant="ghost" size="sm" radius="sm" icon="action.close" icon-only
              :aria-label="`Close ${tab.label}`" tabindex="-1" data-oc-tab-close @click.stop="handleTabClose(tab)" />
          </template>
        </OcBar>
      </OcPanel>
    </OcPanel>

    <OcPanel v-if="$slots.panel" fill grow padding="none" border="none">
      <slot name="panel" :active-key="activeKey" :active-tab="activeTab" />
    </OcPanel>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcBar from '../base/OcBar.vue'
import OcButton from '../base/OcButton.vue'
import OcPanel from '../base/OcPanel.vue'

export interface OcTabItem {
  /** 标签唯一 key。 */
  key: string
  /** 标签展示文案。 */
  label: string
  /** 标签图标。 */
  icon?: IconToken
  /** 标签 hover title。 */
  title?: string
  /** 是否禁用标签。 */
  disabled?: boolean
  /** 是否显示脏标记。 */
  dirty?: boolean
  /** 是否允许关闭。 */
  closable?: boolean
}

interface OcTabProps {
  /** 标签数据列表。 */
  tabs: readonly OcTabItem[]
  /** 当前激活标签 key。 */
  activeKey: string | null
  /** tablist 的 aria-label。 */
  ariaLabel?: string
  /** 是否占满父容器。 */
  fill?: boolean
}

interface OcTabEmits {
  /** 请求切换激活标签。 */
  'update:activeKey': [value: string]
  /** 标签被选中时抛出。 */
  select: [key: string]
  /** 标签关闭按钮被触发时抛出。 */
  close: [payload: { key: string }]
}

defineOptions({ name: 'OcTab' })

const props = withDefaults(defineProps<OcTabProps>(), {
  ariaLabel: undefined,
  fill: false,
})

const emit = defineEmits<OcTabEmits>()

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

function resolveTabPanelTone(tab: OcTabItem): 'base' | 'transparent' {
  return isActive(tab) ? 'base' : 'transparent'
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
.oc-tab {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.oc-tab.is-fill {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
}

.oc-tab > :deep(.oc-panel[role='tablist']) {
  min-height: 33px;
  background: var(--oc-bg-elevated);
}

.oc-tab > :deep(.oc-panel[role='tablist'] > .oc-panel) {
  flex: 0 0 auto;
  max-width: 320px;
  cursor: pointer;
}

.oc-tab > :deep(.oc-panel[role='tablist'] .oc-bar) {
  --oc-bar-min-height: 32px;
  --oc-bar-inline-padding: var(--oc-padding-standard);
}

.oc-tab > :deep(.oc-panel[role='tablist'] .oc-bar[aria-disabled='true']) {
  --oc-bar-fg: var(--oc-text-disabled);
  opacity: 0.75;
}

.oc-tab > :deep(.oc-panel[role='tablist'] .oc-panel[data-oc-tab-disabled='true']) {
  cursor: default;
}

.oc-tab__tab-dirty-mark {
  width: var(--oc-block-sm);
  height: var(--oc-block-sm);
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.oc-tab__tab-dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--oc-radius-pill);
  background: var(--oc-accent);
  box-shadow: 0 0 0 1px var(--oc-bg-elevated);
}
</style>
