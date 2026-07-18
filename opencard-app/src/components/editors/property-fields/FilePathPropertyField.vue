<!--
  使用说明：
  - 输入 `definition` 描述文件路径字段约束
  - 输入 `value` 作为当前路径值 支持目录与文件建议

  职责边界：
  - 负责路径输入 自动补全建议与键盘选择交互
  - 只上抛 `update:value` 不直接改领域对象

  主要输出事件：
  - `update:value`（字段值变更）
-->
<template>
  <div class="file-path-field">
    <OcFieldInput
      ref="inputElement"
      as="input"
      full-width
      :value="stringValue"
      :minlength="definition.minLength"
      :maxlength="definition.maxLength"
      :readonly="definition.isReadonly"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      :aria-expanded="isMenuOpen && visibleSuggestions.length > 0"
      :aria-controls="autocompleteId"
      :aria-activedescendant="activeDescendantId"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="handleInput"
      @keydown="handleKeydown"
    />

    <OcAutocompletePopover
      :id="autocompleteId"
      :open="isMenuOpen"
      :anchor="activeInput"
      :items="visibleSuggestions"
      :active-key="activeKey"
      @select="applySuggestionByKey"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import OcAutocompletePopover from '../../standard/OcAutocompletePopover.vue'
import OcFieldInput from '../../base/OcFieldInput.vue'
import { useProjectStore } from '../../../features/workspace/store/projectStore'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'
import type { IconToken } from '../../../shared/ui/icon/iconRegistry'

type FilePathDefinition = Extract<EditorPropertyDefinition, { datatype: 'filePath' }>

type SuggestionItem = {
  key: string
  label: string
  value: string
  isDirectory: boolean
  detail?: string
  icon: IconToken
}

type FocusableInput = {
  focus: () => void
}

