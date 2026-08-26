import type { ReactNode } from 'react'
import type { PageId } from '../types'
import { useAuctionStore } from '../store/useAuctionStore'

const NAV: { id: PageId; label: string; key: string }[] = [
  { id: 'live', label: 'Live', key: '01' },
  { id: 'piano', label: 'Piano', key: '02' },
  { id: 'board', label: 'Board', key: '03' },
  { id: 'lega', label: 'Lega', key: '04' },
  { id: 'modlab', label: 'MOD Lab', key: '05' },
  { id: 'rigoristi', label: 'Rigoristi', key: '06' },
  { id: 'intel', label: 'Team Intel', key: '07' },
  { id: 'g1', label: 'G1/Young', key: '08' },
  { id: 'watch', label: 'Watch', key: '09' },
  { id: 'settings', label: 'Settings', key: '10' },
]

interface ShellProps {
  page: PageId
  setPage: (p: PageId) => void
  children: ReactNode
}

export function Shell({ page, setPage, children }: ShellProps) {
  const { myEco, TOTAL_SLOTS, dataAsOf } = useAuctionStore()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">Fanta Auction OS</div>
          <div className="brand-sub">Serie A · 2026/27 · {dataAsOf}</div>
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`nav-item${page === n.id ? ' active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span className="nav-key">{n.key}</span>
            {n.label}
          </button>
        ))}
      </aside>

      <header className="topbar">
        <div className="mono dim" style={{ fontSize: '0.8rem' }}>
          {NAV.find((n) => n.id === page)?.label ?? page}
        </div>
        <div className="topbar-stats">
          <div>
            Budget <strong>{myEco.credits}</strong>
          </div>
          <div>
            Slot{' '}
            <strong>
              {TOTAL_SLOTS - myEco.slotsLeft}/{TOTAL_SLOTS}
            </strong>
          </div>
          <div>
            Max bid <strong>{myEco.maxBid}</strong>
          </div>
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="bottom-nav" aria-label="Navigazione">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`nav-item${page === n.id ? ' active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
