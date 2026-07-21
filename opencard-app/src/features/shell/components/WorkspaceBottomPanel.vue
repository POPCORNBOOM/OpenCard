<template>
  <section class="workspace-bottom-panel" :class="{ 'is-expanded': expanded }">
    <button
      class="workspace-bottom-panel__toggle"
      type="button"
      :aria-expanded="expanded"
      :aria-label="expanded ? collapseLabel : expandLabel"
      :data-tooltip="expanded ? collapseLabel : expandLabel"
      @click="emit('toggle')"
    >
      <OcIcon :name="expanded ? 'nav.chevron-down' : 'nav.chevron-up'" size="sm" />
    </button>

    <div
      class="workspace-bottom-panel__content"
      :aria-hidden="!expanded"
      :inert="!expanded || undefined"
    >
      <div class="workspace-bottom-panel__tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :id="`workspace-bottom-tab-${tab.key}`"
          :key="tab.key"
          class="workspace-bottom-panel__tab"
          :class="{ 'is-active': activeTab === tab.key }"
          type="button"
          role="tab"
          :aria-controls="`workspace-bottom-tabpanel-${tab.key}`"
          :aria-selected="activeTab === tab.key"
          :tabindex="activeTab === tab.key ? 0 : -1"
          @click="emit('tab-change', tab.key)"
          @keydown="handleTabKeydown($event, tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span v-if="tab.key === 'problems' && problemCount > 0" class="workspace-bottom-panel__count">
            {{ problemCount }}
          </span>
        </button>
      </div>

      <div
        v-show="activeTab === 'problems'"
        id="workspace-bottom-tabpanel-problems"
        class="workspace-bottom-panel__tabpanel"
        role="tabpanel"
        aria-labelledby="workspace-bottom-tab-problems"
      >
        <OcTree
          v-if="problemTreeData.rootKeys.length > 0"
          :data="problemTreeData"
          :expanded-keys="expandedProblemKeys"
          activation-mode="double-click"
          selection-mode="none"
          fill
          @intent="emit('problem-tree-intent', $event)"
        />
        <div v-else class="workspace-bottom-panel__empty">{{ problemEmptyLabel }}</div>
      </div>

      <div
        v-show="activeTab === 'output'"
        id="workspace-bottom-tabpanel-output"
        class="workspace-bottom-panel__tabpanel workspace-bottom-panel__output"
        role="tabpanel"
        aria-labelledby="workspace-bottom-tab-output"
      >
        <div v-if="outputLines.length === 0" class="workspace-bottom-panel__empty">
          {{ outputEmptyLabel }}
        </div>
        <div v-else class="workspace-bottom-panel__output-lines">
          <div v-for="(line, index) in outputLines" :key="index" class="workspace-bottom-panel__output-line">
            {{ line }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData, OcTreeIntent } from '../../../shared/ui/tree/tree.types'

export type WorkspaceBottomTab = 'problems' | 'output'

const props = defineProps<{
  expanded: boolean
  activeTab: WorkspaceBottomTab
  problemCount: number
  problemTreeData: OcTreeData
  expandedProblemKeys: readonly string[]
  outputLines: readonly string[]
  problemsLabel: string
  outputLabel: string
  problemEmptyLabel: string
  outputEmptyLabel: string
  expandLabel: string
  collapseLabel: string
}>()

const emit = defineEmits<{
  toggle: []
  'tab-change': [tab: WorkspaceBottomTab]
  'problem-tree-intent': [intent: OcTreeIntent]
}>()

const tabs = computed<readonly { key: WorkspaceBottomTab; label: string }[]>(() => [
  { key: 'problems', label: props.problemsLabel },
  { key: 'output', label: props.outputLabel },
])

