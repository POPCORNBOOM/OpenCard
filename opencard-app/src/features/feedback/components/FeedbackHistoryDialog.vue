<template>
  <Teleport to="body">
    <div v-if="open" class="feedback-history__backdrop">
      <section
        class="feedback-history"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.esc.prevent="close"
      >
        <header class="feedback-history__header">
          <div>
            <h2 :id="titleId">{{ t('app.feedback.title') }}</h2>
            <p>{{ t('app.feedback.history.description') }}</p>
          </div>
          <FeedbackPageTabs
            :active-page="activePage"
            @update:active-page="emit('pageChange', $event)"
          />
          <OcButton
            icon="action.close"
            icon-only
            :aria-label="t('app.feedback.actions.close')"
            @click="close"
          />
        </header>

        <div v-if="loading" class="feedback-history__empty" role="status">
          {{ t('app.feedback.history.loading') }}
        </div>
        <div v-else-if="records.length === 0" class="feedback-history__empty">
          <strong>{{ errorKey ? t(errorKey) : t('app.feedback.history.emptyTitle') }}</strong>
          <span v-if="!errorKey">{{ t('app.feedback.history.emptyDescription') }}</span>
        </div>
        <div v-else class="feedback-history__body">
          <nav :aria-label="t('app.feedback.history.listLabel')">
            <button
              v-for="record in records"
              :key="record.reportId"
              type="button"
              class="feedback-history__item"
              :class="{ 'is-active': record.reportId === selectedReportId }"
              :aria-current="record.reportId === selectedReportId ? 'true' : undefined"
              @click="selectRecord(record.reportId)"
            >
              <span class="feedback-history__item-heading">
                <strong>{{ record.summary }}</strong>
                <span class="feedback-history__status" :data-status="record.status">
                  {{ t(`app.feedback.history.status.${record.status}`) }}
                </span>
              </span>
              <span>{{ t(`app.feedback.kind.${record.kind}`) }} · {{ formatDate(record.submittedAt) }}</span>
            </button>
          </nav>

          <article v-if="selectedRecord" class="feedback-history__detail">
            <div class="feedback-history__detail-heading">
              <div>
                <span>{{ t(`app.feedback.kind.${selectedRecord.kind}`) }}</span>
                <h3>{{ selectedRecord.summary }}</h3>
              </div>
              <span class="feedback-history__status" :data-status="selectedRecord.status">
                {{ t(`app.feedback.history.status.${selectedRecord.status}`) }}
              </span>
            </div>

            <dl>
              <div>
                <dt>{{ t('app.feedback.history.reportId') }}</dt>
                <dd>{{ selectedRecord.reportId }}</dd>
              </div>
              <div>
                <dt>{{ t('app.feedback.history.submittedAt') }}</dt>
                <dd>{{ formatDate(selectedRecord.submittedAt) }}</dd>
              </div>
              <div v-if="selectedRecord.lastSyncedAt">
                <dt>{{ t('app.feedback.history.lastSyncedAt') }}</dt>
                <dd>{{ formatDate(selectedRecord.lastSyncedAt) }}</dd>
              </div>
            </dl>

            <section class="feedback-history__response">
              <h4>{{ t('app.feedback.history.officialResponse') }}</h4>
              <p v-if="selectedRecord.officialResponse">{{ selectedRecord.officialResponse.text }}</p>
              <p v-else class="feedback-history__muted">
                {{ t(`app.feedback.history.noResponse.${selectedRecord.status}`) }}
              </p>
            </section>

            <p v-if="errorKey" class="feedback-history__error" role="alert">{{ t(errorKey) }}</p>

            <div v-if="confirmingDelete" class="feedback-history__delete-confirm" role="alertdialog">
              <span>{{ t('app.feedback.history.deleteConfirmation') }}</span>
              <div>
                <OcButton size="sm" @click="confirmingDelete = false">
                  {{ t('app.feedback.actions.cancel') }}
                </OcButton>
                <OcButton size="sm" variant="solid" icon="action.delete" @click="removeSelected">
                  {{ t('app.feedback.history.deleteLocal') }}
                </OcButton>
              </div>
            </div>

            <footer>
              <OcButton v-if="!confirmingDelete" icon="action.delete" icon-tone="danger" @click="confirmingDelete = true">
                {{ t('app.feedback.history.deleteLocal') }}
              </OcButton>
              <OcButton
                v-if="developerMode"
                icon="action.refresh"
                variant="solid"
                :disabled="refreshing"
                @click="refreshRecords(true)"
              >
                {{ refreshing ? t('app.feedback.history.refreshing') : t('app.feedback.history.refresh') }}
              </OcButton>
            </footer>
          </article>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import type { FeedbackPage } from '../model/feedback'
