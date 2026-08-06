import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))

import { composeProjectIconSpritesheet } from './projectIconSpritesheetComposer'

describe('projectIconSpritesheetComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.invoke.mockResolvedValue({
      bytes: [1, 2],
      width: 40,
      height: 32,
      icons: [{ iconKey: 'small', name: 'Small', x: 0, y: 0, width: 16, height: 16, pixelated: true }],
    })
  })

  it('delegates image loading and atlas composition to Rust', async () => {
    const result = await composeProjectIconSpritesheet([
      { path: 'D:/Images/small.png', name: 'Small', iconKey: 'small' },
    ])

    expect(mocks.invoke).toHaveBeenCalledWith('compose_project_icon_spritesheet', {
      request: {
        images: [{ path: 'D:/Images/small.png', name: 'Small', iconKey: 'small' }],
      },
    })
    expect(result.bytes).toEqual(new Uint8Array([1, 2]))
    expect(result.icons[0]).toMatchObject({ pixelated: true })
  })
})
