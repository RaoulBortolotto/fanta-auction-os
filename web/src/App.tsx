import { useState } from 'react'
import type { PageId } from './types'
import { Shell } from './components/Shell'
import { LivePage } from './pages/LivePage'
import { PlanPage } from './pages/PlanPage'
import { BoardPage } from './pages/BoardPage'
import { LeaguePage } from './pages/LeaguePage'
import { ModLabPage } from './pages/ModLabPage'
import { PenaltiesPage } from './pages/PenaltiesPage'
import { IntelPage } from './pages/IntelPage'
import { G1Page } from './pages/G1Page'
import { WatchPage } from './pages/WatchPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  const [page, setPage] = useState<PageId>('live')

  return (
    <Shell page={page} setPage={setPage}>
      {page === 'live' && <LivePage />}
      {page === 'piano' && <PlanPage />}
      {page === 'board' && <BoardPage />}
      {page === 'lega' && <LeaguePage />}
      {page === 'modlab' && <ModLabPage />}
      {page === 'rigoristi' && <PenaltiesPage />}
      {page === 'intel' && <IntelPage />}
      {page === 'g1' && <G1Page />}
      {page === 'watch' && <WatchPage />}
      {page === 'settings' && <SettingsPage />}
    </Shell>
  )
}
