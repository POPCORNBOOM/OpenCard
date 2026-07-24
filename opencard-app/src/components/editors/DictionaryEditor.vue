<template>
  <section class="dictionary-editor" :aria-label="t('dictionaryEditor.title')" @keydown.ctrl.s.prevent="save">
    <div class="dictionary-editor__content">
      <header class="dictionary-editor__header">
        <div class="dictionary-editor__title">
          <OcIcon name="data.collection" size="lg" />
          <div>
            <h1>{{ t('dictionaryEditor.title') }}</h1>
            <OcText tone="muted" size="sm">{{ filePath }}</OcText>
          </div>
        </div>
        <div v-if="dictionary" class="dictionary-editor__create-actions">
          <form @submit.prevent="addRecord">
            <OcFieldInput
              :value="newRecordKey"
              size="sm"
              mono
              :placeholder="t('dictionaryEditor.placeholders.recordKey')"
              :aria-label="t('dictionaryEditor.placeholders.recordKey')"
              :aria-invalid="Boolean(newRecordKey && !canUseRecordKey(newRecordKey))"
              @input="newRecordKey = ($event.target as HTMLInputElement).value"
            />
            <OcButton icon="action.add" size="sm" variant="soft" :disabled="!canUseRecordKey(newRecordKey)" @click="addRecord">
              {{ t('dictionaryEditor.actions.addRecord') }}
            </OcButton>
          </form>
          <form @submit.prevent="addLanguage">
            <OcFieldInput
              :value="newLanguageKey"
              size="sm"
              mono
              :placeholder="t('dictionaryEditor.placeholders.languageKey')"
              :aria-label="t('dictionaryEditor.placeholders.languageKey')"
              :aria-invalid="Boolean(newLanguageKey && !canUseLanguageKey(newLanguageKey))"
              @input="newLanguageKey = ($event.target as HTMLInputElement).value"
            />
            <OcButton icon="action.add" size="sm" variant="soft" :disabled="!canUseLanguageKey(newLanguageKey)" @click="addLanguage">
              {{ t('dictionaryEditor.actions.addLanguage') }}
            </OcButton>
          </form>
        </div>
      </header>

      <div v-if="dictionary && missingActiveLanguage" class="dictionary-editor__warning" role="status">
        <OcIcon name="status.warning" tone="warning" />
        <OcText size="sm">{{ t('dictionaryEditor.missingActive', { language: dictionary.active }) }}</OcText>
      </div>

      <div v-if="dictionary" class="dictionary-editor__table-scroll">
        <table class="dictionary-editor__table">
          <thead>
            <tr>
              <th class="dictionary-editor__key-column">{{ t('dictionaryEditor.columns.key') }}</th>
              <th :class="{ 'is-active': !dictionary.active }">
                <div class="dictionary-editor__column-heading">
                  <span>{{ t('dictionaryEditor.columns.base') }}</span>
                  <OcButton
                    icon-only
                    size="sm"
                    variant="ghost"
                    icon="action.check"
                    :class="{ 'is-selected': !dictionary.active }"
                    :title="t('dictionaryEditor.actions.useBase')"
                    @click="setActiveLanguage(undefined)"
                  />
                </div>
              </th>
              <th
                v-for="language in languageKeys"
                :key="language"
                :class="{ 'is-active': isActiveLanguage(language) }"
              >
                <div v-if="editingLanguage !== language" class="dictionary-editor__column-heading">
                  <span>{{ language }}</span>
                  <div class="dictionary-editor__row-actions">
                    <OcButton icon-only size="sm" variant="ghost" icon="action.check"
                      :class="{ 'is-selected': isActiveLanguage(language) }"
                      :title="t('dictionaryEditor.actions.setActive')" @click="setActiveLanguage(language)" />
                    <OcButton icon-only size="sm" variant="ghost" icon="action.edit"
                      :title="t('dictionaryEditor.actions.renameLanguage')" @click="beginLanguageRename(language)" />
                    <OcButton icon-only size="sm" variant="ghost" icon="action.delete"
                      :title="t('dictionaryEditor.actions.deleteLanguage')" @click="deleteLanguage(language)" />
                  </div>
                </div>
                <form v-else class="dictionary-editor__rename" @submit.prevent="commitLanguageRename(language)">
                  <OcFieldInput :value="renameDraft" size="sm" mono full-width
                    @input="renameDraft = ($event.target as HTMLInputElement).value" />
                  <OcButton icon-only size="sm" icon="action.check" :disabled="!canUseLanguageKey(renameDraft, language)"
                    @click="commitLanguageRename(language)" />
                  <OcButton icon-only size="sm" type="button" variant="ghost" icon="action.close" @click="cancelRename" />
                </form>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="recordKeys.length === 0">
              <td :colspan="languageKeys.length + 2" class="dictionary-editor__empty">
                {{ t('dictionaryEditor.empty') }}
              </td>
            </tr>
            <tr v-for="recordKey in recordKeys" :key="recordKey">
              <th class="dictionary-editor__key-column" scope="row">
                <div v-if="editingRecord !== recordKey" class="dictionary-editor__record-heading">
                  <code>{{ recordKey }}</code>
                  <div class="dictionary-editor__row-actions">
                    <OcButton icon-only size="sm" variant="ghost" icon="action.edit"
                      :title="t('dictionaryEditor.actions.renameRecord')" @click="beginRecordRename(recordKey)" />
                    <OcButton icon-only size="sm" variant="ghost" icon="action.delete"
                      :title="t('dictionaryEditor.actions.deleteRecord')" @click="deleteRecord(recordKey)" />
                  </div>
                </div>
                <form v-else class="dictionary-editor__rename" @submit.prevent="commitRecordRename(recordKey)">
                  <OcFieldInput :value="renameDraft" size="sm" mono full-width
                    @input="renameDraft = ($event.target as HTMLInputElement).value" />
                  <OcButton icon-only size="sm" icon="action.check" :disabled="!canUseRecordKey(renameDraft, recordKey)"
                    @click="commitRecordRename(recordKey)" />
                  <OcButton icon-only size="sm" type="button" variant="ghost" icon="action.close" @click="cancelRename" />
                </form>
              </th>
              <td>
                <OcFieldInput
                  :value="dictionary.base?.[recordKey] ?? ''"
                  size="sm"
                  full-width
                  @input="updateBase(recordKey, ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td v-for="language in languageKeys" :key="language" :class="{ 'is-active': isActiveLanguage(language) }">
                <div class="dictionary-editor__cell">
                  <OcFieldInput
                    :value="cellValue(language, recordKey)"
                    size="sm"
                    full-width
                    :class="{ 'is-inherited': !hasOverride(language, recordKey) }"
                    @input="updateOverride(language, recordKey, ($event.target as HTMLInputElement).value)"
                  />
                  <OcButton
                    v-if="hasOverride(language, recordKey)"
                    icon-only
                    size="sm"
                    variant="ghost"
                    icon="action.undo"
                    :title="t('dictionaryEditor.actions.resetOverride')"
                    @click="resetOverride(language, recordKey)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section v-else class="dictionary-editor__repair" role="alert">
        <div class="dictionary-editor__diagnostic">
          <OcIcon name="status.error" tone="danger" />
          <div>
            <strong>{{ t('dictionaryEditor.invalid') }}</strong>
            <OcText tone="muted" size="sm">{{ t('dictionaryEditor.repairHint') }}</OcText>
          </div>
        </div>
        <div class="dictionary-editor__source">
          <MonacoEditor :model-value="modelValue ?? ''" language="json" :theme-id="themeId"
            @update:model-value="emit('update:modelValue', $event)" @save="save" />
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import {
  dictionaryLanguageKeyPattern,
  dictionaryRecordKeyPattern,
  parseProjectDictionaryText,
  serializeProjectDictionary,
  type ProjectDictionary,
} from '../../features/workspace/model/projectDictionary'
import MonacoEditor from './MonacoEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const dictionary = ref<ProjectDictionary | null>(null)
const newRecordKey = ref('')
const newLanguageKey = ref('')
const editingRecord = ref<string | null>(null)
const editingLanguage = ref<string | null>(null)
const renameDraft = ref('')

