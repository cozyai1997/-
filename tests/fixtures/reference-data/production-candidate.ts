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
  species[1] = {
    id: 'milotic', nationalDexNumber: 350, nameKo: '밀로틱',
    descriptionKo: '아름다운 모습의 포켓몬이다.',
  }
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
  forms[1_000] = {
    ...forms[1_000], id: 'milotic-normal', speciesId: 'milotic', baseFormId: null,
    nameKo: '기본 모습',
  }
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
    sourceCommits: {
      cobblemon: 'd1b8094539f2dd23bd98c1a48293fac1f2010c16',
      koreanLocalizationContent: '9e231c83211f17e9fbb9994ef777750f04e883aa',
    },
    sha256: {
      evolutions: 'aececbd2841ccf662732c42c5eef4c2b5c3ec3e4041fa80fab1872d21b8f108f',
      sourceManifest: 'd9f8a25fcfed05e8a5392c474c3d0b3c834ed6f1c8a1a417eded5d72071e0531',
    },
    battleOnlyDiagnostics: Array.from({ length: 9 }, (_, index) => `diagnostic-${index}`),
    sourceDiagnostics: [
      {
        code: 'missing-evolution-target-form', table: 'evolutions',
        key: 'milotic>megamilotic:233', target: 'forms:milotic-mega',
      },
      {
        code: 'missing-evolution-target-form', table: 'evolutions',
        key: 'milotic>megamilotic:234', target: 'forms:milotic-mega',
      },
    ],
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
    evolutions: Array.from({ length: 602 }, (_, index) => index === 0 ? ({
      id: 'milotic>megamilotic:233',
      fromSpeciesId: 'milotic',
      toSpeciesId: 'milotic',
      toFormId: null,
      conditionKo: '키스톤 사용; 원본에 대상 메가 폼이 없음',
    }) : index === 1 ? ({
      id: 'milotic>megamilotic:234',
      fromSpeciesId: 'milotic',
      toSpeciesId: 'milotic',
      toFormId: null,
      conditionKo: '메가링 사용; 원본에 대상 메가 폼이 없음',
    }) : ({
      id: `species-a>species-a:${index}`,
      fromSpeciesId: 'species-a',
      fromFormId: 'form-0',
      toSpeciesId: 'species-a',
      toFormId: `form-${index + 1}`,
      conditionKo: `레벨 ${index + 1}에 진화`,
    })),
    formAbilities: Array.from({ length: 3_055 }, (_, index) => ({
      formId: index % 1_498 === 1_000 ? 'milotic-normal' : `form-${index % 1_498}`,
      speciesId: index % 1_498 === 1_000 ? 'milotic' : 'species-a',
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
        formId: formIndex === 1_000 ? 'milotic-normal' : `form-${formIndex}`,
        teraTypeId: `tera-${teraIndex}`,
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
