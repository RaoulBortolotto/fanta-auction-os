import { useMemo, useState } from 'react'
import { useAuctionStore } from '../store/useAuctionStore'

export function ModLabPage() {
  const { state } = useAuctionStore()
  const th = state.settings.modThresholds
  const csBonus = state.settings.cleanSheetBonus
  const goalBand = state.settings.goalBand

  const [pVote, setPVote] = useState(6.5)
  const [dVotes, setDVotes] = useState([6.5, 6.5, 6.5, 6.0, 6.0])
  const [cs, setCs] = useState(false)

  const calc = useMemo(() => {
    const best3 = [...dVotes].sort((a, b) => b - a).slice(0, 3)
    const dAvg = best3.reduce((a, b) => a + b, 0) / 3
    const media = (pVote + best3[0] + best3[1] + best3[2]) / 4
    let bonus = 0
    if (media >= th.plus5) bonus = 5
    else if (media >= th.plus3[0]) bonus = 3
    else if (media >= th.plus1[0]) bonus = 1
    const csExtra = cs ? csBonus : 0
    const dFor650 = (6.5 * 4 - pVote) / 3
    return { best3, dAvg, media, bonus, csExtra, total: bonus + csExtra, dFor650 }
  }, [pVote, dVotes, cs, th, csBonus])

  const setD = (i: number, v: number) => {
    setDVotes((prev) => prev.map((x, idx) => (idx === i ? v : x)))
  }

  return (
    <div>
      <h1 className="page-title">MOD Lab</h1>
      <p className="page-sub">
        Portiere + migliori 3 voti D · soglie {th.plus1[0]}–{th.plus1[1]} = +1 · {th.plus3[0]}–
        {th.plus3[1]} = +3 · ≥{th.plus5} = +5
      </p>

      <div className="banner">Il portiere vale il 25% della media.</div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Input voti</div>
          <div className="form-grid">
            <label>
              Voto P
              <input
                type="number"
                step={0.25}
                value={pVote}
                onChange={(e) => setPVote(Number(e.target.value) || 0)}
              />
            </label>
            {dVotes.map((v, i) => (
              <label key={i}>
                D{i + 1}
                <input
                  type="number"
                  step={0.25}
                  value={v}
                  onChange={(e) => setD(i, Number(e.target.value) || 0)}
                />
              </label>
            ))}
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={cs}
                onChange={(e) => setCs(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Clean sheet (+{csBonus})
            </label>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Risultato</div>
          <div className="grid-2">
            <div>
              <div className="metric-label">Best 3 D</div>
              <div className="mono">{calc.best3.map((x) => x.toFixed(2)).join(' · ')}</div>
            </div>
            <div>
              <div className="metric-label">Media D (best 3)</div>
              <div className="mono big-num" style={{ fontSize: '1.4rem' }}>
                {calc.dAvg.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="metric-label">Media MOD (P+3D)/4</div>
              <div className="mono big-num" style={{ fontSize: '1.6rem', color: 'var(--accent)' }}>
                {calc.media.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="metric-label">Bonus</div>
              <div className="mono big-num" style={{ fontSize: '1.6rem' }}>
                +{calc.bonus}
                {calc.csExtra ? ` +CS${calc.csExtra}` : ''} = {calc.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '0.85rem' }}>
        <div className="panel-title">Soglia 6.50 — D medi necessari dato P</div>
        <div className="table-wrap">
          <table className="data threshold-table">
            <thead>
              <tr>
                <th>Voto P</th>
                <th>D medi per media 6.50</th>
              </tr>
            </thead>
            <tbody>
              {[6.0, 6.25, 6.5, 6.75, 7.0].map((p) => {
                const dNeed = (6.5 * 4 - p) / 3
                return (
                  <tr key={p} style={{ cursor: 'default' }}>
                    <td>{p.toFixed(2)}</td>
                    <td>{dNeed.toFixed(2)}</td>
                  </tr>
                )
              })}
              <tr style={{ cursor: 'default' }}>
                <td>
                  <strong>{pVote.toFixed(2)} (attuale)</strong>
                </td>
                <td>
                  <strong>{calc.dFor650.toFixed(2)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '0.85rem' }}>
        <div className="panel-title">Fasce gol (euristica)</div>
        <p className="muted" style={{ marginTop: 0 }}>
          Fascia gol ogni {goalBand} punti.{' '}
          <strong>euristica matematica, non probabilità empirica.</strong>
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          <li>+1 ≈ 16,7% di una fascia</li>
          <li>+3 = 50%</li>
          <li>+5 ≈ 83,3%</li>
          <li>+3 MOD +1 imbattibilità ≈ 66,7%</li>
        </ul>
      </div>
    </div>
  )
}
