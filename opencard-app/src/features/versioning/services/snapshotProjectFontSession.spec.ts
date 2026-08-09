import { describe, expect, it, vi } from 'vitest'
import { createSnapshotProjectFontSession } from './snapshotProjectFontSession'

describe('snapshotProjectFontSession', () => {
  it('loads snapshot fonts with an isolated CSS family prefix and releases its style', async () => {
    const style = { dataset: {} as DOMStringMap, textContent: '', remove: vi.fn() }
    const append = vi.spyOn(document.head, 'appendChild').mockImplementation(() => style as unknown as Node)
    const fs = {
      fileExists: vi.fn(async () => true),
      readFile: vi.fn(async () => JSON.stringify({
        fonts: [{ key: 'body', name: 'Body', source: 'assets/body.ttf' }],
        fontSets: [{ key: 'reading', name: 'Reading', fontKeys: ['body'] }],
      })),
    }

    const session = await createSnapshotProjectFontSession('D:/snapshot', fs, (_root, source) => `asset://${source}`)
    expect(session.context.cssFamilyPrefix).toMatch(/^OpenCardSnapshotFont-/)
    expect(session.context.fonts).toHaveLength(1)
    const appendedStyle = append.mock.calls[0]?.[0] as HTMLStyleElement
    expect(appendedStyle.textContent).toContain(session.context.cssFamilyPrefix)
    session.release()
    session.release()
    expect(appendedStyle.isConnected).toBe(false)
    append.mockRestore()
  })
})
