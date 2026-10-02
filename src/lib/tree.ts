import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy'
import type { DynastyStyle, Person } from '../types'

export type TreeNode = {
  id: string
  person: Person | null
  children?: TreeNode[]
}

const ROOT_ID = '__root__'

/** Compact portrait circle (poster charts). */
export const NODE_R = 20
export const NODE_GAP_X = 210
export const NODE_GAP_Y = 96

export function buildForest(people: Person[]): TreeNode {
  const byId = new Map(people.map((p) => [p.id, p]))
  const children = new Map<string, string[]>()

  for (const p of people) {
    const parent = p.parentId && byId.has(p.parentId) ? p.parentId : ROOT_ID
    const list = children.get(parent) ?? []
    list.push(p.id)
    children.set(parent, list)
  }

  for (const [k, list] of children) {
    list.sort((a, b) => {
      const pa = byId.get(a)
      const pb = byId.get(b)
      const ya = pa?.birth ?? pa?.reignStart ?? 0
      const yb = pb?.birth ?? pb?.reignStart ?? 0
      return ya - yb
    })
    children.set(k, list)
  }

  function make(id: string): TreeNode {
    if (id === ROOT_ID) {
      return {
        id,
        person: null,
        children: (children.get(ROOT_ID) ?? []).map(make),
      }
    }
    const person = byId.get(id)!
    const kids = children.get(id) ?? []
    return {
      id,
      person,
      children: kids.length ? kids.map(make) : undefined,
    }
  }

  return make(ROOT_ID)
}

export type LaidOut = {
  nodes: HierarchyPointNode<TreeNode>[]
  links: { source: HierarchyPointNode<TreeNode>; target: HierarchyPointNode<TreeNode> }[]
  width: number
  height: number
}

export type DynastyBand = {
  dynastyId: string
  y0: number
  y1: number
  label: string
  fill: string
}

export function layoutTree(people: Person[]): LaidOut {
  const rootData = buildForest(people)
  const root = hierarchy(rootData)
  const layout = tree<TreeNode>()
    .nodeSize([NODE_GAP_X, NODE_GAP_Y])
    .separation((a, b) => (a.parent === b.parent ? 1.05 : 1.35))
  const laid = layout(root)

  // Stack separate bloodlines vertically (poster charts read top → bottom).
  const forestRoots = (laid.children ?? []).slice()
  let cursorY = 0
  const COMPONENT_GAP_Y = NODE_GAP_Y * 1.6
  for (const component of forestRoots) {
    const desc = component.descendants()
    const ys = desc.map((d) => d.y)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const shiftY = cursorY - minY
    for (const d of desc) d.y += shiftY
    cursorY = maxY + shiftY + COMPONENT_GAP_Y
  }

  const visible = laid.descendants().filter((d) => d.data.id !== ROOT_ID)
  const links = laid
    .links()
    .filter((l) => l.source.data.id !== ROOT_ID)
    .map((l) => ({ source: l.source, target: l.target }))

  for (const n of visible) n.y -= NODE_GAP_Y

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const n of visible) {
    minX = Math.min(minX, n.x)
    maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y)
    maxY = Math.max(maxY, n.y)
  }

  const padX = 140
  const padY = 110
  for (const n of visible) {
    n.x = n.x - minX + padX
    n.y = n.y - minY + padY
  }

  return {
    nodes: visible,
    links,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padY * 2 + 60,
  }
}

export function computeDynastyBands(
  nodes: HierarchyPointNode<TreeNode>[],
  dynasties: Map<string, DynastyStyle>,
  chartWidth: number,
): DynastyBand[] {
  const ranges = new Map<string, { min: number; max: number }>()
  for (const n of nodes) {
    const p = n.data.person!
    const d = p.dynasty
    const r = ranges.get(d) ?? { min: Infinity, max: -Infinity }
    r.min = Math.min(r.min, n.y)
    r.max = Math.max(r.max, n.y)
    ranges.set(d, r)
  }

  const pad = 52
  const bands: DynastyBand[] = []
  for (const [dynastyId, range] of ranges) {
    const style = dynasties.get(dynastyId)
    if (!style) continue
    bands.push({
      dynastyId,
      y0: range.min - pad,
      y1: range.max + pad,
      label: style.label,
      fill: style.bandFill,
    })
  }
  bands.sort((a, b) => a.y0 - b.y0)

  // Merge overlapping bands of same fill slightly - keep separate stripes
  void chartWidth
  return bands
}

/** Genealogical connector (thin black), T-shaped like classic charts. */
export function genealogyLinkPath(
  s: { x: number; y: number },
  t: { x: number; y: number },
  r = NODE_R,
): string {
  const y0 = s.y + r + 4
  const y1 = t.y - r - 4
  const mid = (y0 + y1) / 2
  if (Math.abs(s.x - t.x) < 2) return `M${s.x},${y0}V${y1}`
  return `M${s.x},${y0}V${mid}H${t.x}V${y1}`
}

/** Bold red succession arrow between two monarchs. */
export function successionLinkPath(
  s: { x: number; y: number },
  t: { x: number; y: number },
  r = NODE_R,
): string {
  const y0 = s.y + r + 6
  const y1 = t.y - r - 6
  const midY = (y0 + y1) / 2
  const bend = (t.x - s.x) * 0.15
  return `M${s.x},${y0}C${s.x + bend},${midY} ${t.x - bend},${midY} ${t.x},${y1}`
}

export function reignLabel(p: Person): string {
  if (p.reignStart == null) return ''
  if (p.reignEnd == null) return `${p.reignStart}–`
  if (p.reignStart === p.reignEnd) return String(p.reignStart)
  return `${p.reignStart}–${p.reignEnd}`
}

export function lifeLabel(p: Person): string {
  if (p.birth == null && p.death == null) return ''
  return `${p.birth ?? '?'} – ${p.death ?? '?'}`
}
