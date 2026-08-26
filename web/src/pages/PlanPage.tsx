import { useMemo, useState } from 'react'
import type { PlanMark, Player, Role, Tier } from '../types'
import { useAuctionStore } from '../store/useAuctionStore'
import { TEMPLATES } from '../defaults'

interface SlotDef {
  id: string
  role: Role
  profile: string
  tiers: Tier[]
}

const SLOTS: SlotDef[] = [
  { id: 'P1', role: 'P', profile: 'Titolare premium/value', tiers: ['elite', 'high'] },
  { id: 'P2', role: 'P', profile: 'Copertura reale / secondo titolare', tiers: ['high', 'mid'] },
  { id: 'P3', role: 'P', profile: 'Minimo o copertura', tiers: ['mid', 'low', 'min'] },
  { id: 'D1', role: 'D', profile: 'Elite MOD + bonus', tiers: ['elite'] },
  { id: 'D2', role: 'D', profile: 'Forte MOD', tiers: ['elite', 'high'] },
  { id: 'D3', role: 'D', profile: 'Stabilizzatore di voto', tiers: ['high', 'mid'] },
  { id: 'D4', role: 'D', profile: 'MOD + bonus', tiers: ['high', 'mid'] },
  { id: 'D5', role: 'D', profile: 'Titolare affidabile', tiers: ['mid', 'high'] },
  { id: 'D6', role: 'D', profile: 'Titolare affidabile', tiers: ['mid', 'high'] },
  { id: 'D7', role: 'D', profile: 'Upside', tiers: ['mid', 'low'] },
  { id: 'D8', role: 'D', profile: 'Sleeper con possibilità di voto', tiers: ['low', 'min'] },
  { id: 'C1', role: 'C', profile: 'Premium bonus', tiers: ['elite'] },
  { id: 'C2', role: 'C', profile: 'Offensivo', tiers: ['elite', 'high'] },
  { id: 'C3', role: 'C', profile: 'Bonus', tiers: ['high'] },
  { id: 'C4', role: 'C', profile: 'Value', tiers: ['high', 'mid'] },
  { id: 'C5', role: 'C', profile: 'Floor / titolarità', tiers: ['mid'] },
  { id: 'C6', role: 'C', profile: 'Floor', tiers: ['mid', 'low'] },
  { id: 'C7', role: 'C', profile: 'Upside', tiers: ['low', 'mid'] },
  { id: 'C8', role: 'C', profile: 'Low cost con minuti', tiers: ['low', 'min'] },
  { id: 'A1', role: 'A', profile: 'Leader', tiers: ['elite'] },
  { id: 'A2', role: 'A', profile: 'Doppia cifra plausibile', tiers: ['elite', 'high'] },
  { id: 'A3', role: 'A', profile: 'Doppia cifra / upside', tiers: ['high'] },
  { id: 'A4', role: 'A', profile: 'Titolare', tiers: ['high', 'mid'] },
  { id: 'A5', role: 'A', profile: 'Low cost con voto', tiers: ['mid', 'low'] },
  { id: 'A6', role: 'A', profile: 'Sleeper / titolare', tiers: ['low', 'min'] },
]

const MARKS: { id: PlanMark; label: string }[] = [
  { id: 'priority', label: 'Priority' },
  { id: 'like', label: 'Like' },
  { id: 'watch', label: 'Watch' },
  { id: 'avoid', label: 'Avoid' },
  { id: 'steal', label: 'Steal' },
]

function scoreForSlot(p: Player, slot: SlotDef) {
  let s = p.baseScore
  if (slot.tiers.includes(p.tier)) s += 20
  if (p.planMark === 'priority') s += 15
  if (p.planMark === 'steal') s += 12
  if (p.planMark === 'like') s += 8
  if (p.planMark === 'avoid') s -= 30
  if (slot.role === 'D' && p.tags.some((t) => t.includes('MOD'))) s += 10
  return s
}

