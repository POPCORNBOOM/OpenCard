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
    <input
      ref="inputElement"
      class="prop-input oc-input"
      type="text"
      :value="stringValue"
      :minlength="definition.minLength"
      :maxlength="definition.maxLength"
      :readonly="definition.isReadonly"
      autocomplete="off"
      spellcheck="false"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <div v-if="isMenuOpen && visibleSuggestions.length > 0" class="suggestion-menu">
      <button
        v-for="(suggestion, index) in visibleSuggestions"
        :key="suggestion.key"
        class="suggestion-item"
        :class="{ selected: index === selectedIndex }"
        type="button"
        @mousedown.prevent="applySuggestion(suggestion)"
      >
        <span class="suggestion-main">
          <span class="codicon" :class="suggestion.icon" />
          <span>{{ suggestion.label }}</span>
        </span>
        <span v-if="suggestion.detail" class="suggestion-detail">{{ suggestion.detail }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useProjectStore } from '../../../features/workspace/store/projectStore'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'

type FilePathDefinition = Extract<EditorPropertyDefinition, { datatype: 'filePath' }>

type SuggestionItem = {
  key: string
  label: string
  value: string
  isDirectory: boolean
  detail?: string
  icon: string
}

const props = defineProps<{
  definition: FilePathDefinition
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const { projectPath, indexedEntries, listProjectDirectoryEntries } = useProjectStore()

const inputElement = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)
const isMenuOpen = ref(false)
const selectedIndex = ref(0)
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
  if (nextSuggestions.length === 0) {
    selectedIndex.value = 0
    return
  }

  selectedIndex.value = Math.min(selectedIndex.value, nextSuggestions.length - 1)
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
        icon: 'codicon-arrow-up',
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
        icon: isDirectory ? 'codicon-folder' : 'codicon-file',
      })
    }

    directorySuggestions.value = nextSuggestions
    selectedIndex.value = 0
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
  const nextValue = (event.target as HTMLInputElement).value.replace(/\\/g, '/')
  emit('update:value', nextValue)
  isMenuOpen.value = true
  selectedIndex.value = 0
}

async function handleFocus() {
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

function applySuggestion(suggestion: SuggestionItem) {
  emit('update:value', suggestion.value)
  selectedIndex.value = 0

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
    selectedIndex.value = (selectedIndex.value + 1) % visibleSuggestions.value.length
    return
  }

  if (event.key === 'ArrowUp') {
    if (visibleSuggestions.value.length === 0) {
      return
    }

    event.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + visibleSuggestions.value.length) % visibleSuggestions.value.length
    return
  }

  if (event.key === 'Tab' || event.key === 'Enter') {
    const suggestion = visibleSuggestions.value[selectedIndex.value]
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

.prop-input {
  width: 100%;
  padding: 2px 6px;
  box-sizing: border-box;
}

.prop-input:focus {
  border-color: var(--oc-accent);
}

.suggestion-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px;
  background: var(--oc-bg-panel);
  border: 1px solid var(--oc-bg-input);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  max-height: 220px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--oc-text-primary);
  padding: 6px 8px;
  font-size: 12px;
  text-align: left;
}

.suggestion-item.selected {
  background: var(--oc-bg-active);
}

.suggestion-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.suggestion-detail {
  color: var(--oc-text-secondary);
  font-size: var(--oc-label-size);
  white-space: nowrap;
}
</style>
