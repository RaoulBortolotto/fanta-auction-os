import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import rawPlayers from '../data/players.json'
import rawTeams from '../data/teams.json'
import rawMeta from '../data/meta.json'
import type {
  AuctionState,
  FairBundle,
  PlanMark,
  Player,
  Role,
  Sale,
  Settings,
  TeamIntel,
} from '../types'
import { DATA_AS_OF, STORAGE_KEY, TEMPLATES, defaultLeague, defaultSettings } from '../defaults'
import { computeFairMap } from '../engine/fairPrice'
import { computeLiveMax, teamEconomy } from '../engine/liveMax'
import { analyzePortfolio, suggestPivot, topReasons, topRisks } from '../engine/portfolio'
import { verdict } from '../engine/verdict'
import { buildSearcher, ALIASES } from '../lib/search'
import { TOTAL_SLOTS } from '../defaults'

const basePlayers = rawPlayers as Player[]
const teamsIntel = rawTeams as TeamIntel[]
const meta = rawMeta as Record<string, unknown>

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyState(): AuctionState {
  return {
    version: 1,
    settings: defaultSettings(),
    league: defaultLeague(),
    sales: [],
    planMarks: {},
    playerEdits: {},
    watchNotes: {},
    customPlayers: [],
    undoStack: [],
    redoStack: [],
    lastPivotReason: null,
  }
}

function loadState(): AuctionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as AuctionState
    if (parsed.version !== 1) return emptyState()
    return { ...emptyState(), ...parsed, settings: { ...defaultSettings(), ...parsed.settings } }
  } catch {
    return emptyState()
  }
}

type Listener = () => void
let state = loadState()
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((l) => l())
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota */
  }
}

function pushUndo() {
  const snap = JSON.stringify({
    sales: state.sales,
    league: state.league,
    settings: state.settings,
    planMarks: state.planMarks,
    playerEdits: state.playerEdits,
    watchNotes: state.watchNotes,
    customPlayers: state.customPlayers,
    lastPivotReason: state.lastPivotReason,
  })
  state = {
    ...state,
    undoStack: [...state.undoStack.slice(-49), snap],
    redoStack: [],
  }
}

function setState(partial: Partial<AuctionState> | ((s: AuctionState) => AuctionState), withUndo = true) {
  if (withUndo) pushUndo()
  state = typeof partial === 'function' ? partial(state) : { ...state, ...partial }
  emit()
}

export function getAuctionState() {
  return state
}

