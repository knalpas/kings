import { useMemo, useRef, useState } from 'react'
import type { Kingdom } from './types'
import { dynastiesFor, dynastyMap, kingdomMeta, peopleFor } from './data'
import { KingdomToggle, SearchBox } from './components/HeaderControls'
import { TreeCanvas } from './components/TreeCanvas'
import { DetailPanel } from './components/DetailPanel'

export default function App() {
  const [kingdom, setKingdom] = useState<Kingdom>('england')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [focusSeq, setFocusSeq] = useState(0)
  const zoomRef = useRef<{
    zoomIn: () => void
    zoomOut: () => void
    reset: () => void
  } | null>(null)

  const people = useMemo(() => peopleFor(kingdom), [kingdom])
  const dynasties = useMemo(() => dynastyMap(kingdom), [kingdom])
  const dynastyList = useMemo(() => dynastiesFor(kingdom), [kingdom])
  const selected = people.find((p) => p.id === selectedId) ?? null
  const meta = kingdomMeta[kingdom]

  function switchKingdom(k: Kingdom) {
    setKingdom(k)
    setSelectedId(null)
    setFocusId(null)
  }

  function pick(id: string) {
    setSelectedId(id)
    setFocusId(id)
    setFocusSeq((n) => n + 1)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand__name">Sceptre</div>
          <div className="brand__tag">Trees of the French &amp; English crowns</div>
        </div>
        <div className="header__controls">
          <KingdomToggle kingdom={kingdom} onChange={switchKingdom} />
          <SearchBox kingdom={kingdom} onPick={pick} />
        </div>
      </header>

      <main className="stage">
        <TreeCanvas
          key={kingdom}
          people={people}
          dynasties={dynasties}
          selectedId={selectedId}
          focusId={focusId}
          focusSeq={focusSeq}
          onSelect={setSelectedId}
          zoomRef={zoomRef}
        />

        <div className="zoom-controls" aria-label="Zoom">
          <button type="button" onClick={() => zoomRef.current?.zoomIn()} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomRef.current?.zoomOut()} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={() => zoomRef.current?.reset()} aria-label="Reset view" title="Fit tree">
            ⌂
          </button>
        </div>

        <div className="hint">Drag to pan · scroll to zoom · tap a portrait</div>

        <aside className="legend" aria-label="Dynasties">
          <div className="legend__title">{meta.label} · houses</div>
          <ul className="legend__list">
            {dynastyList.map((d) => (
              <li key={d.id}>
                <span className="legend__swatch" style={{ background: d.bandFill }} />
                {d.label}
              </li>
            ))}
          </ul>
        </aside>

        {selected && (
          <DetailPanel
            person={selected}
            dynasty={dynasties.get(selected.dynasty)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </main>
    </div>
  )
}
