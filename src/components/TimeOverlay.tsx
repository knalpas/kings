import { CURRENT_YEAR, PX_PER_YEAR, bandAt, type Layout } from '../lib/layout'
import { useViewport, type Viewport } from '../lib/viewport'

export const RULER_W = 64

const STEPS = [5, 10, 25, 50, 100, 200]

export function TimeOverlay({
  layout,
  viewport,
  houseFocus,
  onHouseFocus,
}: {
  layout: Layout
  viewport: Viewport
  houseFocus: string | null
  onHouseFocus: (id: string | null) => void
}) {
  const { transform: t, height } = useViewport(viewport)
  if (!height) return null

  const pxPerYear = PX_PER_YEAR * t.k
  const step = STEPS.find((s) => s * pxPerYear >= 46) ?? 200
  const top = layout.yToYear(-t.y / t.k)
  const bottom = layout.yToYear((height - t.y) / t.k)
  const ticks: number[] = []
  for (let yr = Math.ceil(top / step) * step; yr <= bottom; yr += step) ticks.push(yr)

  const midYear = layout.yToYear((height * 0.4 - t.y) / t.k)
  const titleVisible = t.applyY(150) > 0
  const current = !titleVisible && midYear <= layout.maxYear ? bandAt(layout, midYear) : undefined

  return (
    <>
      <div className="ruler" style={{ width: RULER_W }} aria-hidden="true">
        {layout.bands.map((b) => (
          <div
            key={`${b.label}-${b.start}`}
            className={`ruler__band${b.kind === 'gap' ? ' ruler__band--gap' : ''}`}
            style={{
              top: t.applyY(b.y0),
              height: Math.max(1, (b.y1 - b.y0) * t.k),
              background: b.kind === 'gap' ? undefined : b.color,
              opacity: houseFocus && b.houseId !== houseFocus ? 0.25 : 1,
            }}
          />
        ))}
        {ticks.map((yr) => (
          <div
            key={yr}
            className={`ruler__tick${yr % 100 === 0 ? ' ruler__tick--century' : ''}`}
            style={{ top: t.applyY(layout.yearToY(yr)) }}
          >
            <span>{yr}</span>
          </div>
        ))}
      </div>
      {current && (
        <button
          type="button"
          className={`era${houseFocus === current.houseId ? ' is-active' : ''}`}
          style={{ left: RULER_W + 16, ['--house' as string]: current.color }}
          onClick={() => current.houseId && onHouseFocus(houseFocus === current.houseId ? null : current.houseId)}
          disabled={current.kind === 'gap'}
          title={current.kind === 'gap' ? undefined : 'Highlight this house'}
        >
          <span className="era__year">{Math.round(midYear)}</span>
          <span className="era__swatch" />
          <span className="era__label">{current.label}</span>
          <span className="era__span">
            {current.start}–{current.end >= CURRENT_YEAR ? 'present' : current.end}
          </span>
        </button>
      )}
    </>
  )
}
