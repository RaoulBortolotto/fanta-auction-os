import type { BudgetByRole, ModelWeights, Settings } from './types'

export const ROLE_SLOTS: BudgetByRole = { P: 3, D: 8, C: 8, A: 6 }
export const TOTAL_SLOTS = 25

export const TEMPLATES: Record<string, BudgetByRole> = {
  balanced: { P: 40, D: 100, C: 130, A: 230 },
  eliteA: { P: 35, D: 95, C: 120, A: 250 },
  deepValue: { P: 40, D: 105, C: 145, A: 210 },
}

export const DEFAULT_WEIGHTS: ModelWeights = {
  gk: { cs: 0.3, vote: 0.3, titolarita: 0.15, saves: 0.1, context: 0.1, risk: 0.05 },
  def: { mod: 0.3, minutes: 0.2, bonus: 0.2, teamDef: 0.1, setPiece: 0.1, discipline: 0.1 },
  mid: { bonus: 0.25, minutes: 0.2, tactical: 0.15, setPiece: 0.15, vote: 0.1, reliability: 0.1, attack: 0.05 },
  att: { goals: 0.3, minutes: 0.2, penalties: 0.15, teamAtt: 0.1, assists: 0.1, reliability: 0.1, tactical: 0.05 },
}

export function defaultSettings(): Settings {
  return {
    teams: 10,
    budget: 500,
    slots: { ...ROLE_SLOTS },
    budgetTemplate: 'balanced',
    budgetPlan: { ...TEMPLATES.balanced },
    switchMode: 'plus',
    voteSource: 'Fantacalcio Italia',
    officeReserveGk: false,
    cleanSheetBonus: 1,
    goalBand: 6,
    maxSubs: 5,
    modThresholds: { plus1: [6.0, 6.49], plus3: [6.5, 6.99], plus5: 7.0 },
    alpha: 1.05,
    inflationAbsorption: 0.55,
    inflationClamp: [0.75, 1.35],
    penaltyConversion: 0.764,
    theme: 'dark',
    weights: structuredClone(DEFAULT_WEIGHTS),
    replacementPurchased: { P: 30, D: 80, C: 80, A: 60 },
    replacementStarters: { P: 10, D: 40, C: 30, A: 30 },
  }
}

export function defaultLeague() {
  return [
    { id: 'me', name: 'IO', isMe: true },
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `r${i + 1}`,
      name: `Rivale ${i + 1}`,
      isMe: false,
    })),
  ]
}

export const STORAGE_KEY = 'fanta-auction-os-v1'
export const DATA_AS_OF = '2026-08-26'
