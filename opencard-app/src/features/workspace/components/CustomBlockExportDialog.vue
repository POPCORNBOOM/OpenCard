<template>
  <OcDialog :open="open" :title="title" size="lg" min-height="md" max-height="viewport"
    @request-close="emit('close')">
    <div class="custom-block-export-dialog">
      <div class="custom-block-export-dialog__fields">
        <OcTree fill :data="treeData" :actions="treeActions" :selected-keys="[]"
          selection-mode="none" @intent="handleTreeIntent" />
      </div>
      <div class="custom-block-export-dialog__metadata">
        <label>
          <span>{{ nameLabel }}</span>
          <input v-model="name" required />
        </label>
        <label>
          <span>{{ keyLabel }}</span>
          <input v-model="key" required pattern="[A-Za-z0-9._-]+" />
        </label>
      </div>
    </div>
    <template #footer>
      <button type="button" @click="emit('close')">{{ cancelLabel }}</button>
      <button type="button" :disabled="!name.trim() || !key.trim()" @click="submit">{{ exportLabel }}</button>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import type { CustomBlockFieldAnalysis } from '../services/projectCustomBlockExportAnalyzer'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  fields: readonly CustomBlockFieldAnalysis[]
  defaultName?: string
  defaultKey?: string
  nameLabel: string
  keyLabel: string
  cancelLabel: string
  exportLabel: string
  exposedLabel: string
  privateLabel: string
  moveToExposedLabel: string
  moveToPrivateLabel: string
}>(), { defaultName: '', defaultKey: '' })

const emit = defineEmits<{
  close: []
  submit: [payload: { name: string; key: string; exposedFieldKeys: string[] }]
}>()

const name = ref(props.defaultName)
const key = ref(props.defaultKey)
const exposed = ref(new Set<string>())

const treeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['move-exposed', { title: props.moveToExposedLabel, icon: 'nav.arrow-right' }],
  ['move-private', { title: props.moveToPrivateLabel, icon: 'nav.arrow-left' }],
]))

const treeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  const children = new Map<string, readonly string[]>()
  const exposedKeys: string[] = []
  const privateKeys: string[] = []
  for (const field of props.fields) {
    const fieldKey = `field:${field.key}`
    const isExposed = exposed.value.has(field.key)
    ;(isExposed ? exposedKeys : privateKeys).push(fieldKey)
    items.set(fieldKey, {
      label: field.title || field.key,
      tail: `${field.referenceCount}`,
      icon: 'entity.block-custom',
      draggable: true,
      actions: [isExposed ? 'move-private' : 'move-exposed'],
      contextActions: [isExposed ? 'move-private' : 'move-exposed'],
    })
  }
  const exposedRoot = 'group:exposed'
  const privateRoot = 'group:private'
  items.set(exposedRoot, { label: props.exposedLabel, icon: 'entity.block-custom', draggable: false })
  items.set(privateRoot, { label: props.privateLabel, icon: 'entity.block-custom', draggable: false })
  children.set(exposedRoot, exposedKeys)
  children.set(privateRoot, privateKeys)
  return { rootKeys: [exposedRoot, privateRoot], items, children }
})

function move(fieldKey: string, target: 'exposed' | 'private') {
  const next = new Set(exposed.value)
  if (target === 'exposed') next.add(fieldKey)
  else next.delete(fieldKey)
  exposed.value = next
}

function handleTreeIntent(intent: OcTreeIntent) {
  if (intent.type === 'action.invoke' && intent.key.startsWith('field:')) {
    move(intent.key.slice(6), intent.actionKey === 'move-exposed' ? 'exposed' : 'private')
  }
  if (intent.type === 'move.request' && intent.key.startsWith('field:')) {
    if (intent.targetKey === 'group:exposed') move(intent.key.slice(6), 'exposed')
    if (intent.targetKey === 'group:private') move(intent.key.slice(6), 'private')
  }
}

function submit() {
  emit('submit', { name: name.value.trim(), key: key.value.trim(), exposedFieldKeys: [...exposed.value] })
}
</script>

<style scoped>
.custom-block-export-dialog { display: grid; gap: var(--oc-space-4); }
.custom-block-export-dialog__fields { min-height: 18rem; }
.custom-block-export-dialog__metadata { display: grid; grid-template-columns: 1fr 1fr; gap: var(--oc-space-3); }
.custom-block-export-dialog__metadata label { display: grid; gap: var(--oc-space-1); }
</style>
