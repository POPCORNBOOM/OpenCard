<!-- Standard 通用列表：统一扁平菜单/列表的键盘行为与选择状态。 -->
<template>
  <div
    ref="listElement"
    class="oc-list"
    :class="[`oc-list--${mode}`, { 'is-fill': props.fill }]"
    :role="resolvedListRole"
    :aria-label="ariaLabel"
    :aria-multiselectable="mode === 'listbox' && multiSelect ? 'true' : undefined"
    @keydown="handleListKeydown"
  >
    <div
      v-for="(item, index) in items"
      :key="item.key"
      class="oc-list__item"
      :class="{
        'is-selected': isSelected(item),
        'is-disabled': Boolean(item.disabled),
      }"
    >
      <button
        type="button"
        class="oc-list__button"
        :class="{
          'is-selected': isSelected(item),
        }"
        :data-oc-list-index="index"
        :data-oc-list-key="item.key"
        :role="resolvedItemRole"
        :disabled="Boolean(item.disabled)"
        :tabindex="resolveTabIndex(index, item)"
        :aria-disabled="item.disabled ? true : undefined"
        :aria-selected="mode === 'listbox' ? isSelected(item) : undefined"
        @click="handleItemClick(item)"
        @focus="handleItemFocus(item, index)"
      >
        <slot
          name="item"
          :item="item"
          :active="isSelected(item)"
        >
          <div class="oc-list__button-main">
            <OcIcon v-if="item.icon" :name="item.icon" size="sm" />
            <span v-else class="oc-list__icon-placeholder" />
            <span class="oc-list__label">{{ item.label }}</span>
          </div>
        </slot>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcIcon from '../base/OcIcon.vue'

export interface OcListItem {
  /** 列表项唯一 key。 */
  key: string
  /** 列表项文案。 */
  label: string
  /** 列表项图标。 */
  icon?: IconToken
  /** 是否禁用当前项。 */
  disabled?: boolean
}

type OcListMode = 'menu' | 'listbox'

interface OcListActionPayload {
  /** 触发的项 key。 */
  key: string
  /** 触发的项实体。 */
  item: OcListItem
}

interface OcListProps {
  /** 列表项数据源。 */
  items: readonly OcListItem[]
  /** 列表语义模式。 */
  mode?: OcListMode
  /** 选中项 key 列表。 */
  selectedKeys?: readonly string[]
  /** listbox 模式下是否支持多选。 */
  multiSelect?: boolean
  /** 列表 aria-label。 */
  ariaLabel?: string
  /** 是否占满父容器。 */
  fill?: boolean
}

interface OcListEmits {
  /** 叶子项被选择时抛出 key。 */
  select: [key: string]
  /** 项动作触发时抛出完整 payload。 */
  action: [payload: OcListActionPayload]
  /** listbox 选中项变化时抛出。 */
  'update:selectedKeys': [value: string[]]
}

defineOptions({ name: 'OcList' })

const props = withDefaults(defineProps<OcListProps>(), {
  mode: 'menu',
  selectedKeys: () => [],
  multiSelect: false,
  ariaLabel: undefined,
  fill: false,
})

const emit = defineEmits<OcListEmits>()

const listElement = ref<HTMLElement | null>(null)
const rovingIndex = ref(-1)

const selectedKeySet = computed(() => new Set(props.selectedKeys))
const resolvedListRole = computed(() => (props.mode === 'menu' ? 'menu' : 'listbox'))
const resolvedItemRole = computed(() => (props.mode === 'menu' ? 'menuitem' : 'option'))

watch(
  () => ({
    itemSignature: props.items.map((item) => `${item.key}:${Boolean(item.disabled)}`).join('|'),
    selectedSignature: props.selectedKeys.join('|'),
  }),
  syncRovingIndex,
  { immediate: true },
)

function isEnabled(item: OcListItem): boolean {
  return !item.disabled
}

function isSelected(item: OcListItem): boolean {
  return selectedKeySet.value.has(item.key)
}

function syncRovingIndex(): void {
  if (props.items.length === 0) {
    rovingIndex.value = -1
    return
  }

  const selectedIndex = props.items.findIndex((item) => isSelected(item) && isEnabled(item))
  if (selectedIndex >= 0) {
    rovingIndex.value = selectedIndex
    return
  }

  if (
    rovingIndex.value >= 0
    && rovingIndex.value < props.items.length
    && isEnabled(props.items[rovingIndex.value])
  ) {
    return
  }

  rovingIndex.value = props.items.findIndex(isEnabled)
}

