import type { House, Interval, Kingdom, KingdomData, Person } from '../types'
import type { Locale } from './types'
import frContent from './fr-content.json' with { type: 'json' }
import { ui } from './ui'

export type PersonL10n = {
  name?: string
  short?: string
  title?: string
  epithet?: string
  accession?: string
  spouses?: string[]
  summary?: string
  events?: string[]
  reignText?: string
  wikipedia?: string
}

type KingdomL10n = {
  label: string
  title: string
  subtitle: string
  houses: Record<string, { label: string; note: string }>
  gaps: Record<string, string>
  people: Record<string, PersonL10n>
}

const fr = frContent as Record<Kingdom, KingdomL10n>

function localizePerson(p: Person, locale: Locale, kingdom: Kingdom): Person {
  if (locale === 'en') return p
  const o = fr[kingdom]?.people[p.id]
  if (!o) return p
  return {
    ...p,
    name: o.name ?? p.name,
    short: o.short ?? p.short,
    title: o.title ?? p.title,
    epithet: o.epithet ?? p.epithet,
    accession: o.accession ?? p.accession,
    spouses: o.spouses ?? p.spouses,
    summary: o.summary ?? p.summary,
    events: o.events ?? p.events,
    reignText: o.reignText ?? p.reignText,
    wikipedia: o.wikipedia ?? p.wikipedia,
  }
}

function localizeHouse(h: House, locale: Locale, kingdom: Kingdom): House {
  if (locale === 'en') return h
  const o = fr[kingdom]?.houses[h.id]
  if (!o) return h
  return { ...h, label: o.label, note: o.note }
}

function localizeGaps(gaps: Interval[], locale: Locale, kingdom: Kingdom): Interval[] {
  if (locale === 'en') return gaps
  return gaps.map((g) => ({ ...g, label: fr[kingdom]?.gaps[`${g.start}-${g.end}`] ?? g.label }))
}

export function localizeKingdom(data: KingdomData, locale: Locale): KingdomData {
  if (locale === 'en') {
    return {
      ...data,
      label: ui.en[data.id],
    }
  }
  const meta = fr[data.id]
  return {
    ...data,
    label: meta?.label ?? ui.fr[data.id],
    title: meta?.title ?? data.title,
    subtitle: meta?.subtitle ?? data.subtitle,
    houses: data.houses.map((h) => localizeHouse(h, locale, data.id)),
    people: data.people.map((p) => localizePerson(p, locale, data.id)),
    gaps: localizeGaps(data.gaps, locale, data.id),
  }
}

export function wikiUrl(person: Person, locale: Locale): string {
  const host = locale === 'fr' ? 'fr.wikipedia.org' : 'en.wikipedia.org'
  return `https://${host}/wiki/${encodeURIComponent(person.wikipedia).replace(/%2C/g, ',')}`
}

export function houseShortLabel(label: string, locale: Locale): string {
  if (locale === 'fr') {
    return label
      .replace(/^Maison de /, '')
      .replace(/^Maison d’/, '')
      .replace(/^Maison d'/, '')
      .replace(/^Maison /, '')
      .replace(/^Dynastie /, '')
      .replace(/^Le /, '')
  }
  return label.replace(/^House of /, '').replace(/^The /, '')
}
