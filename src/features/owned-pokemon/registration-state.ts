import { emptyStatBlock, statKeys, type OwnedPokemonInput, type StatBlock } from './schema'

export const registrationDraftKey = 'pokemon-registration-draft-v3'
const legacyRegistrationDraftKeys = ['pokemon-registration-draft-v2', 'pokemon-registration-draft-v1']

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
    teraTypeId: null,
    hasGigantamaxFactor: false,
    currentMoves: [],
    targetMoves: [],
  }
}

export function readRegistrationDraft(storage: Pick<Storage, 'getItem'>) {
  for (const key of [registrationDraftKey, ...legacyRegistrationDraftKeys]) {
    const saved = storage.getItem(key)
    if (!saved) continue
    try {
      const parsed: unknown = JSON.parse(saved)
      if (!isRecord(parsed)) continue
      const defaults = createRegistrationDraft()
      return {
        step: isIntegerBetween(parsed.step, 1, 7) ? parsed.step : defaults.step,
        speciesId: stringOrDefault(parsed.speciesId, defaults.speciesId),
        formId: stringOrDefault(parsed.formId, defaults.formId),
        nickname: nullableStringOrDefault(parsed.nickname, defaults.nickname),
        gender: parsed.gender === 'male' || parsed.gender === 'female' || parsed.gender === 'genderless'
          ? parsed.gender
          : defaults.gender,
        level: typeof parsed.level === 'number' && Number.isFinite(parsed.level)
          ? parsed.level
          : defaults.level,
        capturedOn: nullableStringOrDefault(parsed.capturedOn, defaults.capturedOn),
        originalNatureId: nullableStringOrDefault(
          parsed.originalNatureId,
          defaults.originalNatureId,
        ),
        effectiveNatureId: nullableStringOrDefault(
          parsed.effectiveNatureId,
          defaults.effectiveNatureId,
        ),
        abilityId: nullableStringOrDefault(parsed.abilityId, defaults.abilityId),
        originalIv: normalizeStatBlock(parsed.originalIv, defaults.originalIv),
        effectiveIv: normalizeStatBlock(parsed.effectiveIv, defaults.effectiveIv),
        ev: normalizeStatBlock(parsed.ev, defaults.ev),
        heldItemId: nullableStringOrDefault(parsed.heldItemId, defaults.heldItemId),
        notes: stringOrDefault(parsed.notes, defaults.notes),
        teraTypeId: nullableIdOrDefault(parsed.teraTypeId, defaults.teraTypeId ?? null),
        hasGigantamaxFactor: booleanOrDefault(
          parsed.hasGigantamaxFactor,
          defaults.hasGigantamaxFactor ?? false,
        ),
        currentMoves: normalizeCurrentMoves(parsed.currentMoves),
        targetMoves: normalizeTargetMoves(parsed.targetMoves),
      }
    } catch {
      continue
    }
  }
  return createRegistrationDraft()
}

export function reconcileSpeciesSelection(
  draft: RegistrationDraft,
  speciesId: string,
  formId: string,
): RegistrationDraft {
  return {
    ...draft,
    speciesId,
    formId,
    abilityId: null,
    teraTypeId: null,
    hasGigantamaxFactor: false,
    currentMoves: [],
    targetMoves: [],
  }
}

export function reconcileFormSelection(
  draft: RegistrationDraft,
  formId: string,
  allowedAbilityIds: ReadonlySet<string>,
): RegistrationDraft {
  return {
    ...draft,
    formId,
    abilityId: draft.abilityId && allowedAbilityIds.has(draft.abilityId)
      ? draft.abilityId
      : null,
  }
}

export function reconcileFilteredSelections(
  draft: RegistrationDraft,
  options: {
    abilities: ReadonlyArray<{ id: string }>
    moves: ReadonlyArray<{
      id: string
      routes: ReadonlyArray<{ conditionKo: string }>
    }>
  },
): RegistrationDraft {
  const allowedAbilityIds = new Set(options.abilities.map((ability) => ability.id))
  const movesById = new Map(options.moves.map((move) => [move.id, move]))
  return {
    ...draft,
    abilityId: draft.abilityId && allowedAbilityIds.has(draft.abilityId)
      ? draft.abilityId
      : null,
    currentMoves: draft.currentMoves.filter((move) => movesById.has(move.moveId)),
    targetMoves: draft.targetMoves.filter((selected) => (
      movesById.get(selected.moveId)?.routes.some(
        (route) => route.conditionKo === selected.conditionKo,
      ) ?? false
    )),
  }
}

export function reconcileBattleSelections(
  draft: RegistrationDraft,
  battle: {
    teraTypes: ReadonlyArray<{ id: string; nameKo: string }>
    canGigantamax: boolean
  },
): RegistrationDraft {
  const allowedTeraTypeIds = new Set(battle.teraTypes.map((teraType) => teraType.id))
  return {
    ...draft,
    teraTypeId: draft.teraTypeId && allowedTeraTypeIds.has(draft.teraTypeId)
      ? draft.teraTypeId
      : null,
    hasGigantamaxFactor: battle.canGigantamax ? draft.hasGigantamaxFactor : false,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function nullableStringOrDefault(
  value: unknown,
  fallback: string | null,
): string | null {
  return value === null || typeof value === 'string' ? value : fallback
}

function nullableIdOrDefault(value: unknown, fallback: string | null): string | null {
  if (value === null) return null
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeStatBlock(value: unknown, fallback: StatBlock): StatBlock {
  if (!isRecord(value)) return fallback
  return Object.fromEntries(statKeys.map((key) => [
    key,
    typeof value[key] === 'number' && Number.isFinite(value[key]) ? value[key] : fallback[key],
  ])) as StatBlock
}

function normalizeCurrentMoves(value: unknown): RegistrationDraft['currentMoves'] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const moves: RegistrationDraft['currentMoves'] = []
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.moveId !== 'string' || !candidate.moveId.trim()) continue
    const moveId = candidate.moveId.trim()
    if (seen.has(moveId)) continue
    seen.add(moveId)
    moves.push({ moveId })
    if (moves.length === 4) break
  }
  return moves
}

function normalizeTargetMoves(value: unknown): RegistrationDraft['targetMoves'] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const moves: RegistrationDraft['targetMoves'] = []
  for (const candidate of value) {
    if (
      !isRecord(candidate)
      || typeof candidate.moveId !== 'string'
      || !candidate.moveId.trim()
      || typeof candidate.conditionKo !== 'string'
      || !candidate.conditionKo.trim()
    ) continue
    const moveId = candidate.moveId.trim()
    if (seen.has(moveId)) continue
    seen.add(moveId)
    moves.push({ moveId, conditionKo: candidate.conditionKo })
    if (moves.length === 4) break
  }
  return moves
}
