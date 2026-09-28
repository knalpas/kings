import type { DynastyStyle, Kingdom, Person } from '../types'
import { englandDynasties, englandPeople } from './england'
import { franceDynasties, francePeople } from './france'

export function peopleFor(kingdom: Kingdom): Person[] {
  return kingdom === 'france' ? francePeople : englandPeople
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
    subtitle: 'From the Conquest to the present',
    subtitleFr: 'De la Conquête à nos jours',
  },
}
