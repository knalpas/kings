import type { Kingdom, KingdomData } from '../types'
import { englandGaps, englandHouses, englandPeople } from './england'
import { franceGaps, franceHouses, francePeople } from './france'

export const kingdoms: Record<Kingdom, KingdomData> = {
  england: {
    id: 'england',
    label: 'England',
    title: 'The Kings and Queens of England',
    subtitle: 'From Alfred the Great to Charles III, 871 to the present',
    houses: englandHouses,
    people: englandPeople,
    gaps: englandGaps,
  },
  france: {
    id: 'france',
    label: 'France',
    title: 'The Kings and Emperors of France',
    subtitle: 'From Pepin the Short to Napoleon III, 751–1870',
    houses: franceHouses,
    people: francePeople,
    gaps: franceGaps,
  },
}

export const kingdomOrder: Kingdom[] = ['england', 'france']