const themeId = computed(() => props.themeId ?? 'dark')
const recordKeys = computed(() => Object.keys(dictionary.value?.base ?? {}))
const languageKeys = computed(() => Object.keys(dictionary.value?.languages ?? {}))
const missingActiveLanguage = computed(() => Boolean(
  dictionary.value?.active && !languageKeys.value.some(key => identity(key) === identity(dictionary.value?.active ?? '')),
))

watch(() => props.modelValue, content => {
  dictionary.value = parseProjectDictionaryText(content ?? '')
}, { immediate: true })

function identity(value: string) {
  return value.toLocaleLowerCase()
}

function canUseRecordKey(candidate: string, current?: string) {
  const key = candidate.trim()
  return dictionaryRecordKeyPattern.test(key) && !recordKeys.value.some(existing => (
    identity(existing) === identity(key) && identity(existing) !== identity(current ?? '')
  ))
}

function canUseLanguageKey(candidate: string, current?: string) {
  const key = candidate.trim()
  return dictionaryLanguageKeyPattern.test(key) && !languageKeys.value.some(existing => (
    identity(existing) === identity(key) && identity(existing) !== identity(current ?? '')
  ))
}

function commit(next: ProjectDictionary) {
  dictionary.value = next
  emit('update:modelValue', serializeProjectDictionary(next))
}

