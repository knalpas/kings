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
const COMPONENT_GAP = 36

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
  kind: 'descent' | 'marriage'
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
  // Spouses without a drawn parent hang beside their partner so the couple stays together.
  const anchorOf = new Map<string, string>()
  for (const p of people) {
    if (p.parent) continue
    const partner = p.spouseOf?.find((id) => data.has(id))
    if (partner) anchorOf.set(p.id, partner)
  }
  for (const p of people) {
    const parentId = p.parent ?? anchorOf.get(p.id)
    const parent = parentId ? data.get(parentId) : undefined
    ;(parent ?? root).children.push(data.get(p.id)!)
  }
  const isConsortSlot = (id: string) => anchorOf.has(id)
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

    // Monarchs sit exactly at their accession year; ancestors sit between parent and children;
    // spouses without a parent sit level with (or after) their partner.
    const place = (d: HierarchyPointNode<TreeDatum>, initial: boolean) => {
      const p = d.data.person!
      const here = pos.get(d.data.id)
      let y = initial || !here ? yearToY(naturalYear(p)) : here.y
      const up = d.parent?.data.person ? pos.get(d.parent.data.id)!.y : null
      if (up != null && isConsortSlot(d.data.id)) y = Math.max(yearToY(naturalYear(p)), up)
      else if (up != null && !isMonarch(p)) y = Math.max(y, up + MIN_GEN)
      if (here) here.y = y
      else pos.set(d.data.id, { x: d.x, y })
    }
    for (const d of desc) place(d, true)
    for (const d of [...desc].reverse()) {
      const p = d.data.person!
      if (isMonarch(p) || isConsortSlot(d.data.id) || !d.children) continue
      const blood = d.children.filter((k) => !isConsortSlot(k.data.id))
      if (!blood.length) continue
      const minChild = Math.min(...blood.map((k) => pos.get(k.data.id)!.y))
      const here = pos.get(d.data.id)!
      const lower = d.parent?.data.person ? pos.get(d.parent.data.id)!.y + 4 * PX_PER_YEAR : -Infinity
      if (here.y > minChild - MIN_GEN) here.y = Math.max(lower, minChild - MIN_GEN)
    }
    for (const d of desc) if (d.parent?.data.person && !isMonarch(d.data.person!)) place(d, false)

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

  // Pack separate bloodlines side by side, each as close as possible to the monarchs it
  // succeeds or precedes, so the succession line never has to cross the whole chart.
  const compOf = new Map<string, Comp>()
  for (const c of comps) for (const d of c.nodes) compOf.set(d.data.id, c)
  // Ties between bloodlines: [own, other, weight]. Succession outweighs marriage.
  const ties: [string, string, number][] = []
  chain.forEach((p, i) => {
    const q = chain[i + 1]
    if (q) ties.push([p.id, q.id, 3], [q.id, p.id, 3])
  })
  for (const p of people)
    for (const q of [p.otherParent, ...(p.spouseOf ?? [])]) if (q && compOf.has(q)) ties.push([p.id, q, 1], [q, p.id, 1])
  const tiesOf = (c: Comp) => ties.filter(([own, other]) => compOf.get(own) === c && compOf.get(other) !== c)
  const minDx = SLOT + COMPONENT_GAP
  const base = new Map(comps.map((c) => [c, c.nodes.map((d) => ({ x: pos.get(d.data.id)!.x - c.x0, y: pos.get(d.data.id)!.y }))]))

  /** Place bloodlines in the given order, each at the free spot nearest its ties; returns x offsets. */
  const pack = (order: Comp[]) => {
    const placed: { x: number; y: number }[] = []
    const x0 = new Map<Comp, number>()
    const xOf = (id: string) => x0.get(compOf.get(id)!)! + base.get(compOf.get(id)!)![compIndex.get(id)!].x
    for (const c of order) {
      const own = base.get(c)!
      const live = tiesOf(c).filter(([, other]) => x0.has(compOf.get(other)!))
      const weight = live.reduce((s, t) => s + t[2], 0)
      const desired = weight
        ? live.reduce((s, [mine, other, w]) => s + w * (xOf(other) - own[compIndex.get(mine)!].x), 0) / weight
        : 0
      const candidates = [desired]
      for (const p of placed)
        for (const m of own) if (Math.abs(p.y - m.y) < ROW_H) candidates.push(p.x + minDx - m.x, p.x - minDx - m.x)
      candidates.sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired))
      const fits = (x: number) =>
        own.every((m) => placed.every((p) => Math.abs(p.y - m.y) >= ROW_H || Math.abs(p.x - (x + m.x)) >= minDx - 0.5))
      const x = candidates.find(fits) ?? desired
      x0.set(c, x)
      for (const m of own) placed.push({ x: x + m.x, y: m.y })
    }
    let cost = 0
    for (const [a, b, w] of ties) if (w === 3 && compOf.get(a) !== compOf.get(b)) cost += Math.abs(xOf(a) - xOf(b))
    const xs = placed.map((p) => p.x)
    cost += 0.5 * (Math.max(...xs) - Math.min(...xs))
    return { x0, cost }
  }
  const compIndex = new Map<string, number>()
  for (const c of comps) c.nodes.forEach((d, i) => compIndex.set(d.data.id, i))
  const [main, ...minor] = [...comps].sort((a, b) => b.nodes.length - a.nodes.length)
  const orders: Comp[][] = []
  const permute = (rest: Comp[], acc: Comp[]) => {
    if (orders.length >= 720) return
    if (!rest.length) orders.push(acc)
    rest.forEach((c, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, c]))
  }
  permute(minor, [])
  let best = pack([main, ...(orders[0] ?? [])])
  for (const o of orders.slice(1)) {
    const r = pack([main, ...o])
    if (r.cost < best.cost) best = r
  }
  for (const c of comps) {
    const x = best.x0.get(c)!
    c.nodes.forEach((d, i) => (pos.get(d.data.id)!.x = x + base.get(c)![i].x))
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
    links.push({ kind: 'descent', parent: a.id, child: b.id, distant: Boolean(person.distant), d: descentPath(a, b) })
  }
  for (const person of people) {
    for (const partner of person.spouseOf ?? []) {
      const a = byId.get(partner)
      const b = byId.get(person.id)
      if (!a || !b) continue
      links.push({ kind: 'marriage', parent: a.id, child: b.id, distant: false, d: marriagePath(a, b) })
    }
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

/**
 * Push apart nodes whose discs or captions would overlap. Two colliding relatives are separated by
 * moving the branches below their nearest common ancestor, keeping the branches in tree order, so
 * siblings never swap sides and the separation only grows.
 */
function relax(desc: HierarchyPointNode<TreeDatum>[], pos: Map<string, { x: number; y: number }>) {
  const minDx = SLOT - 6
  const at = (n: HierarchyPointNode<TreeDatum>) => pos.get(n.data.id)!
  const shift = (n: HierarchyPointNode<TreeDatum>, by: number) => {
    for (const d of n.descendants()) at(d).x += by
  }
  const pathUp = (n: HierarchyPointNode<TreeDatum>) => {
    const out: HierarchyPointNode<TreeDatum>[] = []
    for (let p: HierarchyPointNode<TreeDatum> | null = n; p; p = p.parent) out.push(p)
    return out
  }
  for (let pass = 0; pass < 400; pass++) {
    let moved = false
    const sorted = [...desc].sort((a, b) => at(a).y - at(b).y)
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = at(sorted[i])
        const b = at(sorted[j])
        if (b.y - a.y >= ROW_H) break
        if (Math.abs(b.x - a.x) >= minDx) continue
        const upA = pathUp(sorted[i])
        const upB = pathUp(sorted[j])
        const setB = new Set(upB)
        const lca = upA.find((n) => setB.has(n))!
        const ba = upA[upA.indexOf(lca) - 1]
        const bb = upB[upB.indexOf(lca) - 1]
        if (!ba || !bb) {
          // One is an ancestor of the other: move the descendant (and its own line) to its side.
          const anc = ba ? sorted[j] : sorted[i]
          const branch = ba ?? bb!
          const node = ba ? sorted[i] : sorted[j]
          const dx = at(node).x - at(anc).x
          const dir = dx !== 0 ? Math.sign(dx) : (lca.children!.indexOf(branch) < lca.children!.length / 2 ? -1 : 1)
          // Climb while moving would only push the node into its own parent.
          let k = node
          while (k.parent && k.parent !== anc && Math.sign(at(k.parent).x - at(k).x) === dir) k = k.parent
          shift(k, dir * (minDx - Math.abs(dx)) + dir * 0.5)
        } else {
          const kids = lca.children!
          const aLeft = kids.indexOf(ba) < kids.indexOf(bb)
          const [lb, rb, ln, rn] = aLeft ? [ba, bb, a, b] : [bb, ba, b, a]
          const need = minDx - (rn.x - ln.x)
          if (need <= 0) continue
          shift(rb, need / 2 + 0.5)
          shift(lb, -need / 2 - 0.5)
        }
        moved = true
      }
    }
    if (!moved) break
  }
}

