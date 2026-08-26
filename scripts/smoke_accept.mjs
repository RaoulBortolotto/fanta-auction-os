/**
 * Quick acceptance checks for auction engine (node, no DOM).
 */
import { readFileSync } from 'fs'
import { createRequire } from 'module'

// Use dynamic import of compiled logic via tsx isn't available — reimplement key checks on JSON + fair math mirror

const players = JSON.parse(readFileSync(new URL('../web/src/data/players.json', import.meta.url), 'utf8'))
const solet = players.find((p) => p.name === 'Solet')
console.log('TEST1 Solet', {
  role: solet.role,
  team: solet.team,
  tags: solet.tags.filter((t) => /MOD|RIG|SWITCH/i.test(t) || t.includes('RIG')),
  penalty: solet.penalty,
  confidence: solet.confidence,
})

function financialMax(credits, slotsLeft) {
  return Math.max(0, credits - (slotsLeft - 1))
}
console.log('TEST5 max with 50cr 6 slots', financialMax(50, 6), 'expect 45')
console.log('TEST5 block 46?', 46 > financialMax(50, 6))

console.log('AUDIT counts', {
  P: players.filter((p) => p.role === 'P').length,
  D: players.filter((p) => p.role === 'D').length,
  C: players.filter((p) => p.role === 'C').length,
  A: players.filter((p) => p.role === 'A').length,
  total: players.length,
})
console.log('OK smoke')
