import { describe, expect, it } from 'vitest'
import { createSnapshotProjectRenderSession } from './snapshotProjectRenderSession'

function createFileSystem(files: ReadonlyMap<string, string>) {
  return {
    fileExists: async (path: string) => files.has(path),
    readFile: async (path: string) => {
      const content = files.get(path)
      if (content === undefined) throw new Error(`Missing fixture: ${path}`)
      return content
    },
    readBinaryFile: async () => new Uint8Array(),
  }
}

describe('snapshotProjectRenderSession', () => {
  it('builds the card environment from the immutable snapshot root', async () => {
    const session = await createSnapshotProjectRenderSession('D:/snapshot', createFileSystem(new Map([
      ['D:/snapshot/.ocproject', '{"name":"Historical","version":"0.1.0"}'],
      ['D:/snapshot/.oclocale', '{"active":"ja-JP","base":{"title":"Base"},"languages":{"ja-JP":{"title":"履歴"}}}'],
      ['D:/snapshot/.ocblocks', '{"blocks":[]}'],
    ])))

    expect(session.environment.project).toEqual({ name: 'Historical', description: '', version: '0.1.0' })
    expect(session.environment.dictionary).toEqual({ title: '履歴' })
    expect(session.environment.projectIconCatalog.entries).toEqual([])
    expect(session.environment.customBlockCatalog?.size).toBe(0)
    session.release()
    session.release()
  })

  it('rejects an invalid structured snapshot instead of borrowing current project state', async () => {
    await expect(createSnapshotProjectRenderSession('D:/snapshot', createFileSystem(new Map([
      ['D:/snapshot/.ocproject', '{broken'],
    ])))).rejects.toThrow('Invalid snapshot project profile')
  })
})
