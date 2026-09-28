import portraits from './portraits.json'

export type PortraitEntry = { src: string; wiki: string }

const map = portraits as Record<string, PortraitEntry>

export function portraitSrc(id: string): string | undefined {
  const entry = map[id]
  if (!entry) return undefined
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${entry.src}`.replace(/([^:]\/)\/+/g, '$1')
}

export function hasPortrait(id: string): boolean {
  return Boolean(map[id])
}