export function subscribeAuction(cb: Listener) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useAuctionStore() {
  const snap = useSyncExternalStore(subscribeAuction, getAuctionState, getAuctionState)

  const allPlayers = useMemo(() => {
    const edits = snap.playerEdits
    const merged = [
      ...basePlayers.map((p) => ({ ...p, ...edits[p.id], planMark: snap.planMarks[p.id] ?? null })),
      ...snap.customPlayers.map((p) => ({ ...p, planMark: snap.planMarks[p.id] ?? null })),
    ]
    return merged
  }, [snap.playerEdits, snap.customPlayers, snap.planMarks])

  const playersById = useMemo(() => {
    const m = new Map<number, Player>()
    allPlayers.forEach((p) => m.set(p.id, p))
    return m
  }, [allPlayers])

  const soldIds = useMemo(() => new Set(snap.sales.map((s) => s.playerId)), [snap.sales])

  const fairMap = useMemo(
    () => computeFairMap(allPlayers, snap.settings, soldIds),
    [allPlayers, snap.settings, soldIds],
  )

  const fuse = useMemo(() => buildSearcher(allPlayers), [allPlayers])

  const me = snap.league.find((t) => t.isMe)!
  const myEco = useMemo(() => teamEconomy(me.id, snap.sales, snap.settings), [me.id, snap.sales, snap.settings])

  const portfolio = useMemo(
    () => analyzePortfolio(myEco.purchases, playersById, fairMap, snap.settings),
    [myEco.purchases, playersById, fairMap, snap.settings],
  )

  const pivot = useMemo(
    () => suggestPivot(snap.sales, allPlayers, fairMap, snap.settings),
    [snap.sales, allPlayers, fairMap, snap.settings],
  )

  const search = useCallback(
    (q: string) => {
      const alias = ALIASES[q.trim().toLowerCase()]
      const query = alias ?? q
      return fuse.search(query, { limit: 8 }).map((r) => r.item)
    },
    [fuse],
  )

  const getLiveBundle = useCallback(
    (player: Player) => {
      const fair = fairMap.get(player.id)!
      const freeAlts = allPlayers.filter(
        (p) =>
          p.role === player.role &&
          p.tier === player.tier &&
          !soldIds.has(p.id) &&
          p.id !== player.id,
      ).length
      const roleSold = snap.sales.filter((s) => s.role === player.role).length
      const roleAlmostDone = roleSold >= snap.settings.teams * snap.settings.slots[player.role] * 0.7
      const live = computeLiveMax({
        player,
        fair,
        settings: snap.settings,
        sales: snap.sales,
        myRemainingCredits: myEco.credits,
        myRemainingSlots: myEco.slotsLeft,
        myRoleOwned: myEco.byRole[player.role],
        myRoleBudgetLeft: snap.settings.budgetPlan[player.role] - myEco.spendRole[player.role],
        freeAlternatives: freeAlts,
        roleAlmostDone,
      })
      return { fair, live, reasons: topReasons(player), risks: topRisks(player) }
    },
    [fairMap, allPlayers, soldIds, snap.sales, snap.settings, myEco],
  )

  const alternatives = useCallback(
    (player: Player, n = 6) => {
      const fairP = fairMap.get(player.id)?.fair ?? 0
      return allPlayers
        .filter((p) => p.role === player.role && !soldIds.has(p.id) && p.id !== player.id)
        .map((p) => {
          const f = fairMap.get(p.id)!
          const live = getLiveBundle(p).live
          return {
            player: p,
            fair: f.fair,
            liveMax: live.finalLiveMax,
            ev: p.baseScore,
            confidence: p.confidence,
            mod: p.modProfile?.voteConsistencyProxy ?? null,
            penalty: p.penalty.confidence,
            save: fairP - f.fair,
          }
        })
        .sort((a, b) => Math.abs(a.fair - fairP) - Math.abs(b.fair - fairP) || b.fair - a.fair)
        .slice(0, n)
    },
    [allPlayers, soldIds, fairMap, getLiveBundle],
  )

  const recordSale = useCallback(
    (playerId: number, teamId: string, price: number) => {
      const p = playersById.get(playerId)
      if (!p) return { ok: false, error: 'Giocatore non trovato' }
      if (soldIds.has(playerId)) return { ok: false, error: 'Già venduto' }
      const eco = teamEconomy(teamId, snap.sales, snap.settings)
      if (price < 1) return { ok: false, error: 'Prezzo minimo 1' }
      if (price > eco.maxBid) return { ok: false, error: `Max finanziario ${eco.maxBid}` }
      if (eco.slotsLeft <= 0) return { ok: false, error: 'Rosa piena' }
      if (eco.byRole[p.role] >= snap.settings.slots[p.role]) {
        return { ok: false, error: `Slot ${p.role} pieni` }
      }
      const fair = fairMap.get(playerId)?.fair ?? p.qtA ?? 1
      const sale: Sale = {
        id: uid(),
        playerId,
        teamId,
        price,
        role: p.role,
        tier: p.tier,
        fairAtSale: fair,
        ts: Date.now(),
      }
      setState((s) => {
        const next = { ...s, sales: [...s.sales, sale] }
        const reason = suggestPivot(next.sales, allPlayers, fairMap, s.settings)
        return { ...next, lastPivotReason: reason }
      })
      return { ok: true as const }
    },
    [playersById, soldIds, snap.sales, snap.settings, fairMap, allPlayers],
  )

  const undoSale = useCallback(() => {
    setState((s) => {
      if (!s.undoStack.length) return s
      const prev = s.undoStack[s.undoStack.length - 1]
      const parsed = JSON.parse(prev)
      const redo = JSON.stringify({
        sales: s.sales,
        league: s.league,
        settings: s.settings,
        planMarks: s.planMarks,
        playerEdits: s.playerEdits,
        watchNotes: s.watchNotes,
        customPlayers: s.customPlayers,
        lastPivotReason: s.lastPivotReason,
      })
      return {
        ...s,
        ...parsed,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, redo],
      }
    }, false)
  }, [])

  const redo = useCallback(() => {
    setState((s) => {
      if (!s.redoStack.length) return s
      const next = s.redoStack[s.redoStack.length - 1]
      const parsed = JSON.parse(next)
      const undo = JSON.stringify({
        sales: s.sales,
        league: s.league,
        settings: s.settings,
        planMarks: s.planMarks,
        playerEdits: s.playerEdits,
        watchNotes: s.watchNotes,
        customPlayers: s.customPlayers,
        lastPivotReason: s.lastPivotReason,
      })
      return {
        ...s,
        ...parsed,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, undo],
      }
    }, false)
  }, [])

  const deleteSale = useCallback((saleId: string) => {
    setState((s) => ({ ...s, sales: s.sales.filter((x) => x.id !== saleId) }))
  }, [])

  const editSale = useCallback((saleId: string, patch: Partial<Sale>) => {
    setState((s) => ({
      ...s,
      sales: s.sales.map((x) => (x.id === saleId ? { ...x, ...patch } : x)),
    }))
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  const applyTemplate = useCallback((id: keyof typeof TEMPLATES | 'custom') => {
    if (id === 'custom') {
      setState((s) => ({ ...s, settings: { ...s.settings, budgetTemplate: 'custom' as const } }))
      return
    }
    const tid = id as 'balanced' | 'eliteA' | 'deepValue'
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        budgetTemplate: tid,
        budgetPlan: { ...TEMPLATES[tid] },
      },
    }))
  }, [])

  const renameTeam = useCallback((id: string, name: string) => {
    setState((s) => ({
      ...s,
      league: s.league.map((t) => (t.id === id ? { ...t, name } : t)),
    }))
  }, [])

  const setPlanMark = useCallback((playerId: number, mark: PlanMark | null) => {
    setState((s) => {
      const planMarks = { ...s.planMarks }
      if (!mark) delete planMarks[playerId]
      else planMarks[playerId] = mark
      return { ...s, planMarks }
    })
  }, [])

  const editPlayer = useCallback((playerId: number, patch: Partial<Player>) => {
    setState((s) => ({
      ...s,
      playerEdits: { ...s.playerEdits, [playerId]: { ...s.playerEdits[playerId], ...patch } },
    }))
  }, [])

  const addCustomPlayer = useCallback(
    (partial: { name: string; role: Player['role']; team: string; id?: number; qtA?: number }) => {
      const id = partial.id ?? Date.now()
      const p: Player = {
        id,
        name: partial.name,
        role: partial.role,
        team: partial.team,
        searchKeys: [partial.name.toLowerCase(), partial.team.toLowerCase(), partial.role],
        tier: 'min',
        baseScore: 1,
        floorScore: 0.85,
        ceilScore: 1.15,
        confidence: 'low',
        tags: ['CUSTOM'],
        penalty: {
          rank: null,
          confidence: 0,
          attemptsExpected: null,
          sources: [],
          divergence: false,
          note: null,
        },
        setPieces: { fk: null, corners: null, sources: [], note: null },
        g1: null,
        injury: {
          status: 'healthy',
          expectedMissed: null,
          requiredDiscountPct: null,
          note: null,
          lastUpdate: DATA_AS_OF,
        },
        marketRisk: false,
        europe: null,
        starterLikely: null,
        modProfile:
          partial.role === 'D'
            ? { voteConsistencyProxy: 1, pct65plus: null, note: 'N/D' }
            : null,
        switchCandidate: false,
        notes: ['Aggiunto manualmente'],
        lastUpdate: DATA_AS_OF,
        qtA: partial.qtA ?? 1,
        qtI: partial.qtA ?? 1,
        diff: 0,
        fvm: 1,
        fvmM: 1,
        rm: null,
      }
      setState((s) => ({ ...s, customPlayers: [...s.customPlayers, p] }))
      return id
    },
    [],
  )

  const exportJson = useCallback(() => JSON.stringify(snap, null, 2), [snap])

  const importJson = useCallback((text: string) => {
    const parsed = JSON.parse(text) as AuctionState
    setState(() => ({ ...emptyState(), ...parsed }), true)
  }, [])

  const exportCsv = useCallback(() => {
    const header = 'saleId,player,role,team,buyer,price,fairAtSale,ts\n'
    const lines = snap.sales.map((s) => {
      const p = playersById.get(s.playerId)
      const buyer = snap.league.find((t) => t.id === s.teamId)?.name ?? s.teamId
      return [s.id, p?.name, s.role, p?.team, buyer, s.price, s.fairAtSale, new Date(s.ts).toISOString()].join(',')
    })
    return header + lines.join('\n')
  }, [snap.sales, snap.league, playersById])

  const exportRoster = useCallback(() => {
    const rows = myEco.purchases.map((s) => {
      const p = playersById.get(s.playerId)!
      return `${p.role},${p.name},${p.team},${s.price}`
    })
    return 'role,name,team,price\n' + rows.join('\n')
  }, [myEco.purchases, playersById])

  const resetAll = useCallback(() => {
    if (!confirm('Reset completo? Perdi vendite, note e impostazioni salvate.')) return
    state = emptyState()
    emit()
  }, [])

  const threatAnalysis = useCallback(
    (player: Player, myBid: number) => {
      return snap.league
        .filter((t) => !t.isMe)
        .map((t) => {
          const eco = teamEconomy(t.id, snap.sales, snap.settings)
          const needsRole = eco.byRole[player.role] < snap.settings.slots[player.role]
          const canPay = eco.maxBid >= myBid && eco.slotsLeft > 0
          return { team: t, eco, needsRole, canPay, interested: needsRole && canPay && eco.maxBid >= myBid }
        })
        .filter((x) => x.canPay)
        .sort((a, b) => b.eco.maxBid - a.eco.maxBid)
    },
    [snap.league, snap.sales, snap.settings],
  )

  const whatIf = useCallback(
    (player: Player, price: number) => {
      const creditsAfter = myEco.credits - price
      const slotsAfter = myEco.slotsLeft - 1
      const avg = slotsAfter > 0 ? creditsAfter / slotsAfter : 0
      const spendRole = { ...myEco.spendRole, [player.role]: myEco.spendRole[player.role] + price }
      const planLeft = {
        P: snap.settings.budgetPlan.P - spendRole.P,
        D: snap.settings.budgetPlan.D - spendRole.D,
        C: snap.settings.budgetPlan.C - spendRole.C,
        A: snap.settings.budgetPlan.A - spendRole.A,
      }
      const warnings: string[] = []
      const aLeft = planLeft.A
      if (aLeft < 80 && myEco.byRole.A < 2) {
        warnings.push(`ATTENZIONE: per mantenere piano A1+A2 dovresti risparmiare nei prossimi ${player.role}.`)
      }
      return {
        creditsAfter,
        slotsAfter,
        avgPerSlot: Math.round(avg * 10) / 10,
        planLeft,
        financialMaxAfter: Math.max(0, creditsAfter - (slotsAfter - 1)),
        warnings,
        summary: `Comprando ${player.name} a ${price} puoi ancora allocare ${planLeft.A} A / ${planLeft.C} C / ${planLeft.D} D / ${planLeft.P} P (piano).`,
      }
    },
    [myEco, snap.settings],
  )

  // theme
  useEffect(() => {
    document.documentElement.dataset.theme = snap.settings.theme
  }, [snap.settings.theme])

  return {
    state: snap,
    meta,
    teamsIntel,
    dataAsOf: DATA_AS_OF,
    allPlayers,
    playersById,
    soldIds,
    fairMap,
    me,
    myEco,
    portfolio,
    pivot,
    search,
    getLiveBundle,
    alternatives,
    recordSale,
    undoSale,
    redo,
    deleteSale,
    editSale,
    updateSettings,
    applyTemplate,
    renameTeam,
    setPlanMark,
    editPlayer,
    addCustomPlayer,
    exportJson,
    importJson,
    exportCsv,
    exportRoster,
    resetAll,
    threatAnalysis,
    whatIf,
    verdict,
    TOTAL_SLOTS,
    teamEconomy: (id: string) => teamEconomy(id, snap.sales, snap.settings),
  }
}

export type AuctionStore = ReturnType<typeof useAuctionStore>
