import { useEffect, useRef } from 'react'
import type { House, Interval, Kingdom, Person } from '../types'
import { initials, portraitSrc } from '../data/portraits'
import { ageLabel, children, kinship, lifeText, reignLength, reignText, relationPhrase, yearText } from '../lib/genealogy'
import { useLocale } from '../i18n/locale'
import { wikiUrl } from '../i18n/localize'

type Props = {
  kingdom: Kingdom
  person: Person
  people: Person[]
  index: Map<string, Person>
  houses: Map<string, House>
  chain: Person[]
  gaps: Interval[]
  houseFocus: string | null
  onSelect: (id: string) => void
  onHouseFocus: (id: string | null) => void
  onClose: () => void
}

export function DetailDrawer({ kingdom, person: p, people, index, houses, chain, gaps, houseFocus, onSelect, onHouseFocus, onClose }: Props) {
  const { locale, t } = useLocale()
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [p.id])

  const house = houses.get(p.house)
  const color = house?.color ?? '#777'
  const src = portraitSrc(kingdom, p.id)
  const pos = chain.findIndex((c) => c.id === p.id)
  const prev = pos > 0 ? chain[pos - 1] : undefined
  const next = pos >= 0 && pos + 1 < chain.length ? chain[pos + 1] : undefined
  const parent = p.parent ? index.get(p.parent) : undefined
  const kids = children(p.id, people)
  const ordinal = pos >= 0 && !p.protector ? chain.slice(0, pos + 1).filter((c) => !c.protector).length : null

  const interregnum =
    prev && p.reign && prev.reign?.[1] != null
      ? gaps.find((g) => g.start >= prev.reign![1]! - 1 && g.end <= p.reign![0] + 1)
      : undefined

  const relation = (other: Person) => relationPhrase(p, kinship(p.id, other.id, index, locale), locale, t.noRelation)

  const acceededAge = p.reign ? ageLabel(p, p.reign[0], locale) : ''
  const diedAge = p.died != null ? ageLabel(p, p.died, locale) : ''

  return (
    <aside className="drawer" style={{ ['--house' as string]: color }} aria-label={t.about(p.name)}>
      <div className="drawer__bar">
        <div className="drawer__nav">
          <button type="button" className="icon-btn" disabled={!prev} onClick={() => prev && onSelect(prev.id)} aria-label={t.previousMonarch} title={`${t.previousMonarch} (←)`}>
            <Chevron dir="left" />
          </button>
          <button type="button" className="icon-btn" disabled={!next} onClick={() => next && onSelect(next.id)} aria-label={t.nextMonarch} title={`${t.nextMonarch} (→)`}>
            <Chevron dir="right" />
          </button>
          {ordinal != null && <span className="drawer__count">{t.monarchOf(ordinal, chain.filter((c) => !c.protector).length)}</span>}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close} title={`${t.close} (Esc)`}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="drawer__scroll" ref={scrollRef}>
        <header className="drawer__head">
          <div className="drawer__portrait">
            {src ? <img src={src} alt={t.portraitOf(p.name)} /> : <span className="drawer__monogram">{initials(p.name)}</span>}
          </div>
          <div className="drawer__headtext">
            <button
              type="button"
              className={`house-chip${houseFocus === p.house ? ' is-active' : ''}`}
              onClick={() => onHouseFocus(houseFocus === p.house ? null : p.house)}
              title={t.highlightHouse}
            >
              <span className="house-chip__swatch" />
              {house?.label}
            </button>
            <h2 className="drawer__name">{p.name}</h2>
            {p.epithet && !p.name.includes(p.epithet) && <div className="drawer__epithet">“{p.epithet}”</div>}
            <div className="drawer__title">{p.title}</div>
          </div>
        </header>

        <dl className="facts">
          {p.reign ? (
            <>
              <div className="fact fact--wide">
                <dt>{p.protector ? t.lordProtector : t.reigned}</dt>
                <dd>
                  {reignText(p, locale)}
                  <small>{reignLength(p, locale)}</small>
                </dd>
              </div>
              <div className="fact">
                <dt>{t.ageAtAccession}</dt>
                <dd>{acceededAge || '—'}</dd>
              </div>
            </>
          ) : (
            <div className="fact fact--wide">
              <dt>{t.status}</dt>
              <dd className="fact__muted">{t.didNotReignStatus}</dd>
            </div>
          )}
          <div className="fact">
            <dt>{t.born}</dt>
            <dd>{yearText(p.born, p.bornCirca, locale)}</dd>
          </div>
          <div className="fact">
            <dt>{t.died}</dt>
            <dd>
              {p.died ?? (p.born != null ? t.living : '—')}
              {diedAge && <small>{t.aged(diedAge)}</small>}
            </dd>
          </div>
        </dl>

        {p.reign && (prev || next) && (
          <section className="section">
            <h3>{t.succession}</h3>
            {p.accession && <p className="accession">{p.accession}</p>}
            {interregnum && <p className="interregnum">{t.interregnum(interregnum.label, interregnum.start, interregnum.end)}</p>}
            <div className="succ">
              {prev && <PersonCard kingdom={kingdom} label={t.precededBy} person={prev} relation={relation(prev)} color={houses.get(prev.house)?.color} onSelect={onSelect} />}
              {next && <PersonCard kingdom={kingdom} label={t.succeededBy} person={next} relation={relation(next)} color={houses.get(next.house)?.color} onSelect={onSelect} />}
            </div>
          </section>
        )}

        <section className="section">
          <h3>{p.reign ? t.theReign : t.life}</h3>
          <p className="summary">{p.summary}</p>
          {p.events && p.events.length > 0 && (
            <ul className="events">
              {p.events.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="section">
          <h3>{t.family}</h3>
          <div className="family">
            {parent && (
              <div className="family__row">
                <div className="family__label">{p.distant ? t.descendedFrom : parent.female ? t.mother : t.father}</div>
                <PersonLink kingdom={kingdom} person={parent} color={houses.get(parent.house)?.color} onSelect={onSelect} />
              </div>
            )}
            {kids.length > 0 && (
              <div className="family__row">
                <div className="family__label">{kids.length === 1 ? t.childOnChart : t.childrenOnChart}</div>
                <div className="family__links">
                  {kids.map((k) => (
                    <PersonLink key={k.id} kingdom={kingdom} person={k} color={houses.get(k.house)?.color} onSelect={onSelect} distant={k.distant} />
                  ))}
                </div>
              </div>
            )}
            {p.spouses && p.spouses.length > 0 && (
              <div className="family__row">
                <div className="family__label">{p.spouses.length === 1 ? t.spouse : t.spouses}</div>
                <div className="family__spouses">{p.spouses.join(' · ')}</div>
              </div>
            )}
            {!parent && kids.length === 0 && !p.spouses?.length && <p className="fact__muted">{t.noFamily}</p>}
          </div>
        </section>

        <a className="wiki" href={wikiUrl(p, locale)} target="_blank" rel="noreferrer">
          {t.wikipedia}
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M6 3h7v7M13 3L4 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </a>
      </div>
    </aside>
  )
}

function Avatar({ kingdom, person, color, size }: { kingdom: Kingdom; person: Person; color?: string; size: number }) {
  const src = portraitSrc(kingdom, person.id)
  return (
    <span className="avatar" style={{ width: size, height: size, borderColor: color }}>
      {src ? <img src={src} alt="" /> : <span style={{ color }}>{initials(person.name)}</span>}
    </span>
  )
}

function PersonCard({
  kingdom,
  label,
  person,
  relation,
  color,
  onSelect,
}: {
  kingdom: Kingdom
  label: string
  person: Person
  relation: string
  color?: string
  onSelect: (id: string) => void
}) {
  return (
    <button type="button" className="pcard" onClick={() => onSelect(person.id)}>
      <span className="pcard__label">{label}</span>
      <span className="pcard__row">
        <Avatar kingdom={kingdom} person={person} color={color} size={40} />
        <span className="pcard__text">
          <span className="pcard__name">{person.name}</span>
          <span className="pcard__rel">{relation}</span>
        </span>
      </span>
    </button>
  )
}

function PersonLink({
  kingdom,
  person,
  color,
  onSelect,
  distant,
}: {
  kingdom: Kingdom
  person: Person
  color?: string
  onSelect: (id: string) => void
  distant?: boolean
}) {
  const { locale, t } = useLocale()
  return (
    <button type="button" className="plink" onClick={() => onSelect(person.id)}>
      <Avatar kingdom={kingdom} person={person} color={color} size={28} />
      <span className="plink__text">
        <span className="plink__name">{person.name}</span>
        <span className="plink__meta">
          {person.reign ? reignText(person, locale) : lifeText(person, locale)}
          {distant && ` · ${t.lineAbridged}`}
        </span>
      </span>
    </button>
  )
}

export function Chevron({ dir }: { dir: 'left' | 'right' | 'down' }) {
  const d = dir === 'left' ? 'M12 4l-6 6 6 6' : dir === 'right' ? 'M8 4l6 6-6 6' : 'M5 8l5 5 5-5'
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