function handleTabKeydown(event: KeyboardEvent, currentTab: WorkspaceBottomTab): void {
  let nextTab: WorkspaceBottomTab | null = null
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    nextTab = currentTab === 'problems' ? 'output' : 'problems'
  } else if (event.key === 'Home') {
    nextTab = 'problems'
  } else if (event.key === 'End') {
    nextTab = 'output'
  }

  if (!nextTab) return
  event.preventDefault()
  emit('tab-change', nextTab)
}
</script>

<style scoped>
.workspace-bottom-panel {
  position: relative;
  min-width: 0;
  border-top: 1px solid var(--oc-border-muted, #333333);
  background: var(--color-workspace);
}

.workspace-bottom-panel__toggle {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 2;
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--oc-border-default, #3a3d41);
  border-radius: 50%;
  background: var(--color-workspace);
  color: var(--color-text-muted);
  box-shadow: var(--oc-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.18));
  transform: translate(-50%, -50%);
  transition:
    border-color var(--oc-duration-fast, 100ms) var(--oc-ease, ease),
    background-color var(--oc-duration-fast, 100ms) var(--oc-ease, ease),
    color var(--oc-duration-fast, 100ms) var(--oc-ease, ease);
}

.workspace-bottom-panel__toggle:hover,
.workspace-bottom-panel__toggle:focus-visible {
  border-color: var(--oc-border-accent, #7c6cff);
  background: var(--oc-bg-raised, #2d2d2d);
  color: var(--oc-fg-accent, #b8b0ff);
  outline: none;
}

.workspace-bottom-panel__content {
  height: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  background: var(--oc-bg-base, #1e1e1e);
  transition: height var(--oc-duration-normal, 150ms) var(--oc-ease, ease);
}

.workspace-bottom-panel.is-expanded .workspace-bottom-panel__content {
  height: var(--oc-list-max-height-md, 180px);
}

.workspace-bottom-panel__tabs {
  min-height: 30px;
  display: flex;
  align-items: stretch;
  gap: var(--oc-space-1, 4px);
  padding: 0 var(--oc-space-3, 8px);
  border-bottom: 1px solid var(--oc-border-muted, #333333);
}

.workspace-bottom-panel__tab {
  position: relative;
  min-width: 72px;
  padding: 0 var(--oc-space-3, 8px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-1, 4px);
  border: 0;
  background: transparent;
  color: var(--oc-fg-muted, #a5a5a5);
  font: inherit;
  font-size: var(--oc-text-sm, 11px);
}

.workspace-bottom-panel__tab::after {
  content: '';
  position: absolute;
  right: var(--oc-space-2, 6px);
  bottom: 0;
  left: var(--oc-space-2, 6px);
  height: 2px;
  background: transparent;
}

.workspace-bottom-panel__tab:hover,
.workspace-bottom-panel__tab:focus-visible,
.workspace-bottom-panel__tab.is-active {
  color: var(--oc-fg-default, #f0f0f0);
  outline: none;
}

.workspace-bottom-panel__tab.is-active::after {
  background: var(--oc-border-accent, #7c6cff);
}

.workspace-bottom-panel__count {
  min-width: 16px;
  height: 16px;
  padding: 0 var(--oc-space-1, 4px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--oc-radius-sm, 3px);
  background: var(--oc-bg-raised, #2d2d2d);
  color: var(--oc-icon-warning, #d29922);
  font-size: var(--oc-text-xs, 10px);
  line-height: 1;
}

.workspace-bottom-panel__tabpanel {
  min-height: 0;
  padding: var(--oc-space-2, 6px) var(--oc-space-3, 8px);
  overflow: auto;
}

.workspace-bottom-panel__empty {
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--oc-fg-subtle, #777777);
  font-size: var(--oc-text-sm, 11px);
}

.workspace-bottom-panel__output-lines {
  font-family: var(--oc-font-mono, Consolas, monospace);
  font-size: var(--oc-text-sm, 11px);
  color: var(--oc-fg-muted, #a5a5a5);
}

.workspace-bottom-panel__output-line {
  min-height: 20px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
