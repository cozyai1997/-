import { describe, expect, it } from 'vitest'

import {
  calculateAllStats,
  calculateHpStat,
  calculateOtherStat,
} from '@/features/stats/calculate-stat'
import { validateEv, validateIv, validateTraining } from '@/features/stats/validate-training'

describe('포켓몬 능력치 공식', () => {
  it.each([
    [{ base: 1, iv: 0, ev: 0, level: 1 }, 11],
    [{ base: 100, iv: 31, ev: 252, level: 50 }, 207],
    [{ base: 255, iv: 31, ev: 252, level: 100 }, 714],
  ])('HP 경계값 %o를 정수 내림 순서대로 계산한다', (input, expected) => {
    expect(calculateHpStat(input.base, input.iv, input.ev, input.level)).toBe(expected)
  })

  it.each([
    [{ base: 1, iv: 0, ev: 0, level: 1, nature: 1 as const }, 5],
    [{ base: 100, iv: 31, ev: 252, level: 50, nature: 1.1 as const }, 167],
    [{ base: 100, iv: 31, ev: 252, level: 50, nature: 0.9 as const }, 136],
    [{ base: 200, iv: 31, ev: 252, level: 100, nature: 1 as const }, 499],
  ])('HP 외 능력치 경계값 %o를 성격 보정 후 내림한다', (input, expected) => {
    expect(calculateOtherStat(input.base, input.iv, input.ev, input.level, input.nature)).toBe(expected)
  })

  it('상승·하락 성격 능력치를 각각 1.1배와 0.9배로 계산한다', () => {
    expect(calculateAllStats({
      baseStats: { hp: 70, attack: 110, defense: 70, special_attack: 115, special_defense: 70, speed: 90 },
      iv: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      ev: { hp: 0, attack: 252, defense: 0, special_attack: 0, special_defense: 4, speed: 252 },
      level: 50,
      nature: { increased: 'speed', decreased: 'special_attack' },
    })).toEqual({
      hp: 145,
      attack: 162,
      defense: 90,
      special_attack: 121,
      special_defense: 91,
      speed: 156,
    })
  })
})

describe('IV·EV·계산 입력 검증', () => {
  it('IV 0과 31은 허용하고 범위 밖 또는 소수는 거부한다', () => {
    expect(validateIv({ hp: 0, attack: 31, defense: 1, special_attack: 2, special_defense: 3, speed: 4 })).toEqual([])
    expect(validateIv({ hp: -1, attack: 32, defense: 1.5, special_attack: 2, special_defense: 3, speed: 4 })).toEqual([
      'IV는 각 능력치마다 0부터 31 사이의 정수여야 합니다.',
    ])
  })

  it('개별 EV 253과 총합 511을 서로 다른 한국어 오류로 거부한다', () => {
    expect(validateEv({ hp: 253, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 })).toEqual([
      '개별 EV는 0부터 252 사이의 정수여야 합니다.',
    ])
    expect(validateEv({ hp: 252, attack: 252, defense: 7, special_attack: 0, special_defense: 0, speed: 0 })).toEqual([
      'EV 총합은 510 이하여야 합니다.',
    ])
  })

  it('레벨과 종족값 경계를 검증한다', () => {
    expect(validateTraining({
      baseStats: { hp: 0, attack: 256, defense: 70, special_attack: 70, special_defense: 70, speed: 70 },
      iv: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      ev: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      level: 101,
    })).toEqual([
      '레벨은 1부터 100 사이의 정수여야 합니다.',
      '종족값은 각 능력치마다 1부터 255 사이의 정수여야 합니다.',
    ])
  })
})
