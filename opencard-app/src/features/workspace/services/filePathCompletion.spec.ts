import { describe, expect, it, vi } from 'vitest'
import { createFilePathCompletionProvider } from './filePathCompletion'

describe('createFilePathCompletionProvider', () => {
  it('lazily loads only the requested directory, filters extensions, and keeps directories open', async () => {
    const listDirectory = vi.fn(async () => [
      { name: 'assets/characters', isDirectory: true },
      { name: 'assets/card.png', isDirectory: false },
      { name: 'assets/readme.txt', isDirectory: false },
    ])
    const provider = createFilePathCompletionProvider({
      listDirectory,
      getRootEntries: () => [],
      extensions: ['png'],
    })

    const result = await provider({ value: 'assets/c', cursor: 8 })

    expect(listDirectory).toHaveBeenCalledOnce()
    expect(listDirectory).toHaveBeenCalledWith('assets')
    expect(result?.items).toEqual([
      expect.objectContaining({ label: 'characters', value: 'assets/characters/', keepOpen: true }),
      expect.objectContaining({ label: 'card.png', value: 'assets/card.png', keepOpen: false }),
    ])
  })

  it('leaves binding expressions to an earlier provider in the chain', async () => {
    const listDirectory = vi.fn(async () => [])
    const provider = createFilePathCompletionProvider({ listDirectory, getRootEntries: () => [] })

    expect(await provider({ value: '{{self:im}}', cursor: 6 })).toBeNull()
    expect(listDirectory).not.toHaveBeenCalled()
  })
})
