import type { Person } from '../types'
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

const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
const REMOVED = ['', 'once', 'twice', 'three times', 'four times', 'five times']

function greats(n: number): string {
  if (n <= 0) return ''
  if (n === 1) return 'great-'
  return `${n}× great-`
}

/**
 * Describes `b` relative to `a`, e.g. "son", "nephew", "second cousin".
 * Returns null when the chart shows no common ancestor.
 */
export function kinship(a: string, b: string, index: Index): string | null {
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
  if (distant) return ia === 0 ? 'distant descendant' : 'distant cousin'

  if (ia === 0 && ib === 0) return 'same person'
  if (ia === 0) {
    if (ib === 1) return female ? 'daughter' : 'son'
    return `${greats(ib - 2)}${female ? 'granddaughter' : 'grandson'}`
  }
  if (ib === 0) {
    if (ia === 1) return female ? 'mother' : 'father'
    return `${greats(ia - 2)}${female ? 'grandmother' : 'grandfather'}`
  }
  if (ia === 1 && ib === 1) return female ? 'sister' : 'brother'
  if (ia === 1) return `${greats(ib - 2)}${female ? 'niece' : 'nephew'}`
  if (ib === 1) return `${greats(ia - 2)}${female ? 'aunt' : 'uncle'}`
  const degree = Math.min(ia, ib) - 1
  const removed = Math.abs(ia - ib)
  const deg = ORDINAL[degree] ?? `${degree}th`
  return `${deg} cousin${removed ? ` ${REMOVED[removed] ?? `${removed} times`} removed` : ''}`
}

export function children(id: string, people: Person[]): Person[] {
  return people.filter((p) => p.parent === id)
}

export function yearText(year: number | undefined, circa?: boolean): string {
  if (year == null) return '—'
  return circa ? `c. ${year}` : String(year)
}

export function reignText(p: Person): string {
  if (!p.reign) return ''
  if (p.reignText) return p.reignText
  const [s, e] = p.reign
  if (e == null) return `${s}–present`
  if (s === e) return String(s)
  return `${s}–${e}`
}

export function reignLength(p: Person): string {
  if (!p.reign) return ''
  const [s, e] = p.reign
  const years = (e ?? CURRENT_YEAR) - s
  if (years < 1) return 'under a year'
  return `${years} year${years === 1 ? '' : 's'}`
}

export function lifeText(p: Person): string {
  const born = yearText(p.born, p.bornCirca)
  if (p.died == null) return p.born != null ? `born ${born}` : ''
  return `${born}–${p.died}`
}

export function ageAt(p: Person, year: number | undefined): number | null {
  if (p.born == null || year == null) return null
  return year - p.born
}

export function ageLabel(p: Person, year: number | undefined): string {
  const age = ageAt(p, year)
  if (age == null) return ''
  return `${p.bornCirca ? 'about ' : ''}${age}`
}

export function possessive(p: Person): string {
  return p.female ? 'her' : 'his'
}
