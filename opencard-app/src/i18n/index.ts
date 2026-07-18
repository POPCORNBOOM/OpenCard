import { createI18n } from 'vue-i18n'
import enUS from '../locales/en-US'
import zhCN from '../locales/zh-CN'
import type { AppLocale } from '../features/settings/model/appSettings'

const messages = {
  'en-US': enUS,
  'zh-CN': zhCN,
} as const

export function resolveAppLocale(locale: AppLocale): keyof typeof messages {
  if (locale !== 'system') return locale

  if (typeof navigator === 'undefined') {
    return 'zh-CN'
  }

  const browserLocale = navigator.language.toLowerCase()
  if (browserLocale.startsWith('zh')) {
    return 'zh-CN'
  }

  return 'en-US'
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveAppLocale('system'),
  fallbackLocale: 'en-US',
  messages,
})

export function setAppLocale(locale: AppLocale): void {
  i18n.global.locale.value = resolveAppLocale(locale)
}
