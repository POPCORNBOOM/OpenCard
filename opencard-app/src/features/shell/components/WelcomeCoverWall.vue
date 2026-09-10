<!-- 业务 欢迎页封面墙：带透视的模糊瓦片网格朝右上角缓慢流动，只作背景、不参与任何交互。 -->
<template>
  <div
    ref="wallElement"
    class="welcome-cover-wall"
    :class="{ 'is-running': running }"
    aria-hidden="true"
  >
    <div class="welcome-cover-wall__view">
      <div class="welcome-cover-wall__plane" :style="planeStyle">
        <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="welcome-cover-wall__row">
          <template v-for="copyIndex in copies" :key="copyIndex">
            <span
              v-for="tile in row"
              :key="`${copyIndex}-${tile.key}`"
              class="welcome-cover-wall__tile"
              :class="{ 'is-emphasized': isHighlighted(tile) }"
            >
              <img :src="tile.src" alt="" loading="lazy" decoding="async" draggable="false" />
            </span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue'
import { WELCOME_COVER_ARTWORK } from '../welcomeCoverArtwork'

export type WelcomeCoverWallCover = {
  /** 项目 Key，用于与侧栏选中项比对。 */
  readonly projectKey: string
  readonly src: string
}

type WelcomeCoverWallTile = {
  /** 同一行内唯一的瓦片键。 */
  readonly key: string
  readonly src: string
  readonly projectKey?: string
}

const props = withDefaults(defineProps<{
  /** 最近打开项目中有封面的项目；没有时全部使用内置桌游封面。 */
  covers?: readonly WelcomeCoverWallCover[]
  /** 侧栏“最近打开的项目”里选中的项目 Key；对应的封面会放大突出。 */
  highlightKeys?: readonly string[]
}>(), {
  covers: () => [],
  highlightKeys: () => [],
})

defineOptions({ name: 'WelcomeCoverWall' })

/**
 * 每行瓦片数与行样式的循环周期。
 * 行变体越多、每行越长，整面墙重复得越晚（横向周期 ≥ 一行宽度，纵向周期 = 行变体数行）。
 */
const TILES_PER_ROW = 10
const ROW_VARIANTS = 5
const MAX_ROW_COUNT = 20

/** 固定种子的伪随机数，保证同一批内容在任意次渲染中排布一致。 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let result = Math.imul(state ^ (state >>> 15), 1 | state)
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function hashText(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const wallElement = ref<HTMLElement | null>(null)
const wallWidth = ref(0)
const wallHeight = ref(0)
const tileAdvance = ref(0)
const rowPitch = ref(0)
const documentVisible = ref(true)
const inViewport = ref(true)
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null

/** 项目封面优先，其余用内置桌游封面补足。 */
const contentPool = computed<readonly WelcomeCoverWallTile[]>(() => [
  ...props.covers.map(cover => ({
    key: `project:${cover.projectKey}`,
    src: cover.src,
    projectKey: cover.projectKey,
  })),
  ...WELCOME_COVER_ARTWORK.map(artwork => ({
    key: `artwork:${artwork.key}`,
    src: artwork.src,
  })),
])

const highlightedKeys = computed(() => new Set(props.highlightKeys))

const layoutSeed = computed(() => hashText(contentPool.value.map(entry => entry.key).join('|')))

function wrapIndex(value: number, size: number): number {
  return ((value % size) + size) % size
}

/**
 * 一个周期的瓦片图案：逐格随机取图，并保证任何一格与它周围八格都不是同一张图。
 * 图案按 TILES_PER_ROW × ROW_VARIANTS 周期性铺满整面墙，因此也按环绕位置校验边界。
 */
function buildPattern(): readonly (readonly WelcomeCoverWallTile[])[] {
  const pool = contentPool.value
  const random = createSeededRandom(layoutSeed.value)
  const pattern: (WelcomeCoverWallTile | null)[][] = Array.from(
    { length: ROW_VARIANTS },
    () => Array.from({ length: TILES_PER_ROW }, () => null),
  )

  const sourceAt = (row: number, column: number): string | null => (
    pattern[wrapIndex(row, ROW_VARIANTS)]![wrapIndex(column, TILES_PER_ROW)]?.src ?? null
  )
  const neighbours = (row: number, column: number): (string | null)[] => {
    const sources: (string | null)[] = []
    for (const rowOffset of [-1, 0, 1]) {
      for (const columnOffset of [-1, 0, 1]) {
        if (rowOffset === 0 && columnOffset === 0) continue
        sources.push(sourceAt(row + rowOffset, column + columnOffset))
      }
    }
    return sources
  }
  const pick = (row: number, column: number): WelcomeCoverWallTile => {
    const taken = new Set(neighbours(row, column).filter((src): src is string => Boolean(src)))
    const allowed = pool.filter(entry => !taken.has(entry.src))
    const candidates = allowed.length > 0 ? allowed : pool
    const entry = candidates[Math.floor(random() * candidates.length)]!
    return {
      key: `tile-${row}-${column}`,
      src: entry.src,
      ...(entry.projectKey ? { projectKey: entry.projectKey } : {}),
    }
  }

  // 行优先填一遍：每格只避开已经放好的邻居。
  for (let row = 0; row < ROW_VARIANTS; row += 1) {
    for (let column = 0; column < TILES_PER_ROW; column += 1) {
      pattern[row]![column] = pick(row, column)
    }
  }
  // 再修补环绕处的冲突（行首/列首与上一行、上一列的相邻关系）。
  for (let pass = 0; pass < 4; pass += 1) {
    let repaired = false
    for (let row = 0; row < ROW_VARIANTS; row += 1) {
      for (let column = 0; column < TILES_PER_ROW; column += 1) {
        const current = pattern[row]![column]!
        if (!neighbours(row, column).includes(current.src)) continue
        pattern[row]![column] = pick(row, column)
        repaired = true
      }
    }
    if (!repaired) break
  }
  return pattern as readonly (readonly WelcomeCoverWallTile[])[]
}

