import type { ProjectCustomBlockCatalog } from '../model/projectCustomBlocks'
import { createProjectCustomBlockFontFamily } from './projectCustomBlockResources'

const STYLE_ATTRIBUTE = 'data-opencard-custom-block-fonts'
let styleElement: HTMLStyleElement | null = null

function mimeForPath(path: string): string {
  if (/\.woff2$/i.test(path)) return 'font/woff2'
  if (/\.woff$/i.test(path)) return 'font/woff'
  if (/\.ttf$/i.test(path)) return 'font/ttf'
  if (/\.otf$/i.test(path)) return 'font/otf'
  return 'application/octet-stream'
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

export function clearProjectCustomBlockFonts(): void {
  styleElement?.remove()
  styleElement = null
  if (typeof document !== 'undefined') {
    document.querySelectorAll(`style[${STYLE_ATTRIBUTE}]`).forEach(element => element.remove())
  }
}

export function syncProjectCustomBlockFonts(catalog: ProjectCustomBlockCatalog): void {
  if (typeof document === 'undefined' || !document.head) return
  const rules: string[] = []
  for (const entry of catalog.values()) {
    for (const font of entry.manifest.resources?.fonts ?? []) {
      const bytes = entry.files.get(font.source)
      if (!bytes) continue
      const family = JSON.stringify(createProjectCustomBlockFontFamily(entry.manifest.key, font.key))
      const source = `data:${mimeForPath(font.source)};base64,${bytesToBase64(bytes)}`
      rules.push(`@font-face { font-family: ${family}; src: url(${JSON.stringify(source)}); font-weight: normal; font-style: normal; }`)
    }
  }
  clearProjectCustomBlockFonts()
  if (rules.length === 0) return
  const next = document.createElement('style')
  next.setAttribute(STYLE_ATTRIBUTE, '')
  next.textContent = rules.join('\n')
  document.head.appendChild(next)
  styleElement = next
}
