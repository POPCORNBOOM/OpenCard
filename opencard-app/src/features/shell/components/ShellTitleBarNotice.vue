<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import type { ShellTitleBarNotice } from '../titlebarNotices'

defineProps<{ notice: ShellTitleBarNotice }>()

const isFaded = ref(false)
let fadeTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  fadeTimer = setTimeout(() => {
    isFaded.value = true
  }, 2200)
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
