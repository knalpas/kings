import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy'
import type { House, Interval, Person } from '../types'

export const PX_PER_YEAR = 7
export const SLOT = 172
export const R_MONARCH = 30
export const R_ANCESTOR = 20
/** Vertical footprint of a node with its caption, used for collision checks. */
const ROW_H = 108
const MIN_GEN = 12 * PX_PER_YEAR
const CAPTION = 40
const PAD_LEFT = 150
const PAD_RIGHT = 140
const TOP = 210
const COMPONENT_GAP = 70

export const CURRENT_YEAR = new Date().getFullYear()

export type ChartNode = {
  id: string
  person: Person
  x: number
  y: number
  r: number
  monarch: boolean
  ordinal?: number
}

export type ChartLink = {
  parent: string
  child: string
  distant: boolean
  d: string
}

export type Band = {
  kind: 'house' | 'gap'
  houseId?: string
  label: string
  color: string
  start: number
  end: number
  y0: number
  y1: number
}

export type Layout = {
  nodes: ChartNode[]
  byId: Map<string, ChartNode>
  links: ChartLink[]
  bands: Band[]
  chain: Person[]
  width: number
  height: number
  minYear: number
  maxYear: number
  yearToY: (year: number) => number
  yToYear: (y: number) => number
}

export function bandAt(layout: Layout, year: number): Band | undefined {
  const last = layout.bands.at(-1)
  return layout.bands.find((b) => year >= b.start && year < b.end) ?? (last && year >= last.end ? last : undefined)
}

export const isMonarch = (p: Person) => p.reign != null

/** Monarchs (and protectors) in order of accession. */
export function successionChain(people: Person[]): Person[] {
  return people
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => isMonarch(p))
    .sort((a, b) => a.p.reign![0] - b.p.reign![0] || a.i - b.i)
    .map(({ p }) => p)
}

function naturalYear(p: Person): number {
  if (p.reign) return p.reign[0]
  if (p.born != null) {
    const y = p.born + 22
    return p.died != null ? Math.min(y, p.died - 1) : y
  }
  return (p.died ?? 0) - 20
}

type TreeDatum = { id: string; person: Person | null; children: TreeDatum[] }

