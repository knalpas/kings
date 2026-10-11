import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import 'd3-transition'
import type { House, Kingdom } from '../types'
import type { ChartNode, Layout } from '../lib/layout'
import { useViewport, type Viewport } from '../lib/viewport'
import { reignText, lifeText } from '../lib/genealogy'
import { useLocale } from '../i18n/locale'
import { initials, portraitSrc } from '../data/portraits'
import { TimeOverlay, RULER_W } from './TimeOverlay'

export type ChartApi = {
  zoomBy: (factor: number) => void
  fit: () => void
  focus: (id: string) => void
  scrollToYear: (year: number, animate?: boolean) => void
  reveal: (id: string) => void
}

type Props = {
  kingdom: Kingdom
  layout: Layout
  houses: Map<string, House>
  title: string
  subtitle: string
  selectedId: string | null
  houseFocus: string | null
  showSuccession: boolean
  rightInset: number
  bottomInset: number
  viewport: Viewport
  onSelect: (id: string | null) => void
  onHouseFocus: (id: string | null) => void
  apiRef: Ref<ChartApi>
}

const MIN_K = 0.18
const MAX_K = 2.4

export function Chart({
  kingdom,
  layout,
  houses,
  title,
  subtitle,
  selectedId,
  houseFocus,
  showSuccession,
  rightInset,
  bottomInset,
  viewport,
  onSelect,
  onHouseFocus,
  apiRef,
}: Props) {
  const { t } = useLocale()
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const insetRef = useRef(rightInset)
  const bottomRef = useRef(bottomInset)
  useEffect(() => {
    insetRef.current = rightInset
    bottomRef.current = bottomInset
  }, [rightInset, bottomInset])
  const [hover, setHover] = useState<string | null>(null)

  const firstMonarch = layout.byId.get(layout.chain[0]?.id ?? '')

  const animateTo = useCallback((k: number, x: number, y: number, duration = 650) => {
    const svg = svgRef.current
    const z = zoomRef.current
    if (!svg || !z) return
    const vw = svg.clientWidth - insetRef.current
    const vh = svg.clientHeight - bottomRef.current
    const t = zoomIdentity.translate(RULER_W + (vw - RULER_W) / 2 - x * k, vh / 2 - y * k).scale(k)
    select(svg).transition().duration(duration).call(z.transform, t)
  }, [])

  const fit = useCallback(
    (duration = 650) => {
      const svg = svgRef.current
      const z = zoomRef.current
      if (!svg || !z) return
      const vw = svg.clientWidth - insetRef.current
      const avail = vw - RULER_W - 24
      const k = Math.max(0.8, Math.min(0.95, avail / layout.width))
      const contentW = layout.width * k
      const anchorX = firstMonarch?.x ?? layout.width / 2
      const tx = contentW <= avail ? RULER_W + 12 + (avail - contentW) / 2 : RULER_W + avail / 2 - anchorX * k
      const t = zoomIdentity.translate(tx, 8).scale(k)
      if (duration === 0) select(svg).call(z.transform, t)
      else select(svg).transition().duration(duration).call(z.transform, t)
    },
    [layout.width, firstMonarch?.x],
  )

  useImperativeHandle(
    apiRef,
    () => ({
      zoomBy: (factor) => {
        const svg = svgRef.current
        const z = zoomRef.current
        if (svg && z) select(svg).transition().duration(260).call(z.scaleBy, factor)
      },
      fit: () => fit(),
      focus: (id) => {
        const n = layout.byId.get(id)
        if (!n) return
        const k = Math.max(viewport.get().transform.k, 0.95)
        animateTo(k, n.x, n.y + 20)
      },
      scrollToYear: (year, animate = true) => {
        const svg = svgRef.current
        const z = zoomRef.current
        if (!svg || !z) return
        const t = viewport.get().transform
        const y = layout.yearToY(year)
        const next = zoomIdentity.translate(t.x, svg.clientHeight / 2 - y * t.k).scale(t.k)
        if (animate) select(svg).transition().duration(450).call(z.transform, next)
        else select(svg).interrupt().call(z.transform, next)
      },
      reveal: (id) => {
        const svg = svgRef.current
        const n = layout.byId.get(id)
        if (!svg || !n) return
        const t = viewport.get().transform
        const sx = t.applyX(n.x)
        const sy = t.applyY(n.y)
        const right = svg.clientWidth - insetRef.current
        const margin = 90
        const bottom = svg.clientHeight - bottomRef.current
        if (sx < RULER_W + margin || sx > right - margin || sy < margin || sy > bottom - margin) {
          animateTo(t.k, n.x, n.y + 20)
        }
      },
    }),
    [layout, fit, animateTo, viewport],
  )

  useEffect(() => {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return
    const sel = select(svg)
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_K, MAX_K])
      .translateExtent([
        [-600, -300],
        [layout.width + 600, layout.height + 400],
      ])
      .filter((event: Event) => {
        if (event.type === 'wheel') return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey
        if (event.type === 'dblclick') return false
        return !(event as MouseEvent).button
      })
      .on('zoom', (event) => {
        const t = event.transform
        g.setAttribute('transform', t.toString())
        svg.dataset.lod = t.k < 0.45 ? 'far' : t.k < 0.8 ? 'mid' : 'near'
        viewport.set({ transform: t })
      })
    zoomRef.current = z
    sel.call(z)

    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey || ev.metaKey) return
      ev.preventDefault()
      const k = viewport.get().transform.k
      const dx = ev.shiftKey ? ev.deltaY : ev.deltaX
      const dy = ev.shiftKey ? 0 : ev.deltaY
      const scale = ev.deltaMode === 1 ? 32 : 1
      z.translateBy(sel, (-dx * scale) / k, (-dy * scale) / k)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })

    const resize = () => viewport.set({ width: svg.clientWidth, height: svg.clientHeight })
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(svg)

    fit(0)

    return () => {
      svg.removeEventListener('wheel', onWheel)
      ro.disconnect()
      sel.on('.zoom', null)
    }
  }, [layout.width, layout.height, layout.minYear, layout.maxYear, viewport, fit])

  const lineage = useMemo(() => {
    if (!selectedId) return null
    const set = new Set<string>([selectedId])
    const people = new Map(layout.nodes.map((n) => [n.id, n.person]))
    for (let p = people.get(selectedId); p?.parent; p = people.get(p.parent)) set.add(p.parent)
    const stack = [selectedId]
    while (stack.length) {
      const id = stack.pop()!
      for (const n of layout.nodes) if (n.person.parent === id && !set.has(n.id)) {
        set.add(n.id)
        stack.push(n.id)
      }
    }
    return set
  }, [selectedId, layout])

  const hovered = hover ? layout.byId.get(hover) ?? null : null

  return (
    <div className="chart" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="chart__svg"
        data-lod="near"
        role="application"
        aria-label={t.chartAria(title)}
        onClick={() => onSelect(null)}
      >
        <defs>
          <pattern id="gap-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="#efebe3" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#d9d2c4" strokeWidth="3" />
          </pattern>
          <clipPath id="disc" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
          <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#2a2116" floodOpacity="0.18" />
          </filter>
        </defs>
        <g ref={gRef}>
          <Backdrop layout={layout} title={title} subtitle={subtitle} />
          <Links layout={layout} lineage={lineage} houseFocus={houseFocus} />
          {showSuccession && <Succession layout={layout} />}
          <Nodes
            kingdom={kingdom}
            layout={layout}
            houses={houses}
            selectedId={selectedId}
            lineage={lineage}
            houseFocus={houseFocus}
            onSelect={onSelect}
            onHover={setHover}
          />
        </g>
      </svg>
      <TimeOverlay layout={layout} viewport={viewport} houseFocus={houseFocus} onHouseFocus={onHouseFocus} />
      {hovered && hovered.id !== selectedId && (
        <HoverCard kingdom={kingdom} node={hovered} house={houses.get(hovered.person.house)} viewport={viewport} />
      )}
    </div>
  )
}