const props = defineProps<{
  definition: FilePathDefinition
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const { projectPath, indexedEntries, listProjectDirectoryEntries } = useProjectStore()

const inputElement = ref<FocusableInput | null>(null)
const isFocused = ref(false)
const isMenuOpen = ref(false)
const activeKey = ref<string | null>(null)
const activeInput = ref<HTMLInputElement | null>(null)
const autocompleteId = useId()
const directorySuggestions = ref<SuggestionItem[]>([])

const stringValue = computed(() => (props.value == null ? '' : String(props.value)).replace(/\\/g, '/'))

const pathState = computed(() => {
  const normalizedValue = stringValue.value.replace(/\\/g, '/')
  const trimmedValue = normalizedValue.replace(/^\/+/, '')
  const slashIndex = trimmedValue.lastIndexOf('/')

  if (slashIndex === -1) {
    return {
      directory: '',
      fragment: trimmedValue,
    }
  }

  return {
    directory: trimmedValue.slice(0, slashIndex),
    fragment: trimmedValue.slice(slashIndex + 1),
  }
})

const normalizedExtensions = computed(() =>
  (props.definition.extensionsFilter ?? []).map((extension) =>
    extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`
  )
)

const activeDescendantId = computed(() => {
  if (!activeKey.value) return undefined
  return autocompleteId + '-option-' + activeKey.value.replace(/[^a-zA-Z0-9_-]/g, '-')
})

const visibleSuggestions = computed(() => {
  const fragment = pathState.value.fragment.trim().toLowerCase()
  const suggestions = directorySuggestions.value.filter((suggestion) => {
    if (!fragment) {
      return true
    }

    return suggestion.label.toLowerCase().includes(fragment)
  })

  return [...suggestions].sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) {
      return left.isDirectory ? -1 : 1
    }

    const leftStartsWith = fragment ? left.label.toLowerCase().startsWith(fragment) : true
    const rightStartsWith = fragment ? right.label.toLowerCase().startsWith(fragment) : true
    if (leftStartsWith !== rightStartsWith) {
      return leftStartsWith ? -1 : 1
    }

    return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
  })
})

watch(visibleSuggestions, (nextSuggestions) => {
  if (nextSuggestions.some((item) => item.key === activeKey.value)) {
    return
  }
  activeKey.value = nextSuggestions[0]?.key ?? null
})

watch(
  () => pathState.value.directory,
  async () => {
    if (!isFocused.value || props.definition.isReadonly) {
      return
    }

    await loadSuggestions()
  }
)

async function loadSuggestions() {
  if (!projectPath.value) {
    directorySuggestions.value = []
    isMenuOpen.value = false
    return
  }

  try {
    const directory = pathState.value.directory
    let entries = await listProjectDirectoryEntries(directory)
    if (directory === '' && entries.length === 0) {
      entries = indexedEntries.value.filter((entry) => {
        const relativePath = String(entry.name ?? '').replace(/\\/g, '/')
        return relativePath.length > 0 && !relativePath.includes('/')
      })
    }

    const nextSuggestions: SuggestionItem[] = []

    if (directory) {
      const parentDirectory = getParentDirectory(directory)
      nextSuggestions.push({
        key: `parent:${directory}`,
        label: '..',
        value: parentDirectory ? `${parentDirectory}/` : '',
        isDirectory: true,
        detail: '返回上一级',
        icon: 'nav.arrow-up',
      })
    }

    for (const entry of entries) {
      const relativePath = String(entry.name).replace(/\\/g, '/')
      const name = relativePath.split('/').pop() ?? relativePath
      const isDirectory = Boolean(entry.isDirectory)

      if (!isDirectory && !matchesExtensionFilter(name)) {
        continue
      }

      nextSuggestions.push({
        key: relativePath,
        label: name,
        value: isDirectory ? `${relativePath}/` : relativePath,
        isDirectory,
        detail: directory ? relativePath : undefined,
        icon: isDirectory ? 'folder.generic' : 'file.generic',
      })
    }

    directorySuggestions.value = nextSuggestions
    activeKey.value = visibleSuggestions.value[0]?.key ?? null
    isMenuOpen.value = isFocused.value && nextSuggestions.length > 0
  } catch (error) {
    console.error('加载文件路径候选失败:', error)
    directorySuggestions.value = []
    isMenuOpen.value = false
  }
}

function matchesExtensionFilter(fileName: string) {
  if (normalizedExtensions.value.length === 0) {
    return true
  }

  const lowerName = fileName.toLowerCase()
  return normalizedExtensions.value.some((extension) => lowerName.endsWith(extension))
}

function getParentDirectory(path: string) {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const lastSlashIndex = normalizedPath.lastIndexOf('/')
  if (lastSlashIndex === -1) {
    return ''
  }

  return normalizedPath.slice(0, lastSlashIndex)
}

function handleInput(event: Event) {
  const control = event.target as HTMLInputElement
  activeInput.value = control
  const nextValue = control.value.replace(/\\/g, '/')
  emit('update:value', nextValue)
  isMenuOpen.value = true
  activeKey.value = visibleSuggestions.value[0]?.key ?? null
}

async function handleFocus(event: FocusEvent) {
  activeInput.value = event.target as HTMLInputElement
  if (props.definition.isReadonly) {
    return
  }

  isFocused.value = true
  isMenuOpen.value = true
  await loadSuggestions()
}

function handleBlur() {
  isFocused.value = false
  window.setTimeout(() => {
    if (!isFocused.value) {
      isMenuOpen.value = false
    }
  }, 0)
}

function applySuggestionByKey(key: string): void {
  const suggestion = visibleSuggestions.value.find((item) => item.key === key)
  if (suggestion) {
    applySuggestion(suggestion)
  }
}

function applySuggestion(suggestion: SuggestionItem) {
  emit('update:value', suggestion.value)
  activeKey.value = visibleSuggestions.value[0]?.key ?? null

  if (suggestion.isDirectory) {
    isMenuOpen.value = true
    window.setTimeout(() => {
      inputElement.value?.focus()
    }, 0)
    return
  }

  isMenuOpen.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (props.definition.isReadonly) {
    return
  }

  if (event.key === 'ArrowDown') {
    if (!isMenuOpen.value && visibleSuggestions.value.length > 0) {
      isMenuOpen.value = true
      event.preventDefault()
      return
    }

    if (visibleSuggestions.value.length === 0) {
      return
    }

    event.preventDefault()
    const currentIndex = Math.max(0, visibleSuggestions.value.findIndex((item) => item.key === activeKey.value))
    activeKey.value = visibleSuggestions.value[(currentIndex + 1) % visibleSuggestions.value.length]?.key ?? null
    return
  }

  if (event.key === 'ArrowUp') {
    if (visibleSuggestions.value.length === 0) {
      return
    }

    event.preventDefault()
    const currentIndex = Math.max(0, visibleSuggestions.value.findIndex((item) => item.key === activeKey.value))
    activeKey.value = visibleSuggestions.value[
      (currentIndex - 1 + visibleSuggestions.value.length) % visibleSuggestions.value.length
    ]?.key ?? null
    return
  }

  if (event.key === 'Tab' || event.key === 'Enter') {
    const suggestion = visibleSuggestions.value.find((item) => item.key === activeKey.value)
    if (!suggestion) {
      return
    }

    event.preventDefault()
    applySuggestion(suggestion)
    return
  }

  if (event.key === 'Escape') {
    isMenuOpen.value = false
  }
}
</script>

<style scoped>
.file-path-field {
  position: relative;
  flex: 1;
  min-width: 0;
}

</style>

