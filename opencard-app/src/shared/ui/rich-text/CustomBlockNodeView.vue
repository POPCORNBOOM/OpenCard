<template>
  <NodeViewWrapper as="span" class="rich-text-custom-block-node" :class="`is-${layout}`"
    :data-oc-key="node.attrs.customBlockKey" contenteditable="false">
    <OcIcon name="data.symbol-class" size="md" tone="muted" />
    <span>{{ node.attrs.customBlockKey }}</span>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'
import OcIcon from '../../../components/base/OcIcon.vue'

const props = defineProps<NodeViewProps>()
const layout = computed(() => props.node.type.name === 'blockCustomBlock' ? 'block' : 'inline')
</script>

<style scoped>
.rich-text-custom-block-node {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: var(--oc-space-1);
  padding: var(--oc-space-1) var(--oc-space-2);
  border: var(--oc-border-width) solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-raised);
  vertical-align: text-bottom;
}
.rich-text-custom-block-node.is-block { display: flex; width: 100%; }
.rich-text-custom-block-node[class~="ProseMirror-selectednode"] { border-color: var(--oc-border-accent); box-shadow: var(--oc-focus-ring); }
</style>