const Backdrop = memo(function Backdrop({ layout, title, subtitle }: { layout: Layout; title: string; subtitle: string }) {
  const lines: { y: number; major: boolean }[] = []
  for (let yr = Math.ceil(layout.minYear / 50) * 50; yr <= layout.maxYear; yr += 50) {
    lines.push({ y: layout.yearToY(yr), major: yr % 100 === 0 })
  }
  return (
    <g className="backdrop">
      {layout.bands.map((b) => (
        <g key={`${b.label}-${b.start}`}>
          <rect
            x={-600}
            y={b.y0}
            width={layout.width + 1200}
            height={b.y1 - b.y0}
            fill={b.kind === 'gap' ? 'url(#gap-hatch)' : b.color}
            fillOpacity={b.kind === 'gap' ? 0.9 : 0.075}
          />
          <line x1={-600} x2={layout.width + 600} y1={b.y0} y2={b.y0} stroke={b.color} strokeOpacity={0.45} strokeWidth={1} />
        </g>
      ))}
      {lines.map((l) => (
        <line
          key={l.y}
          className={l.major ? 'grid grid--major' : 'grid'}
          x1={-600}
          x2={layout.width + 600}
          y1={l.y}
          y2={l.y}
        />
      ))}
      <text className="plate-title" x={150} y={92}>
        {title}
      </text>
      <text className="plate-subtitle" x={152} y={124}>
        {subtitle}
      </text>
    </g>
  )
})

const Links = memo(function Links({
  layout,
  lineage,
  houseFocus,
}: {
  layout: Layout
  lineage: Set<string> | null
  houseFocus: string | null
}) {
  return (
    <g className="links">
      {layout.links.map((l) => {
        const on = lineage ? lineage.has(l.parent) && lineage.has(l.child) : false
        const child = layout.byId.get(l.child)!
        const dim =
          (lineage && !on) || (houseFocus != null && child.person.house !== houseFocus)
        return (
          <path
            key={l.child}
            d={l.d}
            className={`link${l.distant ? ' link--distant' : ''}${on ? ' is-on' : ''}${dim ? ' is-dim' : ''}`}
          />
        )
      })}
    </g>
  )
})

