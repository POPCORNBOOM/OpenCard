/**
 * 模块说明：
 * - 提供带上限的并发映射，供需要按项目逐个读取外部资源的功能复用
 * 职责边界：
 * - 只调度并发与保持结果顺序，不定义重试、缓存或错误策略
 */

/**
 * 以最多 `limit` 个在途任务处理 `items`，并按输入顺序返回结果。
 *
 * 调用方的 worker 应当自行处理失败并返回替代值：这里不再兜底，避免把一个可诊断的失败
 * 静默降级为 `null`。
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  if (items.length === 0) return results

  const bound = Math.max(1, Math.min(Math.floor(limit) || 1, items.length))
  let cursor = 0
  await Promise.all(Array.from({ length: bound }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index]!, index)
    }
  }))
  return results
}
