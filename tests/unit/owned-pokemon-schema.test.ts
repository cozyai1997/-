import { describe, expect, it } from 'vitest'

import { createRegistrationDraft } from '@/features/owned-pokemon/registration-state'
import { validateOwnedPokemon } from '@/features/owned-pokemon/schema'

function validDraft() {
  return { ...createRegistrationDraft(), speciesId: 'species', formId: 'form' }
}

describe('보유 포켓몬 입력 검증', () => {
  it('정상 입력을 허용한다', () => {
    expect(validateOwnedPokemon(validDraft())).toEqual([])
  })

  it('실전 IV가 원본 IV보다 낮으면 거부한다', () => {
    const draft = validDraft()
    draft.originalIv = { ...draft.originalIv, hp: 20 }
    draft.effectiveIv = { ...draft.effectiveIv, hp: 19 }

    expect(validateOwnedPokemon(draft)).toContain('실전 IV는 원본 IV 이상 31 이하여야 합니다.')
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
})
