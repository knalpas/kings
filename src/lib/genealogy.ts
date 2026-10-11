import type { Person } from '../types'
import type { Locale } from '../i18n/types'
import { ui } from '../i18n/ui'
import { CURRENT_YEAR } from './layout'

type Index = Map<string, Person>

/** Every ancestor on the chart with its generation distance, following both parents. */
function ancestry(id: string, index: Index): Map<string, { depth: number; distant: boolean }> {
  const out = new Map<string, { depth: number; distant: boolean }>()
  const queue: { id: string; depth: number; distant: boolean }[] = [{ id, depth: 0, distant: false }]
  while (queue.length) {
    const cur = queue.shift()!
    if (out.has(cur.id)) continue
    out.set(cur.id, { depth: cur.depth, distant: cur.distant })
    const p = index.get(cur.id)
    if (!p) continue
    if (p.parent) queue.push({ id: p.parent, depth: cur.depth + 1, distant: cur.distant || Boolean(p.distant) })
    if (p.otherParent) queue.push({ id: p.otherParent, depth: cur.depth + 1, distant: cur.distant })
  }
  return out
}

const ORDINAL_EN = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
const REMOVED_EN = ['', 'once', 'twice', 'three times', 'four times', 'five times']

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
  const upA = ancestry(a, index)
  const upB = ancestry(b, index)
  let ia = -1
  let ib = -1
  let distant = false
  for (const [id, xb] of upB) {
    const xa = upA.get(id)
    if (!xa) continue
    const better = ia < 0 || xa.depth + xb.depth < ia + ib || (xa.depth + xb.depth === ia + ib && Math.abs(xa.depth - xb.depth) < Math.abs(ia - ib))
    if (better) {
      ia = xa.depth
      ib = xb.depth
      distant = xa.distant || xb.distant
    }
  }
  if (ia < 0) return null
  const female = Boolean(index.get(b)?.female)
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
    const e = female ? 'e' : ''
    if (degree === 1 && removed === 0) return `cousin${e} germain${e}`
    if (degree === 2 && removed === 0) return `cousin${e} issu${e} de germain`
    return `cousin${e} au ${ia + ib}e degré`
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
  return `${born}–${yearText(p.died, p.diedCirca, locale)}`
}

export function roleLabel(p: Person, locale: Locale): string {
  if (!p.role) return ''
  if (locale === 'fr' && p.female) {
    return { heir: 'Héritière', claimant: 'Prétendante', consort: 'Conjointe', regent: 'Régente' }[p.role]
  }
  return ui[locale].role[p.role]
}

export function spousesOnChart(p: Person, people: Person[]): Person[] {
  const ids = new Set(p.spouseOf ?? [])
  return people.filter((q) => ids.has(q.id) || q.spouseOf?.includes(p.id))
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

function spousesOf(p: Person, index: Index): Person[] {
  const out: Person[] = []
  for (const q of index.values()) if (p.spouseOf?.includes(q.id) || q.spouseOf?.includes(p.id)) out.push(q)
  return out
}

const SIBLING = new Set(['brother', 'sister', 'frère', 'sœur'])
const CHILD = new Set(['son', 'daughter', 'fils', 'fille'])

function inLaw(subject: Person, other: Person, index: Index, locale: Locale): string | null {
  const fr = locale === 'fr'
  const f = Boolean(other.female)
  for (const s of spousesOf(other, index)) {
    const k = kinship(subject.id, s.id, index, locale)
    if (k && SIBLING.has(k)) return fr ? (f ? 'belle-sœur' : 'beau-frère') : f ? 'sister-in-law' : 'brother-in-law'
    if (k && CHILD.has(k)) return fr ? (f ? 'belle-fille' : 'gendre') : f ? 'daughter-in-law' : 'son-in-law'
  }
  for (const s of spousesOf(subject, index)) {
    const k = kinship(s.id, other.id, index, locale)
    if (k && SIBLING.has(k)) return fr ? (f ? 'belle-sœur' : 'beau-frère') : f ? 'sister-in-law' : 'brother-in-law'
    if (k && (k === 'father' || k === 'mother' || k === 'père' || k === 'mère'))
      return fr ? (f ? 'belle-mère' : 'beau-père') : f ? 'mother-in-law' : 'father-in-law'
  }
  return null
}

const FEMININE_FR = /^(fille|sœur|mère|nièce|tante|grand-mère|petite-fille|cousine|belle-|épouse)/

/** How `other` is related to `subject`, phrased from the subject's side: "his father", "her husband", "his brother-in-law". */
export function relationPhrase(subject: Person, kinshipTerm: string | null, locale: Locale, none: string, other?: Person, index?: Index): string {
  if (other && (subject.spouseOf?.includes(other.id) || other.spouseOf?.includes(subject.id))) {
    const term = other.female ? ui[locale].wife : ui[locale].husband
    if (locale === 'fr') return `son ${term}`
    return `${possessive(subject, locale)} ${term}`
  }
  let term = kinshipTerm
  if (!term && other && index) term = inLaw(subject, other, index, locale)
  if (!term) return none
  if (locale === 'fr') {
    const startsWithVowel = /^[aeiouàâäéèêëïîôùûüh]/i.test(term)
    const fem = other ? Boolean(other.female) : FEMININE_FR.test(term)
    return `${fem && !startsWithVowel ? 'sa' : 'son'} ${term}`
  }
  return `${possessive(subject, locale)} ${term}`
}