export function computeLayout(people: Person[], houses: House[], gaps: Interval[]): Layout {
  const houseById = new Map(houses.map((h) => [h.id, h]))
  const chain = successionChain(people)

  const years = people.map(naturalYear)
  const lastReignEnd = Math.max(...chain.map((p) => p.reign![1] ?? CURRENT_YEAR))
  const minYear = Math.floor((Math.min(...years) - 12) / 10) * 10
  const maxYear = Math.ceil((Math.max(lastReignEnd, ...years) + 14) / 10) * 10
  const yearToY = (year: number) => TOP + (year - minYear) * PX_PER_YEAR
  const yToYear = (y: number) => minYear + (y - TOP) / PX_PER_YEAR

  // Forest of blood descent.
  const data = new Map<string, TreeDatum>()
  const root: TreeDatum = { id: '__root__', person: null, children: [] }
  for (const p of people) data.set(p.id, { id: p.id, person: p, children: [] })
  for (const p of people) {
    const parent = p.parent ? data.get(p.parent) : undefined
    ;(parent ?? root).children.push(data.get(p.id)!)
  }
  const sortKids = (n: TreeDatum) => {
    n.children.sort((a, b) => naturalYear(a.person!) - naturalYear(b.person!))
    n.children.forEach(sortKids)
  }
  sortKids(root)

  const h = hierarchy(root, (n) => (n.children.length ? n.children : undefined))
  const laid = tree<TreeDatum>()
    .nodeSize([SLOT, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.2))(h)

  const pos = new Map<string, { x: number; y: number }>()
  const components = laid.children ?? []

  type Comp = { nodes: HierarchyPointNode<TreeDatum>[]; x0: number; x1: number; y0: number; y1: number }
  const comps: Comp[] = []

  for (const c of components) {
    const desc = c.descendants()

    // Monarchs sit exactly at their accession year; ancestors sit between parent and children.
    for (const d of desc) {
      const p = d.data.person!
      let y = yearToY(naturalYear(p))
      if (!isMonarch(p) && d.parent?.data.person) {
        y = Math.max(y, pos.get(d.parent.data.id)!.y + MIN_GEN)
      }
      pos.set(d.data.id, { x: d.x, y })
    }
    for (const d of [...desc].reverse()) {
      const p = d.data.person!
      if (isMonarch(p) || !d.children) continue
      const minChild = Math.min(...d.children.map((k) => pos.get(k.data.id)!.y))
      const here = pos.get(d.data.id)!
      const lower = d.parent?.data.person ? pos.get(d.parent.data.id)!.y + 4 * PX_PER_YEAR : -Infinity
      if (here.y > minChild - MIN_GEN) here.y = Math.max(lower, minChild - MIN_GEN)
    }

    relax(desc, pos)

    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const d of desc) {
      const q = pos.get(d.data.id)!
      x0 = Math.min(x0, q.x - SLOT / 2)
      x1 = Math.max(x1, q.x + SLOT / 2)
      y0 = Math.min(y0, q.y - R_MONARCH - 10)
      y1 = Math.max(y1, q.y + R_MONARCH + CAPTION)
    }
    comps.push({ nodes: desc, x0, x1, y0, y1 })
  }

  // Pack separate bloodlines side by side, reusing columns that are free in time.
  comps.sort((a, b) => b.nodes.length - a.nodes.length)
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
  for (const c of comps) {
    const w = c.x1 - c.x0
    const candidates = [0]
    for (const p of placed) candidates.push(p.x1 + COMPONENT_GAP, p.x0 - COMPONENT_GAP - w)
    candidates.sort((a, b) => Math.abs(a) - Math.abs(b))
    const fits = (x: number) =>
      placed.every((p) => x + w <= p.x0 - COMPONENT_GAP / 2 || x >= p.x1 + COMPONENT_GAP / 2 || c.y1 < p.y0 - 30 || c.y0 > p.y1 + 30)
    const x = candidates.find(fits) ?? 0
    const shift = x - c.x0
    for (const d of c.nodes) pos.get(d.data.id)!.x += shift
    placed.push({ x0: x, x1: x + w, y0: c.y0, y1: c.y1 })
  }

  let minX = Infinity
  let maxX = -Infinity
  for (const q of pos.values()) {
    minX = Math.min(minX, q.x)
    maxX = Math.max(maxX, q.x)
  }
  for (const q of pos.values()) q.x = q.x - minX + PAD_LEFT

  const ordinals = new Map<string, number>()
  let n = 0
  for (const p of chain) if (!p.protector) ordinals.set(p.id, ++n)

  const nodes: ChartNode[] = people.map((person) => {
    const q = pos.get(person.id)!
    const monarch = isMonarch(person)
    return {
      id: person.id,
      person,
      x: q.x,
      y: q.y,
      r: monarch ? R_MONARCH : R_ANCESTOR,
      monarch,
      ordinal: ordinals.get(person.id),
    }
  })
  const byId = new Map(nodes.map((nd) => [nd.id, nd]))

  const links: ChartLink[] = []
  for (const person of people) {
    if (!person.parent) continue
    const a = byId.get(person.parent)
    const b = byId.get(person.id)
    if (!a || !b) continue
    links.push({ parent: a.id, child: b.id, distant: Boolean(person.distant), d: descentPath(a, b) })
  }

  const bands = computeBands(chain, houseById, gaps, lastReignEnd, yearToY)

  return {
    nodes,
    byId,
    links,
    bands,
    chain,
    width: maxX - minX + PAD_LEFT + PAD_RIGHT,
    height: yearToY(maxYear) + 60,
    minYear,
    maxYear,
    yearToY,
    yToYear,
  }
}

