<template>
  <OcDialog :open="open" :title="dialogTitle" as="form" size="lg" min-height="md" max-height="viewport"
    close-on-backdrop @request-close="emit('close')" @submit="submit">
    <div class="custom-block-export-dialog">
      <OcText as="h3" size="sm">{{ fieldsLabel }}</OcText>
      <OcPanel class="custom-block-export-dialog__fields" fill padding="none" overflow="auto">
        <OcTree fill :data="treeData" :actions="treeActions" :selected-keys="[]"
          :expanded-keys="groupKeys" :aria-label="fieldsLabel"
          selection-mode="none" @intent="handleTreeIntent" />
      </OcPanel>
      <div class="custom-block-export-dialog__metadata">
        <label class="custom-block-export-dialog__field">
          <OcText as="span" size="sm">{{ nameLabel }}</OcText>
          <OcFieldInput full-width autofocus :value="name" :aria-invalid="!name.trim()"
            @input="name = ($event.target as HTMLInputElement).value" />
        </label>
        <label class="custom-block-export-dialog__field">
          <OcText as="span" size="sm">{{ keyLabel }}</OcText>
          <OcFieldInput full-width mono :value="key" :aria-invalid="!validKey"
            @input="key = ($event.target as HTMLInputElement).value" />
        </label>
      </div>
      <OcText v-if="errorText" as="p" size="sm" tone="danger">{{ errorText }}</OcText>
    </div>
    <template #footer>
      <OcButton type="button" @click="emit('close')">{{ cancelLabel }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="!name.trim() || !validKey">{{ exportLabel }}</OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import OcPanel from '../../../components/base/OcPanel.vue'
import OcButton from '../../../components/base/OcButton.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcText from '../../../components/base/OcText.vue'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import type { CustomBlockFieldAnalysis } from '../services/projectCustomBlockExportAnalyzer'
import { normalizeProjectCustomBlockKey } from '../model/projectCustomBlocks'

const props = withDefaults(defineProps<{
  open: boolean
  dialogTitle: string
  fields: readonly CustomBlockFieldAnalysis[]
  defaultName?: string
  defaultKey?: string
  nameLabel: string
  keyLabel: string
  cancelLabel: string
  exportLabel: string
  fieldsLabel: string
  exposedLabel: string
  privateLabel: string
  moveToExposedLabel: string
  moveToPrivateLabel: string
  errorText?: string
}>(), { defaultName: '', defaultKey: '', errorText: '' })

const emit = defineEmits<{
  close: []
  submit: [payload: { name: string; key: string; exposedFieldKeys: string[] }]
}>()

const name = ref(props.defaultName)
const key = ref(props.defaultKey)
const exposed = ref(new Set<string>())
const groupKeys = ['group:exposed', 'group:private']
const validKey = computed(() => Boolean(normalizeProjectCustomBlockKey(key.value)))

watch(() => props.open, open => {
  if (!open) return
  name.value = props.defaultName
  key.value = props.defaultKey
  exposed.value = new Set()
})

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
    if (intent.targetKey?.startsWith('field:')) {
      const targetFieldKey = intent.targetKey.slice(6)
      move(intent.key.slice(6), exposed.value.has(targetFieldKey) ? 'exposed' : 'private')
    }
  }
}

function submit() {
  emit('submit', { name: name.value.trim(), key: key.value.trim(), exposedFieldKeys: [...exposed.value] })
}
</script>

<style scoped>
.custom-block-export-dialog { display: grid; gap: var(--oc-space-4); }
.custom-block-export-dialog__metadata { display: grid; grid-template-columns: 1fr 1fr; gap: var(--oc-space-3); }
.custom-block-export-dialog__field { display: grid; gap: var(--oc-space-1); }
</style>
