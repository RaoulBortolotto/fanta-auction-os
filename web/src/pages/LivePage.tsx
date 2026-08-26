import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Player } from '../types'
import { useAuctionStore } from '../store/useAuctionStore'
import { surplus } from '../engine/verdict'

export function LivePage() {
  const store = useAuctionStore()
  const {
    search,
    getLiveBundle,
    alternatives,
    threatAnalysis,
    whatIf,
    verdict,
    recordSale,
    me,
    state,
    soldIds,
  } = store

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Player | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [bid, setBid] = useState(1)
  const [buyerId, setBuyerId] = useState(me.id)
  const [error, setError] = useState<string | null>(null)
  const [openSug, setOpenSug] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => (query.trim() ? search(query) : []), [query, search])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const pick = (p: Player) => {
    setSelected(p)
    setQuery(p.name)
    setOpenSug(false)
    setError(null)
    const fair = store.fairMap.get(p.id)?.fair ?? p.qtA ?? 1
    setBid(Math.max(1, Math.round(fair)))
    setBuyerId(me.id)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!openSug && suggestions.length && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpenSug(true)
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const first = suggestions[activeIdx] ?? suggestions[0]
      if (first) pick(first)
    } else if (e.key === 'Escape') {
      setOpenSug(false)
    }
  }

  const sale = selected ? state.sales.find((s) => s.playerId === selected.id) : undefined
  const isSold = selected ? soldIds.has(selected.id) : false

  const bundle = selected ? getLiveBundle(selected) : null
  const v = bundle ? verdict(bid, bundle.fair, bundle.live) : null
  const sur = bundle ? surplus(bundle.fair.fair, bid) : 0
  const alts = selected ? alternatives(selected, 6) : []
  const threats = selected ? threatAnalysis(selected, bid) : []
  const wi = selected ? whatIf(selected, bid) : null

  const register = (forMe: boolean) => {
    if (!selected) return
    const tid = forMe ? me.id : buyerId
    const res = recordSale(selected.id, tid, bid)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setError(null)
    setSelected({ ...selected })
  }

  const bestAlt = alts[0]
  const oppCost = bestAlt && selected ? bid - bestAlt.fair : null

  return (
    <div>
      <h1 className="page-title">Live Auction</h1>
      <p className="page-sub">Cerca un giocatore, valuta il bid, registra la vendita.</p>

      <div className="live-search-wrap">
        <input
          ref={inputRef}
          className="live-search"
          placeholder="Cerca giocatore… (es. Solet)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpenSug(true)
          }}
          onFocus={() => setOpenSug(true)}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
          aria-expanded={openSug}
        />
        {openSug && suggestions.length > 0 && (
          <div className="suggestions" role="listbox">
            {suggestions.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className={`suggestion${i === activeIdx ? ' active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(p)}
              >
                <span>
                  <strong>{p.name}</strong>{' '}
                  <span className="muted">
                    {p.role} · {p.team}
                  </span>
                </span>
                <span className="mono muted">
                  {soldIds.has(p.id) ? 'VENDUTO' : 'LIBERO'} · qt {p.qtA ?? '—'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!selected && (
        <div className="panel muted">Seleziona un giocatore dalla ricerca per aprire la cockpit.</div>
      )}

      {selected && bundle && v && (
        <>
          <div className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.6rem', letterSpacing: '-0.02em' }}>
                  {selected.name}
                </h2>
                <div className="muted" style={{ marginTop: 4 }}>
                  {selected.role} · {selected.team} · tier {selected.tier} ·{' '}
                  {isSold ? (
                    <span className="badge stop">VENDUTO</span>
                  ) : (
                    <span className="badge value">LIBERO</span>
                  )}
                </div>
              </div>
              <div className="chip-row">
                {selected.tags.map((t) => (
                  <span
                    key={t}
                    className={`tag${t.includes('MOD') ? ' mod' : ''}${t.includes('RIG') ? ' rig' : ''}${t.includes('G1') ? ' g1' : ''}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {isSold && sale && (
              <div className="banner" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
                Acquistato da{' '}
                <strong>{state.league.find((t) => t.id === sale.teamId)?.name ?? sale.teamId}</strong> a{' '}
                <strong className="mono">{sale.price}</strong> crediti
                {sale.fairAtSale != null && (
                  <span className="muted"> · fair al momento {sale.fairAtSale}</span>
                )}
              </div>
            )}

            <div className="metrics-row">
              <div className="metric-card">
                <div className="metric-label">Fair</div>
                <div className="big-num">{bundle.fair.fair}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Range</div>
                <div className="big-num" style={{ fontSize: '1.35rem' }}>
                  {bundle.fair.rangeLow}–{bundle.fair.rangeHigh}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Live Max</div>
                <div className="big-num">{bundle.live.finalLiveMax}</div>
              </div>
              <div className={`metric-card ${sur >= 0 ? 'surplus-pos' : 'surplus-neg'}`}>
                <div className="metric-label">Surplus @ bid</div>
                <div className="big-num">
                  {sur > 0 ? '+' : ''}
                  {sur}
                </div>
              </div>
            </div>

            <div className="row" style={{ alignItems: 'flex-end', gap: '1.5rem' }}>
              <div>
                <div className="metric-label">Verdict</div>
                <div className={`verdict-hero ${v.color}`}>{v.label}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {v.action}
                </div>
              </div>
              <div>
                <div className="metric-label">Confidence</div>
                <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                  {selected.confidence.toUpperCase()}
                </div>
              </div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>
                lastUpdate: <span className="mono">{selected.lastUpdate}</span>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '0.85rem' }}>
            <div className="panel">
              <div className="panel-title">Top 3 reasons</div>
              <ol style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {bundle.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </div>
            <div className="panel">
              <div className="panel-title">Risks</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {bundle.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {!isSold && (
            <div className="panel" style={{ marginTop: '0.85rem' }}>
              <div className="panel-title">Registra offerta</div>
              <div className="row">
                <label style={{ flex: '0 0 120px' }}>
                  <span className="metric-label">Bid</span>
                  <input
                    type="number"
                    min={1}
                    value={bid}
                    onChange={(e) => setBid(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>
                <label style={{ flex: 1, minWidth: 160 }}>
                  <span className="metric-label">Acquirente</span>
                  <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                    {state.league.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.isMe ? ' (io)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="primary" onClick={() => register(false)}>
                  Registra
                </button>
                <button type="button" className="primary" onClick={() => register(true)}>
                  Compra per me
                </button>
              </div>
              {error && <div className="field-error">{error}</div>}
              <div className="muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>
                Max finanziario acquirente:{' '}
                <span className="mono">
                  {store.teamEconomy(buyerId).maxBid}
                </span>{' '}
                · Live max: <span className="mono">{bundle.live.finalLiveMax}</span>
                {bundle.live.inflation != null && (
                  <>
                    {' '}
                    · Inflazione: <span className="mono">{bundle.live.inflation.toFixed(2)}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {wi && (
            <div className="panel" style={{ marginTop: '0.85rem' }}>
              <div className="panel-title">What-if</div>
              <p style={{ margin: '0 0 0.5rem' }}>{wi.summary}</p>
              <div className="grid-4">
                <div>
                  <div className="metric-label">Crediti dopo</div>
                  <div className="mono big-num" style={{ fontSize: '1.3rem' }}>
                    {wi.creditsAfter}
                  </div>
                </div>
                <div>
                  <div className="metric-label">Slot dopo</div>
                  <div className="mono big-num" style={{ fontSize: '1.3rem' }}>
                    {wi.slotsAfter}
                  </div>
                </div>
                <div>
                  <div className="metric-label">Media/slot</div>
                  <div className="mono big-num" style={{ fontSize: '1.3rem' }}>
                    {wi.avgPerSlot}
                  </div>
                </div>
                <div>
                  <div className="metric-label">Max bid dopo</div>
                  <div className="mono big-num" style={{ fontSize: '1.3rem' }}>
                    {wi.financialMaxAfter}
                  </div>
                </div>
              </div>
              {wi.warnings.map((w) => (
                <div key={w} className="banner warn" style={{ marginTop: 8, marginBottom: 0 }}>
                  {w}
                </div>
              ))}
            </div>
          )}

          <div className="panel" style={{ marginTop: '0.85rem' }}>
            <div className="panel-title">Alternative ({alts.length})</div>
            <div className="table-wrap desktop-only">
              <table className="data">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Team</th>
                    <th>Fair</th>
                    <th>Live Max</th>
                    <th>EV</th>
                    <th>Conf</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {alts.map((a) => (
                    <tr key={a.player.id} onClick={() => pick(a.player)}>
                      <td>{a.player.name}</td>
                      <td>{a.player.team}</td>
                      <td className="mono">{a.fair}</td>
                      <td className="mono">{a.liveMax}</td>
                      <td className="mono">{a.ev.toFixed(1)}</td>
                      <td>{a.confidence}</td>
                      <td className="mono">{a.save > 0 ? `+${a.save}` : a.save}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-cards">
              {alts.map((a) => (
                <button
                  key={a.player.id}
                  type="button"
                  className="player-card-mobile"
                  style={{ textAlign: 'left', width: '100%' }}
                  onClick={() => pick(a.player)}
                >
                  <strong>{a.player.name}</strong> · {a.player.team}
                  <div className="mono muted">
                    Fair {a.fair} · Live {a.liveMax} · save {a.save}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel" style={{ marginTop: '0.85rem' }}>
            <div className="panel-title">Threat analysis</div>
            {threats.length === 0 ? (
              <p className="muted">Nessun rivale con budget sufficiente a questo bid.</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Squadra</th>
                      <th>Crediti</th>
                      <th>Max bid</th>
                      <th>Serve ruolo</th>
                      <th>Interessato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {threats.map((t) => (
                      <tr key={t.team.id} style={{ cursor: 'default' }}>
                        <td>{t.team.name}</td>
                        <td className="mono">{t.eco.credits}</td>
                        <td className="mono">{t.eco.maxBid}</td>
                        <td>{t.needsRole ? 'Sì' : 'No'}</td>
                        <td>{t.interested ? 'Sì' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: '0.85rem' }}>
            <div className="panel-title">Opportunity cost</div>
            {bestAlt ? (
              <p style={{ margin: 0 }}>
                A {bid} crediti stai spendendo{' '}
                <strong className="mono">{oppCost != null && oppCost > 0 ? `+${Math.round(oppCost)}` : Math.round(oppCost ?? 0)}</strong>{' '}
                rispetto al fair di <strong>{bestAlt.player.name}</strong> ({bestAlt.fair}). Se lasci,
                puoi puntare su alternative dello stesso ruolo con EV simile.
              </p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Poche alternative libere nello stesso ruolo/tier.
              </p>
            )}
          </div>

          <div className="grid-2" style={{ marginTop: '0.85rem' }}>
            <div className="panel">
              <div className="panel-title">Note G1</div>
              {selected.g1 ? (
                <div>
                  <span className="badge value">{selected.g1.status ?? 'N/D'}</span>
                  <p style={{ margin: '0.5rem 0 0' }}>{selected.g1.note ?? 'N/D'}</p>
                  <div className="muted mono" style={{ fontSize: '0.8rem' }}>
                    adj {selected.g1.adjustmentPct ?? 'N/D'}% · aggiornato {selected.g1.lastUpdate}
                  </div>
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  Nessun profilo G1.
                </p>
              )}
            </div>
            <div className="panel">
              <div className="panel-title">Note rigoristi</div>
              {selected.penalty.rank != null ? (
                <div>
                  <p style={{ margin: 0 }}>
                    Rank <strong className="mono">{selected.penalty.rank}</strong> · conf{' '}
                    <strong className="mono">{selected.penalty.confidence}</strong>
                    {selected.penalty.divergence && (
                      <span className="tag warn" style={{ marginLeft: 8 }}>
                        DIVERGENZA
                      </span>
                    )}
                  </p>
                  <p className="muted" style={{ margin: '0.4rem 0 0' }}>
                    {selected.penalty.note ?? 'N/D'}
                  </p>
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  Non in gerarchia rigori (o N/D).
                </p>
              )}
            </div>
          </div>

          {selected.notes.length > 0 && (
            <div className="panel" style={{ marginTop: '0.85rem' }}>
              <div className="panel-title">Note</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {selected.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