/** Push apart nodes whose discs or captions would overlap, moving whole subtrees sideways. */
function relax(desc: HierarchyPointNode<TreeDatum>[], pos: Map<string, { x: number; y: number }>) {
  const isAncestor = (a: HierarchyPointNode<TreeDatum>, b: HierarchyPointNode<TreeDatum>) => {
    for (let p = b.parent; p; p = p.parent) if (p === a) return true
    return false
  }
  const minDx = SLOT - 6
  for (let pass = 0; pass < 200; pass++) {
    let moved = false
    const sorted = [...desc].sort((a, b) => pos.get(a.data.id)!.y - pos.get(b.data.id)!.y)
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = pos.get(sorted[i].data.id)!
        const b = pos.get(sorted[j].data.id)!
        if (b.y - a.y >= ROW_H) break
        const dx = b.x - a.x
        if (Math.abs(dx) >= minDx) continue
        let mover = dx >= 0 ? sorted[j] : sorted[i]
        let other = mover === sorted[j] ? sorted[i] : sorted[j]
        let dir = 1
        if (isAncestor(mover, other)) {
          ;[mover, other] = [other, mover]
          dir = -1
        }
        const need = (minDx - Math.abs(dx)) * dir
        for (const d of mover.descendants()) pos.get(d.data.id)!.x += need
        moved = true
      }
    }
    if (!moved) break
  }
}

function descentPath(a: ChartNode, b: ChartNode): string {
  const startY = a.y + a.r + CAPTION
  const endY = b.y - b.r - 6
  const barY = startY + 16
  if (endY - barY < 10) {
    // Parent and child too close in time for a drop line: join them from the side.
    const dir = b.x >= a.x ? 1 : -1
    const sx = a.x + dir * (a.r + 4)
    const ex = b.x - dir * (b.r + 4)
    const mx = (sx + ex) / 2
    return `M${sx},${a.y}H${mx}V${b.y}H${ex}`
  }
  if (Math.abs(a.x - b.x) < 1) return `M${a.x},${startY}V${endY}`
  const dir = b.x > a.x ? 1 : -1
  const r = Math.min(10, Math.abs(b.x - a.x) / 2, (endY - barY) / 2, 8)
  return [
    `M${a.x},${startY}`,
    `V${barY - r}`,
    `Q${a.x},${barY} ${a.x + dir * r},${barY}`,
    `H${b.x - dir * r}`,
    `Q${b.x},${barY} ${b.x},${barY + r}`,
    `V${endY}`,
  ].join('')
}

function computeBands(
  chain: Person[],
  houseById: Map<string, House>,
  gaps: Interval[],
  lastEnd: number,
  yearToY: (y: number) => number,
): Band[] {
  const runs: { house: string; start: number }[] = []
  for (const p of chain) {
    const last = runs[runs.length - 1]
    if (!last || last.house !== p.house) runs.push({ house: p.house, start: p.reign![0] })
  }
  let segs: { kind: 'house' | 'gap'; house?: string; label?: string; start: number; end: number }[] = runs.map((r, i) => ({
    kind: 'house',
    house: r.house,
    start: r.start,
    end: i + 1 < runs.length ? runs[i + 1].start : lastEnd,
  }))
  for (const g of gaps) {
    for (const s of segs) if (s.start < g.start && g.start < s.end) s.end = g.start
    segs.push({ kind: 'gap', label: g.label, start: g.start, end: g.end })
  }
  segs = segs.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start)

  const merged: typeof segs = []
  for (const s of segs) {
    const prev = merged[merged.length - 1]
    if (prev && prev.kind === 'house' && s.kind === 'house' && prev.house === s.house && prev.end >= s.start) {
      prev.end = Math.max(prev.end, s.end)
    } else merged.push({ ...s })
  }

  return merged.map((s) => {
    const house = s.house ? houseById.get(s.house) : undefined
    return {
      kind: s.kind,
      houseId: s.house,
      label: s.kind === 'gap' ? s.label! : house?.label ?? s.house!,
      color: s.kind === 'gap' ? '#8a847a' : house?.color ?? '#888',
      start: s.start,
      end: s.end,
      y0: yearToY(s.start),
      y1: yearToY(s.end),
    }
  })
}
