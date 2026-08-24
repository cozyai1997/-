import { calculateAllStats } from './calculate-stat'
import {
  nonHpStatKeys,
  type BaseStats,
  type CalculatedStats,
  type HpRule,
  type NatureAdjustment,
  type StatBlock,
} from './types'

export type OwnedPokemonStatResult =
  | { status: 'ready'; stats: CalculatedStats }
  | { status: 'unavailable'; reasonKo: string }

export type OwnedPokemonStatCalculationInput = {
  baseStats: BaseStats | null
  effectiveIv: StatBlock
  ev: StatBlock
  level: number
  nature: NatureAdjustment | null
  hpRule: HpRule
}

export function calculateOwnedPokemonStats(
  input: OwnedPokemonStatCalculationInput,
): OwnedPokemonStatResult {
  if (input.baseStats === null) {
    return {
      status: 'unavailable',
      reasonKo: '종족값 정보가 없어 실제 능력치를 계산할 수 없습니다.',
    }
  }

  const nature = normalizeNatureAdjustment(input.nature)
  if (nature === null) {
    return {
      status: 'unavailable',
      reasonKo: '성격 보정 정보가 불완전하여 실제 능력치를 계산할 수 없습니다.',
    }
  }

  return {
    status: 'ready',
    stats: calculateAllStats({
      baseStats: input.baseStats,
      iv: input.effectiveIv,
      ev: input.ev,
      level: input.level,
      nature,
      hpRule: input.hpRule,
    }),
  }
}

function normalizeNatureAdjustment(nature: NatureAdjustment | null): NatureAdjustment | null {
  if (nature === null) return { increased: null, decreased: null }
  if (!isNonHpStatOrNull(nature.increased) || !isNonHpStatOrNull(nature.decreased)) return null
  if ((nature.increased === null) !== (nature.decreased === null)) return null
  return nature
}

function isNonHpStatOrNull(value: unknown): value is NatureAdjustment['increased'] {
  return value === null || nonHpStatKeys.includes(value as (typeof nonHpStatKeys)[number])
}
