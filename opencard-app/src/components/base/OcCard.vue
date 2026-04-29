<!-- Base 语义卡片：统一图标标题头部、声明式动作协议与内容承载布局。 -->
<template>
  <OcPanel class="oc-card" :width="props.fitX === 'region' ? 'full' : 'auto'"
    :height="props.fitY === 'region' ? 'full' : 'auto'" :grow="props.fitY === 'region'" orientation="vertical"
    horizontal-alignment="stretch" vertical-alignment="start" :tone="surfacePreset.tone" :border="surfacePreset.border"
    :radius="surfacePreset.radius" :elevation="surfacePreset.elevation" padding="none" overflow-x="clip"
    overflow-y="clip">
    <div v-if="hasHeader" class="oc-card__header-shell" :class="{ 'is-collapsed': collapsed }" :style="headerStyle">
      <OcBar kind="card" layout="leading-append" :icon="props.icon" :title="props.title">
        <template v-if="defaultActionDefinitions.length > 0" #append>
          <OcButton v-for="action in defaultActionDefinitions" :key="action.key" variant="ghost" size="sm" radius="sm"
            icon-only :icon="action.icon" :title="action.title" :aria-label="action.title ?? action.key"
            :disabled="action.disabled === true" @click.stop="handleActionClick(action, $event)" />
        </template>

        <template v-if="hoverActionDefinitions.length > 0" #append-hover>
          <OcButton v-for="action in hoverActionDefinitions" :key="action.key" variant="ghost" size="sm" radius="sm"
            icon-only :icon="action.icon" :title="action.title" :aria-label="action.title ?? action.key"
            :disabled="action.disabled === true" @click.stop="handleActionClick(action, $event)" />
        </template>
      </OcBar>
    </div>

    <OcPanel v-if="!collapsed" as="section" class="oc-card__content" :grow="props.fitY === 'region'" tone="transparent"
      border="none" radius="none" elevation="none" padding="standard" orientation="vertical" gap="space-2"
      horizontal-alignment="stretch" vertical-alignment="start">
      <slot name="content" />
    </OcPanel>
  </OcPanel>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { useFloatingMenu, type FloatingMenuItem } from '../../composables/useFloatingMenu'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcBar from './OcBar.vue'
import OcButton from './OcButton.vue'
import OcPanel, {
  type OcPanelBorder,
  type OcPanelElevation,
  type OcPanelRadius,
  type OcPanelTone,
} from './OcPanel.vue'

const OC_CARD_VARIANTS = ['plain', 'panel', 'glass'] as const
const OC_CARD_LEVELS = [0, 1, 2] as const
const OC_CARD_AXIS_FITS = ['content', 'region'] as const
const OC_CARD_ACTION_REVEALS = ['always', 'hover'] as const

type OcCardVariant = (typeof OC_CARD_VARIANTS)[number]
type OcCardLevel = (typeof OC_CARD_LEVELS)[number]
type OcCardAxisFit = (typeof OC_CARD_AXIS_FITS)[number]
type OcCardActionReveal = (typeof OC_CARD_ACTION_REVEALS)[number]

export interface OcCardActionDefinition {
  key: string
  icon: IconToken
  title?: string
  disabled?: boolean
  children?: OcCardActionDefinition[]
}

interface OcCardProps {
  /** 卡片视觉变体。 */
  variant?: OcCardVariant
  /** 卡片圆角层级语义。 */
  level?: OcCardLevel
  /** 横轴适配语义。 */
  fitX?: OcCardAxisFit
  /** 纵轴适配语义。 */
  fitY?: OcCardAxisFit
  /** 头部图标 token。 */
  icon?: IconToken
  /** 卡片标题文案。 */
  title?: string
  /** 头部动作定义（支持 children 子菜单）。 */
  actions?: readonly OcCardActionDefinition[]
  /** 动作显示策略。 */
  actionReveal?: OcCardActionReveal
  /** 是否折叠内容区。 */
  collapsed?: boolean
}

interface OcCardEmits {
  /** 卡片动作触发时抛出 action key。 */
  action: [payload: { actionKey: string }]
}

interface CardSurfacePreset {
  tone: OcPanelTone
  border: OcPanelBorder
  radius: OcPanelRadius
  elevation: OcPanelElevation
}

defineOptions({
  name: 'OcCard',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<OcCardProps>(), {
  variant: 'plain',
  level: 0,
  fitX: 'region',
  fitY: 'content',
  icon: undefined,
  title: undefined,
  actions: () => [],
  actionReveal: 'always',
  collapsed: false,
})

const emit = defineEmits<OcCardEmits>()
const { openMenu } = useFloatingMenu()

const collapsed = computed(() => props.collapsed)
const actionDefinitions = computed(() => props.actions)

const hasIcon = computed(() => Boolean(props.icon))
const hasTitle = computed(() => Boolean(props.title))
const hasConfiguredActions = computed(() => actionDefinitions.value.length > 0)
const defaultActionDefinitions = computed(() =>
  props.actionReveal === 'always' ? actionDefinitions.value : [],
)
const hoverActionDefinitions = computed(() =>
  props.actionReveal === 'hover' ? actionDefinitions.value : [],
)

const hasHeader = computed(() =>
  hasIcon.value || hasTitle.value || hasConfiguredActions.value,
)

const surfacePreset = computed<CardSurfacePreset>(() => {
  const resolvedLevel = Math.max(0, Math.min(2, props.level)) as OcCardLevel
  const radiusByLevel: Record<OcCardLevel, OcPanelRadius> = {
    0: 'lg',
    1: 'md',
    2: 'sm',
  }

  if (props.variant === 'glass') {
    return {
      tone: 'glass',
      border: 'soft',
      radius: radiusByLevel[resolvedLevel],
      elevation: 'md',
    }
  }

  if (props.variant === 'panel') {
    return {
      tone: 'panel',
      border: 'soft',
      radius: radiusByLevel[resolvedLevel],
      elevation: 'none',
    }
  }

  return {
    tone: 'transparent',
    border: 'none',
    radius: radiusByLevel[resolvedLevel],
    elevation: 'none',
  }
})

const headerStyle = computed<CSSProperties>(() => ({
  '--oc-card-divider-color':
    props.variant === 'plain'
      ? 'var(--oc-border-subtle)'
      : 'var(--oc-panel-border, var(--oc-border-overlay-soft))',
}))

function toFloatingMenuItems(actions: readonly OcCardActionDefinition[]): FloatingMenuItem[] {
  return actions.map((action) => ({
    key: action.key,
    label: action.title ?? action.key,
    icon: action.icon,
    disabled: action.disabled,
  }))
}

function emitAction(actionKey: string): void {
  emit('action', { actionKey })
}

function handleActionClick(action: OcCardActionDefinition, event: MouseEvent): void {
  if (action.disabled) {
    return
  }

  if (action.children?.length) {
    if (import.meta.env.DEV && action.children.some((child) => child.children?.length)) {
      console.warn('[OcCard] Floating menu supports one action.children level. Flatten nested children. ')
    }

    const anchor = event.currentTarget
    if (!(anchor instanceof HTMLElement)) {
      return
    }

    openMenu({
      anchor,
      items: toFloatingMenuItems(action.children),
      placement: 'bottom-end',
      onSelect: (actionKey) => emitAction(actionKey),
    })
    return
  }

  emitAction(action.key)
}
</script>

<style scoped>
.oc-card__header-shell {
  border-bottom: var(--oc-thickness-1) solid var(--oc-card-divider-color);
}

.oc-card__header-shell.is-collapsed {
  border-bottom-width: 0;
}

.oc-card__content {
  min-height: 0;
}
</style>