function cloneDictionary(): ProjectDictionary {
  return JSON.parse(JSON.stringify(dictionary.value ?? {})) as ProjectDictionary
}

function addRecord() {
  if (!dictionary.value || !canUseRecordKey(newRecordKey.value)) return
  const key = newRecordKey.value.trim()
  commit({ ...dictionary.value, base: { ...(dictionary.value.base ?? {}), [key]: '' } })
  newRecordKey.value = ''
}

function addLanguage() {
  if (!dictionary.value || !canUseLanguageKey(newLanguageKey.value)) return
  const key = newLanguageKey.value.trim()
  commit({ ...dictionary.value, languages: { ...(dictionary.value.languages ?? {}), [key]: {} } })
  newLanguageKey.value = ''
}

function updateBase(recordKey: string, value: string) {
  if (!dictionary.value) return
  commit({ ...dictionary.value, base: { ...(dictionary.value.base ?? {}), [recordKey]: value } })
}

function hasOverride(language: string, recordKey: string) {
  return Object.prototype.hasOwnProperty.call(dictionary.value?.languages?.[language] ?? {}, recordKey)
}

function cellValue(language: string, recordKey: string) {
  return hasOverride(language, recordKey)
    ? dictionary.value?.languages?.[language]?.[recordKey] ?? ''
    : dictionary.value?.base?.[recordKey] ?? ''
}

function updateOverride(language: string, recordKey: string, value: string) {
  if (!dictionary.value) return
  commit({
    ...dictionary.value,
    languages: {
      ...(dictionary.value.languages ?? {}),
      [language]: { ...(dictionary.value.languages?.[language] ?? {}), [recordKey]: value },
    },
  })
}

function resetOverride(language: string, recordKey: string) {
  const next = cloneDictionary()
  if (!next.languages?.[language]) return
  delete next.languages[language][recordKey]
  commit(next)
}

function isActiveLanguage(language: string) {
  return identity(dictionary.value?.active ?? '') === identity(language)
}

function setActiveLanguage(language: string | undefined) {
  if (!dictionary.value) return
  const next = { ...dictionary.value, active: language }
  if (!language) delete next.active
  commit(next)
}

function deleteRecord(recordKey: string) {
  const next = cloneDictionary()
  if (!next.base) return
  delete next.base[recordKey]
  for (const overrides of Object.values(next.languages ?? {})) delete overrides[recordKey]
  if (Object.keys(next.base).length === 0) delete next.base
  commit(next)
}

function deleteLanguage(language: string) {
  const next = cloneDictionary()
  if (!next.languages) return
  delete next.languages[language]
  if (Object.keys(next.languages).length === 0) delete next.languages
  if (identity(next.active ?? '') === identity(language)) delete next.active
  commit(next)
}

function beginRecordRename(recordKey: string) {
  editingLanguage.value = null
  editingRecord.value = recordKey
  renameDraft.value = recordKey
}

function beginLanguageRename(language: string) {
  editingRecord.value = null
  editingLanguage.value = language
  renameDraft.value = language
}

function cancelRename() {
  editingRecord.value = null
  editingLanguage.value = null
  renameDraft.value = ''
}

function commitRecordRename(recordKey: string) {
  if (!canUseRecordKey(renameDraft.value, recordKey)) return
  const nextKey = renameDraft.value.trim()
  const next = cloneDictionary()
  const baseEntries = Object.entries(next.base ?? {}).map(([key, value]) => [key === recordKey ? nextKey : key, value])
  next.base = Object.fromEntries(baseEntries)
  for (const [language, overrides] of Object.entries(next.languages ?? {})) {
    next.languages![language] = Object.fromEntries(Object.entries(overrides).map(([key, value]) => (
      [key === recordKey ? nextKey : key, value]
    )))
  }
  commit(next)
  cancelRename()
}

function commitLanguageRename(language: string) {
  if (!canUseLanguageKey(renameDraft.value, language)) return
  const nextKey = renameDraft.value.trim()
  const next = cloneDictionary()
  next.languages = Object.fromEntries(Object.entries(next.languages ?? {}).map(([key, value]) => (
    [key === language ? nextKey : key, value]
  )))
  if (identity(next.active ?? '') === identity(language)) next.active = nextKey
  commit(next)
  cancelRename()
}

