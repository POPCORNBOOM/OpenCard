<template>
  <OcIcon
    :name="name"
    :size="size"
    :tone="tone"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import type { IconResolvable, IconTone } from '../../shared/ui/icon/iconRegistry'
import OcIcon from '../base/OcIcon.vue'

type AppIconTone =
  | IconTone
  | 'opencard'
  | 'json'
  | 'markdown'
  | 'typescript'
  | 'javascript'
  | 'vue'
  | 'html'
  | 'css'
  | 'image'
  | 'package'
  | 'config'
  | 'folder-default'
  | 'folder-open'
  | 'folder-src'
  | 'folder-assets'
  | 'folder-components'
  | 'folder-views'
  | 'folder-locales'
  | 'folder-core'

type AppIconSize = 'sm' | 'md' | 'lg'

defineOptions({
  name: 'AppIcon',
  inheritAttrs: false,
})

defineProps<{
  name?: IconResolvable
  size?: AppIconSize
  tone?: AppIconTone
}>()
</script>
