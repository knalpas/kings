import type { Person } from '../types'
import type { Locale } from '../i18n/types'
import { ui } from '../i18n/ui'
import { CURRENT_YEAR } from './layout'

type Index = Map<string, Person>

function ancestry(id: string, index: Index): { id: string; distant: boolean }[] {
  const out: { id: string; distant: boolean }[] = []
  let p = index.get(id)
  let distant = false
  while (p) {
    out.push({ id: p.id, distant })
    if (p.distant) distant = true
    p = p.parent ? index.get(p.parent) : undefined
  }
  return out
}

const ORDINAL_EN = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
const REMOVED_EN = ['', 'once', 'twice', 'three times', 'four times', 'five times']
const ORDINAL_FR = ['', 'premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième']

function greats(n: number, locale: Locale): string {
  if (n <= 0) return ''
  if (locale === 'fr') {
    if (n === 1) return 'arrière-'
    return `arrière-${n}× `
  }
  if (n === 1) return 'great-'
  return `${n}× great-`
}

/**
 * Describes `b` relative to `a`, e.g. "son", "nephew", "second cousin".
 * Returns null when the chart shows no common ancestor.
 */
export function kinship(a: string, b: string, index: Index, locale: Locale = 'en'): string | null {
  const up = ancestry(a, index)
  const upB = ancestry(b, index)
  const posA = new Map(up.map((x, i) => [x.id, i]))
  let ia = -1
  let ib = -1
  for (let i = 0; i < upB.length; i++) {
    const j = posA.get(upB[i].id)
    if (j != null) {
      ia = j
      ib = i
      break
    }
  }
  if (ia < 0) return null
  const female = Boolean(index.get(b)?.female)
  const distant = up.slice(0, ia + 1).some((x) => x.distant) || upB.slice(0, ib + 1).some((x) => x.distant)
  const fr = locale === 'fr'

  if (distant) return ia === 0 ? (fr ? 'descendant éloigné' : 'distant descendant') : fr ? 'cousin éloigné' : 'distant cousin'

  if (ia === 0 && ib === 0) return fr ? 'la même personne' : 'same person'
  if (ia === 0) {
    if (ib === 1) return female ? (fr ? 'fille' : 'daughter') : fr ? 'fils' : 'son'
    return `${greats(ib - 2, locale)}${female ? (fr ? 'petite-fille' : 'granddaughter') : fr ? 'petit-fils' : 'grandson'}`
  }
  if (ib === 0) {
    if (ia === 1) return female ? (fr ? 'mère' : 'mother') : fr ? 'père' : 'father'
    return `${greats(ia - 2, locale)}${female ? (fr ? 'grand-mère' : 'grandmother') : fr ? 'grand-père' : 'grandfather'}`
  }
  if (ia === 1 && ib === 1) return female ? (fr ? 'sœur' : 'sister') : fr ? 'frère' : 'brother'
  if (ia === 1) return `${greats(ib - 2, locale)}${female ? (fr ? 'nièce' : 'niece') : fr ? 'neveu' : 'nephew'}`
  if (ib === 1) return `${greats(ia - 2, locale)}${female ? (fr ? 'tante' : 'aunt') : fr ? 'oncle' : 'uncle'}`
  const degree = Math.min(ia, ib) - 1
  const removed = Math.abs(ia - ib)
  if (fr) {
    const deg = ORDINAL_FR[degree] ?? `${degree}e`
    const rem =
      removed === 0 ? '' : removed === 1 ? ' issu de germain' : removed === 2 ? ' issu de germain au 2e degré' : ` ${removed} fois éloigné`
    return `${deg} cousin${female ? 'e' : ''}${rem}`
  }
  const deg = ORDINAL_EN[degree] ?? `${degree}th`
  return `${deg} cousin${removed ? ` ${REMOVED_EN[removed] ?? `${removed} times`} removed` : ''}`
}

export function children(id: string, people: Person[]): Person[] {
  return people.filter((p) => p.parent === id)
}

export function yearText(year: number | undefined, circa?: boolean, locale: Locale = 'en'): string {
  if (year == null) return '—'
  return circa ? ui[locale].yearCirca(year) : String(year)
}

export function reignText(p: Person, locale: Locale = 'en'): string {
  if (!p.reign) return ''
  if (p.reignText) return p.reignText
  const [s, e] = p.reign
  if (e == null) return ui[locale].reignPresent(s)
  if (s === e) return String(s)
  return `${s}–${e}`
}

export function reignLength(p: Person, locale: Locale = 'en'): string {
  if (!p.reign) return ''
  const [s, e] = p.reign
  return ui[locale].reignLength((e ?? CURRENT_YEAR) - s)
}

export function lifeText(p: Person, locale: Locale = 'en'): string {
  const born = yearText(p.born, p.bornCirca, locale)
  if (p.died == null) return p.born != null ? ui[locale].bornPrefix(born) : ''
  return `${born}–${p.died}`
}

export function ageAt(p: Person, year: number | undefined): number | null {
  if (p.born == null || year == null) return null
  return year - p.born
}

export function ageLabel(p: Person, year: number | undefined, locale: Locale = 'en'): string {
  const age = ageAt(p, year)
  if (age == null) return ''
  return p.bornCirca ? ui[locale].aboutAge(age) : String(age)
}

export function possessive(p: Person, locale: Locale = 'en'): string {
  if (locale === 'fr') return p.female ? 'sa' : 'son'
  return p.female ? 'her' : 'his'
}

/** French possessive before a vowel/silent h uses "son" for both genders of the possessed noun's article — keep simple: son/sa based on next word gender is hard; use "son/sa" by kinship term gender instead via relation string. */
export function relationPhrase(subject: Person, kinshipTerm: string | null, locale: Locale, none: string): string {
  if (!kinshipTerm) return none
  if (locale === 'fr') {
    // French: "sa sœur", "son frère", "son cousin", "sa cousine", "son fils", "sa fille"
    const startsWithVowel = /^[aeiouàâäéèêëïîôùûüh]/i.test(kinshipTerm)
    const fem = /^(fille|sœur|mère|nièce|tante|grand-mère|petite-fille|cousine)/.test(kinshipTerm)
    const det = fem && !startsWithVowel ? 'sa' : 'son'
    return `${det} ${kinshipTerm}`
  }
  return `${possessive(subject, locale)} ${kinshipTerm}`
}
