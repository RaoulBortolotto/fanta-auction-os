import type { FairBundle, Player, Role, Settings } from '../types'

/** Effective score after G1 adjustment and injury discount proxies. */
export function effectiveScore(p: Player): number {
  let s = p.baseScore
  if (p.g1?.adjustmentPct != null) {
    s *= 1 + p.g1.adjustmentPct / 100
  }
  if (p.injury.status === 'minor') s *= 0.95
  if (p.injury.status === 'medium') s *= 0.85
  if (p.injury.status === 'long') s *= 0.7
  if (p.injury.status === 'uncertain' || p.injury.status === 'market_risk') s *= 0.9
  if (p.injury.requiredDiscountPct != null) s *= 1 - p.injury.requiredDiscountPct / 100
  // Penalty confidence soft bump (not +3 auto)
  if (p.penalty.rank === 1 && p.penalty.confidence >= 70) s *= 1.04
  else if (p.penalty.rank === 1) s *= 1.02
  else if (p.penalty.rank === 2 && p.penalty.confidence >= 45) s *= 1.01
  return Math.max(0.1, s)
}

export function rolePlayers(players: Player[], role: Role, soldIds: Set<number>) {
  return players.filter((p) => p.role === role && !soldIds.has(p.id))
}

/**
 * VORP fair price:
 * Fair_i = 1 + DiscretionaryRolePool × VAR^α / Σ(VAR^α)
 * RolePool = budget_reparto × teams
 * Replacement = N-th purchased player score in role (P30/D80/C80/A60)
 */
export function computeFairMap(
  players: Player[],
  settings: Settings,
  soldIds: Set<number> = new Set(),
): Map<number, FairBundle> {
  const map = new Map<number, FairBundle>()
  const roles: Role[] = ['P', 'D', 'C', 'A']

  for (const role of roles) {
    const all = players
      .filter((p) => p.role === role)
      .map((p) => ({ p, score: effectiveScore(p) }))
      .sort((a, b) => b.score - a.score)

    const nRep = settings.replacementPurchased[role]
    const replacementScore =
      all.length >= nRep ? all[nRep - 1].score : all.length ? all[all.length - 1].score : 0

    const withVar = all.map(({ p, score }) => ({
      p,
      score,
      var: Math.max(0, score - replacementScore),
    }))

    const rolePool = settings.budgetPlan[role] * settings.teams
    const purchasable = Math.min(nRep, withVar.length)
    const discretionary = Math.max(0, rolePool - purchasable * 1)
    const alpha = settings.alpha
    const sumPow = withVar.reduce((s, x) => s + Math.pow(x.var, alpha), 0) || 1

    for (const x of withVar) {
      const share = sumPow > 0 ? Math.pow(x.var, alpha) / sumPow : 0
      const fairRaw = 1 + discretionary * share
      // Soft blend with FVM scale for readability in 500-credit leagues
      const fvmHint = x.p.fvm != null ? Math.max(1, Math.round(x.p.fvm / 10)) : fairRaw
      const qtHint = x.p.qtA != null ? x.p.qtA : fairRaw
      // Weighted: model 70%, fvm hint 20%, qt 10% — still formula-driven, not vibes
      let fair = 0.7 * fairRaw + 0.2 * fvmHint + 0.1 * qtHint
      fair = Math.max(1, Math.round(fair))

      const rangeLow = Math.max(1, Math.round(fair * 0.88))
      const rangeHigh = Math.round(fair * 1.08)
      const affare = Math.max(1, Math.round(fair * 0.8))
      const limite = Math.round(fair * 1.12)
      const stop = Math.max(limite + 1, Math.round(fair * 1.2))

      map.set(x.p.id, {
        fair,
        rangeLow,
        rangeHigh,
        affare,
        limite,
        stop,
        score: x.score,
        var: x.var,
        replacementScore,
      })
    }
  }

  // Ensure sold players still have fair for history
  for (const p of players) {
    if (!map.has(p.id)) {
      map.set(p.id, {
        fair: Math.max(1, p.qtA ?? 1),
        rangeLow: 1,
        rangeHigh: Math.max(1, p.qtA ?? 1),
        affare: 1,
        limite: Math.max(1, p.qtA ?? 1),
        stop: Math.max(2, (p.qtA ?? 1) + 1),
        score: effectiveScore(p),
        var: 0,
        replacementScore: 0,
      })
    }
  }

  void soldIds
  return map
}

export function starterVorp(score: number, role: Role, players: Player[], settings: Settings): number {
  const sorted = players
    .filter((p) => p.role === role)
    .map(effectiveScore)
    .sort((a, b) => b - a)
  const n = settings.replacementStarters[role]
  const rep = sorted.length >= n ? sorted[n - 1] : 0
  return Math.max(0, score - rep)
}

export function rosterVorp(score: number, role: Role, players: Player[], settings: Settings): number {
  const sorted = players
    .filter((p) => p.role === role)
    .map(effectiveScore)
    .sort((a, b) => b - a)
  const n = settings.replacementPurchased[role]
  const rep = sorted.length >= n ? sorted[n - 1] : 0
  return Math.max(0, score - rep)
}
