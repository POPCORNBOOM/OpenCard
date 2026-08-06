import domtoimage from 'dom-to-image-more'

export interface ExportOptions {
  scale?: number
  format?: 'png' | 'jpeg' // 默认 png
  quality?: number // JPEG 质量 0-1，默认 0.92
}

/**
 * 将 DOM 元素导出为图片
 * @param element 要导出的 DOM 元素（通常是 card-canvas）
 * @param options 导出选项
 * @returns 图片的 data URL
 */
export async function exportCardAsImage(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<string> {
  const { scale = 1, format = 'png', quality = 0.92 } = options

  if (format === 'jpeg') {
    return await domtoimage.toJpeg(element, {
      quality: quality,
      scale,
    })
  }
  return await domtoimage.toPng(element, {
    scale,
  })
}

/**
 * 下载图片到本地
 * @param dataUrl 图片的 data URL
 * @param filename 文件名
 */
export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
