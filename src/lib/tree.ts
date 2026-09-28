import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy'
import type { Person } from '../types'

export type TreeNode = {
  id: string
  person: Person | null
  children?: TreeNode[]
}

const ROOT_ID = '__root__'

/** Portrait medallion radius + label clearance. */
export const NODE_R = 36
export const NODE_GAP_X = 118
export const NODE_GAP_Y = 168

export function buildForest(people: Person[]): TreeNode {
  const byId = new Map(people.map((p) => [p.id, p]))
  const children = new Map<string, string[]>()

  for (const p of people) {
    const parent = p.parentId && byId.has(p.parentId) ? p.parentId : ROOT_ID
    const list = children.get(parent) ?? []
    list.push(p.id)
    children.set(parent, list)
  }

  // Stable chronological-ish order among siblings
  for (const [k, list] of children) {
    list.sort((a, b) => {
      const pa = byId.get(a)
      const pb = byId.get(b)
      const ya = pa?.reignStart ?? pa?.birth ?? 0
      const yb = pb?.reignStart ?? pb?.birth ?? 0
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

/**
 * Layout a forest of trees with generous spacing and gaps between
 * disconnected dynastic roots so branches don't collide.
 */
export function layoutTree(people: Person[]): LaidOut {
  const rootData = buildForest(people)
  const root = hierarchy(rootData)
  const layout = tree<TreeNode>().nodeSize([NODE_GAP_X, NODE_GAP_Y]).separation((a, b) => {
    // More air between different subtrees
    return a.parent === b.parent ? 1.15 : 1.45
  })
  const laid = layout(root)

  const forestRoots = (laid.children ?? []).slice()
  // Space forest components apart along X after default layout
  let cursor = 0
  const COMPONENT_GAP = NODE_GAP_X * 1.8
  for (const component of forestRoots) {
    const leaves = component.leaves()
    const xs = component.descendants().map((d) => d.x)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const width = maxX - minX
    const shift = cursor - minX
    for (const d of component.descendants()) {
      d.x += shift
    }
    cursor += width + COMPONENT_GAP
    void leaves
  }

  const visible = laid.descendants().filter((d) => d.data.id !== ROOT_ID)
  const links = laid
    .links()
    .filter((l) => l.source.data.id !== ROOT_ID)
    .map((l) => ({ source: l.source, target: l.target }))

  // Drop virtual root generation
  for (const n of visible) {
    n.y -= NODE_GAP_Y
  }

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

  const padX = 100
  const padY = 90
  for (const n of visible) {
    n.x = n.x - minX + padX
    n.y = n.y - minY + padY
  }

  return {
    nodes: visible,
    links,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padY * 2 + 40,
  }
}

/** Smooth organic elbow curve between parent and child. */
export function linkPath(
  s: { x: number; y: number },
  t: { x: number; y: number },
  r = NODE_R,
): string {
  const y0 = s.y + r + 18
  const y1 = t.y - r - 2
  const mid = (y0 + y1) / 2
  return `M${s.x},${y0}C${s.x},${mid} ${t.x},${mid} ${t.x},${y1}`
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
