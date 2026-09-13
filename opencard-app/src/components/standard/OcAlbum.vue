<!-- Standard album view: consumes one key-only node level and emits narrow node events. -->
<template>
  <div
    ref="albumRootElement"
    class="oc-album"
    :class="{
      'is-fill': props.fill,
      'is-empty': entries.length === 0,
      'are-actions-always-visible': props.actionVisibility === 'always',
    }"
    :role="props.selectionMode === 'none' ? 'list' : 'listbox'"
    :aria-multiselectable="props.selectionMode === 'multiple' ? 'true' : undefined"
  >
    <OcText
      v-if="entries.length === 0 && props.placeholder"
      class="oc-album__placeholder"
      tone="muted"
      size="sm"
    >
      {{ props.placeholder }}
    </OcText>
    <div v-else class="oc-album__grid">
      <div
        v-for="entry in entries"
        :key="entry.key"
        class="oc-album__node"
        :data-oc-album-key="entry.key"
      >
        <div
          class="oc-album__card"
          :ref="setCardRef(entry.key)"
          :class="{ 'is-selected': isSelected(entry.key), 'is-disabled': entry.item.disabled }"
          :role="props.selectionMode === 'none' ? 'listitem' : 'option'"
          :aria-selected="props.selectionMode === 'none' ? undefined : isSelected(entry.key)"
          :aria-disabled="entry.item.disabled || undefined"
          :tabindex="activeKey === entry.key && !entry.item.disabled ? 0 : -1"
          :data-tooltip="entry.item.disabledReason"
          @click="handleCardClick($event, entry.key)"
          @auxclick="handleCardAuxClick($event, entry.key)"
          @dblclick="handleCardDoubleClick($event, entry.key)"
          @keydown="handleCardKeydown($event, entry.key)"
          @focus="activeKey = entry.key"
        >
          <span class="oc-album__media">
            <OcVisual
              v-if="resolveCover(entry)"
              class="oc-album__cover"
              :visual="resolveCover(entry)!"
              :label="entry.item.label"
              size="lg"
              @image-error="markCoverBroken(entry)"
            />
          </span>

          <span class="oc-album__info">
            <span class="oc-album__title">
              <OcVisual
                v-if="entry.item.visual"
                :visual="entry.item.visual"
                :label="entry.item.label"
                size="md"
              />
              <OcText
                class="oc-album__label"
                :tone="entry.item.tone"
                :truncate="true"
                :tooltip-on-overflow="entry.item.label"
              >
                {{ entry.item.label }}
              </OcText>
            </span>
            <span class="oc-album__meta">
              <span v-if="entry.item.tail" class="oc-album__tail" data-tooltip-group>
                <template
                  v-for="(part, index) in normalizeNodeTail(entry.item.tail)"
                  :key="tailPartKey(part, index)"
                >
                  <OcText v-if="typeof part === 'string'" tone="muted" size="xs" :truncate="true">{{ part }}</OcText>
                  <span
                    v-else-if="part.type === 'badge'"
                    class="oc-album__tail-badge"
                    role="img"
                    :aria-label="part.label"
                    :data-tooltip="part.label"
                  >
                    <OcIcon :name="part.icon" :tone="part.tone" size="sm" />
                  </span>
                  <span v-else class="oc-album__tail-action">
                    <OcActionButton
                      :action="part"
                      size="sm"
                      variant="ghost"
                      @mousedown.stop
                      @select="emitActionIntent(entry.key, $event.key)"
                    />
                  </span>
                </template>
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import OcActionButton from './OcActionButton.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcVisual from '../base/OcVisual.vue'
import { isNodeTailAction, normalizeNodeTail } from '../../shared/ui/node/node.types'
import type { OcVisual as OcVisualModel } from '../../shared/ui/visual/visual.types'
import type {
  OcNode,
  OcNodeActionEvent,
  OcNodeActivateEvent,
  OcNodeCollection,
  OcNodeKey,
  OcNodeSelectionEvent,
  OcNodeTailPart,
} from '../../shared/ui/node/node.types'

type OcAlbumSelectionMode = 'none' | 'single' | 'multiple'
type OcAlbumActivationMode = 'none' | 'single-click' | 'double-click'

interface OcAlbumProps {
  data: OcNodeCollection
  selectedKeys?: readonly OcNodeKey[]
  selectionMode?: OcAlbumSelectionMode
  activationMode?: OcAlbumActivationMode
  /** Card actions stay hidden until the card is hovered or focused unless set to `always`. */
  actionVisibility?: 'on-interaction' | 'always'
  fill?: boolean
  placeholder?: string
}

type AlbumEntry = {
  key: OcNodeKey
  item: OcNode
}

