export type Locale = 'en' | 'fr'

export const locales: Locale[] = ['en', 'fr']

export function isLocale(v: string | undefined): v is Locale {
  return v === 'en' || v === 'fr'
}