function marriagePath(a: ChartNode, b: ChartNode): string {
  const dir = b.x >= a.x ? 1 : -1
  const sx = a.x + dir * (a.r + 3)
  const ex = b.x - dir * (b.r + 3)
  if (Math.abs(a.y - b.y) < 4) return `M${sx},${a.y}H${ex}`
  const mx = (sx + ex) / 2
  return `M${sx},${a.y}C${mx},${a.y} ${mx},${b.y} ${ex},${b.y}`
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
  // A gap inside one house (the same dynasty before and after) must split that band.
  // Truncating it would drop every year of the house that follows the gap.
  for (const g of gaps) {
    const next: typeof segs = []
    let placed = false
    for (const s of segs) {
      const cuts = s.kind === 'house' && s.start <= g.start && g.start < s.end
      if (!cuts) {
        next.push(s)
        continue
      }
      if (s.start < g.start) next.push({ ...s, end: g.start })
      next.push({ kind: 'gap', label: g.label, start: g.start, end: g.end })
      if (g.end < s.end) next.push({ ...s, start: g.end })
      placed = true
    }
    if (!placed) next.push({ kind: 'gap', label: g.label, start: g.start, end: g.end })
    segs = next
  }
  segs = segs.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start || (a.kind === 'gap' ? -1 : 1))

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
