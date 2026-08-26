import { useMemo } from 'react'
import { useAuctionStore } from '../store/useAuctionStore'

const STATUS_LABEL: Record<string, string> = {
  PROMOZIONE_REALE: 'PROMOZIONE REALE',
  WATCH: 'WATCH',
  HYPE_GUARD: 'HYPE GUARD',
  GERARCHIA_APERTA: 'OPEN',
}

export function G1Page() {
  const { allPlayers, fairMap, soldIds } = useAuctionStore()

  const rows = useMemo(
    () =>
      allPlayers
        .filter((p) => p.g1 != null)
        .sort((a, b) => (b.g1?.adjustmentPct ?? 0) - (a.g1?.adjustmentPct ?? 0)),
    [allPlayers],
  )

  return (
    <div>
      <h1 className="page-title">G1 / Young Lab</h1>
      <p className="page-sub">
        {rows.length} profili · non strapagare un gol alla prima.
      </p>

      <div className="table-wrap desktop-only">
        <table className="data">
          <thead>
            <tr>
              <th>Giocatore</th>
              <th>R</th>
              <th>Team</th>
              <th>Status</th>
              <th>Adj %</th>
              <th>Fair pre</th>
              <th>Fair post</th>
              <th>Fair live</th>
              <th>Hype</th>
              <th>Note</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const g = p.g1!
              const liveFair = fairMap.get(p.id)?.fair
              const hype = g.status === 'HYPE_GUARD' || (g.adjustmentPct != null && g.adjustmentPct > 8)
              return (
                <tr key={p.id} style={{ cursor: 'default' }}>
                  <td>{p.name}</td>
                  <td className="mono">{p.role}</td>
                  <td>{p.team}</td>
                  <td>
                    <span className={`badge ${g.status === 'HYPE_GUARD' ? 'limit' : 'value'}`}>
                      {STATUS_LABEL[g.status ?? ''] ?? g.status ?? 'N/D'}
                    </span>
                  </td>
                  <td className="mono">{g.adjustmentPct ?? 'N/D'}</td>
                  <td className="mono">{g.fairBefore ?? 'N/D'}</td>
                  <td className="mono">{g.fairAfter ?? 'N/D'}</td>
                  <td className="mono">{liveFair ?? 'N/D'}</td>
                  <td>{hype ? 'Alto' : 'Controllato'}</td>
                  <td style={{ maxWidth: 220, whiteSpace: 'normal' }}>{g.note ?? 'N/D'}</td>
                  <td>{soldIds.has(p.id) ? 'Venduto' : 'Libero'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mobile-cards">
        {rows.map((p) => {
          const g = p.g1!
          return (
            <div key={p.id} className="player-card-mobile">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>
                  {p.name} · {p.role}
                </strong>
                <span className="badge value">{STATUS_LABEL[g.status ?? ''] ?? 'N/D'}</span>
              </div>
              <div className="muted">
                {p.team} · adj {g.adjustmentPct ?? 'N/D'}% · fair{' '}
                {g.fairBefore ?? 'N/D'}→{g.fairAfter ?? 'N/D'}
              </div>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.88rem' }}>{g.note ?? 'N/D'}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