const Succession = memo(function Succession({ layout }: { layout: Layout }) {
  const parts: string[] = []
  for (let i = 0; i + 1 < layout.chain.length; i++) {
    const a = layout.byId.get(layout.chain[i].id)!
    const b = layout.byId.get(layout.chain[i + 1].id)!
    const my = (a.y + b.y) / 2
    parts.push(`M${a.x},${a.y}C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`)
  }
  return <path className="succession" d={parts.join('')} />
})

type NodesProps = {
  kingdom: Kingdom
  layout: Layout
  houses: Map<string, House>
  selectedId: string | null
  lineage: Set<string> | null
  houseFocus: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}

const Nodes = memo(function Nodes({ kingdom, layout, houses, selectedId, lineage, houseFocus, onSelect, onHover }: NodesProps) {
  return (
    <g className="nodes">
      {layout.nodes.map((n) => (
        <NodeMark
          key={n.id}
          kingdom={kingdom}
          node={n}
          color={houses.get(n.person.house)?.color ?? '#777'}
          selected={n.id === selectedId}
          dim={(lineage != null && !lineage.has(n.id)) || (houseFocus != null && n.person.house !== houseFocus)}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </g>
  )
})

const NodeMark = memo(function NodeMark({
  kingdom,
  node,
  color,
  selected,
  dim,
  onSelect,
  onHover,
}: {
  kingdom: Kingdom
  node: ChartNode
  color: string
  selected: boolean
  dim: boolean
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}) {
  const { person, r, monarch } = node
  const src = portraitSrc(kingdom, person.id)
  const label = person.short ?? person.name
  const { locale } = useLocale()
  const years = monarch ? reignText(person, locale) : lifeText(person, locale)
  const inner = r - (monarch ? 4 : 3)
  return (
    <g
      className={`node${monarch ? ' node--monarch' : ' node--ancestor'}${selected ? ' is-selected' : ''}${dim ? ' is-dim' : ''}`}
      transform={`translate(${node.x},${node.y})`}
      style={{ color }}
      tabIndex={0}
      role="button"
      aria-label={`${person.name}${years ? `, ${years}` : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(person.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(person.id)
        }
      }}
      onPointerEnter={() => onHover(person.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(person.id)}
      onBlur={() => onHover(null)}
    >
      <circle className="node__halo" r={r + 7} />
      <circle className="node__ring" r={r} fill="#fffdf8" stroke={color} strokeWidth={monarch ? 3.5 : 2} />
      {src ? (
        <image
          href={src}
          x={-inner}
          y={-inner}
          width={inner * 2}
          height={inner * 2}
          clipPath="url(#disc)"
          preserveAspectRatio="xMidYMid slice"
          className="node__img"
        />
      ) : (
        <>
          <circle r={inner} fill={color} fillOpacity={0.12} />
          <text className="node__monogram" dy="0.35em" fill={color}>
            {initials(person.name)}
          </text>
        </>
      )}
      {node.ordinal != null && (
        <g className="node__ordinal" transform={`translate(0,${r})`}>
          <rect x={-13} y={-8} width={26} height={16} rx={8} fill={color} />
          <text dy="0.35em">{node.ordinal}</text>
        </g>
      )}
      {person.protector && (
        <g className="node__ordinal" transform={`translate(0,${r})`}>
          <rect x={-17} y={-8} width={34} height={16} rx={8} fill={color} />
          <text dy="0.35em">LP</text>
        </g>
      )}
      <text className="node__name" y={r + (monarch ? 24 : 15)}>
        {label}
      </text>
      <text className="node__years" y={r + (monarch ? 39 : 28)}>
        {years}
      </text>
    </g>
  )
})

function HoverCard({
  kingdom,
  node,
  house,
  viewport,
}: {
  kingdom: Kingdom
  node: ChartNode
  house?: House
  viewport: Viewport
}) {
  const { transform } = useViewport(viewport)
  const { locale, t } = useLocale()
  const x = transform.applyX(node.x)
  const y = transform.applyY(node.y) - node.r * transform.k - 14
  const p = node.person
  const src = portraitSrc(kingdom, p.id)
  return (
    <div className="hovercard" style={{ left: x, top: y }} role="tooltip">
      {src && <img src={src} alt="" />}
      <div>
        <div className="hovercard__name">{p.name}</div>
        <div className="hovercard__meta">
          <span className="dot" style={{ background: house?.color }} />
          {house?.label}
        </div>
        <div className="hovercard__meta">
          {p.reign ? `${t.reigned} ${reignText(p, locale)}` : lifeText(p, locale)}
          {!p.reign && ` · ${t.didNotReign}`}
        </div>
      </div>
    </div>
  )
}
