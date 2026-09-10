<template>
  <ProjectRegistryEditorShell icon="file.package"
    :heading="manifest?.name ?? packageKey ?? t('packageManifest.title')"
    :description="t('packageManifest.description')">
    <OcEmpty v-if="!manifest" tone="muted" inset="comfortable">
      {{ t('packageManifest.unavailable') }}
    </OcEmpty>
    <div v-else class="package-manifest-editor">
      <OcPanel gap="3" padding="4" border="muted" radius="md">
        <h2>{{ t('packageManifest.information') }}</h2>
        <dl class="package-manifest-editor__details">
          <div><dt>{{ t('packageManifest.key') }}</dt><dd><code>{{ manifest.key }}</code></dd></div>
          <div><dt>{{ t('packageManifest.version') }}</dt><dd>{{ manifest.version }}</dd></div>
          <div><dt>{{ t('packageManifest.contentHash') }}</dt><dd><code>{{ manifest.contentHash }}</code></dd></div>
        </dl>
      </OcPanel>

      <OcPanel gap="3" padding="4" border="muted" radius="md">
        <h2>{{ t('packageManifest.fonts') }}</h2>
        <OcEmpty v-if="manifest.public.fonts.length === 0" tone="muted" inset="compact">
          {{ t('packageManifest.noFonts') }}
        </OcEmpty>
        <ul v-else class="package-manifest-editor__resources">
          <li v-for="font in manifest.public.fonts" :key="font.key">
            <span>{{ font.title }}</span><code>{{ font.key }}</code>
          </li>
        </ul>
      </OcPanel>

      <OcPanel gap="3" padding="4" border="muted" radius="md">
        <h2>{{ t('packageManifest.iconSeries') }}</h2>
        <OcEmpty v-if="manifest.public.iconSeries.length === 0" tone="muted" inset="compact">
          {{ t('packageManifest.noIconSeries') }}
        </OcEmpty>
        <ul v-else class="package-manifest-editor__resources">
          <li v-for="series in manifest.public.iconSeries" :key="series.key">
            <span>{{ series.title }}</span>
            <code>{{ series.key }}</code>
            <span>{{ t('packageManifest.iconCount', { count: series.count }) }}</span>
          </li>
        </ul>
      </OcPanel>
    </div>
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { resolveInstalledResourcePackageKey } from '../../features/workspace/model/resourcePackage'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import OcEmpty from '../base/OcEmpty.vue'
import OcPanel from '../base/OcPanel.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()

const packageKey = computed(() => resolveInstalledResourcePackageKey(props.filePath) ?? '')
const manifest = computed(() => projectStore.projectResourcePackages.value.get(packageKey.value)?.manifest ?? null)

watch(() => props.filePath, () => emit('modified', false), { immediate: true })
</script>

<style scoped>
.package-manifest-editor {
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-4);
}

.package-manifest-editor h2,
.package-manifest-editor dl,
.package-manifest-editor dd,
.package-manifest-editor ul {
  margin: 0;
}

.package-manifest-editor h2 {
  font-size: var(--oc-text-md);
  color: var(--oc-fg-default);
}

.package-manifest-editor__details,
.package-manifest-editor__resources {
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-2);
  padding: 0;
}

.package-manifest-editor__details > div,
.package-manifest-editor__resources > li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--oc-space-2);
}

.package-manifest-editor__details dt {
  color: var(--oc-fg-muted);
}

.package-manifest-editor__resources > li {
  list-style: none;
}

.package-manifest-editor code {
  overflow-wrap: anywhere;
  color: var(--oc-fg-muted);
}
</style>