function save() {
  if (dictionary.value) emit('save')
}

defineExpose({ save })
</script>

<style scoped>
.dictionary-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--oc-bg-base);
  color: var(--oc-fg-default);
}

.dictionary-editor__content {
  box-sizing: border-box;
  width: 100%;
  max-width: 1440px;
  min-height: 100%;
  margin-inline: auto;
  padding: var(--oc-space-6) var(--oc-space-5);
}

.dictionary-editor__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--oc-space-4);
  padding-bottom: var(--oc-space-4);
  border-bottom: 1px solid var(--oc-border-muted);
}

.dictionary-editor__title,
.dictionary-editor__create-actions,
.dictionary-editor__create-actions form,
.dictionary-editor__column-heading,
.dictionary-editor__record-heading,
.dictionary-editor__row-actions,
.dictionary-editor__cell,
.dictionary-editor__rename,
.dictionary-editor__diagnostic {
  display: flex;
  align-items: center;
}

.dictionary-editor__title {
  min-width: 0;
  gap: var(--oc-space-3);
}

.dictionary-editor h1 {
  margin: 0 0 var(--oc-space-1);
  font-size: var(--oc-text-lg);
  font-weight: var(--font-weight-ui-title);
  letter-spacing: 0;
}

.dictionary-editor__create-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--oc-space-2);
}

.dictionary-editor__create-actions form {
  gap: var(--oc-space-1);
}

.dictionary-editor__table-scroll {
  width: 100%;
  margin-top: var(--oc-space-5);
  overflow: auto;
  border: 1px solid var(--oc-border-muted);
}

.dictionary-editor__warning {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  margin-top: var(--oc-space-4);
  color: var(--oc-icon-warning);
}

.dictionary-editor__table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.dictionary-editor__table th,
.dictionary-editor__table td {
  box-sizing: border-box;
  width: 240px;
  height: 44px;
  padding: var(--oc-space-1) var(--oc-space-2);
  border-right: 1px solid var(--oc-border-muted);
  border-bottom: 1px solid var(--oc-border-muted);
  background: var(--oc-bg-base);
  text-align: left;
}

.dictionary-editor__table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--oc-bg-raised);
  font-size: var(--oc-text-sm);
}

.dictionary-editor__table .dictionary-editor__key-column {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 220px;
  background: var(--oc-bg-raised);
}

.dictionary-editor__table th.is-active,
.dictionary-editor__table td.is-active {
  background: color-mix(in srgb, var(--oc-icon-active) 8%, var(--oc-bg-base));
}

.dictionary-editor__column-heading,
.dictionary-editor__record-heading {
  justify-content: space-between;
  gap: var(--oc-space-2);
}

.dictionary-editor__column-heading > span,
.dictionary-editor__record-heading > code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dictionary-editor__row-actions {
  flex: 0 0 auto;
  opacity: 0;
}

.dictionary-editor__table th:hover .dictionary-editor__row-actions,
.dictionary-editor__table th:focus-within .dictionary-editor__row-actions {
  opacity: 1;
}

.dictionary-editor__cell,
.dictionary-editor__rename {
  gap: var(--oc-space-1);
}

.dictionary-editor__cell :deep(.is-inherited) {
  color: var(--oc-fg-muted);
  font-style: italic;
}

.dictionary-editor__column-heading :deep(.is-selected) {
  color: var(--oc-icon-active);
}

.dictionary-editor__empty {
  color: var(--oc-fg-muted);
  text-align: center !important;
}

.dictionary-editor__repair {
  display: grid;
  grid-template-rows: auto minmax(360px, 1fr);
  gap: var(--oc-space-4);
  min-height: 560px;
  padding-top: var(--oc-space-5);
}

.dictionary-editor__diagnostic {
  align-items: flex-start;
  gap: var(--oc-space-3);
}

.dictionary-editor__diagnostic div {
  display: grid;
  gap: var(--oc-space-1);
}

.dictionary-editor__source {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--oc-border-muted);
}

@media (hover: none) {
  .dictionary-editor__row-actions {
    opacity: 1;
  }
}

@media (max-width: 760px) {
  .dictionary-editor__content {
    padding-inline: var(--oc-space-3);
  }

  .dictionary-editor__header {
    flex-direction: column;
  }

  .dictionary-editor__create-actions {
    justify-content: flex-start;
  }
}
</style>
