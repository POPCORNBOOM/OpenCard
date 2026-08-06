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
      <div ref="memberPickerRef" class="project-font-set-dialog__member-add">
        <OcFieldInput full-width :value="memberQuery" :placeholder="t('projectConfig.fonts.searchMembers')"
          autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list"
          :aria-label="t('projectConfig.fonts.searchMembers')" :aria-expanded="memberMenuOpen"
          :aria-controls="memberAutocompleteId" :aria-activedescendant="activeMemberOptionId"
          @focus="openMemberMenu" @input="updateMemberQuery" @blur="closeMemberMenu"
          @keydown="handleMemberKeydown" />
        <OcButton type="button" icon-only variant="soft" icon="action.add" :disabled="!candidateMemberKey"
          :aria-label="t('projectConfig.fonts.addMember')" :data-tooltip="t('projectConfig.fonts.addMember')"
          @click="addCandidateMember" />
      </div>
      <OcAutocompletePopover :id="memberAutocompleteId" :open="memberMenuOpen" :anchor="memberPickerRef"
        :items="memberSuggestions" :active-key="activeMemberKey" @select="selectMemberSuggestion" />
      <div v-if="selectedMembers.length" class="project-font-set-dialog__selected">
        <div v-for="(memberKey, index) in selectedMembers" :key="`${memberKey}:${index}`"
          class="project-font-set-dialog__member-row">
          <span><OcIcon :name="entryIcon(memberKey)" size="sm" />{{ entryLabel(memberKey) }}</span>
          <span>
            <OcButton type="button" icon-only size="sm" variant="ghost" icon="format.vertical-top"
              :disabled="index === 0" :aria-label="t('projectConfig.fonts.moveMemberToTop')"
              @click="moveMember(index, 0)" />
            <OcButton type="button" icon-only size="sm" variant="ghost" icon="nav.arrow-up" :disabled="index === 0"
              :aria-label="t('propertyEditor.arrays.moveUp')" @click="moveMember(index, index - 1)" />
            <OcButton type="button" icon-only size="sm" variant="ghost" icon="nav.arrow-down"
              :disabled="index === selectedMembers.length - 1" :aria-label="t('propertyEditor.arrays.moveDown')"
              @click="moveMember(index, index + 1)" />
            <OcButton type="button" icon-only size="sm" variant="ghost" icon="format.vertical-bottom"
              :disabled="index === selectedMembers.length - 1"
              :aria-label="t('projectConfig.fonts.moveMemberToBottom')"
              @click="moveMember(index, selectedMembers.length - 1)" />
            <OcButton type="button" icon-only size="sm" variant="ghost" icon="action.delete" icon-tone="danger"
              :aria-label="t('projectConfig.fonts.removeMember')" @click="removeMember(index)" />
          </span>
        </div>
      </div>
      <OcText v-else tone="muted" size="sm">{{ t('projectConfig.fonts.noMembers') }}</OcText>
    </div>

    <OcText v-if="validationMessage" tone="danger" size="sm" role="alert">{{ validationMessage }}</OcText>
    <template #footer>
      <OcButton type="button" @click="emit('close')">{{ t('projectConfig.fonts.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="!canSubmit">{{ t('projectConfig.fonts.save') }}</OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectFont, ProjectFontSet } from '../../features/workspace/model/projectFontRegistry'
import { projectFontIdPattern } from '../../features/workspace/model/projectFonts'
import { createAvailableKey } from '../../shared/model/keySlug'
import type { IconResolvable } from '../../shared/ui/icon/iconRegistry'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcAutocompletePopover from '../standard/OcAutocompletePopover.vue'
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
const memberQuery = ref('')
const selectedCandidateKey = ref<string | null>(null)
const memberPickerRef = ref<HTMLElement | null>(null)
const activeMemberInput = ref<HTMLInputElement | null>(null)
const memberMenuOpen = ref(false)
const activeMemberKey = ref<string | null>(null)
const memberAutocompleteId = useId()
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
const selectableEntries = computed(() => availableEntries.value.filter(entry => (
  !entry.disabled && !selectedMembers.value.includes(entry.key)
)))
const memberSuggestions = computed(() => {
  const query = memberQuery.value.trim().toLocaleLowerCase()
  return selectableEntries.value
    .filter(entry => !query || entry.name.toLocaleLowerCase().includes(query)
      || entry.key.toLocaleLowerCase().includes(query))
    .map(entry => ({
      key: entry.key,
      label: entry.name,
      detail: `font:${entry.key}`,
      icon: entry.kind === 'font' ? 'file.font' as const : 'data.layers' as const,
    }))
})
const candidateMemberKey = computed(() => {
  if (selectedCandidateKey.value
    && selectableEntries.value.some(entry => entry.key === selectedCandidateKey.value)) {
    return selectedCandidateKey.value
  }
  return memberQuery.value.trim() ? activeMemberKey.value : null
})
const activeMemberOptionId = computed(() => activeMemberKey.value
  ? `${memberAutocompleteId}-option-${activeMemberKey.value.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  : undefined)
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
  resetMemberPicker()
}, { immediate: true })

watch(memberSuggestions, suggestions => {
  activeMemberKey.value = suggestions.some(entry => entry.key === activeMemberKey.value)
    ? activeMemberKey.value
    : (suggestions[0]?.key ?? null)
})

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
function openMemberMenu(event: FocusEvent): void {
  activeMemberInput.value = event.target as HTMLInputElement
  memberMenuOpen.value = memberSuggestions.value.length > 0
}
function updateMemberQuery(event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  activeMemberInput.value = event.target
  memberQuery.value = event.target.value
  selectedCandidateKey.value = null
  memberMenuOpen.value = memberSuggestions.value.length > 0
}
function closeMemberMenu(): void {
  window.setTimeout(() => { memberMenuOpen.value = false }, 0)
}
function selectMemberSuggestion(memberKey: string): void {
  const entry = selectableEntries.value.find(candidate => candidate.key === memberKey)
  if (!entry) return
  memberQuery.value = entry.name
  selectedCandidateKey.value = entry.key
  activeMemberKey.value = entry.key
  memberMenuOpen.value = false
  void nextTick(() => activeMemberInput.value?.focus())
}
function addCandidateMember(): void {
  const memberKey = candidateMemberKey.value
  if (!memberKey || selectedMembers.value.includes(memberKey)) return
  selectedMembers.value.push(memberKey)
  resetMemberPicker()
  void nextTick(() => activeMemberInput.value?.focus())
}
function moveActiveMember(offset: 1 | -1): void {
  if (!memberSuggestions.value.length) return
  const current = Math.max(0, memberSuggestions.value.findIndex(entry => entry.key === activeMemberKey.value))
  activeMemberKey.value = memberSuggestions.value[
    (current + offset + memberSuggestions.value.length) % memberSuggestions.value.length
  ]?.key ?? null
}
function handleMemberKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    memberMenuOpen.value = memberSuggestions.value.length > 0
    moveActiveMember(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Enter' && candidateMemberKey.value) {
    event.preventDefault()
    addCandidateMember()
  } else if (event.key === 'Escape') {
    memberMenuOpen.value = false
  }
}
function resetMemberPicker(): void {
  memberQuery.value = ''
  selectedCandidateKey.value = null
  memberMenuOpen.value = false
  activeMemberKey.value = memberSuggestions.value[0]?.key ?? null
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
.project-font-set-dialog__selected { display: grid; min-width: 0; gap: var(--oc-space-2); }
.project-font-set-dialog__field { color: var(--oc-fg-muted); font-size: var(--oc-text-sm); }
.project-font-set-dialog__member-add,
.project-font-set-dialog__member-row,
.project-font-set-dialog__member-row > span { display: flex; align-items: center; min-width: 0; gap: var(--oc-space-2); }
.project-font-set-dialog__member-row { justify-content: space-between; padding: var(--oc-space-2); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-set-dialog__member-row > :first-child { flex: 1; }
.project-font-set-dialog__member-add > :first-child { flex: 1; }
.project-font-set-dialog__selected { max-height: var(--oc-list-max-height-sm); overflow-y: auto; }
</style>
