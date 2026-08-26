import Fuse from 'fuse.js'
import type { Player } from '../types'

export function buildSearcher(players: Player[]) {
  return new Fuse(players, {
    keys: [
      { name: 'name', weight: 0.55 },
      { name: 'searchKeys', weight: 0.25 },
      { name: 'team', weight: 0.15 },
      { name: 'role', weight: 0.05 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
  })
}

export function searchPlayers(fuse: Fuse<Player>, q: string, limit = 8): Player[] {
  const query = q.trim()
  if (!query) return []
  // accent / alias helpers
  const normalized = query
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  const results = fuse.search(normalized.length >= 2 ? query : query)
  // also direct includes
  const direct = fuse.getIndex()
    ? []
    : []
  void direct
  return results.slice(0, limit).map((r) => r.item)
}

/** Simple alias map for common misspellings */
export const ALIASES: Record<string, string> = {
  chala: 'Calhanoglu',
  calha: 'Calhanoglu',
  nico: 'Paz N.',
  lautaro: 'Martinez L.',
  solet: 'Solet',
  ostigard: 'Ostigard',
  'østigård': 'Ostigard',
}
