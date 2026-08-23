export const statKeys = [
  'hp',
  'attack',
  'defense',
  'special_attack',
  'special_defense',
  'speed',
] as const

export const nonHpStatKeys = [
  'attack',
  'defense',
  'special_attack',
  'special_defense',
  'speed',
] as const

export type StatKey = (typeof statKeys)[number]
export type NonHpStatKey = (typeof nonHpStatKeys)[number]
export type StatBlock = Record<StatKey, number>
export type BaseStats = StatBlock
export type CalculatedStats = StatBlock
export type NatureMultiplier = 0.9 | 1 | 1.1

export type NatureAdjustment = {
  increased: NonHpStatKey | null
  decreased: NonHpStatKey | null
}

export type StatCalculationInput = {
  baseStats: BaseStats
  iv: StatBlock
  ev: StatBlock
  level: number
  nature: NatureAdjustment
}

export type TrainingValidationInput = Omit<StatCalculationInput, 'nature'>
