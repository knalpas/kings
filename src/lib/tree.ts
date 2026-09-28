import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy'
import type { Person } from '../types'

export type TreeNode = {
  id: string
  person: Person | null
  children?: TreeNode[]
}

const ROOT_ID = '__root__'

export function buildForest(people: Person[]): TreeNode {
  const byId = new Map(people.map((p) => [p.id, p]))
  const children = new Map<string, string[]>()

  for (const p of people) {
    const parent = p.parentId && byId.has(p.parentId) ? p.parentId : ROOT_ID
    const list = children.get(parent) ?? []
    list.push(p.id)
    children.set(parent, list)
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

export function layoutTree(people: Person[], opts?: { dx?: number; dy?: number }): LaidOut {
  const rootData = buildForest(people)
  const root = hierarchy(rootData)
  const dx = opts?.dx ?? 78
  const dy = opts?.dy ?? 210
  const layout = tree<TreeNode>().nodeSize([dx, dy])
  const laid = layout(root)

  // Drop the virtual root from rendering; shift children up.
  const visible = laid.descendants().filter((d) => d.data.id !== ROOT_ID)
  const links = laid.links().filter((l) => l.source.data.id !== ROOT_ID)

  // If roots hung off virtual root, promote those links as having no parent line from root —
  // we already filtered source === ROOT. Children of root become forest roots (no inbound link).

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const n of visible) {
    // Shift generation so forest roots sit at y=0
    n.y -= dy
    minX = Math.min(minX, n.x)
    maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y)
    maxY = Math.max(maxY, n.y)
  }

  const padX = 120
  const padY = 80
  for (const n of visible) {
    n.x = n.x - minX + padX
    n.y = n.y - minY + padY
  }

  return {
    nodes: visible,
    links: links.map((l) => ({ source: l.source, target: l.target })),
    width: maxX - minX + padX * 2,
    height: maxY - minY + padY * 2,
  }
}

export function reignLabel(p: Person): string {
  if (p.reignStart == null) return ''
  if (p.reignEnd == null) return `${p.reignStart} –`
  if (p.reignStart === p.reignEnd) return `${p.reignStart}`
  return `${p.reignStart} – ${p.reignEnd}`
}

export function lifeLabel(p: Person): string {
  if (p.birth == null && p.death == null) return ''
  return `${p.birth ?? '?'} – ${p.death ?? '?'}`
}
