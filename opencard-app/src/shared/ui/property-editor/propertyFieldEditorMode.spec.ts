import { describe, expect, it } from 'vitest'
import {
  createPropertyFieldEditorModeAction,
  USE_FIELD_EDITOR_ACTION_KEY,
  USE_RAW_STRING_EDITOR_ACTION_KEY,
  usePropertyFieldEditorModes,
} from './propertyFieldEditorMode'

const bindableNumber = {
  title: 'Width',
  fieldType: 'number' as const,
  binding: { provider: () => null },
}

describe('property field editor modes', () => {
  it('keeps editor preferences scoped to stable field identities', () => {
    const modes = usePropertyFieldEditorModes()

    expect(modes.resolve({ identity: 'a', definition: bindableNumber, value: 10 }))
      .toEqual({ editorId: 'field', switchTarget: 'raw-string' })
    expect(modes.select('a', USE_RAW_STRING_EDITOR_ACTION_KEY)).toBe(true)
    expect(modes.resolve({ identity: 'a', definition: bindableNumber, value: 10 }))
      .toEqual({ editorId: 'raw-string', switchTarget: 'field' })
    expect(modes.resolve({ identity: 'b', definition: bindableNumber, value: 10 }))
      .toEqual({ editorId: 'field', switchTarget: 'raw-string' })
  })

  it('forces binding expressions into raw-string without exposing an unsafe switch', () => {
    const modes = usePropertyFieldEditorModes()
    const state = modes.resolve({
      identity: 'width',
      definition: bindableNumber,
      value: '{{self:width}}',
      bindingInterpreter: { isExpression: value => String(value).startsWith('{{') },
    })

    expect(state).toEqual({ editorId: 'raw-string', switchTarget: null })
    expect(createPropertyFieldEditorModeAction(state, bindableNumber, {
      useFieldEditor: 'Use field editor',
      useRawStringEditor: 'Use raw string editor',
    })).toBeNull()
  })

  it('does not offer raw-string for arrays or inline binding editors', () => {
    const modes = usePropertyFieldEditorModes()
    const arrayDefinition = {
      title: 'Values',
      fieldType: 'number[]' as const,
      binding: { provider: () => null },
    }
    const inlineDefinition = {
      title: 'Content',
      fieldType: 'string' as const,
      completion: { provider: () => null },
      binding: { provider: () => null },
    }

    expect(modes.resolve({ identity: 'array', definition: arrayDefinition, value: [] }).switchTarget)
      .toBeNull()
    expect(modes.resolve({ identity: 'inline', definition: inlineDefinition, value: '' }).switchTarget)
      .toBeNull()
  })

  it('projects stable Action Definitions and preserves source editing after value changes', () => {
    const modes = usePropertyFieldEditorModes()
    const initial = modes.resolve({ identity: 'width', definition: bindableNumber, value: 10 })
    expect(createPropertyFieldEditorModeAction(initial, bindableNumber, {
      useFieldEditor: 'Use field editor',
      useRawStringEditor: 'Use raw string editor',
    })).toMatchObject({
      key: USE_RAW_STRING_EDITOR_ACTION_KEY,
      icon: 'data.code-string',
    })

    modes.preserveRawString('width')
    const source = modes.resolve({ identity: 'width', definition: bindableNumber, value: '10' })
    expect(createPropertyFieldEditorModeAction(source, bindableNumber, {
      useFieldEditor: 'Use field editor',
      useRawStringEditor: 'Use raw string editor',
    })).toMatchObject({
      key: USE_FIELD_EDITOR_ACTION_KEY,
      icon: 'data.symbol-number',
    })
  })
})