export function PlanPage() {
  const {
    allPlayers,
    soldIds,
    fairMap,
    getLiveBundle,
    state,
    applyTemplate,
    setPlanMark,
    myEco,
  } = useAuctionStore()

  const [focusSlot, setFocusSlot] = useState('A1')
  const plan = state.settings.budgetPlan

  const freeByRole = useMemo(() => {
    const m: Record<Role, Player[]> = { P: [], D: [], C: [], A: [] }
    for (const p of allPlayers) {
      if (!soldIds.has(p.id)) m[p.role].push(p)
    }
    return m
  }, [allPlayers, soldIds])

  const slotPlayers = useMemo(() => {
    const slot = SLOTS.find((s) => s.id === focusSlot)!
    return [...freeByRole[slot.role]]
      .sort((a, b) => scoreForSlot(b, slot) - scoreForSlot(a, slot))
      .slice(0, 12)
  }, [focusSlot, freeByRole])

  const chains = useMemo(() => {
    const result: { slot: string; soldOver: Player[]; pianoB: Player[]; pianoC: Player[] }[] = []
    for (const slot of SLOTS.filter((s) => ['A1', 'A2', 'C1', 'D1'].includes(s.id))) {
      const pool = allPlayers
        .filter((p) => p.role === slot.role && slot.tiers.includes(p.tier))
        .sort((a, b) => (fairMap.get(b.id)?.fair ?? 0) - (fairMap.get(a.id)?.fair ?? 0))
      const top = pool.slice(0, 4)
      const soldOver = top.filter((p) => {
        if (!soldIds.has(p.id)) return false
        const sale = state.sales.find((x) => x.playerId === p.id)
        if (!sale) return false
        const live = getLiveBundle(p).live.finalLiveMax
        return sale.price > live
      })
      if (!soldOver.length) continue
      const free = pool.filter((p) => !soldIds.has(p.id))
      result.push({
        slot: slot.id,
        soldOver,
        pianoB: free.slice(0, 3),
        pianoC: free.slice(3, 6),
      })
    }
    return result
  }, [allPlayers, soldIds, fairMap, state.sales, getLiveBundle])

  return (
    <div>
      <h1 className="page-title">Piano strategico</h1>
      <p className="page-sub">25 slot · envelope budget · Piano B/C se i target top saltano.</p>

      <div className="panel">
        <div className="panel-title">Template budget</div>
        <div className="row">
          {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((id) => (
            <button
              key={id}
              type="button"
              className={state.settings.budgetTemplate === id ? 'primary' : ''}
              onClick={() => applyTemplate(id)}
            >
              {id === 'balanced' ? 'Balanced' : id === 'eliteA' ? 'Elite A' : 'Deep Value'}
            </button>
          ))}
          <button type="button" onClick={() => applyTemplate('custom')}>
            Custom
          </button>
        </div>
        <div className="grid-4" style={{ marginTop: '0.85rem' }}>
          {(['P', 'D', 'C', 'A'] as Role[]).map((r) => (
            <div key={r} className="metric-card">
              <div className="metric-label">Envelope {r}</div>
              <div className="big-num" style={{ fontSize: '1.4rem' }}>
                {plan[r]}
              </div>
              <div className="muted mono" style={{ fontSize: '0.75rem' }}>
                speso {myEco.spendRole[r]} · slot {myEco.byRole[r]}/{state.settings.slots[r]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {chains.length > 0 && (
        <div className="panel" style={{ marginTop: '0.85rem' }}>
          <div className="panel-title">Catene Piano B / C</div>
          {chains.map((c) => (
            <div key={c.slot} style={{ marginBottom: '0.75rem' }}>
              <div className="banner warn" style={{ marginBottom: 6 }}>
                Slot {c.slot}: top target venduti sopra Live Max —{' '}
                {c.soldOver.map((p) => p.name).join(', ')}
              </div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                <strong>Piano B:</strong>{' '}
                {c.pianoB.map((p) => `${p.name} (${fairMap.get(p.id)?.fair ?? '—'})`).join(' · ') ||
                  'N/D'}
              </div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                <strong>Piano C:</strong>{' '}
                {c.pianoC.map((p) => `${p.name} (${fairMap.get(p.id)?.fair ?? '—'})`).join(' · ') ||
                  'N/D'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2" style={{ marginTop: '0.85rem', alignItems: 'start' }}>
        <div className="stack">
          {SLOTS.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className="slot-card"
              style={{
                textAlign: 'left',
                borderColor: focusSlot === slot.id ? 'var(--accent)' : undefined,
                background: focusSlot === slot.id ? 'var(--accent-dim)' : undefined,
              }}
              onClick={() => setFocusSlot(slot.id)}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="slot-id">{slot.id}</span>
                <span className="tag">{slot.role}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: '0.88rem' }}>{slot.profile}</div>
            </button>
          ))}
        </div>

        <div className="panel" style={{ position: 'sticky', top: 64 }}>
          <div className="panel-title">
            Compatibili · {focusSlot} ({SLOTS.find((s) => s.id === focusSlot)?.profile})
          </div>
          <ul className="compat-list">
            {slotPlayers.map((p) => {
              const fair = fairMap.get(p.id)
              return (
                <li key={p.id}>
                  <span>
                    <strong>{p.name}</strong>
                    <span className="muted">
                      {' '}
                      · {p.team} · {p.tier}
                    </span>
                    {p.planMark && (
                      <span className="tag" style={{ marginLeft: 6 }}>
                        {p.planMark}
                      </span>
                    )}
                    <div className="mark-btns row" style={{ marginTop: 4 }}>
                      {MARKS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={p.planMark === m.id ? 'active' : ''}
                          onClick={(e) => {
                            e.stopPropagation()
                            setPlanMark(p.id, p.planMark === m.id ? null : m.id)
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </span>
                  <span className="mono">{fair?.fair ?? '—'}</span>
                </li>
              )
            })}
            {slotPlayers.length === 0 && <li className="muted">Nessun libero compatibile</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
