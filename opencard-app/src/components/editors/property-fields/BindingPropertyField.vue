<template>
  <div ref="rootRef" class="binding-property-field" :class="{ 'is-bound': isBound }"
    @focusout="handleFocusOut" @keydown.esc="closePicker">
    <template v-if="isBound">
      <button class="binding-property-field__value" type="button" :title="bindingToken" @click="togglePicker">
        <OcIcon name="data.variable" tone="primary" size="sm" />
        <span>{{ bindingLabel }}</span>
        <code>{{ bindingToken }}</code>
      </button>
      <OcButton icon-only size="sm" variant="ghost" icon="action.discard"
        :title="clearTitle" :aria-label="clearTitle" @click="emit('clear')" />
    </template>
    <OcButton v-else icon-only size="sm" variant="ghost" icon="data.variable"
      :title="bindTitle" :aria-label="bindTitle" :disabled="candidates.length === 0"
      @click="togglePicker" />

    <OcFloatingLayer :open="pickerOpen" :anchor="rootRef" placement="bottom-end" :max-height="320"
      class="binding-property-field__floating">
      <div class="binding-property-field__menu" role="menu">
        <section v-for="scope in visibleScopes" :key="scope.token" class="binding-property-field__scope">
          <header>{{ scope.label }} <code>{{ scope.token }}:</code></header>
          <button v-for="field in scope.fields" :key="field.key" type="button" role="menuitem"
            @click="selectField(scope.token, field.key)">
            <OcIcon :name="iconForKind(field.valueKind)" size="sm" />
            <span>{{ field.label ?? field.key }}</span>
            <code>{{ field.key }}</code>
          </button>
        </section>
      </div>
    </OcFloatingLayer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createBindingExpression, isBindingCompatible, isBindingExpression, type BindingValueKind } from '../../../features/editor-runtime/model/binding'
import type { ReferenceCompletionContext } from '../../../features/editor-runtime/services/referenceCompletion'
import type { IconToken } from '../../../shared/ui/icon/iconRegistry'
import { OcButton } from '../../base'
import OcIcon from '../../base/OcIcon.vue'
import OcFloatingLayer from '../../standard/OcFloatingLayer.vue'

const props = defineProps<{
  value: unknown
  context?: ReferenceCompletionContext
  bindTitle: string
  clearTitle: string
}>()

const emit = defineEmits<{
  'update:value': [value: string]
  clear: []
}>()

const rootRef = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)
const isBound = computed(() => isBindingExpression(props.value))
const bindingToken = computed(() => typeof props.value === 'string' ? props.value : '')
const visibleScopes = computed(() => (props.context?.scopes ?? [])
  .map((scope) => ({
    ...scope,
    fields: scope.fields.filter((field) => (
      isBindingCompatible(props.context?.targetKind ?? 'string', field.valueKind)
    )),
  }))
  .filter((scope) => scope.fields.length > 0))
const candidates = computed(() => visibleScopes.value.flatMap((scope) => scope.fields))

const bindingLabel = computed(() => {
  if (!isBound.value || typeof props.value !== 'string') return ''
  const token = props.value.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '')
  const separator = token.indexOf(':')
  if (separator < 1) return token
  const scopeToken = token.slice(0, separator).trim()
  const fieldKey = token.slice(separator + 1).trim()
  const scope = visibleScopes.value.find((item) => item.token === scopeToken)
  const field = scope?.fields.find((item) => item.key === fieldKey)
  return field?.label ?? fieldKey
})

function iconForKind(kind: BindingValueKind): IconToken {
  if (kind === 'number') return 'data.symbol-number'
  if (kind === 'boolean') return 'data.symbol-boolean'
  if (kind === 'object') return 'data.symbol-class'
  return 'data.symbol-string'
}

function togglePicker(): void {
  if (candidates.value.length === 0) return
  pickerOpen.value = !pickerOpen.value
}

function closePicker(): void {
  pickerOpen.value = false
}

function handleFocusOut(): void {
  window.setTimeout(() => {
    if (!rootRef.value?.contains(document.activeElement)) closePicker()
  }, 0)
}

function selectField(scopeToken: string, fieldKey: string): void {
  emit('update:value', createBindingExpression(`${scopeToken}:${fieldKey}`))
  closePicker()
}
</script>

<style scoped>
.binding-property-field {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
  min-width: var(--oc-size-sm);
}

.binding-property-field.is-bound {
  flex: 1 1 auto;
  gap: var(--oc-space-1);
  min-width: 0;
}

.binding-property-field__value {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--oc-space-2);
  width: 100%;
  min-width: 0;
  height: var(--oc-size-md);
  padding: 0 var(--oc-space-2);
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-input);
  color: var(--oc-fg-default);
  cursor: pointer;
}

.binding-property-field__value span,
.binding-property-field__value code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-property-field__value code {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}

.binding-property-field__menu {
  min-width: 220px;
  max-height: inherit;
  overflow: auto;
  padding: var(--oc-space-1);
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-overlay);
  box-shadow: var(--oc-shadow-lg);
}

.binding-property-field__scope header {
  display: flex;
  justify-content: space-between;
  gap: var(--oc-space-2);
  padding: var(--oc-space-1) var(--oc-space-2);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}

.binding-property-field__scope button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--oc-space-2);
  width: 100%;
  min-height: var(--oc-size-md);
  padding: 0 var(--oc-space-2);
  border: 0;
  border-radius: var(--oc-radius-sm);
  background: transparent;
  color: var(--oc-fg-default);
  text-align: left;
  cursor: pointer;
}

.binding-property-field__scope button:hover,
.binding-property-field__scope button:focus-visible {
  background: var(--oc-bg-hover);
  outline: 0;
}

.binding-property-field__scope button span,
.binding-property-field__scope button code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-property-field__scope button code {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}
</style>
