<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import type { ShellTitleBarNotice } from '../../notifications/titlebarNotices'

const props = defineProps<{ notice: ShellTitleBarNotice }>()

const isFaded = ref(false)
let fadeTimer: ReturnType<typeof setTimeout> | undefined

function resetFadeTimer(): void {
  if (fadeTimer) clearTimeout(fadeTimer)
  isFaded.value = false
  fadeTimer = setTimeout(() => {
    isFaded.value = true
  }, 2200)
}

onMounted(() => {
  resetFadeTimer()
})

watch(() => props.notice.id, () => {
  resetFadeTimer()
})

onBeforeUnmount(() => {
  if (fadeTimer) clearTimeout(fadeTimer)
})
</script>

<template>
  <div
    class="titlebar-notice"
    :class="[
      `titlebar-notice-tone-${notice.tone ?? 'default'}`,
      { 'titlebar-notice-is-faded': isFaded },
    ]"
    role="status"
    aria-live="polite"
  >
    <OcIcon v-if="notice.icon" :name="notice.icon" size="sm" :tone="notice.tone" />
    <span>{{ notice.message }}</span>
  </div>
</template>