import { FeedbackServiceError, getFeedbackStatuses } from '../services/feedbackService'
import {
  feedbackReceiptStore,
  type FeedbackReceiptRecord,
} from '../services/feedbackReceiptStore'
import FeedbackPageTabs from './FeedbackPageTabs.vue'

const props = withDefaults(defineProps<{
  open: boolean
  developerMode?: boolean
  activePage?: FeedbackPage
}>(), {
  developerMode: false,
  activePage: 'history',
})
const emit = defineEmits<{ close: []; pageChange: [page: FeedbackPage] }>()
const { locale, t } = useI18n()
const titleId = `feedback-history-title-${Math.random().toString(36).slice(2)}`
const records = ref<FeedbackReceiptRecord[]>([])
const selectedReportId = ref<string | null>(null)
const loading = ref(false)
const refreshing = ref(false)
const confirmingDelete = ref(false)
const errorKey = ref('')

const selectedRecord = computed(() => (
  records.value.find(record => record.reportId === selectedReportId.value) ?? null
))

watch(() => props.open, (open) => {
  if (open) void loadRecords(true)
  else resetTransientState()
}, { immediate: true })

async function loadRecords(refreshFirst: boolean): Promise<void> {
  loading.value = true
  errorKey.value = ''
  try {
    records.value = await feedbackReceiptStore.list()
    if (!records.value.some(record => record.reportId === selectedReportId.value)) {
      selectedReportId.value = records.value[0]?.reportId ?? null
    }
  } catch {
    records.value = []
    selectedReportId.value = null
    errorKey.value = 'app.feedback.history.errors.storage'
  } finally {
    loading.value = false
  }
  if (refreshFirst) await refreshRecords(false)
}

function selectRecord(reportId: string): void {
  if (selectedReportId.value === reportId) return
  selectedReportId.value = reportId
  confirmingDelete.value = false
  errorKey.value = ''
}

async function refreshRecords(force: boolean): Promise<void> {
  const now = Date.now()
  const dueRecords = records.value.filter(record => (
    record.status !== 'closed'
    && (force || !record.nextCheckAt || Number.isNaN(Date.parse(record.nextCheckAt)) || Date.parse(record.nextCheckAt) <= now)
  ))
  if (dueRecords.length === 0 || refreshing.value) return
  refreshing.value = true
  errorKey.value = ''
  try {
    const results = await getFeedbackStatuses(dueRecords.map(record => ({
      reportId: record.reportId,
      receiptToken: record.receiptToken,
    })))
    await feedbackReceiptStore.applyStatuses(results)
    records.value = await feedbackReceiptStore.list()
  } catch (error) {
    try {
      await feedbackReceiptStore.markRefreshFailed(dueRecords.map(record => record.reportId))
      records.value = await feedbackReceiptStore.list()
    } catch {
      // Keep the cached records visible even when backoff persistence fails.
    }
    errorKey.value = error instanceof FeedbackServiceError
      ? `app.feedback.history.errors.${error.code}`
      : 'app.feedback.history.errors.network'
  } finally {
    refreshing.value = false
  }
}

async function removeSelected(): Promise<void> {
  if (!selectedRecord.value) return
  try {
    await feedbackReceiptStore.remove(selectedRecord.value.reportId)
    confirmingDelete.value = false
    selectedReportId.value = null
    await loadRecords(false)
  } catch {
    errorKey.value = 'app.feedback.history.errors.storage'
  }
}

function close(): void {
  emit('close')
}

