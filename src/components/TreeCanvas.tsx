import { useEffect, useMemo, useRef } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import type { DynastyStyle, Person } from '../types'
import {
  computeDynastyBands,
  genealogyLinkPath,
  layoutTree,
  NODE_R,
  reignLabel,
  successionLinkPath,
} from '../lib/tree'
import { successionChain } from '../lib/succession'
import { portraitSrc } from '../data/portraits'

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

function initials(name: string): string {
  const parts = name.replace(/,/g, '').split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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
  const bands = useMemo(
    () => computeDynastyBands(laid.nodes, dynasties, laid.width),
    [laid, dynasties],
  )
  const succession = useMemo(() => successionChain(people), [people])

  const posById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    for (const n of laid.nodes) m.set(n.data.id, { x: n.x, y: n.y })
    return m
  }, [laid])

  useEffect(() => {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return

    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 2.8])
      .on('zoom', (event) => {
        transformRef.current = event.transform
        select(g).attr('transform', event.transform.toString())
      })

    zoomBehavior.current = z
    const sel = select(svg)
    sel.call(z)

    function fit() {
      const el = svgRef.current
      if (!el || !zoomBehavior.current) return
      const { width: tw, height: th } = laid
      const vw = el.clientWidth || 800
      const vh = el.clientHeight || 600
      const scale = Math.min(1, Math.max(0.1, Math.min((vw - 24) / tw, (vh - 24) / th) * 0.96))
      const tx = (vw - tw * scale) / 2
      const ty = 8
      select(el)
        .transition()
        .duration(500)
        .call(zoomBehavior.current.transform, zoomIdentity.translate(tx, ty).scale(scale))
    }

    zoomRef.current = {
      zoomIn: () => sel.transition().duration(280).call(z.scaleBy, 1.28),
      zoomOut: () => sel.transition().duration(280).call(z.scaleBy, 1 / 1.28),
      reset: () => fit(),
    }

    fit()

    return () => {
      sel.on('.zoom', null)
      zoomRef.current = null
    }
  }, [laid, zoomRef])

  useEffect(() => {
    if (!focusId || !svgRef.current || !zoomBehavior.current) return
    const node = laid.nodes.find((n) => n.data.id === focusId)
    if (!node) return
    const el = svgRef.current
    const vw = el.clientWidth || 800
    const vh = el.clientHeight || 600
    const scale = Math.min(1.6, Math.max(transformRef.current.k, 0.95))
    const tx = vw / 2 - node.x * scale
    const ty = vh / 2 - node.y * scale
    select(el)
      .transition()
      .duration(560)
      .call(zoomBehavior.current.transform, zoomIdentity.translate(tx, ty).scale(scale))
  }, [focusId, focusSeq, laid])

  const innerR = NODE_R - 2

  return (
    <svg
      ref={svgRef}
      className="tree-canvas"
      role="img"
      aria-label="Zoomable royal family tree"
      onClick={() => onSelect(null)}
    >
      <defs>
        <marker
          id="succ-arrow"
          markerWidth="9"
          markerHeight="9"
          refX="8"
          refY="4.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L9,4.5 L0,9 z" fill="#d4213d" />
        </marker>
        {laid.nodes.map((n) => (
          <clipPath key={`clip-${n.data.id}`} id={`clip-${n.data.id}`}>
            <circle r={innerR - 1} />
          </clipPath>
        ))}
      </defs>

      <g ref={gRef}>
        {/* Dynasty colour bands */}
        {bands.map((b) => (
          <g key={b.dynastyId} className="dynasty-band">
            <rect
              className="dynasty-band__fill"
              x={0}
              y={b.y0}
              width={laid.width}
              height={b.y1 - b.y0}
              fill={b.fill}
            />
            <text className="dynasty-band__label" x={14} y={b.y0 + 22}>
              {b.label}
            </text>
          </g>
        ))}

        {/* Black genealogical lines */}
        {laid.links.map((l) => (
          <path
            key={`gen-${l.source.data.id}-${l.target.data.id}`}
            className="tree-link tree-link--genealogy"
            d={genealogyLinkPath(
              { x: l.source.x, y: l.source.y },
              { x: l.target.x, y: l.target.y },
            )}
          />
        ))}

        {/* Red succession path */}
        {succession.slice(0, -1).map((monarch, i) => {
          const next = succession[i + 1]
          const a = posById.get(monarch.id)
          const b = posById.get(next.id)
          if (!a || !b) return null
          const dimmed =
            selectedId != null && selectedId !== monarch.id && selectedId !== next.id
          return (
            <path
              key={`succ-${monarch.id}-${next.id}`}
              className={`tree-link tree-link--succession${dimmed ? ' is-dimmed' : ''}`}
              d={successionLinkPath(a, b)}
              markerEnd="url(#succ-arrow)"
            />
          )
        })}

        {/* Portrait nodes */}
        {laid.nodes.map((n) => {
          const person = n.data.person!
          const house = dynasties.get(person.dynasty)
          const ring = house?.color ?? '#333'
          const isSelected = selectedId === person.id
          const isLink = person.reigning === false
          const dimmed = selectedId != null && !isSelected
          const reign = reignLabel(person)
          const src = portraitSrc(person.id)

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
              <circle
                className="tree-node__ring"
                r={NODE_R}
                fill="#fff"
                stroke={ring}
                strokeWidth={isSelected ? 3 : 2}
                strokeDasharray={isLink ? '3 2' : undefined}
              />

              {src ? (
                <image
                  href={src}
                  x={-(innerR - 1)}
                  y={-(innerR - 1)}
                  width={(innerR - 1) * 2}
                  height={(innerR - 1) * 2}
                  clipPath={`url(#clip-${person.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <g>
                  <circle r={innerR - 1} fill="#e8e0d4" />
                  <text className="tree-node__silhouette" textAnchor="middle" dy="0.35em">
                    {initials(person.shortName)}
                  </text>
                </g>
              )}

              <text className="tree-node__name" y={NODE_R + 14}>
                {person.shortName}
              </text>
              {reign && (
                <text className="tree-node__reign" y={NODE_R + 26}>
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
