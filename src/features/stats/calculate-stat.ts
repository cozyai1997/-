import {
  nonHpStatKeys,
  type CalculatedStats,
  type NatureMultiplier,
  type NonHpStatKey,
  type StatCalculationInput,
} from './types'

export function calculateHpStat(base: number, iv: number, ev: number, level: number): number {
  const evPart = Math.floor(ev / 4)
  const basePart = Math.floor(((2 * base + iv + evPart) * level) / 100)
  return basePart + level + 10
}

export function calculateOtherStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: NatureMultiplier,
): number {
  const evPart = Math.floor(ev / 4)
  const basePart = Math.floor(((2 * base + iv + evPart) * level) / 100)
  return Math.floor((basePart + 5) * nature)
}

export function calculateAllStats(input: StatCalculationInput): CalculatedStats {
  const result = {
    hp: calculateHpStat(input.baseStats.hp, input.iv.hp, input.ev.hp, input.level),
    attack: 0,
    defense: 0,
    special_attack: 0,
    special_defense: 0,
    speed: 0,
  }
  for (const key of nonHpStatKeys) {
    result[key] = calculateOtherStat(
      input.baseStats[key],
      input.iv[key],
      input.ev[key],
      input.level,
      natureMultiplier(key, input.nature.increased, input.nature.decreased),
    )
  }
  return result
}

function natureMultiplier(
  key: NonHpStatKey,
  increased: NonHpStatKey | null,
  decreased: NonHpStatKey | null,
): NatureMultiplier {
  if (increased === decreased) return 1
  if (key === increased) return 1.1
  if (key === decreased) return 0.9
  return 1
}
