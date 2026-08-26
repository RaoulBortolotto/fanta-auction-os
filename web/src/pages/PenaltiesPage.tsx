import { useMemo, useState } from 'react'
import { useAuctionStore } from '../store/useAuctionStore'

export function PenaltiesPage() {
  const { teamsIntel, allPlayers, soldIds } = useAuctionStore()
  const [onlyFree, setOnlyFree] = useState(false)

  const playersByNameTeam = useMemo(() => {
    const m = new Map<string, (typeof allPlayers)[0]>()
    for (const p of allPlayers) {
      m.set(`${p.team}::${p.name}`.toLowerCase(), p)
      m.set(p.name.toLowerCase(), p)
    }
    return m
  }, [allPlayers])

  const findPlayer = (team: string, name: string) => {
    return (
      playersByNameTeam.get(`${team}::${name}`.toLowerCase()) ??
      playersByNameTeam.get(name.toLowerCase()) ??
      allPlayers.find(
        (p) =>
          p.team === team &&
          (p.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(p.name.toLowerCase())),
      )
    )
  }

  const rows = teamsIntel.map((ti) => {
    const user = ti.penalties.user.order
    const sky = ti.penalties.skySport?.order ?? null
    const entries = [0, 1, 2].map((i) => {
      const uname = user[i] ?? null
      const sname = sky?.[i] ?? null
      const p = uname ? findPlayer(ti.team, uname.replace(/^UNMATCHED:/, '')) : undefined
      const free = p ? !soldIds.has(p.id) : uname != null && !String(uname).startsWith('UNMATCHED')
      return { rank: (i + 1) as 1 | 2 | 3, user: uname, sky: sname, player: p, free }
    })
    return { ti, entries }
  })

  const filtered = onlyFree
    ? rows
        .map((r) => ({
          ...r,
          entries: r.entries.filter((e) => e.user && e.free && e.player),
        }))
        .filter((r) => r.entries.length > 0)
    : rows

  const highlightClass = (p: (typeof allPlayers)[0] | undefined) => {
    if (!p) return ''
    if (p.role === 'C') return 'highlight-c'
    if (p.role === 'A' && (p.tier === 'low' || p.tier === 'mid' || p.tier === 'min')) return 'highlight-low-a'
    if (p.role === 'D' && (p.penalty.rank != null || p.tags.some((t) => t.includes('RIG'))))
      return 'highlight-rig'
    return ''
  }

  return (
    <div>
      <h1 className="page-title">Rigoristi</h1>
      <p className="page-sub">20 squadre · gerarchia user vs Sky · evidenzia C / A low-mid / D RIG.</p>

      <label className="row" style={{ marginBottom: '1rem' }}>
        <input
          type="checkbox"
          checked={onlyFree}
          onChange={(e) => setOnlyFree(e.target.checked)}
          style={{ width: 'auto' }}
        />
        Solo rigoristi ancora liberi
      </label>

      <div className="card-grid">
        {filtered.map(({ ti, entries }) => (
          <div key={ti.team} className="team-card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{ti.team}</strong>
              {ti.penalties.divergence && <span className="tag warn">DIVERGE</span>}
            </div>
            <div className="muted mono" style={{ fontSize: '0.75rem', marginBottom: 8 }}>
              update {ti.lastUpdate} · {ti.penalties.user.source}
            </div>
            {entries.map((e) => (
              <div
                key={e.rank}
                className={`row ${highlightClass(e.player)}`}
                style={{
                  justifyContent: 'space-between',
                  padding: '0.35rem 0.4rem',
                  borderRadius: 4,
                  marginBottom: 4,
                  opacity: onlyFree || e.free || !e.player ? 1 : 0.45,
                }}
              >
                <div>
                  <span className="mono dim">{e.rank}°</span>{' '}
                  <strong>{e.user?.replace(/^UNMATCHED:/, '') ?? 'N/D'}</strong>
                  {e.player && (
                    <span className="muted">
                      {' '}
                      · {e.player.role}
                      {!e.free ? ' · VENDUTO' : ''}
                    </span>
                  )}
                  {e.sky && e.sky !== e.user && (
                    <div className="dim" style={{ fontSize: '0.78rem' }}>
                      Sky: {e.sky.replace(/^UNMATCHED:/, '')}
                    </div>
                  )}
                </div>
                <span className="mono muted">
                  {e.player?.penalty.confidence ?? '—'}%
                </span>
              </div>
            ))}
            {ti.penalties.divergenceNote && (
              <p className="dim" style={{ fontSize: '0.78rem', margin: '6px 0 0' }}>
                {ti.penalties.divergenceNote}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
