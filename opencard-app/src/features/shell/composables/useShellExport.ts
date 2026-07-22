/**
 * 模块说明：
 * - 管理 Shell 导出流程 包括导出上下文 队列与隐藏渲染器状态
 * 职责边界：
 * - 只编排导出动作与资源等待 不维护项目或会话真相
 */
import { computed, nextTick, ref, type Ref } from 'vue'
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import {
  type CardFaceKey,
  type CardDocument,
  type CardInstanceRecord,
} from '../../../entities/card/model'
import { parseCardDocument } from '../../../entities/card/storage'
import type { CardPipelineIssue } from '../../card-rendering/cardPipelineIssue'
import { runRenderPipeline, type RenderPipelineResult } from '../../card-rendering/renderPipeline'
import type { RenderReadyCardFace } from '../../card-rendering/render.types'
import { resolveFileTypeById } from '../../workspace/model/fileTypes'
import type { ProjectInformation } from '../../workspace/model/projectMetadata'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import type { CardDesignerViewState } from '../../editor-runtime/model/editorUiState'
import { exportCardAsImage } from '../../../utils/exportCard'

type ExportRendererInstance = {
  getCanvasElement?: () => HTMLElement | undefined
}

type UseShellExportOptions = {
  activeSession: Readonly<Ref<EditorSession | null>>
  exportRendererRef: Ref<ExportRendererInstance | undefined>
  projectInformation: Readonly<Ref<ProjectInformation>>
  translate: (key: string) => string
}

type CardExportContext = {
  fileNameStem: string
  document: CardDocument
}

type ExportQueueEntry = {
  fileName: string
  face: RenderReadyCardFace
  issues: CardPipelineIssue[]
}

type CardExportProjection = {
  suffix: string
  instance: CardInstanceRecord | null
}

export function resolveActiveCardExportTarget(
  document: CardDocument,
  viewState: CardDesignerViewState | undefined,
): { faceKey: CardFaceKey; instance: CardInstanceRecord | null; projectionSuffix: string } {
  const faceKey = viewState?.activeFace ?? 'front'
  const instance = document.instances.find((candidate) => (
    candidate.id === viewState?.selectedInstanceId
  )) ?? null
  const projectionSuffix = instance
    ? `instance_${sanitizeFileNameSegment(instance.name || instance.id, 'instance')}`
    : 'blueprint'

  return { faceKey, instance, projectionSuffix }
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

export function buildCardExportQueue(
  baseFileName: string,
  document: CardDocument,
  project: Readonly<ProjectInformation>,
): ExportQueueEntry[] {
  const usedFileNames = new Set<string>()
  const exportQueue: ExportQueueEntry[] = []
  const projections: CardExportProjection[] = [{ suffix: 'blueprint', instance: null }]

  for (const instance of document.instances ?? []) {
    const instanceName = sanitizeFileNameSegment(instance.name || instance.id, 'instance')
    projections.push({ suffix: `instance_${instanceName}`, instance })
  }

  for (const projection of projections) {
    const renderResult = buildRenderableCardDocument(document, projection.instance, project)
    for (const faceKey of ['front', 'back'] as const) {
      exportQueue.push({
        fileName: createExportFileName(baseFileName, `${projection.suffix}_${faceKey}`, usedFileNames),
        face: renderResult.document.faces[faceKey],
        issues: renderResult.issues,
      })
    }
  }

  return exportQueue
}

function buildRenderableCardDocument(
  document: CardDocument,
  instance: CardInstanceRecord | null,
  project: Readonly<ProjectInformation>,
): RenderPipelineResult {
  return runRenderPipeline(document, instance, { project })
}

export function useShellExport(options: UseShellExportOptions) {
  const showExportRenderer = ref(false)
  const exportCardFace = ref<RenderReadyCardFace | null>(null)

  const canExportActiveCard = computed(() =>
    Boolean(options.activeSession.value) && resolveFileTypeById(options.activeSession.value!.fileTypeId).id === 'opencard'
  )

  function getActiveCardExportContext(): CardExportContext | null {
    const session = options.activeSession.value
    if (!session) {
      console.error('没有打开的文件')
      return null
    }

    if (resolveFileTypeById(session.fileTypeId).id !== 'opencard') {
      console.error('当前活动文件不是 .opencard')
      return null
    }

    const currentContent = session.draftContent.trim()
    if (!currentContent) {
      console.error('当前 .opencard 内容为空')
      return null
    }

    try {
      const parsed = JSON.parse(currentContent) as unknown
      return {
        fileNameStem: sanitizeFileNameSegment(stripFileExtension(session.name), 'card'),
        document: parseCardDocument(parsed),
      }
    } catch (error) {
      console.error('解析 .opencard 失败:', error)
      return null
    }
  }

  async function renderCardFaceToImage(face: RenderReadyCardFace) {
    showExportRenderer.value = true
    exportCardFace.value = face

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
    exportCardFace.value = null
  }

  async function exportActiveCard2x() {
    const context = getActiveCardExportContext()
    if (!context) {
      return
    }

    const { faceKey, instance: selectedInstance, projectionSuffix } = resolveActiveCardExportTarget(
      context.document,
      options.activeSession.value?.uiState?.cardDesigner?.view,
    )
    const savePath = await save({
      defaultPath: `${context.fileNameStem}_${projectionSuffix}_${faceKey}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`,
      filters: [{
        name: 'PNG Image',
        extensions: ['png'],
      }],
    })

    if (!savePath) {
      return
    }

    try {
      const renderResult = buildRenderableCardDocument(
        context.document,
        selectedInstance,
        options.projectInformation.value,
      )
      if (renderResult.issues.length > 0) {
        console.warn('[export] resolveReferences issues:', renderResult.issues)
      }

      const dataUrl = await renderCardFaceToImage(renderResult.document.faces[faceKey])
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
      const exportQueue = buildCardExportQueue(
        context.fileNameStem,
        context.document,
        options.projectInformation.value,
      )

      for (const entry of exportQueue) {
        if (entry.issues.length > 0) {
          console.warn(`[export] resolveReferences issues in ${entry.fileName}:`, entry.issues)
        }

        const dataUrl = await renderCardFaceToImage(entry.face)
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
    exportCardFace,
    exportActiveCard2x,
    exportAllCardViews,
  }
}
