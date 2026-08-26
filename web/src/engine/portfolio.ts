import type { Player, Role, Sale, Settings } from '../types'
import { effectiveScore } from './fairPrice'
import type { FairBundle } from '../types'

export interface PortfolioHealth {
  projectedSurplus: number
  fairTotal: number
  spent: number
  surplusPerCredit: number
  modReadyD: number
  voteD: number
  minutesC: number
  voteA: number
  rigoristi: number
  piazzati: number
  titolari: number
  europe: number
  injuryRisk: number
  clubConcentration: { team: string; count: number }[]
  capitalAtRisk: number
  switchOptions: number
  warnings: string[]
  deadCapitalIds: number[]
}

export function analyzePortfolio(
  mySales: Sale[],
  playersById: Map<number, Player>,
  fairMap: Map<number, FairBundle>,
  settings: Settings,
): PortfolioHealth {
  let fairTotal = 0
  let spent = 0
  let modReadyD = 0
  let voteD = 0
  let minutesC = 0
  let voteA = 0
  let rigoristi = 0
  let piazzati = 0
  let titolari = 0
  let europe = 0
  let injuryRisk = 0
  let capitalAtRisk = 0
  let switchOptions = 0
  const clubs = new Map<string, number>()
  const deadCapitalIds: number[] = []
  const warnings: string[] = []

  for (const s of mySales) {
    const p = playersById.get(s.playerId)
    if (!p) continue
    const fair = fairMap.get(p.id)?.fair ?? s.fairAtSale
    fairTotal += fair
    spent += s.price
    clubs.set(p.team, (clubs.get(p.team) ?? 0) + 1)

    if (p.role === 'D') {
      if ((p.modProfile?.voteConsistencyProxy ?? 0) >= 12 || (p.qtA ?? 0) >= 8) modReadyD++
      if ((p.qtA ?? 0) >= 5 || p.starterLikely === 'titolare') voteD++
    }
    if (p.role === 'C' && ((p.qtA ?? 0) >= 5 || p.starterLikely === 'titolare')) minutesC++
    if (p.role === 'A' && ((p.qtA ?? 0) >= 6 || p.starterLikely === 'titolare')) voteA++
    if (p.penalty.rank != null && p.penalty.confidence >= 40) rigoristi++
    if (p.setPieces.fk != null || p.setPieces.corners != null) piazzati++
    if (p.starterLikely === 'titolare' || (p.qtA ?? 0) >= 8) titolari++
    if (p.europe) europe++
    if (['minor', 'medium', 'long', 'uncertain'].includes(p.injury.status) || p.marketRisk) {
      injuryRisk++
      capitalAtRisk += s.price
      deadCapitalIds.push(p.id)
    }
    if (p.starterLikely === 'riserva' && s.price >= 8) {
      capitalAtRisk += s.price
      deadCapitalIds.push(p.id)
    }
    if (p.switchCandidate) switchOptions++
  }

  const projectedSurplus = fairTotal - spent
  const surplusPerCredit = spent > 0 ? projectedSurplus / spent : 0
  const clubConcentration = [...clubs.entries()]
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count)

  const dOwned = mySales.filter((s) => s.role === 'D').length
  const cOwned = mySales.filter((s) => s.role === 'C').length
  const aOwned = mySales.filter((s) => s.role === 'A').length

  if (dOwned >= 4 && modReadyD < 4) warnings.push('Meno di 4 D con buon profilo MOD')
  if (dOwned >= 6 && voteD < 6) warnings.push('Meno di 6 D con possibilità di voto')
  if (cOwned >= 5 && minutesC < 5) warnings.push('Meno di 5 C con minuti credibili')
  if (aOwned >= 4 && voteA < 4) warnings.push('Meno di 4 A con voto credibile')
  if (injuryRisk > 3) warnings.push('Troppi profili high injury/rotation/market')
  if (rigoristi === 0 && mySales.length >= 8) warnings.push('Zero/pochi rigoristi in rosa')
  for (const c of clubConcentration) {
    if (c.count >= 4) warnings.push(`Concentrazione club: ${c.count} da ${c.team}`)
  }

  // budget deviation
  for (const role of ['P', 'D', 'C', 'A'] as Role[]) {
    const spend = mySales.filter((s) => s.role === role).reduce((a, s) => a + s.price, 0)
    const plan = settings.budgetPlan[role]
    if (spend > plan * 1.15 && mySales.filter((s) => s.role === role).length >= 2) {
      warnings.push(`Reparto ${role} sopra budget piano (+${spend - plan})`)
    }
  }

  return {
    projectedSurplus,
    fairTotal,
    spent,
    surplusPerCredit,
    modReadyD,
    voteD,
    minutesC,
    voteA,
    rigoristi,
    piazzati,
    titolari,
    europe,
    injuryRisk,
    clubConcentration,
    capitalAtRisk,
    switchOptions,
    warnings,
    deadCapitalIds: [...new Set(deadCapitalIds)],
  }
}

