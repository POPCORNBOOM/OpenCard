/**
 * 模块说明：
 * - 将项目导出领域模块接入 Shell 的 session、隐藏 DOM renderer、文件系统与任务进度。
 * 职责边界：
 * - 只提供端口适配和运行生命周期，不定义队列、命名、冲突或失败策略。
 */
import { nextTick, readonly, ref, type Ref } from 'vue'
import { normalizeCardDocument } from '../../../entities/card/storage'
import { prepareExportTask } from '../../exporting/exportPlanner'
import { runExportPlan } from '../../exporting/exportRunner'
import type {
  ExportDocumentSnapshot,
  ExportFaceRenderer,
  ExportPlan,
  ExportPreparationResult,
  ExportProgressEvent,
  ExportRunResult,
} from '../../exporting/exportTask'
import type { RenderReadyCardFace } from '../../card-rendering/render.types'
import type { CardRenderEnvironment } from '../../card-rendering/renderPipeline'
import type { PreparedCardRender } from '../../card-rendering/renderPipeline'
import type { CardFaceKey } from '../../../entities/card/model'
import type { CardRenderResourceContext } from '../../card-rendering/cardRenderResources'
import type { ProjectExportTask } from '../../workspace/model/projectMetadata'
import type { ProjectIconCatalog } from '../../workspace/services/projectIconCatalog'
import { waitForProjectFonts } from '../../workspace/services/projectFontLoader'
import { fileSystemService } from '../../workspace/services/fileSystemService'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import { exportCardAsImage } from '../../../utils/exportCard'
import { reportAppError } from '../../logging/appErrorCatalog'
import { useShellProgressTasks } from './useShellProgressTasks'
import { visitCardBlockTree } from '../../../entities/card/tree'

const PROJECT_EXPORT_PROGRESS_KEY = 'project-export'

type ExportRendererInstance = {
  getCanvasElement?: () => HTMLElement | undefined
}

type UseProjectExportOptions = {
  sessions: Readonly<Ref<readonly EditorSession[]>>
  exportRendererRef: Ref<ExportRendererInstance | undefined>
  renderEnvironment: Readonly<Ref<Readonly<CardRenderEnvironment>>>
  readProjectFile: (relativePath: string) => Promise<string>
  resolveProjectPath: (relativePath: string) => string
  getRelativeProjectPath: (path: string) => string
  ensureCustomBlocksLoaded?: (keys: Iterable<string>) => Promise<void>
  translate: (key: string, params?: Record<string, unknown>) => string
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binaryData = atob(dataUrl.split(',')[1] ?? '')
  const bytes = new Uint8Array(binaryData.length)
  for (let index = 0; index < binaryData.length; index += 1) bytes[index] = binaryData.charCodeAt(index)
  return bytes
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not encode the project icon atlas')))
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Could not read the project icon atlas')))
    reader.readAsDataURL(blob)
  })
}

export async function inlineProjectIconAtlases(root: HTMLElement, iconCatalog: ProjectIconCatalog): Promise<() => void> {
  const replacements = new Map<string, string>()
  await Promise.all(iconCatalog.series.map(async series => {
    const response = await fetch(series.src)
    if (!response.ok) throw new Error(`Could not load project icon atlas: ${series.source}`)
    replacements.set(series.src, await blobToDataUrl(await response.blob()))
  }))

  const restorations: Array<() => void> = []
  for (const element of root.querySelectorAll<HTMLElement>('.oc-project-icon')) {
    const property = '--oc-project-icon-background-image'
    const original = element.style.getPropertyValue(property)
    const source = extractCssUrl(original)
    const replacement = source ? replacements.get(source) : undefined
    if (!replacement) continue
    element.style.setProperty(property, `url(${JSON.stringify(replacement)})`)
    restorations.push(() => element.style.setProperty(property, original))
  }
  return () => restorations.forEach(restore => restore())
}

