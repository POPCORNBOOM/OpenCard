<!-- Base 卡片容器：只负责 title/content 双区块结构，不承载业务状态。 -->
<template>
  <OcSurface class="oc-card" :class="{ 'oc-card--fill': props.fill }" :as="props.as" :tone="props.tone"
    :border="props.border" :radius="props.radius" :elevation="props.elevation" :pattern="props.pattern"
    :padding="props.padding" :fill="props.fill" :clip="props.clip" v-bind="attrs">
    <header v-if="hasTitle" class="oc-card__title" :class="{ 'oc-card__title--with-divider': !props.collapsed }"
      :style="densityPaddingStyle">
      <slot name="title">{{ props.title }}</slot>
    </header>
    <section v-if="!props.collapsed" class="oc-card__content" :style="densityPaddingStyle">
      <slot name="content">
        <slot />
      </slot>
    </section>
  </OcSurface>
</template>

<script setup lang="ts">
import { computed, type CSSProperties, type PropType, useAttrs, useSlots } from 'vue'
import OcSurface, { OcSurfacePadding, ocSurfaceProps } from './OcSurface.vue'

const OC_CARD_DENSITIES = [
  'none',
  'compact',
  'standard',
] as const

export type OcCardDensity = (typeof OC_CARD_DENSITIES)[number]

defineOptions({
  name: 'OcCard',
  inheritAttrs: false,
})

const props = defineProps({
  ...ocSurfaceProps,
  /** 卡片标题文案。 */
  title: {
    type: String,
    default: undefined,
  },
  /** 是否折叠内容区。true 时仅保留标题区。 */
  collapsed: {
    type: Boolean,
    default: false,
  },
  padding: {
    type: String as PropType<OcSurfacePadding>,
    default: 'none',
  },
  /** 内容区内边距密度。 */
  density: {
    type: String as PropType<OcCardDensity>,
    default: 'standard',
  },
})

const attrs = useAttrs()
const slots = useSlots()

const hasTitle = computed(() => Boolean(props.title) || Boolean(slots.title))
const densityPaddingValue = computed(() => {
  if (props.density === 'none') {
    return 'var(--oc-padding-none)'
  }
  if (props.density === 'compact') {
    return 'var(--oc-padding-compact)'
  }

  return 'var(--oc-padding-standard)'
})
const densityPaddingStyle = computed<CSSProperties>(() => ({
  '--oc-card-density-padding': densityPaddingValue.value,
}))
</script>

<style scoped>
.oc-card {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.oc-card__title {
  min-height: var(--oc-block-lg);
  padding: var(--oc-padding-standard);
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  color: var(--oc-text-primary);
  font-size: var(--oc-title-size);
  font-weight: 600;
  flex: 0 0 auto;
}

.oc-card__title--with-divider {
  border-bottom: var(--oc-thickness-1) solid var(--oc-surface-border);
}

.oc-card__content {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--oc-card-density-padding);
  gap: var(--oc-space-2);
}

.oc-card--fill .oc-card__content {
  flex: 1 1 auto;

}
</style>
