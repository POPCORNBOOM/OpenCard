<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { EzSelectOption } from './types';

const props = defineProps<{
  modelValue: string;
  options: EzSelectOption[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

const selectedLabel = computed(() => {
  const option = props.options.find((item) => item.value === props.modelValue);
  return option?.label ?? props.placeholder ?? '';
});

function close(): void {
  open.value = false;
}

function updateMenuPosition(): void {
  const trigger = root.value?.querySelector('.app-select-trigger') as HTMLElement | null;
  if (!trigger) {
    return;
  }

  const rect = trigger.getBoundingClientRect();
  menuStyle.value = {
    left: `${Math.round(rect.left)}px`,
    top: `${Math.round(rect.bottom + 8)}px`,
    width: `${Math.round(rect.width)}px`
  };
}

async function toggle(): Promise<void> {
  open.value = !open.value;
  if (open.value) {
    await nextTick();
    updateMenuPosition();
  }
}

function select(value: string): void {
  emit('update:modelValue', value);
  close();
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node | null;
  if (!root.value || (target && (root.value.contains(target) || menu.value?.contains(target)))) {
    return;
  }

  close();
}

function onViewportChanged(): void {
  if (open.value) {
    updateMenuPosition();
  }
}

onMounted(() => {
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', onViewportChanged);
  window.addEventListener('scroll', onViewportChanged, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPointerDown);
  window.removeEventListener('resize', onViewportChanged);
  window.removeEventListener('scroll', onViewportChanged, true);
});
</script>

<template>
  <div ref="root" class="app-select" :class="{ open }">
    <button class="app-select-trigger" type="button" :aria-expanded="open" @click="toggle">
      <span class="app-select-value" :class="{ placeholder: !modelValue }">
        {{ selectedLabel }}
      </span>
      <i class="mdi mdi-chevron-down app-select-icon" />
    </button>

    <teleport to="body">
      <div v-if="open" ref="menu" class="app-select-menu floating-overlay" :style="menuStyle">
        <button
          v-for="option in options"
          :key="option.value || '__empty__'"
          class="app-select-option"
          :class="{ selected: option.value === modelValue }"
          type="button"
          @click="select(option.value)"
        >
          <span>{{ option.label }}</span>
          <i v-if="option.value === modelValue" class="mdi mdi-check" />
        </button>
      </div>
    </teleport>
  </div>
</template>