function extractCssUrl(value: string): string | null {
  const match = /^url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)$/.exec(value.trim())
  return match ? (match[1] ?? match[2] ?? match[3] ?? '').trim() : null
}

function waitForNextPaint(): Promise<void> {
  return new Promise(resolve => window.requestAnimationFrame(() => resolve()))
}

async function waitForImageElement(image: HTMLImageElement): Promise<void> {
  if (!image.complete) {
    await new Promise<void>(resolve => {
      const finish = () => {
        image.removeEventListener('load', finish)
        image.removeEventListener('error', finish)
        resolve()
      }
      image.addEventListener('load', finish, { once: true })
      image.addEventListener('error', finish, { once: true })
    })
  }
  if (typeof image.decode === 'function') {
    try { await image.decode() } catch { /* use the best available image state */ }
  }
}

async function waitForImageSource(source: string): Promise<void> {
  const image = new Image()
  image.src = source
  await waitForImageElement(image)
}

async function waitForExportAssets(root: HTMLElement, iconCatalog: ProjectIconCatalog): Promise<void> {
  await Promise.all([
    ...Array.from(root.querySelectorAll('img')).map(waitForImageElement),
    ...iconCatalog.series.map(series => waitForImageSource(series.src)),
  ])
  await waitForNextPaint()
}

