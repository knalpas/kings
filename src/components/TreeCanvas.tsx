import { useEffect, useMemo, useRef } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import type { DynastyStyle, Person } from '../types'
import { layoutTree, linkPath, NODE_R, reignLabel } from '../lib/tree'
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

  useEffect(() => {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return

    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.18, 2.6])
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
      const scale = Math.min(1.05, Math.max(0.22, Math.min((vw - 48) / tw, (vh - 48) / th) * 0.9))
      const tx = (vw - tw * scale) / 2
      const ty = (vh - th * scale) / 2 + 8
      select(el)
        .transition()
        .duration(500)
        .call(zoomBehavior.current.transform, zoomIdentity.translate(tx, ty).scale(scale))
    }

    zoomRef.current = {
      zoomIn: () => sel.transition().duration(280).call(z.scaleBy, 1.3),
      zoomOut: () => sel.transition().duration(280).call(z.scaleBy, 1 / 1.3),
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
    const scale = Math.min(1.45, Math.max(transformRef.current.k, 0.85))
    const tx = vw / 2 - node.x * scale
    const ty = vh / 2 - node.y * scale
    select(el)
      .transition()
      .duration(560)
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
        <filter id="medallionGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.45" />
        </filter>
        <filter id="linkSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {laid.nodes.map((n) => {
          const id = n.data.id
          return (
            <clipPath key={`clip-${id}`} id={`clip-${id}`}>
              <circle r={NODE_R - 5} />
            </clipPath>
          )
        })}
        <radialGradient id="salonGlow" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#5a2a24" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#2a1814" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#120c0a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100%" height="100%" fill="url(#salonGlow)" pointerEvents="none" />

      <g ref={gRef}>
        {laid.links.map((l) => {
          const child = l.target.data.person!
          const color = dynasties.get(child.dynasty)?.color ?? '#c9a256'
          const dimmed = selectedId != null && selectedId !== child.id && selectedId !== l.source.data.id
          return (
            <path
              key={`${l.source.data.id}-${l.target.data.id}`}
              className={`tree-link${dimmed ? ' is-dimmed' : ''}`}
              d={linkPath(
                { x: l.source.x, y: l.source.y },
                { x: l.target.x, y: l.target.y },
              )}
              stroke={color}
            />
          )
        })}

        {laid.nodes.map((n) => {
          const person = n.data.person!
          const color = dynasties.get(person.dynasty)?.color ?? '#c9a256'
          const isSelected = selectedId === person.id
          const isLink = person.reigning === false
          const dimmed = selectedId != null && !isSelected
          const reign = reignLabel(person)
          const src = portraitSrc(person.id)
          const r = isLink ? NODE_R - 4 : NODE_R

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
              {/* House-colored outer ring / gilt rim */}
              <circle className="tree-node__halo" r={r + 7} fill={color} opacity={isSelected ? 0.55 : 0.22} />
              <circle
                className="tree-node__ring"
                r={r + 2}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? 4.5 : 3.2}
                strokeDasharray={isLink ? '5 4' : undefined}
                filter="url(#medallionGlow)"
              />
              <circle className="tree-node__rim" r={r} fill="#1a120e" stroke="#e6c878" strokeWidth={1.4} />

              {src ? (
                <image
                  href={src}
                  x={-(r - 5)}
                  y={-(r - 5)}
                  width={(r - 5) * 2}
                  height={(r - 5) * 2}
                  clipPath={`url(#clip-${person.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <g>
                  <circle r={r - 5} fill="#2c2118" />
                  <text className="tree-node__mono" textAnchor="middle" dy="0.35em">
                    {initials(person.shortName)}
                  </text>
                </g>
              )}

              {/* Soft vignette over portrait */}
              <circle
                r={r - 5}
                fill="url(#portraitVignette)"
                style={{ pointerEvents: 'none' }}
                opacity={0.35}
              />

              <text className="tree-node__name" y={r + 16}>
                {person.shortName}
              </text>
              {(reign || isLink) && (
                <text className="tree-node__reign" y={r + 30}>
                  {reign || '—'}
                </text>
              )}
            </g>
          )
        })}
      </g>

      <defs>
        <radialGradient id="portraitVignette" cx="50%" cy="40%" r="60%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>
    </svg>
  )
}
