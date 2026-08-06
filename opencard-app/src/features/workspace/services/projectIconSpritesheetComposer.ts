import { invoke } from '@tauri-apps/api/core'
import type { ProjectIcon } from '../model/projectIcons'

export type ProjectIconSourceImage = {
  path: string
  name: string
  iconKey: string
}

export type ProjectIconSpritesheetComposition = {
  bytes: Uint8Array
  width: number
  height: number
  icons: readonly ProjectIcon[]
}

type RustCompositionResult = {
  bytes: number[]
  width: number
  height: number
  icons: readonly ProjectIcon[]
}

export async function composeProjectIconSpritesheet(
  images: readonly ProjectIconSourceImage[],
): Promise<ProjectIconSpritesheetComposition> {
  const result = await invoke<RustCompositionResult>('compose_project_icon_spritesheet', {
    request: {
      images,
    },
  })
  return {
    bytes: Uint8Array.from(result.bytes),
    width: result.width,
    height: result.height,
    icons: result.icons,
  }
}
