import { computed, nextTick, ref, type Ref } from 'vue'
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { applyInstance, toViewDoc, type CardDocument } from '../../../entities/card/model'
import { resolveFileType } from '../../workspace/model/fileTypes'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import { exportCardAsImage } from '../../../utils/exportCard'

type ExportRendererInstance = {
  getCanvasElement?: () => HTMLElement | undefined
}

type UseIdeExportOptions = {
  activeSession: Readonly<Ref<EditorSession | null>>
  exportRendererRef: Ref<ExportRendererInstance | undefined>
  translate: (key: string) => string
}

type CardExportContext = {
  fileNameStem: string
  document: CardDocument
}

type ExportQueueEntry = {
  fileName: string
  document: CardDocument
}

function stripFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.')
  return lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName
}

function sanitizeFileNameSegment(value: string, fallback: string) {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[. ]+$/g, '')

  return sanitized.length > 0 ? sanitized : fallback
}

function buildFilePath(directoryPath: string, fileName: string) {
  const separator = directoryPath.includes('\\') ? '\\' : '/'
  return `${directoryPath.replace(/[\\/]+$/, '')}${separator}${fileName}`
}

function dataUrlToBytes(dataUrl: string) {
  const base64Data = dataUrl.split(',')[1] ?? ''
  const binaryData = atob(base64Data)
  const bytes = new Uint8Array(binaryData.length)

  for (let index = 0; index < binaryData.length; index += 1) {
    bytes[index] = binaryData.charCodeAt(index)
  }

  return bytes
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

async function waitForImageElement(imageElement: HTMLImageElement) {
  if (imageElement.complete) {
    if (typeof imageElement.decode === 'function') {
      try {
        await imageElement.decode()
      } catch {
        // Ignore decode failures so export can continue with the best available state.
      }
    }
    return
  }

  await new Promise<void>((resolve) => {
    const finalize = () => {
      imageElement.removeEventListener('load', finalize)
      imageElement.removeEventListener('error', finalize)
      resolve()
    }

    imageElement.addEventListener('load', finalize, { once: true })
    imageElement.addEventListener('error', finalize, { once: true })
  })

  if (typeof imageElement.decode === 'function') {
    try {
      await imageElement.decode()
    } catch {
      // Ignore decode failures so export can continue with the best available state.
    }
  }
}

async function waitForExportAssets(rootElement: HTMLElement) {
  const images = Array.from(rootElement.querySelectorAll('img'))
  await Promise.all(images.map((imageElement) => waitForImageElement(imageElement)))
  await waitForNextPaint()
}

function createExportFileName(baseFileName: string, suffix: string, usedFileNames: Set<string>) {
  const normalizedSuffix = sanitizeFileNameSegment(suffix, 'export')
  let nextStem = `${baseFileName}_${normalizedSuffix}`
  let nextFileName = `${nextStem}.png`
  let dedupeIndex = 2

  while (usedFileNames.has(nextFileName.toLowerCase())) {
    nextStem = `${baseFileName}_${normalizedSuffix}_${dedupeIndex}`
    nextFileName = `${nextStem}.png`
    dedupeIndex += 1
  }

  usedFileNames.add(nextFileName.toLowerCase())
  return nextFileName
}

function buildCardExportQueue(baseFileName: string, document: CardDocument): ExportQueueEntry[] {
  const usedFileNames = new Set<string>()
  const exportQueue: ExportQueueEntry[] = [
    {
      fileName: createExportFileName(baseFileName, 'blueprint', usedFileNames),
      document: applyInstance(document, null),
    },
  ]

  for (const instance of document.instances ?? []) {
    const instanceName = sanitizeFileNameSegment(instance.name || instance.id, 'instance')
    exportQueue.push({
      fileName: createExportFileName(baseFileName, `instance_${instanceName}`, usedFileNames),
      document: applyInstance(document, instance),
    })
  }

  return exportQueue
}

export function useIdeExport(options: UseIdeExportOptions) {
  const showExportRenderer = ref(false)
  const exportCardDoc = ref<CardDocument | null>(null)

  const canExportActiveCard = computed(() =>
    Boolean(options.activeSession.value) && resolveFileType(options.activeSession.value!.path).id === 'opencard'
  )

  function getActiveCardExportContext(): CardExportContext | null {
    const session = options.activeSession.value
    if (!session) {
      console.error('没有打开的文件')
      return null
    }

    if (resolveFileType(session.path).id !== 'opencard') {
      console.error('当前活动文件不是 .opencard')
      return null
    }

    const currentContent = session.draftContent.trim()
    if (!currentContent) {
      console.error('当前 .opencard 内容为空')
      return null
    }

    try {
      return {
        fileNameStem: sanitizeFileNameSegment(stripFileExtension(session.name), 'card'),
        document: toViewDoc(JSON.parse(currentContent)),
      }
    } catch (error) {
      console.error('解析 .opencard 失败:', error)
      return null
    }
  }

  async function renderCardDocumentToImage(document: CardDocument) {
    showExportRenderer.value = true
    exportCardDoc.value = document

    await nextTick()
    await waitForNextPaint()

    const canvasElement = options.exportRendererRef.value?.getCanvasElement?.()
    if (!canvasElement) {
      throw new Error('无法获取导出 canvas 元素')
    }

    await waitForExportAssets(canvasElement)

    return await exportCardAsImage(canvasElement, {
      dpi: 192,
      format: 'png',
    })
  }

  function resetExportRenderer() {
    showExportRenderer.value = false
    exportCardDoc.value = null
  }

  async function exportActiveCard2x() {
    const context = getActiveCardExportContext()
    if (!context) {
      return
    }

    const savePath = await save({
      defaultPath: `${context.fileNameStem}_blueprint_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`,
      filters: [{
        name: 'PNG Image',
        extensions: ['png'],
      }],
    })

    if (!savePath) {
      return
    }

    try {
      const dataUrl = await renderCardDocumentToImage(context.document)
      await writeFile(savePath, dataUrlToBytes(dataUrl))
      console.log('图片已保存到:', savePath)
    } catch (error) {
      console.error('导出图片失败:', error)
    } finally {
      resetExportRenderer()
    }
  }

  async function exportAllCardViews() {
    const context = getActiveCardExportContext()
    if (!context) {
      return
    }

    const exportDirectory = await open({
      directory: true,
      multiple: false,
      title: options.translate('app.menu.exportAll'),
    })

    if (typeof exportDirectory !== 'string' || !exportDirectory) {
      return
    }

    try {
      const exportQueue = buildCardExportQueue(context.fileNameStem, context.document)

      for (const entry of exportQueue) {
        const dataUrl = await renderCardDocumentToImage(entry.document)
        const targetPath = buildFilePath(exportDirectory, entry.fileName)
        await writeFile(targetPath, dataUrlToBytes(dataUrl))
        console.log('图片已保存到:', targetPath)
      }
    } catch (error) {
      console.error('批量导出图片失败:', error)
    } finally {
      resetExportRenderer()
    }
  }

  return {
    canExportActiveCard,
    showExportRenderer,
    exportCardDoc,
    exportActiveCard2x,
    exportAllCardViews,
  }
}
