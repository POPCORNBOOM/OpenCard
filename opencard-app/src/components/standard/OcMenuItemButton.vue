<!-- Standard 菜单项按钮：组合 OcButton 与 OcIcon 构建菜单交互行。 -->
<template>
  <OcButton
    class="oc-menu-item-button"
    variant="ghost"
    size="md"
    radius="md"
    block
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <span class="oc-menu-item-button__main">
      <OcIcon v-if="icon" :name="icon" size="sm" />
      <span v-else class="oc-menu-item-button__icon-placeholder" />
      <span class="oc-menu-item-button__label">{{ label }}</span>
    </span>
    <OcIcon v-if="hasChildren" name="nav.chevron-right" class="oc-menu-item-button__chevron" size="sm" />
  </OcButton>
</template>

<script setup lang="ts">
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcButton from '../base/OcButton.vue'
import OcIcon from '../base/OcIcon.vue'

interface OcMenuItemButtonProps {
  /** 菜单主文案。 */
  label: string
  /** 左侧图标名。 */
  icon?: IconToken
  /** 是否显示右侧子菜单箭头。 */
  hasChildren?: boolean
  /** 是否禁用菜单项。 */
  disabled?: boolean
}

interface OcMenuItemButtonEmits {
  /** 点击菜单项时抛出。 */
  click: [event: MouseEvent]
}

defineOptions({ name: 'OcMenuItemButton' })

withDefaults(defineProps<OcMenuItemButtonProps>(), {
  icon: undefined,
  hasChildren: false,
  disabled: false,
})

const emit = defineEmits<OcMenuItemButtonEmits>()
</script>

<style scoped>
.oc-menu-item-button {
  width: 100%;
}

.oc-menu-item-button :deep(.oc-base-button__surface) {
  width: 100%;
  justify-content: space-between;
  gap: 10px;
  text-align: left;
}

.oc-menu-item-button__main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.oc-menu-item-button__icon-placeholder {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.oc-menu-item-button__label {
  white-space: nowrap;
}

.oc-menu-item-button__chevron {
  font-size: 10px;
}
</style>