export function topReasons(p: Player): string[] {
  const reasons: string[] = []
  if (p.role === 'D' && (p.modProfile?.voteConsistencyProxy ?? 0) > 10) reasons.push('MOD consistency proxy')
  if (p.starterLikely === 'titolare' || (p.qtA ?? 0) >= 10) reasons.push('Titolarità / quotazione alta')
  if (p.penalty.rank != null) reasons.push(`Penalty upside (rank ${p.penalty.rank}, conf ${p.penalty.confidence})`)
  if (p.setPieces.fk != null) reasons.push('Piazzati / FK')
  if (p.europe) reasons.push('Competizioni europee')
  if (p.g1?.status === 'PROMOZIONE_REALE') reasons.push('G1: promozione reale')
  if (p.fvm && p.qtA && p.fvm / Math.max(1, p.qtA) > 8) reasons.push('FVM elevato vs quotazione')
  if (p.switchCandidate) reasons.push('Switch candidate')
  while (reasons.length < 3) {
    if (reasons.length === 0) reasons.push(`Score proxy ${p.baseScore.toFixed(1)}`)
    else if (reasons.length === 1) reasons.push(`Tier ${p.tier}`)
    else reasons.push(`Confidence ${p.confidence}`)
  }
  return reasons.slice(0, 3)
}

export function topRisks(p: Player): string[] {
  const risks: string[] = []
  if (p.injury.status !== 'healthy') risks.push(`Infortunio: ${p.injury.status}`)
  if (p.marketRisk) risks.push('Rischio mercato')
  if (p.g1?.status === 'HYPE_GUARD') risks.push('Hype G1')
  if (p.penalty.divergence) risks.push('Divergenza gerarchia rigori')
  if (p.confidence === 'low') risks.push('Confidence bassa / campione limitato')
  if (p.starterLikely === 'ballottaggio') risks.push('Ballottaggio')
  if (p.europe) risks.push('Rotazioni europee possibili')
  if (!risks.length) risks.push('Prezzo/hype di mercato da monitorare')
  return risks.slice(0, 4)
}

export function suggestPivot(
  sales: Sale[],
  players: Player[],
  fairMap: Map<number, FairBundle>,
  settings: Settings,
): string | null {
  const soldA = sales.filter((s) => s.role === 'A')
  const eliteA = players.filter((p) => p.role === 'A' && p.tier === 'elite')
  const eliteSold = eliteA.filter((p) => soldA.some((s) => s.playerId === p.id))
  const eliteFree = eliteA.filter((p) => !sales.some((s) => s.playerId === p.id))

  const underFair = eliteSold.filter((p) => {
    const s = soldA.find((x) => x.playerId === p.id)!
    const f = fairMap.get(p.id)?.fair ?? s.fairAtSale
    return s.price <= f
  })
  if (underFair.length >= 1 && settings.budgetTemplate !== 'eliteA') {
    return 'Un A elite è caduto ≤ Fair → valuta template Elite Attacker Opportunity (A 250).'
  }

  const overMax = eliteFree.length === 0 && eliteSold.every((p) => {
    const s = soldA.find((x) => x.playerId === p.id)!
    const f = fairMap.get(p.id)?.fair ?? s.fairAtSale
    return s.price > f * 1.15
  })
  if (eliteSold.length >= 3 && overMax && settings.budgetTemplate !== 'deepValue') {
    return 'Supertop A strapagati → suggerito No Supertop / Deep Value (A 210, C/D più profondi).'
  }

  const cSales = sales.filter((s) => s.role === 'C' && s.tier === 'elite')
  if (cSales.length >= 3) {
    const infl = cSales.reduce((a, s) => a + s.price / Math.max(1, s.fairAtSale), 0) / cSales.length
    if (infl >= 1.2) {
      return 'C top +20% inflazionati → non inseguire; sposta budget verso A/D value.'
    }
  }

  const dSales = sales.filter((s) => s.role === 'D')
  if (dSales.length >= 3) {
    const infl = dSales.reduce((a, s) => a + s.price / Math.max(1, s.fairAtSale), 0) / dSales.length
    if (infl <= 0.9) {
      return 'D MOD sottopagati in stanza → puoi spendere extra in difesa rispetto al piano.'
    }
  }

  void effectiveScore
  return null
}
