import { useState } from 'react'
import { useAuctionStore } from '../store/useAuctionStore'

export function IntelPage() {
  const { teamsIntel } = useAuctionStore()
  const [open, setOpen] = useState<string | null>(teamsIntel[0]?.team ?? null)

  return (
    <div>
      <h1 className="page-title">Team Intel</h1>
      <p className="page-sub">20 club · coach, sistema, asset, trappole — non un muro di testo.</p>

      {teamsIntel.map((t) => {
        const isOpen = open === t.team
        return (
          <div key={t.team} className="accordion">
            <button
              type="button"
              className="accordion-head"
              onClick={() => setOpen(isOpen ? null : t.team)}
              aria-expanded={isOpen}
            >
              <span>
                {t.team}{' '}
                <span className="muted" style={{ fontWeight: 400 }}>
                  · {t.coach} · {t.system}
                </span>
              </span>
              <span className="mono dim">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <div className="accordion-body">
                <div className="grid-2">
                  <div>
                    <div className="metric-label">Difesa / Attacco</div>
                    <div>
                      {t.defensiveSolidity} · {t.offensiveQuality}
                    </div>
                  </div>
                  <div>
                    <div className="metric-label">Europa</div>
                    <div>{t.europe == null ? 'N/D' : t.europe ? 'Sì' : 'No'}</div>
                  </div>
                </div>

                <div>
                  <div className="metric-label">Rigori (user)</div>
                  <div className="mono">{t.penalties.user.order.join(' → ') || 'N/D'}</div>
                  {t.penalties.skySport && (
                    <div className="dim mono" style={{ fontSize: '0.8rem' }}>
                      Sky: {t.penalties.skySport.order.join(' → ')}
                      {t.penalties.divergence ? ' · DIVERGE' : ''}
                    </div>
                  )}
                </div>

                <div>
                  <div className="metric-label">Piazzati</div>
                  <div className="mono">{t.setPieces.order.join(' → ') || 'N/D'}</div>
                  {t.setPieces.note && <div className="dim">{t.setPieces.note}</div>}
                </div>

                {t.g1Notes.length > 0 && (
                  <div>
                    <div className="metric-label">G1 / young</div>
                    <div className="chip-row">
                      {t.g1Notes.map((n) => (
                        <span key={n} className="tag g1">
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="metric-label">Asset fantasy</div>
                  <div className="chip-row">
                    {t.fantasyAssets.map((a) => (
                      <span key={a} className="tag mod">
                        {a}
                      </span>
                    ))}
                    {t.fantasyAssets.length === 0 && <span className="muted">N/D</span>}
                  </div>
                </div>

                <div>
                  <div className="metric-label">Trappole</div>
                  <div className="chip-row">
                    {t.traps.map((a) => (
                      <span key={a} className="tag warn">
                        {a}
                      </span>
                    ))}
                    {t.traps.length === 0 && <span className="muted">—</span>}
                  </div>
                </div>

                {(t.injuries.length > 0 || t.marketNotes.length > 0) && (
                  <div className="grid-2">
                    <div>
                      <div className="metric-label">Infortuni</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.88rem' }}>
                        {t.injuries.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                        {t.injuries.length === 0 && <li className="muted">—</li>}
                      </ul>
                    </div>
                    <div>
                      <div className="metric-label">Mercato</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.88rem' }}>
                        {t.marketNotes.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                        {t.marketNotes.length === 0 && <li className="muted">—</li>}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="dim mono" style={{ fontSize: '0.75rem' }}>
                  lastUpdate {t.lastUpdate}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
