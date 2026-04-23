<template>
  <component
    :is="as"
    class="oc-axis-layout"
    :class="[
      `oc-axis-layout--${axis}`,
      `oc-axis-layout--spacing-${props.spacing}`,
      {
        'is-fill': props.fill,
        'is-non-interactive': !props.interactive,
      },
    ]"
    :style="layoutStyle"
  >
    <div
      v-for="region in resolvedRegions"
      :key="region.key"
      class="oc-axis-layout__region"
      :class="region.semanticClass"
      :data-slot="region.slot"
      :style="getRegionStyle(region)"
    >
      <slot :name="region.slot" />
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

type Axis = 'horizontal' | 'vertical'
type AxisLayoutSpacing = 'none' | 'tight' | 'normal' | 'loose'
type AxisRegionTrack =
  | 'auto'
  | 'fill'
  | 'fill-2'
  | 'fill-3'
  | 'size-xs'
  | 'size-sm'
  | 'size-md'
  | 'size-lg'
  | 'size-xl'
  | 'size-2xl'
  | 'sidebar'
  | 'panel'
  | 'inspector'

const AXIS_REGION_TRACK_MAP: Record<AxisRegionTrack, string> = {
  auto: 'auto',
  fill: 'minmax(0, 1fr)',
  'fill-2': 'minmax(0, 2fr)',
  'fill-3': 'minmax(0, 3fr)',
  'size-xs': '36px',
  'size-sm': '48px',
  'size-md': '72px',
  'size-lg': '96px',
  'size-xl': '120px',
  'size-2xl': '160px',
  sidebar: 'var(--oc-axis-layout-track-sidebar, 84px)',
  panel: 'var(--oc-axis-layout-track-panel, 272px)',
  inspector: 'var(--oc-axis-layout-track-inspector, 320px)',
}

export type AxisRegion = {
  slot: string
  track?: AxisRegionTrack
}

type ResolvedAxisRegion = Omit<AxisRegion, 'track'> & {
  track: string
  key: string
  isAutoTrack: boolean
  semanticClass: string
}

defineOptions({ name: 'OcAxisLayout' })

const props = withDefaults(defineProps<{
  as?: string
  axis?: Axis
  spacing?: AxisLayoutSpacing
  fill?: boolean
  interactive?: boolean
  regions: readonly AxisRegion[]
}>(), {
  as: 'div',
  axis: 'horizontal',
  spacing: 'none',
  fill: false,
  interactive: true,
})

const slots = useSlots()

function warnInvalidRegion(message: string, region: AxisRegion) {
  if (!import.meta.env.DEV) {
    return
  }

  console.warn(`[OcAxisLayout] ${message}`, region)
}

function resolveRegionTrack(region: AxisRegion): { track: string; isAutoTrack: boolean } {
  const trackToken = region.track ?? 'auto'
  const resolvedTrack = AXIS_REGION_TRACK_MAP[trackToken]
  if (!resolvedTrack) {
    warnInvalidRegion(`track token "${String(region.track)}" is invalid, fallback to "auto"`, region)
    return {
      track: 'auto',
      isAutoTrack: true,
    }
  }

  return {
    track: resolvedTrack,
    isAutoTrack: trackToken === 'auto',
  }
}

function normalizeRegionSlotForClass(slot: string): string {
  const normalized = slot
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'unnamed'
}

function buildRegionSemanticClass(slot: string): string {
  return `oc-axis-layout__region--slot-${normalizeRegionSlotForClass(slot)}`
}

const resolvedRegions = computed<ResolvedAxisRegion[]>(() => {
  return props.regions.flatMap<ResolvedAxisRegion>((region, index) => {
    const slotName = region.slot?.trim()
    if (!slotName) {
      warnInvalidRegion('slot must be a non-empty string', region)
      return []
    }

    if (!slots[slotName]) {
      warnInvalidRegion(`slot "${slotName}" is not provided`, region)
      return []
    }

    const resolvedTrack = resolveRegionTrack(region)
    return [{
      ...region,
      slot: slotName,
      track: resolvedTrack.track,
      isAutoTrack: resolvedTrack.isAutoTrack,
      key: `${slotName}-${index}`,
      semanticClass: buildRegionSemanticClass(slotName),
    }]
  })
})

const templateValue = computed(() => {
  if (resolvedRegions.value.length === 0) {
    return 'none'
  }

  return resolvedRegions.value.map((region) => region.track).join(' ')
})

const layoutStyle = computed(() => {
  if (props.axis === 'vertical') {
    return {
      gridTemplateRows: templateValue.value,
      gridTemplateColumns: 'minmax(0, 1fr)',
    }
  }

  return {
    gridTemplateColumns: templateValue.value,
    gridTemplateRows: 'minmax(0, 1fr)',
  }
})

function getRegionStyle(region: ResolvedAxisRegion): Record<string, string> | undefined {
  if (!region.isAutoTrack) {
    return undefined
  }

  if (props.axis === 'vertical') {
    return {
      minHeight: 'max-content',
    }
  }

  return {
    minWidth: 'max-content',
  }
}
</script>

<style scoped>
.oc-axis-layout {
  --oc-axis-layout-gap: 0;
  min-width: 0;
  min-height: 0;
  display: grid;
  gap: var(--oc-axis-layout-gap);
}

.oc-axis-layout.is-fill {
  width: 100%;
  height: 100%;
}

.oc-axis-layout.is-non-interactive {
  pointer-events: none;
}

.oc-axis-layout--horizontal {
  align-items: stretch;
}

.oc-axis-layout--vertical {
  align-items: stretch;
}

.oc-axis-layout--spacing-none {
  --oc-axis-layout-gap: 0;
}

.oc-axis-layout--spacing-tight {
  --oc-axis-layout-gap: var(--oc-space-1);
}

.oc-axis-layout--spacing-normal {
  --oc-axis-layout-gap: var(--oc-space-2);
}

.oc-axis-layout--spacing-loose {
  --oc-axis-layout-gap: var(--oc-space-3);
}

.oc-axis-layout__region {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
