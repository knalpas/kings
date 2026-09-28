import { useEffect, useMemo, useRef } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import type { DynastyStyle, Person } from '../types'
import { layoutTree, reignLabel } from '../lib/tree'

type Props = {
  people: Person[]
  dynasties: Map<string, DynastyStyle>
  selectedId: string | null
  focusId: string | null
  focusSeq: number
  onSelect: (id: string | null) => void
  zoomRef: React.MutableRefObject<{
    zoomIn: () => void
    zoomOut: () => void
    reset: () => void
  } | null>
}

const NODE_W = 118
const NODE_H = 44

function linkPath(
  s: { x: number; y: number },
  t: { x: number; y: number },
): string {
  const mid = (s.y + t.y) / 2
  return `M${s.x},${s.y}C${s.x},${mid} ${t.x},${mid} ${t.x},${t.y}`
}

export function TreeCanvas({
  people,
  dynasties,
  selectedId,
  focusId,
  focusSeq,
  onSelect,
  zoomRef,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomBehavior = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const transformRef = useRef<ZoomTransform>(zoomIdentity)

  const laid = useMemo(() => layoutTree(people), [people])

  useEffect(() => {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return

    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 2.8])
      .on('zoom', (event) => {
        transformRef.current = event.transform
        select(g).attr('transform', event.transform.toString())
      })

    zoomBehavior.current = z
    const sel = select(svg)
    sel.call(z)

    zoomRef.current = {
      zoomIn: () => sel.transition().duration(280).call(z.scaleBy, 1.35),
      zoomOut: () => sel.transition().duration(280).call(z.scaleBy, 1 / 1.35),
      reset: () => fit(),
    }

    function fit(targetId?: string | null) {
      const el = svgRef.current
      if (!el || !zoomBehavior.current) return
      const { width: tw, height: th } = laid
      const vw = el.clientWidth || 800
      const vh = el.clientHeight || 600
      const scale = Math.min(1.15, Math.max(0.28, Math.min((vw - 40) / tw, (vh - 40) / th) * 0.92))

      let tx = (vw - tw * scale) / 2
      let ty = (vh - th * scale) / 2 + 10

      if (targetId) {
        const node = laid.nodes.find((n) => n.data.id === targetId)
        if (node) {
          const focusScale = Math.min(1.4, Math.max(scale, 0.85))
          tx = vw / 2 - node.x * focusScale
          ty = vh / 2 - node.y * focusScale
          select(el)
            .transition()
            .duration(500)
            .call(
              zoomBehavior.current.transform,
              zoomIdentity.translate(tx, ty).scale(focusScale),
            )
          return
        }
      }

      select(el)
        .transition()
        .duration(450)
        .call(zoomBehavior.current.transform, zoomIdentity.translate(tx, ty).scale(scale))
    }

    fit()

    return () => {
      sel.on('.zoom', null)
      zoomRef.current = null
    }
    // Refit when the kingdom/people set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laid, zoomRef])

  useEffect(() => {
    if (!focusId || !svgRef.current || !zoomBehavior.current) return
    const node = laid.nodes.find((n) => n.data.id === focusId)
    if (!node) return
    const el = svgRef.current
    const vw = el.clientWidth || 800
    const vh = el.clientHeight || 600
    const scale = Math.min(1.5, Math.max(transformRef.current.k, 0.9))
    const tx = vw / 2 - node.x * scale
    const ty = vh / 2 - node.y * scale
    select(el)
      .transition()
      .duration(550)
      .call(zoomBehavior.current.transform, zoomIdentity.translate(tx, ty).scale(scale))
  }, [focusId, focusSeq, laid])

  return (
    <svg
      ref={svgRef}
      className="tree-canvas"
      role="img"
      aria-label="Zoomable royal family tree"
      onClick={() => onSelect(null)}
    >
      <defs>
        <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2" />
        </filter>
      </defs>
      <g ref={gRef}>
        {laid.links.map((l) => (
          <path
            key={`${l.source.data.id}-${l.target.data.id}`}
            className="tree-link"
            d={linkPath(
              { x: l.source.x, y: l.source.y },
              { x: l.target.x, y: l.target.y },
            )}
          />
        ))}
        {laid.nodes.map((n) => {
          const person = n.data.person!
          const color = dynasties.get(person.dynasty)?.color ?? '#8e2b25'
          const isSelected = selectedId === person.id
          const isLink = person.reigning === false
          const dimmed = selectedId != null && !isSelected
          const reign = reignLabel(person)
          return (
            <g
              key={person.id}
              className={`tree-node${isSelected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}${isLink ? ' is-link' : ''}`}
              transform={`translate(${n.x},${n.y})`}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(person.id)
              }}
            >
              <rect
                className={`tree-node__plate${isLink ? ' is-link-fill' : ''}`}
                x={-NODE_W / 2}
                y={-NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={2}
                ry={2}
                stroke={color}
              />
              <circle className="tree-node__dot" cx={-NODE_W / 2 + 10} cy={0} r={4.5} fill={color} />
              <text className="tree-node__name" y={reign ? -4 : 4}>
                {person.shortName}
              </text>
              {reign && (
                <text className="tree-node__reign" y={12}>
                  {reign}
                </text>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
