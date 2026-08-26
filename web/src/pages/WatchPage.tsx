import { useMemo, useState } from 'react'
import { useAuctionStore } from '../store/useAuctionStore'

type InjFilter = 'all' | 'healthy' | 'minor' | 'medium' | 'long' | 'uncertain' | 'market_risk'

export function WatchPage() {
  const { allPlayers, fairMap, portfolio, playersById, soldIds } = useAuctionStore()
  const [inj, setInj] = useState<InjFilter>('all')
  const [marketOnly, setMarketOnly] = useState(false)

  const rows = useMemo(() => {
    return allPlayers.filter((p) => {
      const isMarket = p.marketRisk || p.injury.status === 'market_risk'
      const risky = p.injury.status !== 'healthy' || p.marketRisk
      if (inj === 'all') {
        if (marketOnly) return isMarket
        return risky
      }
      if (inj === 'market_risk') return isMarket
      return p.injury.status === inj
    })
  }, [allPlayers, inj, marketOnly])

  const dead = portfolio.deadCapitalIds.map((id) => playersById.get(id)).filter(Boolean)

  return (
    <div>
      <h1 className="page-title">Injury / Market Watch</h1>
      <p className="page-sub">Required discount · capitale a rischio · dead capital.</p>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="metric-card">
          <div className="metric-label">Capitale a rischio (rosa)</div>
          <div className="big-num" style={{ fontSize: '1.6rem', color: 'var(--limit)' }}>
            {portfolio.capitalAtRisk}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Profili injury/risk</div>
          <div className="big-num" style={{ fontSize: '1.6rem' }}>
            {portfolio.injuryRisk}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Dead capital</div>
          <div className="big-num" style={{ fontSize: '1.6rem' }}>
            {dead.length}
          </div>
        </div>
      </div>

      <div className="filters">
        <label>
          Injury status
          <select value={inj} onChange={(e) => setInj(e.target.value as InjFilter)}>
            <option value="all">Tutti i rischiosi</option>
            <option value="minor">minor</option>
            <option value="medium">medium</option>
            <option value="long">long</option>
            <option value="uncertain">uncertain</option>
            <option value="market_risk">market_risk</option>
            <option value="healthy">healthy</option>
          </select>
        </label>
        <label className="row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={marketOnly}
            onChange={(e) => setMarketOnly(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Solo market risk
        </label>
      </div>

      <div className="table-wrap desktop-only">
        <table className="data">
          <thead>
            <tr>
              <th>Giocatore</th>
              <th>R</th>
              <th>Team</th>
              <th>Status</th>
              <th>Missed</th>
              <th>Required discount</th>
              <th>Fair sano≈</th>
              <th>Fair adj</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const fair = fairMap.get(p.id)?.fair ?? p.qtA ?? 0
              const disc = p.injury.requiredDiscountPct
              const adj = disc != null ? Math.round(fair * (1 - disc / 100)) : null
              return (
                <tr key={p.id} style={{ cursor: 'default' }}>
                  <td>
                    {p.name}
                    {soldIds.has(p.id) ? ' · V' : ''}
                  </td>
                  <td className="mono">{p.role}</td>
                  <td>{p.team}</td>
                  <td>
                    <span className="tag warn">{p.injury.status}</span>
                    {p.marketRisk && <span className="tag">MARKET</span>}
                  </td>
                  <td className="mono">{p.injury.expectedMissed ?? 'N/D'}</td>
                  <td className="mono">{disc != null ? `${disc}%` : 'N/D'}</td>
                  <td className="mono">{fair}</td>
                  <td className="mono">{adj != null ? `${adj}–${Math.round(adj * 1.08)}` : 'N/D'}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 200 }}>{p.injury.note ?? 'N/D'}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr style={{ cursor: 'default' }}>
                <td colSpan={9} className="muted">
                  Nessun profilo nel filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-cards">
        {rows.map((p) => (
          <div key={p.id} className="player-card-mobile">
            <strong>
              {p.name} · {p.role}
            </strong>
            <div className="muted">
              {p.injury.status} · discount {p.injury.requiredDiscountPct ?? 'N/D'}%
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-title">Dead capital (rosa)</div>
        {dead.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nessun dead capital al momento.
          </p>
        ) : (
          <ul className="compat-list">
            {dead.map((p) =>
              p ? (
                <li key={p.id}>
                  <span>
                    {p.name} · {p.role} · {p.team}
                  </span>
                  <span className="tag warn">{p.injury.status}</span>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