export function useProjectExport(options: UseProjectExportOptions) {
  const showExportRenderer = ref(false)
  const exportCardFace = ref<RenderReadyCardFace | null>(null)
  const exportResourceContext = ref<CardRenderResourceContext | null>(null)
  const isRunning = ref(false)
  const controller = ref<AbortController | null>(null)
  const { setTask, removeTask } = useShellProgressTasks()

  async function loadDocumentSnapshot(relativePath: string): Promise<ExportDocumentSnapshot> {
    const normalizedRelativePath = normalizePath(relativePath)
    const session = options.sessions.value.find(candidate => candidate.resourceKind === 'workspace'
      && candidate.path
      && options.getRelativeProjectPath(candidate.path).toLocaleLowerCase() === normalizedRelativePath.toLocaleLowerCase())
    const content = session?.draftContent ?? await options.readProjectFile(normalizedRelativePath)
    const normalized = normalizeCardDocument(JSON.parse(content) as unknown)
    return {
      sourcePath: normalizedRelativePath,
      resourceRootPath: normalizePath(options.resolveProjectPath('')),
      document: normalized.document,
      storageWarnings: normalized.warnings,
    }
  }

  const destination = {
    exists: (path: string) => fileSystemService.fileExists(path),
    ensureDirectory: (path: string) => fileSystemService.createDirectory(path),
    write: (path: string, bytes: Uint8Array) => fileSystemService.writeBinaryFile(path, bytes),
  }

  async function prepare(task: ProjectExportTask): Promise<ExportPreparationResult> {
    const snapshots = new Map<string, ExportDocumentSnapshot>()
    const customBlockKeys = new Set<string>()
    for (const path of task.documentPaths) {
      const snapshot = await loadDocumentSnapshot(path)
      snapshots.set(normalizePath(path).toLowerCase(), snapshot)
      for (const face of Object.values(snapshot.document.faces)) {
        for (const child of face.children) {
          visitCardBlockTree(child.block, block => {
            if (block.type === 'custom-block') customBlockKeys.add(block.customBlockKey)
          })
        }
      }
    }
    await options.ensureCustomBlocksLoaded?.(customBlockKeys)
    const environment = options.renderEnvironment.value
    return await prepareExportTask({
      task,
      source: { load: async path => snapshots.get(normalizePath(path).toLowerCase()) ?? await loadDocumentSnapshot(path) },
      destination,
      environment,
    })
  }

  const renderer: ExportFaceRenderer = {
    async render(request, signal) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
      showExportRenderer.value = true
      exportCardFace.value = request.render.document.faces[request.faceKey]
      exportResourceContext.value = request.render.resources
      await nextTick()
      await waitForNextPaint()

      const canvas = options.exportRendererRef.value?.getCanvasElement?.()
      if (!canvas) throw new Error('Export renderer is unavailable')
      await waitForExportAssets(canvas, request.render.resources.projectIconCatalog)
      await waitForProjectFonts()
      await waitForNextPaint()
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
      const restoreProjectIcons = await inlineProjectIconAtlases(
        canvas,
        request.render.resources.projectIconCatalog,
      )
      try {
        return dataUrlToBytes(await exportCardAsImage(canvas, { scale: request.scale, format: 'png' }))
      } finally {
        restoreProjectIcons()
      }
    },
    reset() {
      showExportRenderer.value = false
      exportCardFace.value = null
      exportResourceContext.value = null
    },
  }

  function progressDetail(event: ExportProgressEvent): string | undefined {
    if (!event.current) return undefined
    return options.translate(`app.exportProgress.phase.${event.phase}`, {
      path: event.current.sourcePath,
    })
  }

  function reportProgress(event: ExportProgressEvent): void {
    setTask({
      key: PROJECT_EXPORT_PROGRESS_KEY,
      title: options.translate('app.exportProgress.project'),
      progress: event.totalUnits > 0 ? event.completedUnits / event.totalUnits : 0,
      weight: Math.max(1, event.totalUnits),
      detail: progressDetail(event),
      cancellable: event.phase !== 'completed' && event.phase !== 'cancelled' && event.phase !== 'failed',
    }, cancel)
  }

  function logResult(result: ExportRunResult): void {
    console.info(options.translate('app.exportProgress.summary', {
      succeeded: result.succeeded,
      skipped: result.skipped,
      failed: result.failed,
      directory: result.outputDirectory,
    }))
    for (const failure of result.failures) console.warn('[export]', failure)
    if (result.status === 'failed') reportAppError('OC-E5006', result)
  }

  async function run(plan: ExportPlan): Promise<ExportRunResult | null> {
    if (isRunning.value) return null
    isRunning.value = true
    controller.value = new AbortController()
    for (const entry of plan.entries) {
      if (entry.render.issues.length > 0) {
        console.warn(`[export] pipeline issues in ${entry.sourcePath}:`, entry.render.issues)
      }
    }
    setTask({
      key: PROJECT_EXPORT_PROGRESS_KEY,
      title: options.translate('app.exportProgress.project'),
      progress: 0,
      weight: Math.max(1, plan.entries.length * 2),
      cancellable: true,
    }, cancel)
    try {
      const result = await runExportPlan({
        plan,
        renderer,
        destination,
        signal: controller.value.signal,
        report: reportProgress,
      })
      logResult(result)
      return result
    } catch (error) {
      reportAppError('OC-E5006', error)
      return null
    } finally {
      removeTask(PROJECT_EXPORT_PROGRESS_KEY)
      renderer.reset()
      controller.value = null
      isRunning.value = false
    }
  }

  async function renderCardImages(
    render: PreparedCardRender,
    faceKeys: readonly CardFaceKey[],
    scale: number,
  ): Promise<ReadonlyMap<CardFaceKey, Uint8Array> | null> {
    if (isRunning.value) return null
    isRunning.value = true
    const result = new Map<CardFaceKey, Uint8Array>()
    try {
      for (const faceKey of faceKeys) {
        result.set(faceKey, await renderer.render({
          sourcePath: '',
          outputPath: '',
          faceKey,
          render,
          scale,
        }, new AbortController().signal))
      }
      return result
    } catch (error) {
      reportAppError('OC-E5006', error)
      return null
    } finally {
      renderer.reset()
      isRunning.value = false
    }
  }

  function cancel(): void {
    controller.value?.abort()
  }

  return {
    showExportRenderer: readonly(showExportRenderer),
    exportCardFace,
    exportResourceContext: readonly(exportResourceContext),
    isRunning: readonly(isRunning),
    loadDocumentSnapshot,
    prepare,
    run,
    renderCardImages,
    cancel,
  }
}
