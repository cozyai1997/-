import { emptyStatBlock, type OwnedPokemonInput } from './schema'

export const registrationDraftKey = 'pokemon-registration-draft-v1'

export type RegistrationDraft = OwnedPokemonInput & { step: number }

export function createRegistrationDraft(): RegistrationDraft {
  return {
    step: 1,
    speciesId: '',
    formId: '',
    nickname: null,
    gender: 'genderless',
    level: 1,
    capturedOn: null,
    originalNatureId: null,
    effectiveNatureId: null,
    abilityId: null,
    originalIv: emptyStatBlock(),
    effectiveIv: emptyStatBlock(),
    ev: emptyStatBlock(),
    heldItemId: null,
    notes: '',
  }
}

export function readRegistrationDraft(storage: Pick<Storage, 'getItem'>) {
  const saved = storage.getItem(registrationDraftKey)
  if (!saved) return createRegistrationDraft()
  try {
    const parsed = JSON.parse(saved) as Partial<RegistrationDraft>
    return { ...createRegistrationDraft(), ...parsed }
  } catch {
    return createRegistrationDraft()
  }
}
