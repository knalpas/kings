import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy'
import type { Person } from '../types'

export type TreeNode = {
  id: string
  person: Person | null
  children?: TreeNode[]
}

const ROOT_ID = '__root__'

/** Oval portrait medallion, as on an engraved plate. */
export const NODE_RX = 18
export const NODE_RY = 23
/** Space reserved under each medallion for the name and dates. */
export const LABEL_BLOCK = 34
export const NODE_GAP_X = 168
export const NODE_GAP_Y = 156

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

export function layoutTree(people: Person[]): LaidOut {
  const rootData = buildForest(people)
  const root = hierarchy(rootData)
  const layout = tree<TreeNode>()
    .nodeSize([NODE_GAP_X, NODE_GAP_Y])
    .separation((a, b) => (a.parent === b.parent ? 1.12 : 1.45))
  const laid = layout(root)

  // Stack separate bloodlines one under another so the plate reads downward.
  const forestRoots = (laid.children ?? []).slice()
  let cursorY = 0
  const COMPONENT_GAP_Y = NODE_GAP_Y * 0.85
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

  const padX = 96
  const padTop = 156
  const padBottom = 78
  for (const n of visible) {
    n.x = n.x - minX + padX
    n.y = n.y - minY + padTop
  }

  return {
    nodes: visible,
    links,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padTop + padBottom,
  }
}

/** Fine genealogical rule, dropping clear of the caption under each portrait. */
export function genealogyLinkPath(
  s: { x: number; y: number },
  t: { x: number; y: number },
): string {
  const y0 = s.y + NODE_RY + LABEL_BLOCK
  const y1 = t.y - NODE_RY - 8
  const mid = (y0 + y1) / 2
  if (Math.abs(s.x - t.x) < 2) return `M${s.x},${y0}V${y1}`
  return `M${s.x},${y0}V${mid}H${t.x}V${y1}`
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
