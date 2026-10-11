import portraits from './portraits.json'
import type { Kingdom } from '../types'

const map = portraits as Record<string, { src: string; wiki: string }>

export function portraitSrc(kingdom: Kingdom, id: string): string | undefined {
  const entry = map[`${kingdom}/${id}`]
  if (!entry) return undefined
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${entry.src}`.replace(/([^:]\/)\/+/g, '$1')
}

export function initials(name: string): string {
  const words = name
    .replace(/[,()]/g, '')
    .split(/\s+/)
    .filter((w) => w && !['of', 'the', 'and', 'de', 'Lady', 'Prince', 'Empress'].includes(w))
  if (words.length === 1) return words[0].slice(0, 2)
  return words[0][0] + words[1][0]
}