/** 整面墙以这个图案为周期循环，横向每周 TILES_PER_ROW 格、纵向每周 ROW_VARIANTS 行。 */
const patternRows = computed(buildPattern)

const rowCount = computed(() => {
  const pitch = rowPitch.value
  if (!pitch || wallHeight.value === 0) return ROW_VARIANTS * 2
  return Math.min(MAX_ROW_COUNT, Math.ceil(wallHeight.value / pitch) + ROW_VARIANTS)
})

const rows = computed(() => (
  Array.from({ length: rowCount.value }, (_, index) => patternRows.value[index % ROW_VARIANTS]!)
))

const copies = computed(() => {
  const copyWidth = TILES_PER_ROW * tileAdvance.value
  if (!copyWidth || wallWidth.value === 0) return 2
  return Math.ceil(wallWidth.value / copyWidth) + 1
})

/** 平面从一个周期的左上方开始，向右上角流动一个周期后正好回到同样的图案。 */
const planeStyle = computed<CSSProperties>(() => {
  const copyWidth = TILES_PER_ROW * tileAdvance.value
  return {
    left: `-${copyWidth}px`,
    '--welcome-cover-wall-copy-width': `${copyWidth}px`,
    '--welcome-cover-wall-period-height': `${ROW_VARIANTS * rowPitch.value}px`,
  }
})

const running = computed(() => documentVisible.value && inViewport.value)

function isHighlighted(tile: WelcomeCoverWallTile): boolean {
  return Boolean(tile.projectKey) && highlightedKeys.value.has(tile.projectKey!)
}

function handleVisibilityChange(): void {
  documentVisible.value = !document.hidden
}

/** 瓦片与行距都来自 foundation token，因此按已渲染尺寸测量而不是重复字面量。 */
function measure(): void {
  const wall = wallElement.value
  if (!wall) return
  wallWidth.value = wall.clientWidth
  wallHeight.value = wall.clientHeight
  const tile = wall.querySelector('.welcome-cover-wall__tile')
  const nextTile = tile?.nextElementSibling
  if (tile instanceof HTMLElement && nextTile instanceof HTMLElement) {
    const advance = nextTile.offsetLeft - tile.offsetLeft
    if (advance > 0) tileAdvance.value = advance
  }
  const row = wall.querySelector('.welcome-cover-wall__row')
  const nextRow = row?.nextElementSibling
  if (row instanceof HTMLElement && nextRow instanceof HTMLElement) {
    const pitch = nextRow.offsetTop - row.offsetTop
    if (pitch > 0) rowPitch.value = pitch
  }
}

onMounted(() => {
  handleVisibilityChange()
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (typeof ResizeObserver !== 'undefined' && wallElement.value) {
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(wallElement.value)
  }
  if (typeof IntersectionObserver !== 'undefined' && wallElement.value) {
    intersectionObserver = new IntersectionObserver(entries => {
      inViewport.value = entries[0]?.isIntersecting ?? true
    })
    intersectionObserver.observe(wallElement.value)
  }
  measure()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
})
</script>

<style scoped>
.welcome-cover-wall {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  perspective: var(--oc-welcome-cover-wall-perspective);
}

/* 整面墙做一点 3D 倾斜，形成向右上角收进去的透视。 */
.welcome-cover-wall__view {
  width: 100%;
  height: 100%;
  transform:
    rotateX(var(--oc-welcome-cover-wall-rotate-x))
    rotateY(var(--oc-welcome-cover-wall-rotate-y))
    scale(var(--oc-welcome-cover-wall-scale));
}

.welcome-cover-wall__plane {
  position: absolute;
  top: 0;
  display: grid;
  gap: var(--oc-welcome-cover-tile-gap);
}

.welcome-cover-wall.is-running .welcome-cover-wall__plane {
  animation: welcome-cover-wall-drift var(--oc-welcome-cover-wall-duration) linear infinite;
}

.welcome-cover-wall__row {
  display: flex;
  gap: var(--oc-welcome-cover-tile-gap);
}

.welcome-cover-wall__tile {
  position: relative;
  flex: 0 0 auto;
  width: var(--oc-welcome-cover-tile-width);
  aspect-ratio: var(--oc-welcome-cover-tile-aspect-ratio);
  overflow: hidden;
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
  filter: blur(var(--oc-welcome-cover-wall-blur));
  opacity: var(--oc-welcome-cover-wall-opacity);
  transition:
    opacity var(--oc-duration-normal) var(--oc-ease),
    transform var(--oc-duration-normal) var(--oc-ease),
    box-shadow var(--oc-duration-normal) var(--oc-ease),
    filter var(--oc-duration-normal) var(--oc-ease);
}

.welcome-cover-wall__tile img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 侧栏选中的项目封面：放大并去掉模糊，与其余瓦片形成对比。 */
.welcome-cover-wall__tile.is-emphasized {
  z-index: 1;
  filter: none;
  opacity: var(--oc-welcome-cover-tile-emphasis-opacity);
  box-shadow: var(--oc-shadow-lg);
  transform: scale(var(--oc-welcome-cover-tile-emphasis-scale));
}

@keyframes welcome-cover-wall-drift {
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    transform: translate3d(
      var(--welcome-cover-wall-copy-width),
      calc(var(--welcome-cover-wall-period-height) * -1),
      0
    );
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-cover-wall.is-running .welcome-cover-wall__plane {
    animation: none;
  }

  .welcome-cover-wall__tile {
    transition: none;
  }
}
</style>
