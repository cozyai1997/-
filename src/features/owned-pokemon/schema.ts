export const statKeys = [
  'hp',
  'attack',
  'defense',
  'special_attack',
  'special_defense',
  'speed',
] as const

export type StatKey = (typeof statKeys)[number]
export type StatBlock = Record<StatKey, number>

export type OwnedPokemonInput = {
  speciesId: string
  formId: string
  nickname: string | null
  gender: 'male' | 'female' | 'genderless'
  level: number
  capturedOn: string | null
  originalNatureId: string | null
  effectiveNatureId: string | null
  abilityId: string | null
  originalIv: StatBlock
  effectiveIv: StatBlock
  ev: StatBlock
  heldItemId: string | null
  notes: string
  currentMoves: Array<{ moveId: string }>
  targetMoves: Array<{ moveId: string; conditionKo: string }>
}

export function emptyStatBlock(): StatBlock {
  return {
    hp: 0,
    attack: 0,
    defense: 0,
    special_attack: 0,
    special_defense: 0,
    speed: 0,
  }
}

export function validateOwnedPokemon(input: OwnedPokemonInput) {
  const errors: string[] = []
  if (!input.speciesId || !input.formId) errors.push('포켓몬 종과 모습을 선택해 주세요.')
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 100) {
    errors.push('레벨은 1부터 100 사이여야 합니다.')
  }
  if (input.nickname && input.nickname.length > 40) errors.push('별명은 40자 이하여야 합니다.')

  validateMoveSelection(input.currentMoves, '현재', errors)
  validateMoveSelection(input.targetMoves, '목표', errors)
  if (input.targetMoves.some((move) => !move.conditionKo.trim())) {
    errors.push('목표 기술의 습득 조건을 선택해 주세요.')
  }

  for (const key of statKeys) {
    if (input.originalIv[key] < 0 || input.originalIv[key] > 31) {
      errors.push('원본 IV는 0부터 31 사이여야 합니다.')
      break
    }
    if (input.effectiveIv[key] < input.originalIv[key] || input.effectiveIv[key] > 31) {
      errors.push('실전 IV는 원본 IV 이상 31 이하여야 합니다.')
      break
    }
    if (input.ev[key] < 0 || input.ev[key] > 252) {
      errors.push('개별 EV는 0부터 252 사이여야 합니다.')
      break
    }
  }

  if (statKeys.reduce((total, key) => total + input.ev[key], 0) > 510) {
    errors.push('EV 총합은 510 이하여야 합니다.')
  }
  return errors
}

function validateMoveSelection(
  moves: ReadonlyArray<{ moveId: string }>,
  kindKo: '현재' | '목표',
  errors: string[],
) {
  if (moves.length > 4) errors.push(`${kindKo} 기술은 4개 이하로 선택해 주세요.`)
  if (new Set(moves.map((move) => move.moveId)).size !== moves.length) {
    errors.push(`${kindKo} 기술은 중복해서 선택할 수 없습니다.`)
  }
}
