import { describe, expect, it } from 'vitest'
import enUS from './en-US'
import zhCN from './zh-CN'

function keyPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix]
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, nested]) => keyPaths(nested, prefix ? `${prefix}.${key}` : key))
}

describe('locale parity', () => {
  it('keeps every supported language on the same key set', () => {
    const zhKeys = new Set(keyPaths(zhCN))
    const enKeys = new Set(keyPaths(enUS))

    expect([...zhKeys].filter(key => !enKeys.has(key))).toEqual([])
    expect([...enKeys].filter(key => !zhKeys.has(key))).toEqual([])
  })
})
