<!-- 业务 项目封面字段：整幅封面横幅加可编辑的项目相对路径；操作失败通过标题栏即时消息反馈。 -->
<template>
  <div class="project-cover-field">
    <button type="button" class="project-cover-field__banner" :class="{ 'is-empty': !cover }"
      :data-tooltip="actionHint" :aria-label="actionHint" @click="chooseProjectFile">
      <img v-if="cover" :src="cover.src" :alt="t('projectConfig.cover.previewAlt')" />
      <span v-else class="project-cover-field__placeholder">
        <OcIcon name="file.image" size="lg" tone="muted" />
        <OcText tone="muted" size="sm">{{ t('projectConfig.cover.empty') }}</OcText>
      </span>
    </button>
    <div class="project-cover-field__path">
      <OcFieldInput full-width mono :value="pathDraft" :placeholder="t('projectConfig.cover.pathPlaceholder')"
        :aria-label="t('projectConfig.fields.cover')"
        @input="updatePathDraft" @change="commitPathDraft" @keydown.enter.prevent="commitPathDraft" />
      <OcButton v-if="relativePath" icon-only size="sm" variant="ghost" icon="action.image-minus"
        icon-tone="danger" :data-tooltip="t('projectConfig.cover.remove')"
        :aria-label="t('projectConfig.cover.remove')" @click="clear" />
    </div>
    <OcText v-if="stateNote" tone="muted" size="sm">{{ stateNote }}</OcText>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import { notifyError } from '../../features/notifications/titlebarNotices'
import {
  COVER_IMAGE_EXTENSIONS,
  coverImageExtension,
  normalizeProjectRelativeCoverPath,
  projectRelativePathFromAbsolute,
  type ProjectCover,
} from '../../features/workspace/model/projectCover'
import { resolveProjectCover } from '../../features/workspace/services/projectCoverService'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { useProjectStore } from '../../features/workspace/store/projectStore'

defineOptions({ name: 'ProjectCoverField' })

const props = withDefaults(defineProps<{
  /** 当前封面：项目根相对路径；空字符串表示该项目尚未设置封面。 */
  modelValue?: string
  /** 项目根目录，用于解析封面文件与文件选择的默认位置。 */
  projectRootPath: string
}>(), {
  modelValue: '',
})

const emit = defineEmits<{
  /** 封面路径变化；空字符串表示移除封面引用。 */
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const projectStore = useProjectStore()
const cover = ref<ProjectCover | null>(null)
const pathDraft = ref('')
let coverRevision = 0

const relativePath = computed(() => props.modelValue.trim())
const actionHint = computed(() => (
  relativePath.value ? t('projectConfig.cover.replaceHint') : t('projectConfig.cover.chooseHint')
))
/** 引用已写入配置但文件不可用时的状态说明（不是操作失败，因此只做说明）。 */
const stateNote = computed(() => {
  if (!relativePath.value) return ''
  if (!coverImageExtension(relativePath.value)) {
    return t('projectConfig.cover.unsupported', { path: relativePath.value })
  }
  return cover.value ? '' : t('projectConfig.cover.missing', { path: relativePath.value })
})

watch(() => props.modelValue, value => {
  pathDraft.value = value ?? ''
}, { immediate: true })

watch(
  [() => props.modelValue, () => props.projectRootPath, () => projectStore.fileChangeRevision],
  async () => {
    const revision = ++coverRevision
    const resolved = relativePath.value
      ? await resolveProjectCover({
        fs: fileSystemService,
        rootPath: props.projectRootPath,
        relativePath: relativePath.value,
      })
      : null
    if (revision !== coverRevision) return
    cover.value = resolved
  },
  { immediate: true },
)

function updatePathDraft(event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  pathDraft.value = event.target.value
}

/** 只有合法的项目内路径才会写入草稿，出错时通过即时消息说明并回到已生效的路径。 */
function commitPathDraft(): void {
  const draft = pathDraft.value.trim()
  if (!draft) {
    if (relativePath.value) emit('update:modelValue', '')
    return
  }
  const normalized = normalizeProjectRelativeCoverPath(draft)
  if (!normalized || !coverImageExtension(normalized)) {
    notifyError(t('projectConfig.cover.invalidPath', { path: draft }))
    pathDraft.value = relativePath.value
    return
  }
  if (normalized !== relativePath.value) emit('update:modelValue', normalized)
}

async function chooseProjectFile(): Promise<void> {
  const picked = await fileSystemService.pickFile({
    title: t('projectConfig.cover.choose'),
    fileTypeName: t('projectConfig.cover.fileTypeName'),
    extensions: [...COVER_IMAGE_EXTENSIONS],
    defaultPath: props.projectRootPath,
  })
  if (!picked) return
  const relative = projectRelativePathFromAbsolute(props.projectRootPath, picked)
  if (!relative) {
    notifyError(t('projectConfig.cover.outsideProject'))
    return
  }
  if (!coverImageExtension(relative)) {
    notifyError(t('projectConfig.cover.unsupported', { path: relative }))
    return
  }
  emit('update:modelValue', relative)
}

function clear(): void {
  pathDraft.value = ''
  emit('update:modelValue', '')
}
</script>

<style scoped>
.project-cover-field {
  display: grid;
  gap: var(--oc-space-2);
}

.project-cover-field__banner {
  display: flex;
  width: 100%;
  height: var(--oc-cover-banner-height);
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
  cursor: pointer;
  transition: border-color var(--oc-duration-fast) var(--oc-ease);
}

.project-cover-field__banner:hover,
.project-cover-field__banner:focus-visible {
  border-color: var(--oc-border-accent);
  outline: none;
}

.project-cover-field__banner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-cover-field__placeholder {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.project-cover-field__path {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
}
</style>
