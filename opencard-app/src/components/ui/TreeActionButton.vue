<template>
  <div class="action-entry">
    <OcButton
      class="action-trigger oc-button--tree-action"
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
import type { ITreeNode } from './TreeNode.vue'
import type { ActionDefinition, ActionCaller } from './NodeTree.vue'

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
