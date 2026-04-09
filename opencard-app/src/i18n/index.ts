import { createI18n } from 'vue-i18n'
import enUS from '../locales/en-US'
import zhCN from '../locales/zh-CN'

const messages = {
  'en-US': enUS,
  'zh-CN': zhCN,
} as const

function resolveInitialLocale(): keyof typeof messages {
  if (typeof navigator === 'undefined') {
    return 'zh-CN'
  }

  const locale = navigator.language.toLowerCase()
  if (locale.startsWith('zh')) {
    return 'zh-CN'
  }

  return 'en-US'
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale: 'en-US',
  messages,
})
