export type AppView = 'ui-kit' | 'ide'

export function resolveAppView(search: string): AppView {
  const view = new URLSearchParams(search).get('view')
  if (view === 'ui-kit' || view === 'buttons') {
    return 'ui-kit'
  }
  return 'ide'
}

