<script setup lang="ts">
import OcTree from '../../../components/standard/OcTree.vue'
import type { ShellList } from '../shell.types'

const props = defineProps<{
  list: ShellList
}>()
</script>

<template>
  <OcTree
    v-if="props.list.content?.type === 'tree'"
    :ref="props.list.content.captureInstance"
    class="open-card-shell__sidebar-tree"
    :data="props.list.content.data"
    :actions="props.list.content.actions"
    :selected-keys="props.list.content.selectedKeys"
    :expanded-keys="props.list.content.expandedKeys"
    :role="props.list.content.role"
    :selection-mode="props.list.content.selectionMode"
    :activation-mode="props.list.content.activationMode"
    :selection-expansion-mode="props.list.content.selectionExpansionMode"
    :scroll-to-selection="props.list.content.scrollToSelection"
    :virtualized="props.list.content.virtualized"
    :action-visibility="props.list.content.actionVisibility"
    :tab-navigation="props.list.content.tabNavigation"
    @intent="props.list.content.onIntent"
    @auxclick="props.list.content.onAuxclick"
  />
  <div v-else-if="!props.list.content || props.list.content.type === 'empty'" class="shell-sidebar-empty">
    <span>{{ props.list.content?.type === 'empty' ? props.list.content.text ?? props.list.placeholder : props.list.placeholder }}</span>
  </div>
</template>
