import type { ProjectDictionary } from '../../workspace/model/projectDictionary'
import { orderedPair, type OrderedPairEntry } from './orderedPair'

export type DictionaryComparisonSide = 'historical' | 'current'

export type DictionaryComparisonProjection = {
  dictionary: ProjectDictionary
  missingRecords: ReadonlySet<string>
  missingLanguages: ReadonlySet<string>
  changedCells: ReadonlySet<string>
  changedRecordKeys: ReadonlySet<string>
  changedLanguageKeys: ReadonlySet<string>
  activeChanged: boolean
}

function identity(value: string): string {
  return value.toLocaleLowerCase()
}

function pairKeys(
  historical: readonly string[],
  current: readonly string[],
): OrderedPairEntry<string>[] | null {
  const pairs = orderedPair(historical, current, identity)
  return pairs.some(pair => pair.status === 'ambiguous') ? null : pairs
}

function pairKey(pair: OrderedPairEntry<string>): string {
  return pair.rightItem ?? pair.leftItem ?? ''
}

function sourceKey(pair: OrderedPairEntry<string>, side: DictionaryComparisonSide): string | null {
  return side === 'historical' ? pair.leftItem : pair.rightItem
}

function cellIdentity(recordKey: string, languageKey: string): string {
  return `${identity(recordKey)}\u0000${identity(languageKey)}`
}

function ownValue(dictionary: ProjectDictionary, recordKey: string, languageKey: string): string | undefined {
  if (languageKey === '$base') return dictionary.base?.[recordKey]
  return dictionary.languages?.[languageKey]?.[recordKey]
}

export function projectDictionaryComparison(
  historical: ProjectDictionary,
  current: ProjectDictionary,
  side: DictionaryComparisonSide,
): DictionaryComparisonProjection | null {
  const recordPairs = pairKeys(Object.keys(historical.base ?? {}), Object.keys(current.base ?? {}))
  const languagePairs = pairKeys(Object.keys(historical.languages ?? {}), Object.keys(current.languages ?? {}))
  if (!recordPairs || !languagePairs) return null

  const selected = side === 'historical' ? historical : current
  const other = side === 'historical' ? current : historical
  const missingRecords = new Set<string>()
  const missingLanguages = new Set<string>()
  const changedCells = new Set<string>()
  const changedRecordKeys = new Set<string>()
  const changedLanguageKeys = new Set<string>()
  const base: Record<string, string> = {}
  const languages: Record<string, Record<string, string>> = {}

  for (const pair of recordPairs) {
    const displayKey = pairKey(pair)
    const selectedKey = sourceKey(pair, side)
    const otherKey = sourceKey(pair, side === 'historical' ? 'current' : 'historical')
    base[displayKey] = selectedKey ? selected.base?.[selectedKey] ?? '' : ''
    if (!selectedKey) missingRecords.add(identity(displayKey))
    if (selectedKey && otherKey && selectedKey !== otherKey) changedRecordKeys.add(identity(displayKey))
    if (ownValue(selected, selectedKey ?? displayKey, '$base') !== ownValue(other, otherKey ?? displayKey, '$base')) {
      changedCells.add(cellIdentity(displayKey, '$base'))
    }
  }

  for (const languagePair of languagePairs) {
    const displayLanguage = pairKey(languagePair)
    const selectedLanguage = sourceKey(languagePair, side)
    const otherLanguage = sourceKey(languagePair, side === 'historical' ? 'current' : 'historical')
    const overrides: Record<string, string> = {}
    if (!selectedLanguage) missingLanguages.add(identity(displayLanguage))
    if (selectedLanguage && otherLanguage && selectedLanguage !== otherLanguage) {
      changedLanguageKeys.add(identity(displayLanguage))
    }
    for (const recordPair of recordPairs) {
      const displayRecord = pairKey(recordPair)
      const selectedRecord = sourceKey(recordPair, side)
      const otherRecord = sourceKey(recordPair, side === 'historical' ? 'current' : 'historical')
      const selectedValue = selectedLanguage && selectedRecord
        ? ownValue(selected, selectedRecord, selectedLanguage)
        : undefined
      const otherValue = otherLanguage && otherRecord
        ? ownValue(other, otherRecord, otherLanguage)
        : undefined
      if (selectedValue !== undefined) overrides[displayRecord] = selectedValue
      if (selectedValue !== otherValue) changedCells.add(cellIdentity(displayRecord, displayLanguage))
    }
    languages[displayLanguage] = overrides
  }

  const selectedActive = selected.active ? identity(selected.active) : ''
  const otherActive = other.active ? identity(other.active) : ''
  return {
    dictionary: {
      ...(selected.active ? { active: selected.active } : {}),
      ...(Object.keys(base).length ? { base } : {}),
      ...(Object.keys(languages).length ? { languages } : {}),
    },
    missingRecords,
    missingLanguages,
    changedCells,
    changedRecordKeys,
    changedLanguageKeys,
    activeChanged: selectedActive !== otherActive,
  }
}

export function dictionaryComparisonCellIdentity(recordKey: string, languageKey: string): string {
  return cellIdentity(recordKey, languageKey)
}
