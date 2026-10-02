import type { Person } from '../types'

/** Monarchs in order of accession (for the red succession path). */
export function successionChain(people: Person[]): Person[] {
  return people
    .filter((p) => p.reigning !== false && p.reignStart != null)
    .sort((a, b) => a.reignStart! - b.reignStart!)
}
