import { useEffect, useMemo, useRef } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import type { DynastyStyle, Person } from '../types'
import { genealogyLinkPath, LABEL_BLOCK, layoutTree, NODE_RX, NODE_RY, reignLabel } from '../lib/tree'
import { successionChain } from '../lib/succession'
import { portraitSrc } from '../data/portraits'

type Props = {
  people: Person[]
  dynasties: Map<string, DynastyStyle>
  chartTitle: string
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
  chartTitle,
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
  const succession = useMemo(() => successionChain(people), [people])
  const order = useMemo(() => {
    const map = new Map<string, number>()
    succession.forEach((person, index) => map.set(person.id, index + 1))
    return map
  }, [succession])

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
      const vw = el.clientWidth || 800
      // Open on a readable passage of the plate, not a postage-stamp of the whole chart.
      const scale = vw < 720 ? 0.62 : 0.78
      const tx = 28
      const ty = 18
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

  const clipRx = NODE_RX - 2.2
  const clipRy = NODE_RY - 2.2

  return (
    <svg
      ref={svgRef}
      className="tree-canvas"
      role="img"
      aria-label={`Zoomable genealogy of the ${chartTitle}`}
      onClick={() => onSelect(null)}
    >
      <defs>
        {laid.nodes.map((n) => (
          <clipPath key={`clip-${n.data.id}`} id={`clip-${n.data.id}`}>
            <ellipse rx={clipRx} ry={clipRy} />
          </clipPath>
        ))}
      </defs>

      <g ref={gRef}>
        <rect className="plate" x={0} y={0} width={laid.width} height={laid.height} />
        <rect className="plate-frame" x={18} y={16} width={laid.width - 36} height={laid.height - 32} />
        <rect className="plate-frame plate-frame--inner" x={23} y={21} width={laid.width - 46} height={laid.height - 42} />

        <text className="chart-kicker" x={48} y={48}>
          A genealogical chart
        </text>
        <text className="chart-title" x={48} y={82}>
          {chartTitle}
        </text>
        <text className="chart-note" x={48} y={106}>
          Fine lines show descent. Carmine numerals show the order of accession.
        </text>
        <text className="chart-note" x={48} y={laid.height - 36}>
          Sceptre · genealogies of the French and English crowns
        </text>

        {laid.links.map((l) => (
          <path
            key={`gen-${l.source.data.id}-${l.target.data.id}`}
            className="tree-link"
            d={genealogyLinkPath({ x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y })}
          />
        ))}

        {laid.nodes.map((n) => {
          const person = n.data.person!
          const house = dynasties.get(person.dynasty)
          const ink = house?.color ?? '#3a3128'
          const isSelected = selectedId === person.id
          const isLink = person.reigning === false
          const dimmed = selectedId != null && !isSelected
          const reign = reignLabel(person)
          const src = portraitSrc(person.id)
          const numeral = order.get(person.id)

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
              <ellipse
                className="tree-node__ring"
                rx={NODE_RX}
                ry={NODE_RY}
                fill="#f7f3ea"
                stroke={isSelected ? '#8c2f2a' : ink}
                strokeWidth={isSelected ? 2.1 : 1.15}
                strokeDasharray={isLink ? '2.2 1.8' : undefined}
              />
              <ellipse
                className="tree-node__ring-inner"
                rx={NODE_RX - 3.2}
                ry={NODE_RY - 3.2}
                fill="none"
                stroke={ink}
                strokeWidth={0.45}
                strokeOpacity={0.7}
              />

              {src ? (
                <image
                  href={src}
                  x={-clipRx}
                  y={-clipRy}
                  width={clipRx * 2}
                  height={clipRy * 2}
                  clipPath={`url(#clip-${person.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text className="tree-node__silhouette" textAnchor="middle" dy="0.35em">
                  {initials(person.shortName)}
                </text>
              )}

              {numeral != null && (
                <g className="tree-node__badge" transform={`translate(${NODE_RX - 2},${-NODE_RY + 5})`}>
                  <circle r={8} fill="#f7f3ea" stroke="#8c2f2a" strokeWidth={0.7} />
                  <text textAnchor="middle" dy="0.35em">
                    {numeral}
                  </text>
                </g>
              )}

              <text className="tree-node__name" y={NODE_RY + 15}>
                {person.shortName}
              </text>
              {reign ? (
                <text className="tree-node__reign" y={NODE_RY + 28}>
                  {reign}
                </text>
              ) : (
                <text className="tree-node__reign" y={NODE_RY + LABEL_BLOCK - 8}>
                  {isLink ? 'ancestor' : ''}
                </text>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
