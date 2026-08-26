import { useMemo, useState } from 'react'
import type { PlanMark, Player, Role, Tier } from '../types'
import { useAuctionStore } from '../store/useAuctionStore'

type SortKey = 'name' | 'role' | 'team' | 'tier' | 'fair' | 'qtA' | 'fvm'

const MARKS: PlanMark[] = ['priority', 'like', 'watch', 'avoid', 'steal']
const INJURY = ['healthy', 'minor', 'medium', 'long', 'uncertain', 'market_risk'] as const
const TAG_FILTERS = ['MOD', 'RIG', 'G1', 'FK', 'CORNER', 'EUROPE']

export function BoardPage() {
  const { allPlayers, soldIds, fairMap, state, setPlanMark, editPlayer } = useAuctionStore()
  const [role, setRole] = useState<Role | ''>('')
  const [team, setTeam] = useState('')
  const [status, setStatus] = useState<'all' | 'free' | 'sold'>('all')
  const [tier, setTier] = useState<Tier | ''>('')
  const [fairMin, setFairMin] = useState('')
  const [fairMax, setFairMax] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState<SortKey>('fair')
  const [asc, setAsc] = useState(false)
  const [drawer, setDrawer] = useState<Player | null>(null)

  const teams = useMemo(
    () => [...new Set(allPlayers.map((p) => p.team))].sort(),
    [allPlayers],
  )

  const rows = useMemo(() => {
    let list = allPlayers
    if (role) list = list.filter((p) => p.role === role)
    if (team) list = list.filter((p) => p.team === team)
    if (status === 'free') list = list.filter((p) => !soldIds.has(p.id))
    if (status === 'sold') list = list.filter((p) => soldIds.has(p.id))
    if (tier) list = list.filter((p) => p.tier === tier)
    if (tag) {
      list = list.filter(
        (p) =>
          p.tags.some((t) => t.toUpperCase().includes(tag)) ||
          (tag === 'EUROPE' && p.europe) ||
          (tag === 'RIG' && p.penalty.rank != null) ||
          (tag === 'G1' && p.g1 != null) ||
          (tag === 'FK' && p.setPieces.fk != null) ||
          (tag === 'CORNER' && p.setPieces.corners != null),
      )
    }
    const lo = fairMin === '' ? null : Number(fairMin)
    const hi = fairMax === '' ? null : Number(fairMax)
    if (lo != null || hi != null) {
      list = list.filter((p) => {
        const f = fairMap.get(p.id)?.fair ?? 0
        if (lo != null && f < lo) return false
        if (hi != null && f > hi) return false
        return true
      })
    }
    return [...list].sort((a, b) => {
      let va: string | number = 0
      let vb: string | number = 0
      if (sort === 'fair') {
        va = fairMap.get(a.id)?.fair ?? 0
        vb = fairMap.get(b.id)?.fair ?? 0
      } else if (sort === 'qtA' || sort === 'fvm') {
        va = a[sort] ?? 0
        vb = b[sort] ?? 0
      } else {
        va = a[sort]
        vb = b[sort]
      }
      if (va < vb) return asc ? -1 : 1
      if (va > vb) return asc ? 1 : -1
      return 0
    })
  }, [allPlayers, role, team, status, tier, tag, fairMin, fairMax, sort, asc, soldIds, fairMap])

  const toggleSort = (k: SortKey) => {
    if (sort === k) setAsc(!asc)
    else {
      setSort(k)
      setAsc(k === 'name' || k === 'team')
    }
  }

  const saleOf = (id: number) => state.sales.find((s) => s.playerId === id)

  return (
    <div>
      <h1 className="page-title">Board</h1>
      <p className="page-sub">{rows.length} giocatori · filtra, ordina, apri dettaglio.</p>

      <div className="filters">
        <label>
          Ruolo
          <select value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
            <option value="">Tutti</option>
            {(['P', 'D', 'C', 'A'] as Role[]).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          Squadra
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Tutte</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stato
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Tutti</option>
            <option value="free">Liberi</option>
            <option value="sold">Venduti</option>
          </select>
        </label>
        <label>
          Tier
          <select value={tier} onChange={(e) => setTier(e.target.value as Tier | '')}>
            <option value="">Tutti</option>
            {(['elite', 'high', 'mid', 'low', 'min'] as Tier[]).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fair min
          <input value={fairMin} onChange={(e) => setFairMin(e.target.value)} type="number" />
        </label>
        <label>
          Fair max
          <input value={fairMax} onChange={(e) => setFairMax(e.target.value)} type="number" />
        </label>
        <label>
          Tag
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Tutti</option>
            {TAG_FILTERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap desktop-only">
        <table className="data">
          <thead>
            <tr>
              {(
                [
                  ['name', 'Nome'],
                  ['role', 'R'],
                  ['team', 'Team'],
                  ['tier', 'Tier'],
                  ['fair', 'Fair'],
                  ['qtA', 'QtA'],
                  ['fvm', 'FVM'],
                ] as [SortKey, string][]
              ).map(([k, label]) => (
                <th key={k} className={sort === k ? 'sorted' : ''} onClick={() => toggleSort(k)}>
                  {label}
                  {sort === k ? (asc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
              <th>Stato</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 400).map((p) => {
              const sold = soldIds.has(p.id)
              return (
                <tr key={p.id} className={sold ? 'sold' : ''} onClick={() => setDrawer(p)}>
                  <td>{p.name}</td>
                  <td className="mono">{p.role}</td>
                  <td>{p.team}</td>
                  <td>{p.tier}</td>
                  <td className="mono">{fairMap.get(p.id)?.fair ?? '—'}</td>
                  <td className="mono">{p.qtA ?? '—'}</td>
                  <td className="mono">{p.fvm ?? '—'}</td>
                  <td>{sold ? 'Venduto' : 'Libero'}</td>
                  <td>
                    <span className="chip-row">
                      {p.tags.slice(0, 3).map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mobile-cards">
        {rows.slice(0, 120).map((p) => (
          <button
            key={p.id}
            type="button"
            className="player-card-mobile"
            style={{ textAlign: 'left', width: '100%' }}
            onClick={() => setDrawer(p)}
          >
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>
                {p.name} · {p.role}
              </strong>
              <span className="mono">{fairMap.get(p.id)?.fair ?? '—'}</span>
            </div>
            <div className="muted">
              {p.team} · {p.tier} · {soldIds.has(p.id) ? 'Venduto' : 'Libero'}
            </div>
          </button>
        ))}
      </div>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(null)} />
          <aside className="drawer">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>{drawer.name}</h2>
              <button type="button" className="ghost" onClick={() => setDrawer(null)}>
                Chiudi
              </button>
            </div>
            <p className="muted">
              {drawer.role} · {drawer.team} · tier {drawer.tier}
            </p>
            <div className="grid-2" style={{ margin: '0.75rem 0' }}>
              <div>
                <div className="metric-label">Fair</div>
                <div className="mono big-num" style={{ fontSize: '1.4rem' }}>
                  {fairMap.get(drawer.id)?.fair ?? '—'}
                </div>
              </div>
              <div>
                <div className="metric-label">Stato</div>
                <div>
                  {soldIds.has(drawer.id)
                    ? `Venduto · ${saleOf(drawer.id)?.price ?? '?'}`
                    : 'Libero'}
                </div>
              </div>
            </div>

            <div className="panel-title">Plan mark</div>
            <div className="mark-btns row" style={{ marginBottom: '1rem' }}>
              {MARKS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={drawer.planMark === m ? 'active' : ''}
                  onClick={() => {
                    setPlanMark(drawer.id, drawer.planMark === m ? null : m)
                    setDrawer({
                      ...drawer,
                      planMark: drawer.planMark === m ? null : m,
                    })
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="panel-title">Infortunio / market</div>
            <label>
              Status
              <select
                value={drawer.injury.status}
                onChange={(e) => {
                  const statusVal = e.target.value as (typeof INJURY)[number]
                  const injury = { ...drawer.injury, status: statusVal }
                  editPlayer(drawer.id, { injury, marketRisk: statusVal === 'market_risk' })
                  setDrawer({ ...drawer, injury, marketRisk: statusVal === 'market_risk' })
                }}
              >
                {INJURY.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block', marginTop: 8 }}>
              Nota
              <textarea
                rows={3}
                value={drawer.manualNote ?? ''}
                onChange={(e) => {
                  editPlayer(drawer.id, { manualNote: e.target.value })
                  setDrawer({ ...drawer, manualNote: e.target.value })
                }}
              />
            </label>

            <div className="chip-row" style={{ marginTop: 12 }}>
              {drawer.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
            <p className="dim mono" style={{ fontSize: '0.75rem', marginTop: 12 }}>
              lastUpdate {drawer.lastUpdate}
            </p>
          </aside>
        </>
      )}
    </div>
  )
}
