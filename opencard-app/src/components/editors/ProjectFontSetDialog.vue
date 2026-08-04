<template>
  <OcDialog :open="open" :title="dialogTitle" as="form" size="md" min-height="md"
    close-on-backdrop @request-close="emit('close')" @submit="submit">
    <label class="project-font-set-dialog__field">
      <span>{{ t('projectConfig.fonts.name') }}</span>
      <OcFieldInput full-width autofocus :value="name" :aria-invalid="!name.trim()"
        @input="updateText('name', $event)" />
    </label>
    <label class="project-font-set-dialog__field">
      <span>{{ t('projectConfig.fonts.key') }}</span>
      <OcFieldInput full-width mono :value="key" :placeholder="generatedKey"
        :aria-invalid="Boolean(key) && (!validKey || !uniqueKey)" @input="updateText('key', $event)" />
    </label>

    <div class="project-font-set-dialog__members">
      <OcText as="strong" size="sm">{{ t('projectConfig.fonts.members') }}</OcText>
      <div v-if="selectedMembers.length" class="project-font-set-dialog__selected">
        <div v-for="(memberKey, index) in selectedMembers" :key="`${memberKey}:${index}`"
          class="project-font-set-dialog__member-row">
          <span><OcIcon :name="entryIcon(memberKey)" size="sm" />{{ entryLabel(memberKey) }}</span>
          <span>
            <OcButton icon-only size="sm" variant="ghost" icon="nav.arrow-up" :disabled="index === 0"
              :aria-label="t('propertyEditor.arrays.moveUp')" @click="moveMember(index, index - 1)" />
            <OcButton icon-only size="sm" variant="ghost" icon="nav.arrow-down"
              :disabled="index === selectedMembers.length - 1" :aria-label="t('propertyEditor.arrays.moveDown')"
              @click="moveMember(index, index + 1)" />
            <OcButton icon-only size="sm" variant="ghost" icon="action.delete" icon-tone="danger"
              :aria-label="t('projectConfig.fonts.removeMember')" @click="removeMember(index)" />
          </span>
        </div>
      </div>
      <OcText v-else tone="muted" size="sm">{{ t('projectConfig.fonts.noMembers') }}</OcText>

      <div class="project-font-set-dialog__choices">
        <OcCheckbox v-for="entry in availableEntries" :key="entry.key"
          :checked="selectedMembers.includes(entry.key)" :disabled="entry.disabled"
          @update:checked="toggleMember(entry.key, $event)">
          <span class="project-font-set-dialog__choice">
            <OcIcon :name="entry.kind === 'font' ? 'file.font' : 'data.layers'" size="sm" />
            <span>{{ entry.name }}</span><code>font:{{ entry.key }}</code>
          </span>
        </OcCheckbox>
      </div>
    </div>

    <OcText v-if="validationMessage" tone="danger" size="sm" role="alert">{{ validationMessage }}</OcText>
    <template #footer>
      <OcButton type="button" @click="emit('close')">{{ t('projectConfig.fonts.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="!canSubmit">{{ t('projectConfig.fonts.save') }}</OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectFont, ProjectFontSet } from '../../features/workspace/model/projectFontRegistry'
import { projectFontIdPattern } from '../../features/workspace/model/projectFonts'
import { createAvailableKey } from '../../shared/model/keySlug'
import type { IconResolvable } from '../../shared/ui/icon/iconRegistry'
import OcButton from '../base/OcButton.vue'
import OcCheckbox from '../base/OcCheckbox.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcDialog from '../standard/OcDialog.vue'

export type ProjectFontSetRequest = {
  originalKey?: string
  key: string
  name: string
  fontKeys: string[]
}

const props = defineProps<{
  open: boolean
  fonts: readonly ProjectFont[]
  fontSets: readonly ProjectFontSet[]
  originalKey?: string
}>()
const emit = defineEmits<{ close: []; submit: [request: ProjectFontSetRequest] }>()
const { t } = useI18n()
const name = ref('')
const key = ref('')
const selectedMembers = ref<string[]>([])
const editing = computed(() => Boolean(props.originalKey))
const usedKeys = computed(() => [...props.fonts, ...props.fontSets]
  .map(entry => entry.key)
  .filter(candidate => candidate.toLocaleLowerCase() !== props.originalKey?.toLocaleLowerCase()))
const generatedKey = computed(() => createAvailableKey(name.value, usedKeys.value, 'font-set'))
const effectiveKey = computed(() => key.value || generatedKey.value)
const validKey = computed(() => projectFontIdPattern.test(effectiveKey.value))
const uniqueKey = computed(() => !usedKeys.value.some(candidate => (
  candidate.toLocaleLowerCase() === effectiveKey.value.toLocaleLowerCase()
)))
const availableEntries = computed(() => [
  ...props.fonts.map(font => ({ ...font, kind: 'font' as const, disabled: false })),
  ...props.fontSets
    .filter(fontSet => fontSet.key !== props.originalKey)
    .map(fontSet => ({
      ...fontSet,
      kind: 'set' as const,
      disabled: setReaches(fontSet.key, props.originalKey ?? effectiveKey.value),
    })),
])
const canSubmit = computed(() => Boolean(
  name.value.trim() && validKey.value && uniqueKey.value && (editing.value || selectedMembers.value.length > 0),
))
const dialogTitle = computed(() => editing.value
  ? t('projectConfig.fonts.configureSet') : t('projectConfig.fonts.addSet'))
const validationMessage = computed(() => {
  if (!uniqueKey.value) return t('projectConfig.fonts.keyExists')
  if (key.value && !validKey.value) return t('projectConfig.fonts.invalidKey')
  if (!name.value.trim()) return t('projectConfig.fonts.nameRequired')
  if (!editing.value && selectedMembers.value.length === 0) return t('projectConfig.fonts.memberRequired')
  return ''
})

watch([() => props.open, () => props.originalKey], ([open]) => {
  if (!open) return
  const fontSet = props.fontSets.find(candidate => candidate.key === props.originalKey)
  name.value = fontSet?.name ?? createDefaultSetName()
  key.value = fontSet?.key ?? ''
  selectedMembers.value = [...(fontSet?.fontKeys ?? [])]
}, { immediate: true })

function createDefaultSetName(): string {
  const existingNames = new Set(props.fontSets.map(fontSet => fontSet.name.toLocaleLowerCase()))
  let index = 1
  while (existingNames.has(t('projectConfig.fonts.defaultSetName', { index }).toLocaleLowerCase())) index += 1
  return t('projectConfig.fonts.defaultSetName', { index })
}

function updateText(field: 'name' | 'key', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  if (field === 'name') name.value = event.target.value
  else key.value = event.target.value
}
function toggleMember(memberKey: string, checked: boolean): void {
  if (checked && !selectedMembers.value.includes(memberKey)) selectedMembers.value.push(memberKey)
  else if (!checked) selectedMembers.value = selectedMembers.value.filter(candidate => candidate !== memberKey)
}
function moveMember(from: number, to: number): void {
  if (to < 0 || to >= selectedMembers.value.length) return
  const members = [...selectedMembers.value]
  const [member] = members.splice(from, 1)
  if (!member) return
  members.splice(to, 0, member)
  selectedMembers.value = members
}
function removeMember(index: number): void {
  selectedMembers.value = selectedMembers.value.filter((_, candidate) => candidate !== index)
}
function entryLabel(memberKey: string): string {
  return [...props.fonts, ...props.fontSets].find(entry => entry.key === memberKey)?.name ?? memberKey
}
function entryIcon(memberKey: string): IconResolvable {
  return props.fontSets.some(fontSet => fontSet.key === memberKey) ? 'data.layers' : 'file.font'
}
function setReaches(startKey: string, targetKey: string, visited = new Set<string>()): boolean {
  const identity = startKey.toLocaleLowerCase()
  if (identity === targetKey.toLocaleLowerCase()) return true
  if (visited.has(identity)) return false
  visited.add(identity)
  const fontSet = props.fontSets.find(candidate => candidate.key.toLocaleLowerCase() === identity)
  return Boolean(fontSet?.fontKeys.some(member => setReaches(member, targetKey, visited)))
}
function submit(): void {
  if (!canSubmit.value) return
  emit('submit', {
    ...(props.originalKey ? { originalKey: props.originalKey } : {}),
    key: effectiveKey.value,
    name: name.value.trim(),
    fontKeys: [...selectedMembers.value],
  })
}
</script>

<style scoped>
.project-font-set-dialog__field,
.project-font-set-dialog__members,
.project-font-set-dialog__selected,
.project-font-set-dialog__choices { display: grid; min-width: 0; gap: var(--oc-space-2); }
.project-font-set-dialog__field { color: var(--oc-fg-muted); font-size: var(--oc-text-sm); }
.project-font-set-dialog__member-row,
.project-font-set-dialog__member-row > span,
.project-font-set-dialog__choice { display: flex; align-items: center; min-width: 0; gap: var(--oc-space-2); }
.project-font-set-dialog__member-row { justify-content: space-between; padding: var(--oc-space-2); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-set-dialog__member-row > :first-child { flex: 1; }
.project-font-set-dialog__choices { overflow: auto; }
.project-font-set-dialog__choice span { flex: 1; }
.project-font-set-dialog__choice code { color: var(--oc-fg-muted); font-size: var(--oc-text-xs); }
</style>
