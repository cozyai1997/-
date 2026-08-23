import { describe, expect, it } from 'vitest'

import {
  damageClassLabelKo,
  groupAbilityOptions,
  groupMoveOptions,
  learnMethodLabelKo,
} from '@/features/owned-pokemon/repository'

describe('포켓몬 필터 표시 라벨', () => {
  it('지원하는 획득 경로를 닫힌 순서의 한국어로 변환한다', () => {
    expect([
      'level',
      'tm',
      'tutor',
      'egg',
      'special',
      'form_change',
      'legacy',
    ].map(learnMethodLabelKo)).toEqual([
      '레벨업',
      '기술머신',
      '기술 가르침',
      '유전',
      '특별한 방법',
      '모습 변경',
      '과거 버전',
    ])
    expect(() => learnMethodLabelKo('unknown')).toThrow('지원하지 않는 기술 습득 경로입니다.')
  })

  it('기술 분류를 닫힌 한국어 라벨로 변환한다', () => {
    expect(['physical', 'special', 'status'].map(damageClassLabelKo)).toEqual([
      '물리',
      '특수',
      '변화',
    ])
    expect(() => damageClassLabelKo('unknown')).toThrow('지원하지 않는 기술 분류입니다.')
  })
})

describe('폼 특성 선택지', () => {
  const ability = (formId: string, id: string, nameKo: string, isHidden: boolean) => ({
    form_id: formId,
    is_hidden: isHidden,
    reference_abilities: {
      id,
      name_ko: nameKo,
      description_ko: `${nameKo} 설명`,
      is_active: true,
    },
  })

  it('정확한 폼 관계가 있으면 기본 폼 관계를 사용하지 않는다', () => {
    const result = groupAbilityOptions([
      ability('base', 'base-ability', '가볍', false),
      ability('exact', 'exact-ability', '나옹', false),
    ], 'exact', 'base')

    expect(result).toEqual([{
      id: 'exact-ability',
      nameKo: '나옹',
      descriptionKo: '나옹 설명',
      isHidden: false,
    }])
  })

  it('정확한 폼 관계가 하나도 없을 때만 기본 폼으로 대체한다', () => {
    const result = groupAbilityOptions([
      ability('base', 'base-ability', '피카츄', false),
    ], 'exact', 'base')

    expect(result.map((option) => option.id)).toEqual(['base-ability'])
  })

  it('같은 특성 ID를 하나로 합치고 중복 행 중 숨겨진 표시를 우선한다', () => {
    const result = groupAbilityOptions([
      ability('exact', 'same', '하나', false),
      ability('exact', 'same', '하나', true),
      ability('exact', 'other', '가나', false),
    ], 'exact', null)

    expect(result).toEqual([
      { id: 'other', nameKo: '가나', descriptionKo: '가나 설명', isHidden: false },
      { id: 'same', nameKo: '하나', descriptionKo: '하나 설명', isHidden: true },
    ])
  })
})

describe('종별 기술 선택지', () => {
  const move = (
    id: string,
    nameKo: string,
    learnMethod: string,
    conditionKo: string,
  ) => ({
    learn_method: learnMethod,
    condition_ko: conditionKo,
    reference_moves: {
      id,
      name_ko: nameKo,
      description_ko: `${nameKo} 설명`,
      damage_class: 'physical',
      power: 40,
      accuracy: 100,
      pp: 35,
      is_active: true,
      reference_types: { name_ko: '노말' },
    },
  })

  it('기술 ID로 합치면서 서로 다른 한국어 획득 경로를 모두 보존한다', () => {
    const result = groupMoveOptions([
      move('tackle', '몸통박치기', 'tm', '기술머신으로 습득'),
      move('tackle', '몸통박치기', 'level', '레벨 1에 습득'),
      move('tackle', '몸통박치기', 'level', '레벨 1에 습득'),
      move('splash', '튀어오르기', 'egg', '유전으로 습득'),
    ])

    expect(result).toEqual([
      {
        id: 'tackle',
        nameKo: '몸통박치기',
        descriptionKo: '몸통박치기 설명',
        typeKo: '노말',
        damageClassKo: '물리',
        power: 40,
        accuracy: 100,
        pp: 35,
        routes: [
          { methodKo: '레벨업', conditionKo: '레벨 1에 습득' },
          { methodKo: '기술머신', conditionKo: '기술머신으로 습득' },
        ],
      },
      {
        id: 'splash',
        nameKo: '튀어오르기',
        descriptionKo: '튀어오르기 설명',
        typeKo: '노말',
        damageClassKo: '물리',
        power: 40,
        accuracy: 100,
        pp: 35,
        routes: [{ methodKo: '유전', conditionKo: '유전으로 습득' }],
      },
    ])
  })
})
