<template>
  <component
    :is="as"
    class="oc-axis-layout"
    :class="[
      `oc-axis-layout--${axis}`,
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
      :style="getRegionStyle(region)"
    >
      <slot :name="region.slot" />
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

type Axis = 'horizontal' | 'vertical'

export type AxisRegion = {
  slot: string
  track?: string
}

type ResolvedAxisRegion = AxisRegion & {
  track: string
  key: string
  isAutoTrack: boolean
}

defineOptions({ name: 'OcAxisLayout' })

const props = withDefaults(defineProps<{
  as?: string
  axis?: Axis
  gap?: string
  fill?: boolean
  interactive?: boolean
  regions: readonly AxisRegion[]
}>(), {
  as: 'div',
  axis: 'horizontal',
  gap: '0',
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
  const rawTrack = region.track?.trim()
  if (!rawTrack) {
    return {
      track: 'auto',
      isAutoTrack: true,
    }
  }

  if (rawTrack === 'auto') {
    return {
      track: 'auto',
      isAutoTrack: true,
    }
  }

  if (rawTrack === '*') {
    return {
      track: 'minmax(0, 1fr)',
      isAutoTrack: false,
    }
  }

  const starTrackMatch = rawTrack.match(/^(\d+(?:\.\d+)?)\*$/)
  if (starTrackMatch) {
    const weight = Number.parseFloat(starTrackMatch[1])
    if (!Number.isFinite(weight) || weight <= 0) {
      warnInvalidRegion(`track "${region.track}" is invalid, fallback to "auto"`, region)
      return {
        track: 'auto',
        isAutoTrack: true,
      }
    }

    return {
      track: `minmax(0, ${weight}fr)`,
      isAutoTrack: false,
    }
  }

  return {
    track: rawTrack,
    isAutoTrack: false,
  }
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
      gap: props.gap,
      gridTemplateRows: templateValue.value,
      gridTemplateColumns: 'minmax(0, 1fr)',
    }
  }

  return {
    gap: props.gap,
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
  min-width: 0;
  min-height: 0;
  display: grid;
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

.oc-axis-layout__region {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
