import { describe, expect, it } from 'vitest'

import {
  createRegistrationDraft,
  readRegistrationDraft,
  reconcileFormSelection,
  reconcileSpeciesSelection,
  registrationDraftKey,
} from '@/features/owned-pokemon/registration-state'
import * as registrationState from '@/features/owned-pokemon/registration-state'

function storageWith(values: Record<string, string>): Pick<Storage, 'getItem'> {
  return {
    getItem(key) {
      return values[key] ?? null
    },
  }
}

describe('포켓몬 등록 임시 저장', () => {
  it('v2 키와 빈 기술 배열을 기본값으로 사용한다', () => {
    expect(registrationDraftKey).toBe('pokemon-registration-draft-v2')
    expect(createRegistrationDraft()).toMatchObject({ currentMoves: [], targetMoves: [] })
  })

  it('v1 임시 저장에 새 기술 기본값을 병합한다', () => {
    const draft = readRegistrationDraft(storageWith({
      'pokemon-registration-draft-v1': JSON.stringify({
        step: 3,
        speciesId: 'species-old',
        formId: 'form-old',
        abilityId: 'ability-old',
      }),
    }))

    expect(draft).toMatchObject({
      step: 3,
      speciesId: 'species-old',
      formId: 'form-old',
      abilityId: 'ability-old',
      currentMoves: [],
      targetMoves: [],
    })
  })

  it('손상된 기술 배열을 예외 없이 중복 제거하고 4개로 정규화한다', () => {
    const draft = readRegistrationDraft(storageWith({
      [registrationDraftKey]: JSON.stringify({
        currentMoves: [
          null,
          { moveId: 'current-1', ignored: true },
          { moveId: 'current-1' },
          { moveId: '' },
          { moveId: 'current-2' },
          { moveId: 'current-3' },
          { moveId: 'current-4' },
          { moveId: 'current-5' },
        ],
        targetMoves: [
          { moveId: 'target-1', conditionKo: '레벨 5에 습득', ignored: true },
          { moveId: 'target-1', conditionKo: '기술머신으로 습득' },
          { moveId: 'target-2', conditionKo: 123 },
          'broken',
        ],
      }),
    }))

    expect(draft.currentMoves).toEqual([
      { moveId: 'current-1' },
      { moveId: 'current-2' },
      { moveId: 'current-3' },
      { moveId: 'current-4' },
    ])
    expect(draft.targetMoves).toEqual([
      { moveId: 'target-1', conditionKo: '레벨 5에 습득' },
    ])
  })

  it('깨진 JSON이나 객체가 아닌 값은 새 기본값으로 복구한다', () => {
    expect(readRegistrationDraft(storageWith({ [registrationDraftKey]: '{broken' })))
      .toEqual(createRegistrationDraft())
    expect(readRegistrationDraft(storageWith({ [registrationDraftKey]: '"broken"' })))
      .toEqual(createRegistrationDraft())
  })

  it('잘못된 필드는 기본값으로 되돌리고 부분 스탯 블록은 병합한다', () => {
    const draft = readRegistrationDraft(storageWith({
      [registrationDraftKey]: JSON.stringify({
        step: null,
        speciesId: 25,
        level: '100',
        originalIv: null,
        effectiveIv: { hp: 20 },
        ev: 'broken',
      }),
    }))

    expect(draft.step).toBe(1)
    expect(draft.speciesId).toBe('')
    expect(draft.level).toBe(1)
    expect(draft.originalIv).toEqual(createRegistrationDraft().originalIv)
    expect(draft.effectiveIv).toEqual({
      ...createRegistrationDraft().effectiveIv,
      hp: 20,
    })
    expect(draft.ev).toEqual(createRegistrationDraft().ev)
  })
})

describe('종·모습 선택 정합성', () => {
  it('종이 바뀌면 특성·현재 기술·목표 기술을 모두 지운다', () => {
    const draft = {
      ...createRegistrationDraft(),
      speciesId: 'old-species',
      formId: 'old-form',
      abilityId: 'ability',
      currentMoves: [{ moveId: 'current' }],
      targetMoves: [{ moveId: 'target', conditionKo: '유전으로 습득' }],
    }

    expect(reconcileSpeciesSelection(draft, 'new-species', 'new-form')).toMatchObject({
      speciesId: 'new-species',
      formId: 'new-form',
      abilityId: null,
      currentMoves: [],
      targetMoves: [],
    })
  })

  it('모습만 바뀌면 기술을 유지하고 허용되는 특성도 유지한다', () => {
    const draft = {
      ...createRegistrationDraft(),
      speciesId: 'species',
      formId: 'old-form',
      abilityId: 'kept-ability',
      currentMoves: [{ moveId: 'current' }],
      targetMoves: [{ moveId: 'target', conditionKo: '유전으로 습득' }],
    }

    expect(reconcileFormSelection(draft, 'new-form', new Set(['kept-ability']))).toMatchObject({
      formId: 'new-form',
      abilityId: 'kept-ability',
      currentMoves: [{ moveId: 'current' }],
      targetMoves: [{ moveId: 'target', conditionKo: '유전으로 습득' }],
    })
  })

  it('모습에서 허용하지 않는 기존 특성만 지운다', () => {
    const draft = {
      ...createRegistrationDraft(),
      abilityId: 'old-ability',
      currentMoves: [{ moveId: 'current' }],
      targetMoves: [{ moveId: 'target', conditionKo: '특별한 방법으로 습득' }],
    }

    expect(reconcileFormSelection(draft, 'new-form', new Set(['other-ability']))).toMatchObject({
      formId: 'new-form',
      abilityId: null,
      currentMoves: [{ moveId: 'current' }],
      targetMoves: [{ moveId: 'target', conditionKo: '특별한 방법으로 습득' }],
    })
  })

  it('복원된 v2 초안에서 허용되지 않은 기술과 정확히 일치하지 않는 목표 경로를 제거한다', () => {
    const draft = {
      ...createRegistrationDraft(),
      speciesId: 'species',
      formId: 'form',
      abilityId: 'allowed-ability',
      currentMoves: [
        { moveId: 'allowed-move' },
        { moveId: 'invalid-move' },
      ],
      targetMoves: [
        { moveId: 'allowed-move', conditionKo: '레벨 5에 습득' },
        { moveId: 'route-mismatch', conditionKo: '조작한 습득 조건' },
        { moveId: 'invalid-move', conditionKo: '유전으로 습득' },
      ],
    }
    const options = {
      abilities: [{ id: 'allowed-ability' }],
      moves: [
        { id: 'allowed-move', routes: [{ conditionKo: '레벨 5에 습득' }] },
        { id: 'route-mismatch', routes: [{ conditionKo: '기술머신 1로 습득' }] },
      ],
    }
    const reconcile = 'reconcileFilteredSelections' in registrationState
      ? registrationState.reconcileFilteredSelections as unknown as (
        value: typeof draft,
        loaded: typeof options,
      ) => typeof draft
      : (value: typeof draft) => value

    expect(reconcile(draft, options)).toMatchObject({
      abilityId: 'allowed-ability',
      currentMoves: [{ moveId: 'allowed-move' }],
      targetMoves: [{ moveId: 'allowed-move', conditionKo: '레벨 5에 습득' }],
    })
  })
})
