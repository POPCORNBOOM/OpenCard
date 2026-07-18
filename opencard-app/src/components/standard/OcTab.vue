<!-- Standard 标签页：结构化标签切换，支持关闭与键盘导航。 -->
<template>
  <div class="oc-tab-container" :class="{ 'oc-tab-container--fill': fill }">
    <div class="oc-tab-list" role="tablist">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.key"
        :ref="el => setTabRef(index, el)"
        role="tab"
        :aria-selected="tab.key === activeKey"
        :aria-controls="`tabpanel-${tab.key}`"
        class="oc-tab-button"
        :class="{ 'oc-tab-active': tab.key === activeKey }"
        @click="selectTab(tab.key)"
        @keydown="handleKeydown($event, index)"
      >
        <OcIcon
          v-if="tab.icon"
          :name="tab.icon"
          class="oc-tab-icon"
        />
        <OcText class="oc-tab-label">{{ tab.label }}</OcText>
        <button
          v-if="tab.closable"
          class="oc-tab-close"
          @click.stop="closeTab(tab.key)"
          :aria-label="`Close ${tab.label}`"
        >
          ×
        </button>
        <div v-if="tab.dirty" class="oc-tab-dirty-dot" />
      </button>
    </div>
    <div v-if="$slots.panel" class="oc-tab-panel" :id="activeKey ? `tabpanel-${activeKey}` : undefined" role="tabpanel">
      <slot name="panel" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, type ComponentPublicInstance } from 'vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'

defineOptions({ name: 'OcTab' })

interface OcTabItem {
  key: string
  label: string
  icon?: IconToken
  closable?: boolean
  dirty?: boolean
}

interface Props {
  tabs: OcTabItem[]
  activeKey?: string | null
  fill?: boolean
}

interface Emits {
  'update:activeKey': [key: string]
  'select': [key: string]
  'close': [key: string]
}

const props = withDefaults(defineProps<Props>(), {
  activeKey: null,
  fill: false
})

const emit = defineEmits<Emits>()

const tabRefs = ref<(HTMLElement | null)[]>([])

function setTabRef(index: number, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) {
    tabRefs.value[index] = element
    return
  }
  if (element && '$el' in element) {
    const rootElement = element.$el
    tabRefs.value[index] = rootElement instanceof HTMLElement ? rootElement : null
    return
  }
  tabRefs.value[index] = null
}

const selectTab = (key: string) => {
  emit('update:activeKey', key)
  emit('select', key)
}

const closeTab = (key: string) => {
  emit('close', key)
}

const handleKeydown = (event: KeyboardEvent, index: number) => {
  let nextIndex: number | null = null

  switch (event.key) {
    case 'ArrowLeft':
      nextIndex = index > 0 ? index - 1 : props.tabs.length - 1
      event.preventDefault()
      break
    case 'ArrowRight':
      nextIndex = index < props.tabs.length - 1 ? index + 1 : 0
      event.preventDefault()
      break
    case 'Home':
      nextIndex = 0
      event.preventDefault()
      break
    case 'End':
      nextIndex = props.tabs.length - 1
      event.preventDefault()
      break
  }

  if (nextIndex !== null) {
    const nextTab = tabRefs.value[nextIndex]
    if (nextTab) {
      nextTab.focus()
      selectTab(props.tabs[nextIndex].key)
    }
  }
}
</script>

<style scoped>
.oc-tab-container {
  border-bottom: 1px solid var(--oc-border-default);
}

.oc-tab-container--fill {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.oc-tab-list {
  display: flex;
  flex-direction: row;
  gap: 0;
  flex: 0 0 auto;
}

.oc-tab-panel {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

.oc-tab-panel > * {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.oc-tab-button {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  height: var(--oc-size-md);
  padding: 0 var(--oc-space-3);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--oc-fg-muted);
  font: var(--oc-text-sm);
  cursor: pointer;
  transition: color 0.2s ease;
  position: relative;
  white-space: nowrap;
}

.oc-tab-button:hover {
  color: var(--oc-fg-default);
}

.oc-tab-button.oc-tab-active {
  border-bottom-color: var(--oc-accent);
  color: var(--oc-fg-default);
}

.oc-tab-icon {
  flex-shrink: 0;
}

.oc-tab-label {
  flex-shrink: 0;
}

.oc-tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--oc-fg-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: color 0.2s ease;
  flex-shrink: 0;
}

.oc-tab-close:hover {
  color: var(--oc-fg-default);
}

.oc-tab-dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--oc-accent);
  flex-shrink: 0;
}
</style>
