export const requiredKoreanFields = {
  types: ['nameKo'],
  species: ['nameKo', 'descriptionKo'],
  forms: ['nameKo'],
  abilities: ['nameKo', 'descriptionKo'],
  moves: ['nameKo', 'descriptionKo'],
  items: ['nameKo', 'descriptionKo'],
  evolutions: ['conditionKo'],
  learnsets: ['conditionKo'],
  natures: ['nameKo'],
} as const

export type KoreanFieldTable = keyof typeof requiredKoreanFields
