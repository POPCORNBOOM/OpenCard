import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardDocument } from '../../entities/card/model'
import { useCdeDataTableWorkbook } from './useCdeDataTableWorkbook'

const mocks = vi.hoisted(() => ({
  exportCardDataWorkbook: vi.fn(),
  importCardDataWorkbook: vi.fn(),
  pickSavePath: vi.fn(),
  writeBinaryFile: vi.fn(),
  openWithDefaultApp: vi.fn(),
  showMessage: vi.fn(),
}))

vi.mock('./cardDataWorkbook', () => ({
  exportCardDataWorkbook: mocks.exportCardDataWorkbook,
  importCardDataWorkbook: mocks.importCardDataWorkbook,
}))

vi.mock('../workspace/services/fileSystemService', () => ({
  fileSystemService: {
    pickSavePath: mocks.pickSavePath,
    writeBinaryFile: mocks.writeBinaryFile,
    openWithDefaultApp: mocks.openWithDefaultApp,
  },
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({ message: mocks.showMessage }))

function createWorkbookController(openAfterExport: boolean) {
  return useCdeDataTableWorkbook({
    cardDoc: ref({ id: 'card-1', name: 'Example' } as CardDocument),
    columns: ref([]),
    faceGroups: ref([{ blocks: [{ fields: [{}] }] }]) as never,
    exportInstanceIds: ref([]),
    flushPendingChanges: vi.fn().mockResolvedValue(undefined),
    applyImport: vi.fn(),
    openAfterExport: ref(openAfterExport),
    translate: key => key,
  })
}

describe('useCdeDataTableWorkbook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pickSavePath.mockResolvedValue('D:/Cards/Example.xlsx')
    mocks.exportCardDataWorkbook.mockResolvedValue(new Uint8Array([1, 2, 3]))
    mocks.writeBinaryFile.mockResolvedValue(undefined)
    mocks.openWithDefaultApp.mockResolvedValue(undefined)
  })

  it('opens a successfully exported workbook when enabled', async () => {
    await createWorkbookController(true).exportWorkbook()

    expect(mocks.writeBinaryFile).toHaveBeenCalledWith(
      'D:/Cards/Example.xlsx',
      new Uint8Array([1, 2, 3]),
    )
    expect(mocks.openWithDefaultApp).toHaveBeenCalledWith('D:/Cards/Example.xlsx')
  })

  it('leaves a successfully exported workbook closed when disabled', async () => {
    await createWorkbookController(false).exportWorkbook()

    expect(mocks.writeBinaryFile).toHaveBeenCalledOnce()
    expect(mocks.openWithDefaultApp).not.toHaveBeenCalled()
  })

  it('reports an automatic-open failure separately from export failure', async () => {
    mocks.openWithDefaultApp.mockRejectedValue(new Error('No associated app'))

    await createWorkbookController(true).exportWorkbook()

    expect(mocks.writeBinaryFile).toHaveBeenCalledOnce()
    expect(mocks.showMessage).toHaveBeenCalledWith(
      'cardDesigner.dataTable.openExportedWorkbookFailed',
      expect.objectContaining({ kind: 'error' }),
    )
  })
})
