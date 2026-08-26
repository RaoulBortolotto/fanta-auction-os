export type Role = 'P' | 'D' | 'C' | 'A'
export type Tier = 'elite' | 'high' | 'mid' | 'low' | 'min'
export type Confidence = 'high' | 'medium' | 'low'
export type PageId =
  | 'live'
  | 'piano'
  | 'board'
  | 'lega'
  | 'modlab'
  | 'rigoristi'
  | 'intel'
  | 'g1'
  | 'watch'
  | 'settings'

export type BudgetTemplateId = 'balanced' | 'eliteA' | 'deepValue' | 'custom'

export interface PenaltyInfo {
  rank: 1 | 2 | 3 | null
  confidence: number
  attemptsExpected: number | null
  sources: { name: string; order: string[]; date: string }[]
  divergence: boolean
  note: string | null
}

export interface G1Info {
  status: 'PROMOZIONE_REALE' | 'WATCH' | 'HYPE_GUARD' | 'GERARCHIA_APERTA' | null
  minutes: number | null
  starter: boolean | null
  tacticalRole: string | null
  adjustmentPct: number | null
  note: string | null
  fairBefore: number | null
  fairAfter: number | null
  lastUpdate: string
}

export interface Player {
  id: number
  role: Role
  rm: string | null
  name: string
  team: string
  qtA: number | null
  qtI: number | null
  diff: number
  fvm: number | null
  fvmM: number | null
  searchKeys: string[]
  tier: Tier
  baseScore: number
  floorScore: number
  ceilScore: number
  confidence: Confidence
  tags: string[]
  penalty: PenaltyInfo
  setPieces: {
    fk: 1 | 2 | 3 | null
    corners: 1 | 2 | 3 | null
    sources: unknown[]
    note: string | null
  }
  g1: G1Info | null
  injury: {
    status: 'healthy' | 'minor' | 'medium' | 'long' | 'uncertain' | 'market_risk'
    expectedMissed: number | null
    requiredDiscountPct: number | null
    note: string | null
    lastUpdate: string
  }
  marketRisk: boolean
  europe: boolean | null
  starterLikely: 'titolare' | 'ballottaggio' | 'riserva' | null
  modProfile: {
    voteConsistencyProxy: number
    pct65plus: number | null
    note: string
  } | null
  switchCandidate: boolean
  notes: string[]
  lastUpdate: string
  // runtime / user edits
  manualNote?: string
  planMark?: PlanMark | null
}

export type PlanMark = 'priority' | 'like' | 'watch' | 'avoid' | 'steal'

export interface TeamIntel {
  team: string
  coach: string
  system: string
  penalties: {
    user: { order: string[]; date: string; source: string }
    skySport: { order: string[]; date: string; source: string } | null
    divergence: boolean
    divergenceNote?: string
  }
  setPieces: { order: string[]; date: string; source: string; note?: string }
  europe: boolean | null
  defensiveSolidity: string
  offensiveQuality: string
  g1Notes: string[]
  injuries: string[]
  marketNotes: string[]
  fantasyAssets: string[]
  traps: string[]
  lastUpdate: string
  sources: { name: string; date: string }[]
}

export interface BudgetByRole {
  P: number
  D: number
  C: number
  A: number
}

export interface ModelWeights {
  gk: { cs: number; vote: number; titolarita: number; saves: number; context: number; risk: number }
  def: { mod: number; minutes: number; bonus: number; teamDef: number; setPiece: number; discipline: number }
  mid: { bonus: number; minutes: number; tactical: number; setPiece: number; vote: number; reliability: number; attack: number }
  att: { goals: number; minutes: number; penalties: number; teamAtt: number; assists: number; reliability: number; tactical: number }
}

export interface Settings {
  teams: number
  budget: number
  slots: BudgetByRole
  budgetTemplate: BudgetTemplateId
  budgetPlan: BudgetByRole
  switchMode: 'basic' | 'plus'
  voteSource: string
  officeReserveGk: boolean
  cleanSheetBonus: number
  goalBand: number
  maxSubs: number
  modThresholds: { plus1: [number, number]; plus3: [number, number]; plus5: number }
  alpha: number
  inflationAbsorption: number
  inflationClamp: [number, number]
  penaltyConversion: number
  theme: 'dark' | 'light'
  weights: ModelWeights
  replacementPurchased: BudgetByRole
  replacementStarters: BudgetByRole
}

export interface LeagueTeam {
  id: string
  name: string
  isMe: boolean
}

export interface Sale {
  id: string
  playerId: number
  teamId: string
  price: number
  role: Role
  tier: Tier
  fairAtSale: number
  ts: number
}

export interface AuctionState {
  version: 1
  settings: Settings
  league: LeagueTeam[]
  sales: Sale[]
  planMarks: Record<number, PlanMark>
  playerEdits: Record<number, Partial<Player>>
  watchNotes: Record<number, string>
  customPlayers: Player[]
  undoStack: string[]
  redoStack: string[]
  lastPivotReason: string | null
}

export type VerdictKind = 'STEAL' | 'VALUE' | 'FAIR' | 'LIMIT' | 'STOP'

export interface FairBundle {
  fair: number
  rangeLow: number
  rangeHigh: number
  affare: number
  limite: number
  stop: number
  score: number
  var: number
  replacementScore: number
}

export interface LiveMaxBundle {
  liveMax: number
  financialMax: number
  finalLiveMax: number
  inflation: number | null
  absorbed: number
  scarcity: number
  need: number
  budgetFactor: number
  sampleSize: number
}
