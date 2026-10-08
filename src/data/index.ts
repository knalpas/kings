import type { DynastyStyle, Kingdom, Person } from '../types'
import { englandDynasties, englandPeople } from './england'
import { wessexPeople } from './england-wessex'
import { franceDynasties, francePeople } from './france'

export function peopleFor(kingdom: Kingdom): Person[] {
  if (kingdom === 'france') return francePeople
  return [...wessexPeople, ...englandPeople]
}

export function dynastiesFor(kingdom: Kingdom): DynastyStyle[] {
  return kingdom === 'france' ? franceDynasties : englandDynasties
}

export function dynastyMap(kingdom: Kingdom): Map<string, DynastyStyle> {
  return new Map(dynastiesFor(kingdom).map((d) => [d.id, d]))
}

export const kingdomMeta: Record<Kingdom, { label: string; subtitle: string; chartTitle: string }> = {
  france: {
    label: 'France',
    subtitle: 'From Charlemagne to the Second Empire',
    chartTitle: 'Kings of France',
  },
  england: {
    label: 'England',
    subtitle: 'From Alfred the Great to the House of Windsor',
    chartTitle: 'Kings of England',
  },
}
