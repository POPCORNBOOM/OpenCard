import { computed, ref, type Ref } from 'vue'
import { message as showMessage } from '@tauri-apps/plugin-dialog'
import type { CardDocument } from '../../entities/card/model'
import { fileSystemService } from '../workspace/services/fileSystemService'
import {
  exportCardDataWorkbook,
  importCardDataWorkbook,
  type CardDataWorkbookUpdate,
} from './cardDataWorkbook'
import type {
  CdeDataTableColumn,
  CdeDataTableFaceGroup,
} from './useCdeDataTableModel'

type UseCdeDataTableWorkbookOptions = {
  cardDoc: Readonly<Ref<CardDocument | null>>
  columns: Readonly<Ref<readonly CdeDataTableColumn[]>>
  faceGroups: Readonly<Ref<readonly CdeDataTableFaceGroup[]>>
  exportInstanceIds: Readonly<Ref<readonly string[]>>
  flushPendingChanges: () => Promise<void>
  applyUpdates: (updates: readonly CardDataWorkbookUpdate[]) => boolean
  translate: (key: string, parameters?: Record<string, unknown>) => string
}

export function useCdeDataTableWorkbook(options: UseCdeDataTableWorkbookOptions) {
  const busy = ref(false)
  const canExport = computed(() => Boolean(
    options.cardDoc.value
    && options.faceGroups.value.some(face => face.blocks.some(block => block.fields.length > 0)),
  ))

  async function exportWorkbook(): Promise<void> {
    const document = options.cardDoc.value
    if (!document || !canExport.value || busy.value) return
    const path = await fileSystemService.pickSavePath({
      defaultPath: `${safeFileName(document.name?.trim() || document.id)}.xlsx`,
      fileTypeName: 'Excel Workbook',
      extensions: ['xlsx'],
      title: options.translate('cardDesigner.dataTable.exportWorkbook'),
    })
    if (!path) return

    busy.value = true
    try {
      await options.flushPendingChanges()
      const bytes = await exportCardDataWorkbook({
        document,
        columns: options.columns.value,
        faceGroups: options.faceGroups.value,
        exportInstanceIds: options.exportInstanceIds.value,
        labels: {
          face: options.translate('cardDesigner.dataTable.workbookFaceColumn'),
          block: options.translate('cardDesigner.dataTable.workbookBlockColumn'),
          field: options.translate('cardDesigner.dataTable.workbookFieldColumn'),
        },
      })
      await fileSystemService.writeBinaryFile(path, bytes)
      await notify(options.translate('cardDesigner.dataTable.exportSuccess'), 'info')
    } catch (error) {
      await notify(errorMessage(error, options.translate('cardDesigner.dataTable.exportFailed')), 'error')
    } finally {
      busy.value = false
    }
  }

  async function importWorkbook(): Promise<void> {
    const document = options.cardDoc.value
    if (!document || busy.value) return
    const path = await fileSystemService.pickFile({
      title: options.translate('cardDesigner.dataTable.importWorkbook'),
      fileTypeName: 'Excel Workbook',
      extensions: ['xlsx'],
    })
    if (!path) return

    busy.value = true
    try {
      await options.flushPendingChanges()
      const bytes = await fileSystemService.readBinaryFile(path)
      const result = await importCardDataWorkbook(bytes, document, options.faceGroups.value)
      const changed = options.applyUpdates(result.updates)
      const messageKey = changed
        ? 'cardDesigner.dataTable.importSuccess'
        : 'cardDesigner.dataTable.importNoChanges'
      const body = result.warnings.length > 0
        ? `${options.translate(messageKey)}\n\n${result.warnings.join('\n')}`
        : options.translate(messageKey)
      await notify(body, result.warnings.length > 0 ? 'warning' : 'info')
    } catch (error) {
      await notify(errorMessage(error, options.translate('cardDesigner.dataTable.importFailed')), 'error')
    } finally {
      busy.value = false
    }
  }

  async function notify(body: string, kind: 'info' | 'warning' | 'error'): Promise<void> {
    await showMessage(body, {
      title: options.translate('cardDesigner.dataTable.workbookTitle'),
      kind,
    })
  }

  return { busy, canExport, exportWorkbook, importWorkbook }
}

function safeFileName(value: string): string {
  const normalized = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim()
  return normalized || 'OpenCard Data'
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
