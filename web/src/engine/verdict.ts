import type { FairBundle, LiveMaxBundle, VerdictKind } from '../types'

export function verdict(
  bid: number,
  fair: FairBundle,
  live: LiveMaxBundle,
): { kind: VerdictKind; label: string; action: string; color: string } {
  const limitCeil = live.finalLiveMax * 1.04
  if (bid <= fair.fair * 0.8) {
    return { kind: 'STEAL', label: 'STEAL', action: 'rilancia aggressivo', color: 'steal' }
  }
  if (bid <= fair.fair) {
    return { kind: 'VALUE', label: 'VALUE', action: 'rilancia', color: 'value' }
  }
  if (bid <= live.finalLiveMax) {
    return { kind: 'FAIR', label: 'FAIR / BUY IF NEEDED', action: 'compra solo se serve', color: 'fair' }
  }
  if (bid <= limitCeil) {
    return { kind: 'LIMIT', label: 'LIMIT', action: 'zona pericolo', color: 'limit' }
  }
  return { kind: 'STOP', label: 'STOP', action: 'lascia', color: 'stop' }
}

export function surplus(fair: number, price: number) {
  return fair - price
}

export function opportunityCost(bid: number, altFair: number) {
  return {
    credits: bid,
    leftoverVsAlt: bid - altFair,
  }
}
