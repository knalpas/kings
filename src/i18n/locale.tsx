import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Locale } from './types'
import { ui, type Ui } from './ui'

const LocaleContext = createContext<{ locale: Locale; t: Ui }>({ locale: 'en', t: ui.en })

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: ui[locale] }), [locale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}
