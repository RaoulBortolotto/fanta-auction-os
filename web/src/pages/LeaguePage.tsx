import { useState } from 'react'
import { useAuctionStore } from '../store/useAuctionStore'

export function LeaguePage() {
  const {
    state,
    teamEconomy,
    renameTeam,
    deleteSale,
    editSale,
    undoSale,
    portfolio,
    playersById,
    pivot,
    me,
  } = useAuctionStore()

  const [editingSale, setEditingSale] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState(1)
  const [editTeam, setEditTeam] = useState('')

  const pivotMsg = state.lastPivotReason ?? pivot

  return (
    <div>
      <h1 className="page-title">Lega</h1>
      <p className="page-sub">10 squadre · vendite · salute portfolio · undo.</p>

      {pivotMsg && <div className="banner warn">{pivotMsg}</div>}

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => undoSale()} disabled={!state.undoStack.length}>
          Undo
        </button>
        <span className="muted mono" style={{ fontSize: '0.8rem' }}>
          stack {state.undoStack.length}
        </span>
      </div>

      <div className="card-grid">
        {state.league.map((t) => {
          const eco = teamEconomy(t.id)
          return (
            <div key={t.id} className={`team-card${t.isMe ? ' me' : ''}`}>
              <input
                value={t.name}
                onChange={(e) => renameTeam(t.id, e.target.value)}
                style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 8 }}
              />
              <div className="grid-2" style={{ gap: '0.4rem' }}>
                <div>
                  <div className="metric-label">Crediti</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {eco.credits}
                  </div>
                </div>
                <div>
                  <div className="metric-label">Slot</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {eco.slotsLeft}
                  </div>
                </div>
                <div>
                  <div className="metric-label">Max bid</div>
                  <div className="mono">{eco.maxBid}</div>
                </div>
                <div>
                  <div className="metric-label">P/D/C/A</div>
                  <div className="mono">
                    {eco.byRole.P}/{eco.byRole.D}/{eco.byRole.C}/{eco.byRole.A}
                  </div>
                </div>
              </div>
              <div className="panel-title" style={{ marginTop: 10 }}>
                Acquisti ({eco.purchases.length})
              </div>
              <ul className="compat-list">
                {eco.purchases.map((s) => {
                  const p = playersById.get(s.playerId)
                  return (
                    <li key={s.id}>
                      <span>
                        {p?.name ?? s.playerId} <span className="dim">({s.role})</span>
                      </span>
                      <span className="mono">{s.price}</span>
                    </li>
                  )
                })}
                {eco.purchases.length === 0 && <li className="muted">—</li>}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-title">Portfolio health · {me.name}</div>
        <div className="grid-4">
          <div>
            <div className="metric-label">Surplus prog.</div>
            <div className="mono big-num" style={{ fontSize: '1.3rem' }}>
              {Math.round(portfolio.projectedSurplus)}
            </div>
          </div>
          <div>
            <div className="metric-label">Fair tot.</div>
            <div className="mono big-num" style={{ fontSize: '1.3rem' }}>
              {Math.round(portfolio.fairTotal)}
            </div>
          </div>
          <div>
            <div className="metric-label">Speso</div>
            <div className="mono big-num" style={{ fontSize: '1.3rem' }}>
              {portfolio.spent}
            </div>
          </div>
          <div>
            <div className="metric-label">Surplus/credito</div>
            <div className="mono big-num" style={{ fontSize: '1.3rem' }}>
              {portfolio.surplusPerCredit.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="chip-row" style={{ marginTop: 10 }}>
          <span className="tag">MOD D {portfolio.modReadyD}</span>
          <span className="tag">Vote D {portfolio.voteD}</span>
          <span className="tag">Min C {portfolio.minutesC}</span>
          <span className="tag">Vote A {portfolio.voteA}</span>
          <span className="tag rig">RIG {portfolio.rigoristi}</span>
          <span className="tag">Piazzati {portfolio.piazzati}</span>
          <span className="tag">Titolari {portfolio.titolari}</span>
          <span className="tag">Europa {portfolio.europe}</span>
          <span className="tag warn">Injury {portfolio.injuryRisk}</span>
          <span className="tag">Dead cap {portfolio.capitalAtRisk}</span>
          <span className="tag">Switch {portfolio.switchOptions}</span>
        </div>
        {portfolio.warnings.map((w) => (
          <div key={w} className="banner warn" style={{ marginTop: 8, marginBottom: 0 }}>
            {w}
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-title">Log vendite</div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Giocatore</th>
                <th>Buyer</th>
                <th>Prezzo</th>
                <th>Fair</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...state.sales].reverse().map((s) => {
                const p = playersById.get(s.playerId)
                const buyer = state.league.find((t) => t.id === s.teamId)?.name ?? s.teamId
                const editing = editingSale === s.id
                return (
                  <tr key={s.id} style={{ cursor: 'default' }}>
                    <td className="mono">{new Date(s.ts).toLocaleTimeString('it-IT')}</td>
                    <td>
                      {p?.name ?? s.playerId} ({s.role})
                    </td>
                    <td>
                      {editing ? (
                        <select value={editTeam} onChange={(e) => setEditTeam(e.target.value)}>
                          {state.league.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        buyer
                      )}
                    </td>
                    <td className="mono">
                      {editing ? (
                        <input
                          type="number"
                          min={1}
                          value={editPrice}
                          onChange={(e) => setEditPrice(Number(e.target.value) || 1)}
                          style={{ width: 80 }}
                        />
                      ) : (
                        s.price
                      )}
                    </td>
                    <td className="mono">{s.fairAtSale}</td>
                    <td>
                      {editing ? (
                        <div className="row">
                          <button
                            type="button"
                            className="primary"
                            onClick={() => {
                              editSale(s.id, { price: editPrice, teamId: editTeam })
                              setEditingSale(null)
                            }}
                          >
                            Salva
                          </button>
                          <button type="button" onClick={() => setEditingSale(null)}>
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <div className="row">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSale(s.id)
                              setEditPrice(s.price)
                              setEditTeam(s.teamId)
                            }}
                          >
                            Modifica
                          </button>
                          <button type="button" className="danger" onClick={() => deleteSale(s.id)}>
                            Elimina
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {state.sales.length === 0 && (
                <tr style={{ cursor: 'default' }}>
                  <td colSpan={6} className="muted">
                    Nessuna vendita ancora.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
