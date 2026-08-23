import { describe, expect, it } from 'vitest'
import {
  localizeEvolutionCondition,
  localizeLearnsetCondition,
} from '../../scripts/data/import-reference-data'

describe('Cobbleverse 원본 조건 한국어 정규화', () => {
  it.each([
    ['Level 16+', '레벨 16 이상'],
    ['Friendship 160+; Time: Night', '친밀도 160 이상; 밤'],
    ['Use Thunder Stone', '천둥의돌 사용'],
    ['Hold Metal Coat', '금속코트 지니기'],
    ['Level 20+; Female only', '레벨 20 이상; 암컷만'],
    ['Friendship 160+; Knows Fairy move', '친밀도 160 이상; 페어리타입 기술을 알고 있음'],
  ])('%s 조건을 %s로 바꾼다', (source, expected) => {
    expect(localizeEvolutionCondition(source)).toEqual({ text: expected, translated: true })
  })

  it('알 수 없는 조건은 임의 번역하지 않고 공개 차단 대상으로 남긴다', () => {
    expect(localizeEvolutionCondition('Property unknown=value')).toEqual({
      text: 'Property unknown=value',
      translated: false,
    })
  })

  it.each([
    ['level', '15', '레벨 15에 습득'],
    ['tm', '', '기술머신으로 습득'],
    ['tutor', '', '기술 가르침으로 습득'],
    ['egg', '', '유전으로 습득'],
    ['legacy', '', '과거 버전에서 습득'],
  ])('%s 습득 경로를 한국어로 바꾼다', (sourceType, sourceValue, expected) => {
    expect(localizeLearnsetCondition(sourceType, sourceValue)).toBe(expected)
  })
})
