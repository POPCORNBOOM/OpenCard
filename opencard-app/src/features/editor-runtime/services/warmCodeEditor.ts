/**
 * 模块说明：
 * - 在窗口空闲时预热按需加载的代码编辑器模块。
 * 职责边界：
 * - 只负责触发加载，不创建编辑器实例、不改变任何界面状态。
 * - 预热失败不报错：真正需要使用时会重新加载并给出失败提示。
 */
const IDLE_TIMEOUT_MS = 3000

let warmUpStarted = false

/**
 * 幂等：重复调用只触发一次加载。
 *
 * 放在首帧之后而不是启动关键路径上：启动时不必为可能用不到的编辑器付解析开销，
 * 等界面稳定后再取回，用户真正打开文件时通常已经在内存里。
 * 窗口一直繁忙时由 timeout 兜底，避免永远等不到空闲。
 */
export function warmCodeEditorOnIdle(): void {
  if (warmUpStarted) return
  warmUpStarted = true

  const start = (): void => {
    void import('monaco-editor').catch(() => undefined)
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS })
    return
  }
  // 不支持空闲回调的运行环境（例如 WKWebView）退化为定时预热。
  setTimeout(start, IDLE_TIMEOUT_MS)
}