function resolveTabIndex(index: number, item: OcListItem): number {
  if (!isEnabled(item)) {
    return -1
  }

  if (rovingIndex.value < 0) {
    return index === 0 ? 0 : -1
  }

  return rovingIndex.value === index ? 0 : -1
}

function emitSelection(item: OcListItem): void {
  if (props.mode !== 'listbox') {
    return
  }

  const nextSelectedKeys = props.multiSelect
    ? toggleSelected(item.key)
    : [item.key]

  emit('update:selectedKeys', nextSelectedKeys)
}

function toggleSelected(key: string): string[] {
  const next = [...props.selectedKeys]
  const existingIndex = next.indexOf(key)
  if (existingIndex >= 0) {
    next.splice(existingIndex, 1)
    return next
  }

  next.push(key)
  return next
}

function handleItemClick(item: OcListItem): void {
  if (!isEnabled(item)) {
    return
  }

  emitSelection(item)
  emit('action', { key: item.key, item })
  emit('select', item.key)
}

function handleItemFocus(item: OcListItem, index: number): void {
  if (!isEnabled(item)) {
    return
  }

  rovingIndex.value = index
}

function focusIndex(index: number): void {
  if (!listElement.value) {
    return
  }

  const target = listElement.value.querySelector<HTMLElement>(`[data-oc-list-index="${index}"]`)
  target?.focus()
}

function findNextEnabledIndex(startIndex: number, direction: 1 | -1): number {
  if (props.items.length === 0) {
    return -1
  }

  let index = startIndex
  for (let step = 0; step < props.items.length; step += 1) {
    index = (index + direction + props.items.length) % props.items.length
    const candidate = props.items[index]
    if (candidate && isEnabled(candidate)) {
      return index
    }
  }

  return -1
}

function handleListKeydown(event: KeyboardEvent): void {
  const target = event.target
  const currentTarget = event.currentTarget
  if (!(target instanceof HTMLElement) || !(currentTarget instanceof HTMLElement)) {
    return
  }

  if (!currentTarget.contains(target)) {
    return
  }

  const keyIndex = Number(target.dataset.ocListIndex)
  if (Number.isNaN(keyIndex) || !props.items[keyIndex] || !isEnabled(props.items[keyIndex])) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const nextIndex = findNextEnabledIndex(keyIndex, 1)
    if (nextIndex >= 0) {
      rovingIndex.value = nextIndex
      focusIndex(nextIndex)
    }
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    const nextIndex = findNextEnabledIndex(keyIndex, -1)
    if (nextIndex >= 0) {
      rovingIndex.value = nextIndex
      focusIndex(nextIndex)
    }
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    const nextIndex = props.items.findIndex(isEnabled)
    if (nextIndex >= 0) {
      rovingIndex.value = nextIndex
      focusIndex(nextIndex)
    }
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    const nextIndex = findNextEnabledIndex(0, -1)
    if (nextIndex >= 0) {
      rovingIndex.value = nextIndex
      focusIndex(nextIndex)
    }
    return
  }

  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    const item = props.items[keyIndex]
    if (item) {
      handleItemClick(item)
    }
  }
}
</script>

<style scoped>
.oc-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.oc-list.is-fill {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.oc-list__item {
  position: relative;
}

.oc-list__button {
  width: 100%;
  min-height: 24px;
  padding: 0 var(--oc-space-2);
  border: 0;
  border-radius: var(--oc-radius-sm);
  color: var(--oc-text-primary);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-2);
  text-align: left;
  cursor: pointer;
}

.oc-list__button:hover,
.oc-list__item:hover > .oc-list__button,
.oc-list__button:focus-visible {
  background: var(--oc-bg-active);
  outline: none;
}

.oc-list__item.is-selected > .oc-list__button,
.oc-list__button.is-selected {
  background: var(--oc-bg-selected);
}

.oc-list__item.is-disabled > .oc-list__button,
.oc-list__button:disabled {
  color: var(--oc-text-disabled);
  cursor: default;
}

.oc-list__item.is-disabled > .oc-list__button:hover,
.oc-list__item.is-disabled > .oc-list__button:focus-visible {
  background: transparent;
}

.oc-list__button-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.oc-list__icon-placeholder {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.oc-list__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>

