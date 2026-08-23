import { describe, expect, it } from 'vitest'

import { assertKoreanOptionDisplayValues } from '../../scripts/data/publish-pokemon-option-filter-reference-data'

describe('포켓몬 선택 필터 게시', () => {
  it('한국어 기술 또는 특성 표시값이 비어 있으면 쓰기 전에 거부한다', () => {
    expect(() => assertKoreanOptionDisplayValues({
      abilities: [{ id: 'adaptability', nameKo: '적응력', descriptionKo: '   ' }],
      moves: [{ id: 'tackle', nameKo: '몸통박치기', descriptionKo: '상대에게 부딪친다.' }],
    })).toThrow('abilities:adaptability:descriptionKo')
    expect(() => assertKoreanOptionDisplayValues({
      abilities: [{ id: 'adaptability', nameKo: '적응력', descriptionKo: '같은 타입 기술이 강해진다.' }],
      moves: [{ id: 'tackle', nameKo: 'Tackle', descriptionKo: '상대에게 부딪친다.' }],
    })).toThrow('moves:tackle:nameKo')
  })
})
