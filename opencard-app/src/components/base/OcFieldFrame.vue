<!-- Base 复合字段外壳：统一输入表面并承载可选前后缀。 -->
<template>
  <div
    class="oc-field-frame"
    :class="[
      `oc-field-frame--${size}`,
      {
        'oc-field-frame--full-width': fullWidth,
        'oc-field-frame--disabled': disabled,
        'oc-field-frame--readonly': readonly,
        'oc-field-frame--invalid': invalid,
        'oc-field-frame--busy': busy,
      },
    ]"
    :aria-disabled="disabled || undefined"
    :aria-readonly="readonly || undefined"
    :aria-invalid="invalid || undefined"
    :aria-busy="busy || undefined"
    v-bind="$attrs"
  >
    <span v-if="$slots.prefix" class="oc-field-frame__prefix"><slot name="prefix" /></span>
    <span class="oc-field-frame__control"><slot /></span>
    <span v-if="$slots.suffix" class="oc-field-frame__suffix"><slot name="suffix" /></span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  busy?: boolean
}

withDefaults(defineProps<Props>(), {
  size: 'md',
  fullWidth: false,
  disabled: false,
  readonly: false,
  invalid: false,
  busy: false,
})

defineOptions({ name: 'OcFieldFrame' })
</script>

<style scoped>
.oc-field-frame {
  display: flex;
  align-items: stretch;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--oc-field-surface-border-color, var(--oc-border-default));
  border-radius: var(--oc-field-surface-border-radius, var(--oc-radius-sm));
  background: var(--oc-field-surface-background, var(--oc-bg-input));
  color: var(--oc-fg-default);
  transition: border-color var(--oc-duration-fast) var(--oc-ease);
}

.oc-field-frame:focus-within:not(.oc-field-frame--disabled):not(.oc-field-frame--readonly) {
  border-color: var(--oc-field-surface-focus-border-color, var(--oc-border-accent));
  box-shadow: var(--oc-field-surface-focus-shadow, var(--oc-focus-ring));
}

.oc-field-frame--sm { height: var(--oc-size-sm); }
.oc-field-frame--md { height: var(--oc-size-md); }
.oc-field-frame--lg { height: var(--oc-size-lg); }

.oc-field-frame--full-width {
  width: 100%;
}

.oc-field-frame--disabled {
  opacity: .5;
  cursor: not-allowed;
}

.oc-field-frame--readonly {
  background: var(--oc-field-readonly-background, var(--oc-bg-raised));
  color: var(--oc-fg-muted);
}

.oc-field-frame--invalid {
  border-color: var(--oc-field-invalid-border-color, var(--oc-danger));
}

.oc-field-frame--busy {
  cursor: progress;
}

.oc-field-frame__prefix,
.oc-field-frame__suffix {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: stretch;
}

.oc-field-frame__control {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: stretch;
}
</style>
