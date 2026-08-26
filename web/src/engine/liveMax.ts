import type { LiveMaxBundle, Player, Role, Sale, Settings, Tier } from '../types'
import type { FairBundle } from '../types'
import { TOTAL_SLOTS } from '../defaults'

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

export function inflationFor(
  sales: Sale[],
  role: Role,
  tier?: Tier,
): { inflation: number | null; sampleSize: number } {
  const comparable = sales.filter(
    (s) => s.role === role && s.fairAtSale > 0 && (tier ? s.tier === tier : true),
  )
  if (comparable.length < 3) {
    // try role-only if tier too sparse
    if (tier) return inflationFor(sales, role, undefined)
    return { inflation: null, sampleSize: comparable.length }
  }
  const ratios = comparable.map((s) => s.price / s.fairAtSale)
  const raw = median(ratios)
  if (raw == null) return { inflation: null, sampleSize: comparable.length }
  return {
    inflation: clamp(raw, 0.75, 1.35),
    sampleSize: comparable.length,
  }
}

export function computeLiveMax(opts: {
  player: Player
  fair: FairBundle
  settings: Settings
  sales: Sale[]
  myRemainingCredits: number
  myRemainingSlots: number
  myRoleOwned: number
  myRoleBudgetLeft: number
  freeAlternatives: number
  roleAlmostDone: boolean
}): LiveMaxBundle {
  const { player, fair, settings, sales } = opts
  const { inflation, sampleSize } = inflationFor(sales, player.role, player.tier)

  const absorbed =
    inflation == null
      ? 1
      : 1 + settings.inflationAbsorption * (inflation - 1)

  let scarcity = 1
  if (opts.freeAlternatives >= 5) scarcity = 1.0
  else if (opts.freeAlternatives >= 3) scarcity = 1.03
  else if (opts.freeAlternatives === 2) scarcity = 1.06
  else scarcity = 1.1

  const needSlots = settings.slots[player.role]
  const owned = opts.myRoleOwned
  let need = 1
  if (owned >= needSlots) need = 0.95
  else if (owned === 0 && opts.roleAlmostDone) need = 1.1
  else if (owned < needSlots / 2) need = 1.04

  const plan = settings.budgetPlan[player.role]
  const spentRatio = plan > 0 ? 1 - opts.myRoleBudgetLeft / plan : 1
  let budgetFactor = 1
  if (spentRatio > 1.15) budgetFactor = 0.88
  else if (spentRatio > 1.05) budgetFactor = 0.92
  else if (spentRatio < 0.5 && opts.roleAlmostDone) budgetFactor = 1.04

  let liveMax = fair.fair * absorbed * scarcity * need * budgetFactor

  const extremeScarce = opts.freeAlternatives <= 1
  const lo = fair.fair * 0.8
  const hi = fair.fair * (extremeScarce ? 1.25 : 1.2)
  liveMax = clamp(liveMax, lo, hi)

  const financialMax = Math.max(0, opts.myRemainingCredits - (opts.myRemainingSlots - 1))
  const finalLiveMax = Math.min(Math.round(liveMax), financialMax)

  return {
    liveMax: Math.round(liveMax),
    financialMax,
    finalLiveMax: Math.max(0, finalLiveMax),
    inflation,
    absorbed,
    scarcity,
    need,
    budgetFactor,
    sampleSize,
  }
}

export function financialMax(credits: number, slotsLeft: number) {
  return Math.max(0, credits - (slotsLeft - 1))
}

export function teamEconomy(
  teamId: string,
  sales: Sale[],
  settings: Settings,
) {
  const mine = sales.filter((s) => s.teamId === teamId)
  const spent = mine.reduce((s, x) => s + x.price, 0)
  const slotsLeft = TOTAL_SLOTS - mine.length
  const credits = settings.budget - spent
  const byRole = { P: 0, D: 0, C: 0, A: 0 }
  const spendRole = { P: 0, D: 0, C: 0, A: 0 }
  for (const s of mine) {
    byRole[s.role]++
    spendRole[s.role] += s.price
  }
  return {
    spent,
    credits,
    slotsLeft,
    owned: mine.length,
    byRole,
    spendRole,
    maxBid: financialMax(credits, slotsLeft),
    purchases: mine,
  }
}
