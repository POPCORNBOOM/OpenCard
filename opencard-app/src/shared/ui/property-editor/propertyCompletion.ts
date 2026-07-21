import type { PropertyCompletionProvider } from './propertyEditor.types'

export function chainPropertyCompletionProviders(
  providers: readonly (PropertyCompletionProvider | null | undefined)[],
): PropertyCompletionProvider {
  return async (request) => {
    for (const provider of providers) {
      if (!provider) continue
      const result = await provider(request)
      if (result) return result
    }
    return null
  }
}
