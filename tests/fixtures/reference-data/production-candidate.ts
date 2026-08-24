import type { ReferenceDataset } from '@/features/localization/reference-data-validation'

export function createProductionReferenceCandidate(): ReferenceDataset {
  const types = [
    { id: 'normal', nameKo: '노말' },
    ...Array.from({ length: 17 }, (_, index) => ({ id: `type-${index}`, nameKo: `타입가-${index}` })),
  ]
  const species = [
    {
      id: 'species-a', nationalDexNumber: 1, nameKo: '이상해씨',
      descriptionKo: '검증용 포켓몬이다.',
    },
    ...Array.from({ length: 1_024 }, (_, index) => ({
      id: `species-${index + 1}`,
      nationalDexNumber: index + 2,
      nameKo: `포켓몬가-${index + 1}`,
      descriptionKo: `검증용 포켓몬 설명 ${index + 1}`,
    })),
  ]
  const forms = Array.from({ length: 1_498 }, (_, index) => ({
    id: `form-${index}`,
    speciesId: 'species-a',
    baseFormId: index === 0 ? null : 'form-0',
    nameKo: `모습가-${index}`,
    primaryTypeId: 'normal',
    secondaryTypeId: null,
    baseStats: { hp: 50, attack: 50, defense: 50, special_attack: 50, special_defense: 50, speed: 50 },
    isBattleOnly: index >= 1_334,
    aspects: [],
  }))
  const moves = Array.from({ length: 826 }, (_, index) => ({
    id: `move-${index}`,
    nameKo: `기술가-${index}`,
    descriptionKo: `한국어 기술 설명 ${index}`,
    typeId: 'normal',
    damageClass: 'physical' as const,
    power: 40,
    accuracy: 100,
    pp: 35,
  }))

  return {
    version: 'candidate-v1',
    sourceCommits: { source: 'a'.repeat(40) },
    sha256: { source: 'b'.repeat(64) },
    battleOnlyDiagnostics: Array.from({ length: 9 }, (_, index) => `diagnostic-${index}`),
    reportedCounts: {
      types: 18,
      species: 1_025,
      forms: 1_498,
      abilities: 310,
      moves: 826,
      learnsets: 116_519,
      items: 615,
      evolutions: 602,
      formAbilities: 3_055,
      natures: 25,
      typeMatchups: 324,
      teraTypes: 19,
      formTeraOptions: 25_184,
      formGigantamaxOptions: 42,
    },
    types,
    species,
    forms,
    abilities: [
      { id: 'ability-a', nameKo: '심록', descriptionKo: '위기일 때 풀 타입 기술이 강해진다.' },
      ...Array.from({ length: 309 }, (_, index) => ({
        id: `ability-${index + 1}`,
        nameKo: `특성가-${index + 1}`,
        descriptionKo: `검증용 특성 설명 ${index + 1}`,
      })),
    ],
    moves,
    learnsets: Array.from({ length: 116_519 }, (_, index) => ({
      speciesId: 'species-a',
      formId: null,
      moveId: `move-${index % 826}`,
      learnMethod: 'level' as const,
      learnLevel: 1,
      conditionKo: `레벨 1에 습득 ${index}`,
    })),
    items: Array.from({ length: 615 }, (_, index) => ({
      id: `item-${index}`,
      nameKo: `도구가-${index}`,
      descriptionKo: `검증용 도구 설명 ${index}`,
    })),
    evolutions: Array.from({ length: 602 }, (_, index) => ({
      id: `species-a>species-a:${index}`,
      fromSpeciesId: 'species-a',
      fromFormId: 'form-0',
      toSpeciesId: 'species-a',
      toFormId: `form-${index + 1}`,
      conditionKo: `레벨 ${index + 1}에 진화`,
    })),
    formAbilities: Array.from({ length: 3_055 }, (_, index) => ({
      formId: `form-${index % 1_498}`,
      speciesId: 'species-a',
      abilityId: 'ability-a',
      slot: `slot-${Math.floor(index / 1_498)}`,
      isHidden: false,
    })),
    natures: Array.from({ length: 25 }, (_, index) => ({
      id: `nature-${index}`, nameKo: `성격가-${index}`, increasedStat: null, decreasedStat: null,
    })),
    teraTypes: Array.from({ length: 19 }, (_, index) => ({
      id: `tera-${index}`, nameKo: `테라가-${index}`, referenceTypeId: null, sortOrder: index,
    })),
    formTeraOptions: [
      ...Array.from({ length: 1_325 }, (_, formIndex) => Array.from({ length: 19 }, (_, teraIndex) => ({
        formId: `form-${formIndex}`, teraTypeId: `tera-${teraIndex}`,
      }))).flat(),
      ...Array.from({ length: 9 }, (_, index) => ({
        formId: `form-${1_325 + index}`, teraTypeId: 'tera-0',
      })),
    ],
    formGigantamaxOptions: Array.from({ length: 42 }, (_, index) => ({
      sourceFormId: `form-${index}`, gigantamaxFormId: `form-${1_334 + index}`,
    })),
    typeMatchups: types.flatMap((attackingType) => types.map((defendingType) => ({
      attackingTypeId: attackingType.id,
      defendingTypeId: defendingType.id,
      multiplier: 1,
    }))),
  }
}
