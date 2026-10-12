import type { Kingdom, KingdomData } from '../types'
import { englandGaps, englandHouses, englandPeople } from './england'
import { franceGaps, franceHouses, francePeople } from './france'
import { spainGaps, spainHouses, spainPeople } from './spain'

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
    subtitle: 'From Childeric I to Napoleon III, 457–1870',
    houses: franceHouses,
    people: francePeople,
    gaps: franceGaps,
  },
  spain: {
    id: 'spain',
    label: 'Spain',
    title: 'The Kings and Queens of Spain',
    subtitle: 'From Isabella and Ferdinand to Felipe VI, 1474 to the present',
    houses: spainHouses,
    people: spainPeople,
    gaps: spainGaps,
  },
}

export const kingdomOrder: Kingdom[] = ['england', 'france', 'spain']
