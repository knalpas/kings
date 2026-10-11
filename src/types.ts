export type Kingdom = 'england' | 'france'

export type Person = {
  id: string
  name: string
  /** Shorter caption for the chart when the full name is long. */
  short?: string
  title: string
  house: string
  parent: string | null
  /** The other parent, when they are on the chart (used for kinship and family links, not drawn as descent). */
  otherParent?: string
  /** The parent link skips generations that are not drawn. */
  distant?: boolean
  /** Accession and end of reign; absent for ancestors who never reigned. */
  reign?: [number, number | null]
  /** Display text for interrupted reigns, e.g. "1422–1461, 1470–1471". */
  reignText?: string
  /** Heads of state who were not crowned (e.g. Lord Protector). */
  protector?: boolean
  born?: number
  bornCirca?: boolean
  died?: number
  diedCirca?: boolean
  female?: boolean
  /** Why a non-reigning person matters to the succession. */
  role?: 'heir' | 'claimant' | 'consort' | 'regent'
  /** Partners drawn on the chart; a spouse without a parent is placed beside the first partner. */
  spouseOf?: string[]
  /** One-line note on how their story ended, e.g. "Drowned in the White Ship, 1120". */
  fate?: string
  epithet?: string
  /** How the crown was obtained, when not a plain inheritance. */
  accession?: string
  spouses?: string[]
  summary: string
  events?: string[]
  wikipedia: string
}

export type House = {
  id: string
  label: string
  color: string
  note: string
}

export type Interval = {
  start: number
  end: number
  label: string
}

export type KingdomData = {
  id: Kingdom
  label: string
  title: string
  subtitle: string
  houses: House[]
  people: Person[]
  /** Periods without a monarch, shown as neutral bands. */
  gaps: Interval[]
}