defineOptions({ name: 'OcAlbum' })

const props = withDefaults(defineProps<OcAlbumProps>(), {
  selectedKeys: () => [],
  selectionMode: 'single',
  activationMode: 'double-click',
  actionVisibility: 'on-interaction',
  fill: false,
  placeholder: '',
})

const emit = defineEmits<{
  'selection-change': [event: OcNodeSelectionEvent]
  'node-activate': [event: OcNodeActivateEvent]
  action: [event: OcNodeActionEvent]
}>()

const albumRootElement = ref<HTMLElement | null>(null)
const cardRefs = new Map<OcNodeKey, HTMLElement>()
const activeKey = ref<OcNodeKey | null>(null)
const selectionAnchorKey = ref<OcNodeKey | null>(null)
/** 已解析失败的封面图片源，让卡片隐藏该图而不是显示破图。 */
const brokenCoverSources = ref<ReadonlyMap<OcNodeKey, string>>(new Map())

/** 卡片媒体区要绘制的封面；图片源加载失败后返回 null，媒体区留空。 */
function resolveCover(entry: AlbumEntry): OcVisualModel | null {
  const cover = entry.item.cover
  if (!cover) return null
  if (cover.type === 'image' && brokenCoverSources.value.get(entry.key) === cover.src) return null
  return cover
}
function markCoverBroken(entry: AlbumEntry): void {
  const cover = entry.item.cover
  if (!cover || cover.type !== 'image' || brokenCoverSources.value.get(entry.key) === cover.src) return
  const next = new Map(brokenCoverSources.value)
  next.set(entry.key, cover.src)
  brokenCoverSources.value = next
}

const selectedKeySet = computed(() => new Set(props.selectedKeys))

/**
 * The album renders exactly the level it is given: `rootKeys` in order.
 * Nesting, rename, drag, and context menus stay with OcTree; cards show their actions inline.
 */
const entries = computed<AlbumEntry[]>(() => props.data.rootKeys.flatMap((key) => {
  const item = props.data.items.get(key)
  return item ? [{ key, item }] : []
}))

function isSelected(key: OcNodeKey): boolean {
  return selectedKeySet.value.has(key)
}

function tailPartKey(part: OcNodeTailPart, index: number): string {
  return typeof part === 'string' ? `text:${index}` : isNodeTailAction(part) ? `action:${part.key}` : `badge:${index}`
}

function setCardRef(key: OcNodeKey): (element: Element | ComponentPublicInstance | null) => void {
  return (element) => {
    if (element instanceof HTMLElement) cardRefs.set(key, element)
    else cardRefs.delete(key)
  }
}

watch(entries, async (nextEntries) => {
  if (activeKey.value && nextEntries.some(entry => entry.key === activeKey.value)) return
  activeKey.value = nextEntries.find(entry => !entry.item.disabled)?.key ?? null
  await nextTick()
}, { immediate: true })

function focusCardFromPointer(key: OcNodeKey): void {
  activeKey.value = key
  cardRefs.get(key)?.focus({ preventScroll: true })
}

function handleCardClick(event: MouseEvent, key: OcNodeKey): void {
  if (props.data.items.get(key)?.disabled) return
  focusCardFromPointer(key)
  emitSelectionIntent(key, event.ctrlKey || event.metaKey, event.shiftKey)
  if (props.activationMode === 'single-click') emit('node-activate', { key })
}

function handleCardAuxClick(event: MouseEvent, key: OcNodeKey): void {
  if (event.button !== 1 || props.data.items.get(key)?.disabled) return
  event.preventDefault()
  emitSelectionIntent(key, event.ctrlKey || event.metaKey, event.shiftKey)
}

function handleCardDoubleClick(event: MouseEvent, key: OcNodeKey): void {
  if (props.data.items.get(key)?.disabled) return
  event.preventDefault()
  if (props.activationMode === 'double-click') emit('node-activate', { key })
}

function emitSelectionIntent(key: OcNodeKey, toggle: boolean, range: boolean): void {
  if (props.selectionMode === 'none') return
  const canRangeSelect = props.selectionMode === 'multiple' && range
  const mode = canRangeSelect
    ? 'range'
    : props.selectionMode === 'multiple' && toggle ? 'toggle' : 'replace'
  let selectedKeys: OcNodeKey[]

  if (mode === 'range') {
    const anchorKey = selectionAnchorKey.value
      && entries.value.some(entry => entry.key === selectionAnchorKey.value)
      ? selectionAnchorKey.value
      : props.selectedKeys[0] ?? key
    const anchorIndex = entries.value.findIndex(entry => entry.key === anchorKey)
    const targetIndex = entries.value.findIndex(entry => entry.key === key)
    const rangeKeys = anchorIndex < 0 || targetIndex < 0
      ? [key]
      : entries.value
        .slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)
        .map(entry => entry.key)
    const selectedSet = new Set(toggle ? [...props.selectedKeys, ...rangeKeys] : rangeKeys)
    selectedKeys = entries.value.filter(entry => selectedSet.has(entry.key)).map(entry => entry.key)
  } else if (mode === 'toggle') {
    selectedKeys = [...props.selectedKeys]
    const index = selectedKeys.indexOf(key)
    if (index >= 0) selectedKeys.splice(index, 1)
    else selectedKeys.push(key)
  } else {
    selectedKeys = [key]
  }

  if (mode !== 'range') selectionAnchorKey.value = key
  emit('selection-change', { triggerKey: key, selectedKeys })
}

