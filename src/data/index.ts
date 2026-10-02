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

export const kingdomMeta: Record<
  Kingdom,
  { label: string; labelFr: string; subtitle: string; subtitleFr: string }
> = {
  france: {
    label: 'France',
    labelFr: 'France',
    subtitle: 'From Hugh Capet to the last crowns',
    subtitleFr: 'D’Hugues Capet aux dernières couronnes',
  },
  england: {
    label: 'England',
    labelFr: 'Angleterre',
    subtitle: 'From Wessex to the House of Windsor',
    subtitleFr: 'Du Wessex à la maison Windsor',
  },
}
