import { describe, expect, it } from 'vitest'

import { createRegistrationDraft } from '@/features/owned-pokemon/registration-state'
import {
  validateOwnedPokemon,
  type OwnedPokemonInput,
  type StatBlock as SchemaStatBlock,
} from '@/features/owned-pokemon/schema'
import type { StatBlock as SharedStatBlock } from '@/features/stats/types'

function validDraft() {
  return { ...createRegistrationDraft(), speciesId: 'species', formId: 'form' }
}

describe('보유 포켓몬 입력 검증', () => {
  it('등록 스키마는 공통 StatBlock 타입을 다시 내보낸다', () => {
    const shared: SharedStatBlock = { hp: 1, attack: 2, defense: 3, special_attack: 4, special_defense: 5, speed: 6 }
    const schema: SchemaStatBlock = shared

    expect(schema).toEqual(shared)
  })

  it('전투 선택 필드는 입력 계약에서 생략할 수 없다', () => {
    const { teraTypeId: _teraTypeId, hasGigantamaxFactor: _hasGigantamaxFactor, ...withoutBattleSelections } = validDraft()
    void _teraTypeId
    void _hasGigantamaxFactor

    // @ts-expect-error OwnedPokemonInput requires both battle selection fields.
    const omitted: OwnedPokemonInput = withoutBattleSelections

    expect(omitted).toEqual(withoutBattleSelections)
  })

  it('정상 입력을 허용한다', () => {
    expect(validateOwnedPokemon(validDraft())).toEqual([])
  })

  it('왕관 보정 적용 IV가 원본 개체값보다 낮으면 승인된 용어로 거부한다', () => {
    const draft = validDraft()
    draft.originalIv = { ...draft.originalIv, hp: 20 }
    draft.effectiveIv = { ...draft.effectiveIv, hp: 19 }

    expect(validateOwnedPokemon(draft)).toContain(
      '적용 IV (왕관 보정 포함)는 개체값 IV (원본) 이상 31 이하여야 합니다.',
    )
  })

  it('EV 총합이 510을 넘으면 거부한다', () => {
    const draft = validDraft()
    draft.ev = {
      hp: 100,
      attack: 100,
      defense: 100,
      special_attack: 100,
      special_defense: 100,
      speed: 100,
    }

    expect(validateOwnedPokemon(draft)).toContain('EV 총합은 510 이하여야 합니다.')
  })

  it('현재 기술과 목표 기술을 각각 0개부터 4개까지 허용한다', () => {
    const empty = validDraft()
    const full = validDraft()
    full.currentMoves = ['1', '2', '3', '4'].map((moveId) => ({ moveId }))
    full.targetMoves = ['5', '6', '7', '8'].map((moveId) => ({
      moveId,
      conditionKo: `조건 ${moveId}`,
    }))

    expect(validateOwnedPokemon(empty)).toEqual([])
    expect(validateOwnedPokemon(full)).toEqual([])
  })

  it('종류별로 기술을 5개 이상 선택하면 거부한다', () => {
    const draft = validDraft()
    draft.currentMoves = ['1', '2', '3', '4', '5'].map((moveId) => ({ moveId }))
    draft.targetMoves = ['6', '7', '8', '9', '10'].map((moveId) => ({
      moveId,
      conditionKo: `조건 ${moveId}`,
    }))

    expect(validateOwnedPokemon(draft)).toEqual(expect.arrayContaining([
      '현재 기술은 4개 이하로 선택해 주세요.',
      '목표 기술은 4개 이하로 선택해 주세요.',
    ]))
  })

  it('같은 종류 안의 중복 기술 ID를 거부한다', () => {
    const draft = validDraft()
    draft.currentMoves = [{ moveId: 'same' }, { moveId: 'same' }]
    draft.targetMoves = [
      { moveId: 'target', conditionKo: '레벨 10에 습득' },
      { moveId: 'target', conditionKo: '기술머신으로 습득' },
    ]

    expect(validateOwnedPokemon(draft)).toEqual(expect.arrayContaining([
      '현재 기술은 중복해서 선택할 수 없습니다.',
      '목표 기술은 중복해서 선택할 수 없습니다.',
    ]))
  })

  it('목표 기술의 습득 조건이 비어 있으면 거부한다', () => {
    const draft = validDraft()
    draft.targetMoves = [{ moveId: 'target', conditionKo: '   ' }]

    expect(validateOwnedPokemon(draft)).toContain('목표 기술의 습득 조건을 선택해 주세요.')
  })
})
