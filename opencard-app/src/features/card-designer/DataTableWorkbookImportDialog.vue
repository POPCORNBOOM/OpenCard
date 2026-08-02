<template>
  <Teleport to="body">
    <div v-if="result" class="workbook-import-dialog__backdrop" @mousedown.self="emit('cancel')">
      <section
        class="workbook-import-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t('cardDesigner.dataTable.importReviewTitle')"
        @keydown.esc.prevent="emit('cancel')"
      >
        <header>
          <h2>{{ t('cardDesigner.dataTable.importReviewTitle') }}</h2>
          <p>{{ t('cardDesigner.dataTable.importReviewDescription') }}</p>
        </header>

        <dl class="workbook-import-dialog__summary">
          <div>
            <dt>{{ t('cardDesigner.dataTable.importReviewInstances') }}</dt>
            <dd>{{ result.newInstances.length }}</dd>
          </div>
          <div>
            <dt>{{ t('cardDesigner.dataTable.importReviewBlockNames') }}</dt>
            <dd>{{ result.blockRenames.length }}</dd>
          </div>
          <div>
            <dt>{{ t('cardDesigner.dataTable.importReviewCells') }}</dt>
            <dd>{{ result.updates.length }}</dd>
          </div>
        </dl>

        <div v-if="result.newInstances.length || result.blockRenames.length" class="workbook-import-dialog__details">
          <section v-if="result.newInstances.length">
            <h3>{{ t('cardDesigner.dataTable.importReviewNewInstances') }}</h3>
            <ul>
              <li v-for="instance in result.newInstances" :key="instance.id">{{ instance.name }}</li>
            </ul>
          </section>
          <section v-if="result.blockRenames.length">
            <h3>{{ t('cardDesigner.dataTable.importReviewRenamedBlocks') }}</h3>
            <ul>
              <li v-for="rename in result.blockRenames" :key="rename.blockId">
                {{ rename.previousName }} → {{ rename.nextName || t('cardDesigner.dataTable.importReviewEmptyName') }}
              </li>
            </ul>
          </section>
        </div>

        <ul v-if="result.warnings.length" class="workbook-import-dialog__warnings" role="alert">
          <li v-for="warning in result.warnings" :key="warning">{{ warning }}</li>
        </ul>

        <p v-if="!hasChanges" class="workbook-import-dialog__empty">
          {{ t('cardDesigner.dataTable.importNoChanges') }}
        </p>

        <footer>
          <OcButton @click="emit('cancel')">{{ t('cardDesigner.dataTable.importCancel') }}</OcButton>
          <OcButton variant="solid" :disabled="!hasChanges" @click="emit('confirm')">
            {{ t('cardDesigner.dataTable.importConfirm') }}
          </OcButton>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../components/base/OcButton.vue'
import type { CardDataWorkbookImportResult } from './cardDataWorkbook'

const props = defineProps<{ result: CardDataWorkbookImportResult | null }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const { t } = useI18n()
const hasChanges = computed(() => Boolean(
  props.result
  && (props.result.updates.length || props.result.blockRenames.length || props.result.newInstances.length),
))
</script>

<style scoped>
.workbook-import-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--oc-z-modal);
  display: grid;
  place-items: center;
  padding: var(--oc-space-6);
  background: var(--oc-bg-glass);
}

.workbook-import-dialog {
  display: grid;
  gap: var(--oc-space-4);
  width: min(100%, var(--oc-content-width-md));
  max-height: var(--oc-list-max-height-lg);
  padding: var(--oc-space-5);
  overflow: auto;
  border: var(--oc-border-width) solid var(--oc-border-default);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
  box-shadow: var(--oc-shadow-lg);
  color: var(--oc-fg-default);
}

.workbook-import-dialog h2,
.workbook-import-dialog h3,
.workbook-import-dialog p,
.workbook-import-dialog dl,
.workbook-import-dialog ul {
  margin: 0;
}

.workbook-import-dialog header p,
.workbook-import-dialog__empty {
  color: var(--oc-fg-muted);
}

.workbook-import-dialog__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--oc-space-2);
}

.workbook-import-dialog__summary > div,
.workbook-import-dialog__details section {
  padding: var(--oc-space-3);
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-raised);
}

.workbook-import-dialog__summary dt {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.workbook-import-dialog__summary dd {
  margin: var(--oc-space-1) 0 0;
  font-size: var(--oc-text-lg);
}

.workbook-import-dialog__details {
  display: grid;
  gap: var(--oc-space-2);
}

.workbook-import-dialog__details ul,
.workbook-import-dialog__warnings {
  padding-left: var(--oc-space-5);
}

.workbook-import-dialog__warnings {
  color: var(--oc-icon-warning);
}

.workbook-import-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--oc-space-2);
}
</style>