function resetTransientState(): void {
  confirmingDelete.value = false
  errorKey.value = ''
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
</script>

<style scoped>
.feedback-history__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: var(--oc-space-6);
  background: color-mix(in srgb, var(--oc-bg-base) 68%, transparent);
}

.feedback-history {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(860px, 100%);
  height: min(720px, calc(100vh - 48px));
  overflow: hidden;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-lg);
  background: var(--oc-bg-surface);
  box-shadow: var(--oc-shadow-lg);
  color: var(--oc-fg-default);
}

.feedback-history__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--oc-space-4);
  padding: var(--oc-space-5);
  border-bottom: 1px solid var(--oc-border-muted);
}
.feedback-history__header > :last-child { justify-self: end; }

.feedback-history__header h2,
.feedback-history__header p,
.feedback-history__detail h3,
.feedback-history__response h4,
.feedback-history__response p {
  margin: 0;
}

.feedback-history__header h2 { font-size: var(--oc-text-lg); }
.feedback-history__header p,
.feedback-history__muted { color: var(--oc-fg-muted); }
.feedback-history__header p { margin-top: var(--oc-space-1); }

.feedback-history__body {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.6fr);
  min-height: 0;
}

.feedback-history__body nav {
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border-right: 1px solid var(--oc-border-muted);
  background: var(--oc-bg-base);
}

.feedback-history__item {
  display: grid;
  width: 100%;
  gap: var(--oc-space-2);
  padding: var(--oc-space-4);
  border: 0;
  border-bottom: 1px solid var(--oc-border-muted);
  background: transparent;
  color: var(--oc-fg-muted);
  text-align: left;
  cursor: pointer;
}

.feedback-history__item:hover { background: var(--oc-bg-hover); }
.feedback-history__item.is-active {
  background: var(--oc-bg-raised);
  box-shadow: inset 2px 0 var(--oc-border-accent);
}

.feedback-history__item-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--oc-space-2);
  min-width: 0;
}

.feedback-history__item strong {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  color: var(--oc-fg-default);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feedback-history__status {
  flex: 0 0 auto;
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}

.feedback-history__status[data-status="answered"] { color: var(--oc-fg-accent); }
.feedback-history__status[data-status="closed"] { color: var(--oc-fg-subtle); }

.feedback-history__detail {
  min-width: 0;
  overflow: auto;
  padding: var(--oc-space-5);
}

.feedback-history__detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--oc-space-4);
}

.feedback-history__detail-heading > div > span,
.feedback-history__detail dt {
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-xs);
}

.feedback-history__detail h3 { margin-top: var(--oc-space-1); }
.feedback-history__detail dl {
  display: grid;
  gap: var(--oc-space-2);
  margin: var(--oc-space-5) 0;
}
.feedback-history__detail dl > div {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: var(--oc-space-3);
}
.feedback-history__detail dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.feedback-history__response {
  padding: var(--oc-space-4);
  border: 1px solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-raised);
}
.feedback-history__response p {
  margin-top: var(--oc-space-3);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.feedback-history__error,
.feedback-history__delete-confirm {
  margin: var(--oc-space-4) 0 0;
  padding: var(--oc-space-3);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-danger-subtle);
  color: var(--oc-fg-danger);
}
.feedback-history__delete-confirm,
.feedback-history__delete-confirm > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-2);
}

.feedback-history__detail footer {
  display: flex;
  justify-content: space-between;
  gap: var(--oc-space-3);
  margin-top: var(--oc-space-5);
}

.feedback-history__empty {
  display: grid;
  min-height: 0;
  place-content: center;
  gap: var(--oc-space-2);
  padding: var(--oc-space-6);
  color: var(--oc-fg-muted);
  text-align: center;
}

@media (max-width: 700px) {
  .feedback-history__header { grid-template-columns: 1fr auto; }
  .feedback-history__header > :nth-child(2) { grid-column: 1 / -1; grid-row: 2; }
  .feedback-history__body { grid-template-columns: 1fr; }
  .feedback-history__body nav { max-height: 180px; border-right: 0; border-bottom: 1px solid var(--oc-border-muted); }
}
</style>
