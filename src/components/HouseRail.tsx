import { useMemo, useRef } from 'react'
import type { House } from '../types'
import type { Layout } from '../lib/layout'
import { useViewport, type Viewport } from '../lib/viewport'
import { CURRENT_YEAR } from '../lib/layout'

type Props = {
  layout: Layout
  houses: House[]
  viewport: Viewport
  houseFocus: string | null
  onHouseFocus: (id: string | null) => void
  onScrollToYear: (year: number, animate?: boolean) => void
}

export function HouseRail({ layout, houses, viewport, houseFocus, onHouseFocus, onScrollToYear }: Props) {
  const entries = useMemo(() => {
    const byHouse = new Map<string, { start: number; end: number; monarchs: number }>()
    for (const p of layout.chain) {
      const [start, end] = p.reign!
      const e = byHouse.get(p.house)
      if (e) {
        e.end = Math.max(e.end, end ?? CURRENT_YEAR)
        e.monarchs++
      } else byHouse.set(p.house, { start, end: end ?? CURRENT_YEAR, monarchs: 1 })
    }
    return houses
      .filter((h) => byHouse.has(h.id))
      .map((h) => ({ house: h, ...byHouse.get(h.id)! }))
      .sort((a, b) => a.start - b.start)
  }, [layout, houses])

  return (
    <nav className="rail" aria-label="Royal houses">
      <MiniMap layout={layout} viewport={viewport} houseFocus={houseFocus} onScrollToYear={onScrollToYear} />
      <div className="rail__list">
        <div className="rail__heading">
          <span>Royal houses</span>
          {houseFocus && (
            <button type="button" className="rail__clear" onClick={() => onHouseFocus(null)}>
              Show all
            </button>
          )}
        </div>
        <ol>
          {entries.map(({ house, start, end, monarchs }) => {
            const active = houseFocus === house.id
            return (
              <li key={house.id}>
                <button
                  type="button"
                  className={`house${active ? ' is-active' : ''}${houseFocus && !active ? ' is-muted' : ''}`}
                  style={{ ['--house' as string]: house.color }}
                  aria-pressed={active}
                  onClick={() => {
                    onHouseFocus(active ? null : house.id)
                    if (!active) onScrollToYear(start + Math.min(25, (end - start) / 2))
                  }}
                >
                  <span className="house__swatch" />
                  <span className="house__body">
                    <span className="house__name">{house.label.replace(/^House of /, '')}</span>
                    <span className="house__meta">
                      {start}–{end >= CURRENT_YEAR ? 'present' : end} · {monarchs} {monarchs === 1 ? 'ruler' : 'rulers'}
                    </span>
                    {active && <span className="house__note">{house.note}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}

function MiniMap({
  layout,
  viewport,
  houseFocus,
  onScrollToYear,
}: {
  layout: Layout
  viewport: Viewport
  houseFocus: string | null
  onScrollToYear: (year: number, animate?: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { transform: t, height } = useViewport(viewport)
  const span = layout.maxYear - layout.minYear
  const pct = (yr: number) => ((yr - layout.minYear) / span) * 100
  const topYear = layout.yToYear(-t.y / t.k)
  const bottomYear = layout.yToYear((height - t.y) / t.k)
  const winTop = Math.max(0, pct(topYear))
  const winBottom = Math.min(100, pct(bottomYear))

  const yearFromEvent = (clientY: number) => {
    const r = ref.current!.getBoundingClientRect()
    return layout.minYear + ((clientY - r.top) / r.height) * span
  }

  const centuries: number[] = []
  for (let yr = Math.ceil(layout.minYear / 100) * 100; yr < layout.maxYear; yr += 100) centuries.push(yr)

  return (
    <div
      ref={ref}
      className="minimap"
      role="slider"
      aria-label="Scroll through time"
      aria-valuemin={layout.minYear}
      aria-valuemax={layout.maxYear}
      aria-valuenow={Math.round((topYear + bottomYear) / 2)}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onScrollToYear(yearFromEvent(e.clientY), false)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) onScrollToYear(yearFromEvent(e.clientY), false)
      }}
      onKeyDown={(e) => {
        const mid = (topYear + bottomYear) / 2
        if (e.key === 'ArrowDown') onScrollToYear(mid + 25)
        if (e.key === 'ArrowUp') onScrollToYear(mid - 25)
      }}
    >
      <div className="minimap__track">
        {layout.bands.map((b) => (
          <div
            key={`${b.label}-${b.start}`}
            className={`minimap__band${b.kind === 'gap' ? ' minimap__band--gap' : ''}`}
            style={{
              top: `${pct(b.start)}%`,
              height: `${Math.max(0.25, pct(b.end) - pct(b.start))}%`,
              background: b.kind === 'gap' ? undefined : b.color,
              opacity: houseFocus && b.houseId !== houseFocus ? 0.25 : 1,
            }}
          />
        ))}
      </div>
      {centuries.map((yr) => (
        <div key={yr} className="minimap__century" style={{ top: `${pct(yr)}%` }}>
          {yr}
        </div>
      ))}
      {height > 0 && winBottom > winTop && (
        <div className="minimap__window" style={{ top: `${winTop}%`, height: `${winBottom - winTop}%` }} />
      )}
    </div>
  )
}