function moveActiveCard(key: OcNodeKey, step: number): void {
  const keys = entries.value.filter(entry => !entry.item.disabled).map(entry => entry.key)
  const index = keys.indexOf(key)
  if (index < 0) return
  const nextKey = keys[Math.min(keys.length - 1, Math.max(0, index + step))]
  if (!nextKey) return
  activeKey.value = nextKey
  cardRefs.get(nextKey)?.focus({ preventScroll: true })
}

function handleCardKeydown(event: KeyboardEvent, key: OcNodeKey): void {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    moveActiveCard(key, 1)
    return
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveActiveCard(key, -1)
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emitSelectionIntent(key, event.ctrlKey || event.metaKey, event.shiftKey)
    emit('node-activate', { key })
  }
}

function emitActionIntent(key: OcNodeKey, actionKey: string): void {
  emit('action', { key, actionKey, source: 'inline' })
}
</script>

<style scoped>
.oc-album {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: var(--oc-space-3);
}

.oc-album.is-fill {
  height: 100%;
}

.oc-album__placeholder {
  display: block;
  padding: var(--oc-space-4);
  text-align: center;
}

.oc-album__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--oc-album-card-min-width), 1fr));
  gap: var(--oc-space-3);
}

.oc-album__node {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.oc-album__card {
  position: relative;
  display: block;
  min-width: 0;
  aspect-ratio: var(--oc-album-card-aspect-ratio);
  overflow: hidden;
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-block);
  cursor: pointer;
  transition:
    border-color var(--oc-duration-fast) var(--oc-ease),
    background-color var(--oc-duration-fast) var(--oc-ease);
}

.oc-album__card:hover {
  border-color: var(--oc-border-strong);
}

.oc-album__card:focus-visible {
  outline: none;
  border-color: var(--oc-border-accent);
}

.oc-album__card.is-selected {
  border-color: var(--oc-border-accent);
}

.oc-album__card.is-selected .oc-album__info {
  background: var(--oc-bg-selected);
}

.oc-album__card.is-disabled {
  opacity: var(--oc-opacity-disabled);
  cursor: default;
}

.oc-album__media {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 封面铺满媒体区；图片与精灵图裁剪都按面积适配，图标变体保持自身尺寸。 */
.oc-album__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.oc-album__info {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-1);
  min-width: 0;
  padding: var(--oc-space-1) var(--oc-space-3);
  /* The strip sits on the card's inner bottom corners, so it must round itself: a composited
     backdrop-filter layer can escape the ancestor's overflow clip and paint square corners. */
  border-end-start-radius: calc(var(--oc-radius-md) - var(--oc-border-width));
  border-end-end-radius: calc(var(--oc-radius-md) - var(--oc-border-width));
  background: var(--oc-bg-glass);
  -webkit-backdrop-filter: blur(var(--oc-bg-glass-blur)) saturate(var(--oc-bg-glass-saturate));
  backdrop-filter: blur(var(--oc-bg-glass-blur)) saturate(var(--oc-bg-glass-saturate));
}

.oc-album__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--oc-space-1);
}

.oc-album__label {
  min-width: 0;
}

.oc-album__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--oc-space-1);
  /* Reserve the command height so revealing a command on hover never reflows the card. */
  min-height: var(--oc-size-sm);
}
.oc-album__tail {
  display: inline-flex;
  flex: 0 1 auto;
  min-width: 0;
  align-items: center;
  gap: var(--oc-space-1);
}

.oc-album__tail-badge {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}

.oc-album__tail-action {
  display: none;
  flex: 0 0 auto;
  align-items: center;
}

.oc-album__node:hover .oc-album__tail-action,
.oc-album__card:focus-within .oc-album__tail-action,
.oc-album__card.is-selected .oc-album__tail-action,
.oc-album__tail-action:has(.oc-action-button.is-menu-open),
.oc-album.are-actions-always-visible .oc-album__tail-action {
  display: inline-flex;
}
</style>
