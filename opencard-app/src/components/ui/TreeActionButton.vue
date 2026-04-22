<!--
  使用说明：
  - 输入 `action` 定义按钮与可选子菜单动作
  - 输入 `caller/node` 标记动作来源上下文

  职责边界：
  - 负责树动作按钮渲染与浮动菜单触发
  - 只上抛动作意图 不执行业务规则

  主要输出事件：
  - `trigger`（动作触发）
-->
<template>
  <div class="action-entry">
    <OcButton
      class="action-trigger"
      variant="icon"
      icon-only
      :icon="action.icon"
      :class="{ 'has-children': hasChildren }"
      :title="action.title"
      data-tree-interactive="true"
      @mousedown.stop
      @click.stop="handleClick"
    />
  </div>
</template>

<script setup lang="ts">
import { useFloatingMenu, type FloatingMenuItem } from '../../composables/useFloatingMenu'
import OcButton from '../base/OcButton.vue'
import type { ActionCaller, ActionDefinition, ITreeNode } from '../../shared/ui/tree/tree.types'

defineOptions({ name: 'TreeActionButton' })

const props = withDefaults(defineProps<{
  action: ActionDefinition
  caller: ActionCaller
  node?: ITreeNode
}>(), {
  node: undefined,
})

const emit = defineEmits<{
  trigger: [{ actionKey: string; caller: ActionCaller; node?: ITreeNode }]
}>()

const hasChildren = Boolean(props.action.children?.length)
const { openMenu } = useFloatingMenu()

function toFloatingMenuItems(actions: ActionDefinition[]): FloatingMenuItem[] {
  return actions.map((action) => ({
    key: action.key,
    label: action.title ?? action.key,
    icon: action.icon,
    children: action.children ? toFloatingMenuItems(action.children) : undefined,
  }))
}

function handleClick(event: MouseEvent) {
  if (hasChildren) {
    const anchor = event.currentTarget
    if (!(anchor instanceof HTMLElement) || !props.action.children) {
      return
    }

    openMenu({
      anchor,
      items: toFloatingMenuItems(props.action.children),
      placement: 'bottom-end',
      onSelect: (actionKey) => emit('trigger', {
        actionKey,
        caller: props.caller,
        node: props.node,
      }),
    })
    return
  }

  emit('trigger', {
    actionKey: props.action.key,
    caller: props.caller,
    node: props.node,
  })
}
</script>

<style scoped>
.action-trigger {
  border: 0;
  border-radius: 4px;
  color: inherit;
}

.action-trigger:hover,
.action-entry:hover > .action-trigger {
  background: var(--oc-bg-hover-strong);
}
</style>
