<template>
  <OcFloatingLayer
    :open="open && items.length > 0"
    :anchor="anchor"
    :placement="placement"
    :max-height="maxHeight"
    :z-index="zIndex"
    :match-anchor-width="matchAnchorWidth"
    class="oc-autocomplete-popover"
    role="listbox"
    :id="id"
  >
    <div class="oc-autocomplete-popover__scroll">
      <div
        v-for="item in items"
        :id="getOptionId(item.key)"
        :key="item.key"
        :ref="(element) => setOptionElement(item.key, element)"
        class="oc-autocomplete-popover__option"
        :class="{ 'is-active': item.key === activeKey }"
        role="option"
        :aria-selected="item.key === activeKey"
        @pointerdown.prevent="emit('select', item.key)"
      >
        <span class="oc-autocomplete-popover__main">
          <OcIcon v-if="item.icon" :name="item.icon" size="sm" />
          <span v-else-if="item.thumbnailStyle" class="oc-autocomplete-popover__thumbnail"
            :style="item.thumbnailStyle" role="img" :aria-label="item.thumbnailLabel ?? item.label" />
          <span class="oc-autocomplete-popover__label" :style="item.labelStyle">{{ item.label }}</span>
        </span>
        <span v-if="item.detail" class="oc-autocomplete-popover__detail">{{ item.detail }}</span>
      </div>
    </div>
  </OcFloatingLayer>
</template>

<script setup lang="ts">
import { nextTick, watch, type ComponentPublicInstance } from 'vue'
import type { Placement } from '@floating-ui/vue'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcIcon from '../base/OcIcon.vue'
import OcFloatingLayer from './OcFloatingLayer.vue'

export type OcAutocompleteItem = {
  key: string
  label: string
  detail?: string
  icon?: IconToken
  thumbnailStyle?: Readonly<Record<string, string>>
  thumbnailLabel?: string
  labelStyle?: Readonly<Record<string, string>>
}

const props = withDefaults(defineProps<{
  id: string
  open: boolean
  anchor: HTMLElement | DOMRect | null
  items: readonly OcAutocompleteItem[]
  activeKey: string | null
  placement?: Placement
  maxHeight?: number
  zIndex?: number
  matchAnchorWidth?: boolean
}>(), {
  placement: 'bottom-start',
  maxHeight: 220,
  zIndex: 2000,
  matchAnchorWidth: true,
})

const emit = defineEmits<{
  select: [key: string]
}>()

const optionElements = new Map<string, HTMLElement>()

function getOptionId(key: string): string {
  return `${props.id}-option-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function setOptionElement(key: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) {
    optionElements.set(key, element)
    return
  }

  optionElements.delete(key)
}

watch(
  () => [props.open, props.activeKey, props.items] as const,
  async ([open, activeKey]) => {
    if (!open || !activeKey) return
    await nextTick()
    optionElements.get(activeKey)?.scrollIntoView?.({ block: 'nearest' })
  },
  { deep: true },
)
</script>

<style scoped>
.oc-autocomplete-popover {
  min-width: var(--oc-autocomplete-popover-min-width);
  padding: var(--oc-space-1);
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-surface);
  box-shadow: var(--oc-shadow-lg);
}

.oc-autocomplete-popover__scroll {
  max-height: inherit;
  overflow-y: auto;
}

.oc-autocomplete-popover__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-2);
  min-height: var(--oc-size-md);
  padding: var(--oc-space-1) var(--oc-space-2);
  border-radius: var(--oc-radius-sm);
  color: var(--oc-fg-default);
  cursor: default;
}

.oc-autocomplete-popover__option.is-active,
.oc-autocomplete-popover__option:hover {
  background: var(--oc-bg-active);
}

.oc-autocomplete-popover__main {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
  min-width: 0;
}

.oc-autocomplete-popover__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oc-autocomplete-popover__thumbnail {
  display: inline-block;
  flex: none;
  font-size: var(--oc-size-sm);
  background-repeat: no-repeat;
  vertical-align: text-bottom;
}

.oc-autocomplete-popover__detail {
  flex: 0 0 auto;
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
  white-space: nowrap;
}
</style>
