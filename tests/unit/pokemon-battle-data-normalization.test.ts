import mechanicsSource from '../fixtures/reference-data/battle-mechanics/mechanics-source.json'
import { describe, expect, it } from 'vitest'
import {
  validateReferenceData,
  type ReferenceDataset,
  type ReferenceFormRow,
} from '@/features/localization/reference-data-validation'
import {
  buildFormGigantamaxOptions,
  buildFormTeraOptions,
  buildTeraTypes,
  normalizeNatureRow,
  resolveInheritedBaseStats,
} from '../../scripts/data/normalize-pokemon-battle-data'
import {
  importReferenceData,
  localizeEvolutionConditionForPublication,
} from '../../scripts/data/import-reference-data'

const forms = mechanicsSource.forms as ReferenceFormRow[]
const productionSource = process.env.REFERENCE_DATA_SOURCE
const runReferenceDataIntegration = process.env.RUN_REFERENCE_DATA_INTEGRATION === '1'
  && Boolean(productionSource)
const hangulPattern = /[ㄱ-ㅎㅏ-ㅣ가-힣]/u
let cachedProductionDataset: ReferenceDataset | undefined

function productionDataset() {
  if (!productionSource) throw new Error('REFERENCE_DATA_SOURCE 환경 변수가 필요합니다.')
  cachedProductionDataset ??= importReferenceData(productionSource)
  return cachedProductionDataset
}

describe('Cobbleverse 전투 데이터 정규화', () => {
  it('여섯 종족값이 모두 0인 폼은 두 단계 부모까지 상속하고 aspects를 정규화한다', () => {
    const result = resolveInheritedBaseStats(forms.slice(0, 3))

    expect(result.map((form) => form.baseStats)).toEqual([
      { hp: 60, attack: 70, defense: 80, special_attack: 90, special_defense: 100, speed: 110 },
      { hp: 60, attack: 70, defense: 80, special_attack: 90, special_defense: 100, speed: 110 },
      { hp: 60, attack: 70, defense: 80, special_attack: 90, special_defense: 100, speed: 110 },
    ])
    expect(result[0].aspects).toEqual(['normal'])
  })

  it.each([
    ['missing-parent', 'missing'],
    ['cycle-a', 'cycle-b'],
    ['partial-zero', 'partial-zero'],
    ['out-of-range', 'out-of-range'],
  ])('%s 종족값 원본을 거부한다', (id, baseFormId) => {
    const invalid = {
      ...forms[0],
      id,
      baseFormId,
      baseStats: id === 'partial-zero'
        ? { hp: 0, attack: 70, defense: 80, special_attack: 90, special_defense: 100, speed: 110 }
        : id === 'out-of-range'
          ? { hp: 256, attack: 70, defense: 80, special_attack: 90, special_defense: 100, speed: 110 }
          : { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
    }
    const rows = id === 'cycle-a'
      ? [invalid, { ...invalid, id: 'cycle-b', baseFormId: 'cycle-a' }]
      : [invalid]

    expect(() => resolveInheritedBaseStats(rows)).toThrow(id === 'missing-parent' ? 'missing' : id)
  })

  it.each([
    ['lonely', 'attack', 'defence', 'attack', 'defense'],
    ['naughty', 'attack', 'special_defence', 'attack', 'special_defense'],
    ['hardy', '', '', null, null],
  ])('%s 성격 키를 지원하는 종족값 키로 바꾼다', (_id, up, down, increasedStat, decreasedStat) => {
    expect(normalizeNatureRow({ id: _id, nameKo: '성격', UpStat: up, DownStat: down })).toEqual({
      id: _id,
      nameKo: '성격',
      increasedStat,
      decreasedStat,
    })
  })

  it.each([
    ['hardy', '', '', null, null], ['lonely', 'attack', 'defence', 'attack', 'defense'],
    ['brave', 'attack', 'speed', 'attack', 'speed'], ['adamant', 'attack', 'special_attack', 'attack', 'special_attack'],
    ['naughty', 'attack', 'special_defence', 'attack', 'special_defense'], ['bold', 'defence', 'attack', 'defense', 'attack'],
    ['docile', '', '', null, null], ['relaxed', 'defence', 'speed', 'defense', 'speed'],
    ['impish', 'defence', 'special_attack', 'defense', 'special_attack'], ['lax', 'defence', 'special_defence', 'defense', 'special_defense'],
    ['timid', 'speed', 'attack', 'speed', 'attack'], ['hasty', 'speed', 'defence', 'speed', 'defense'],
    ['serious', '', '', null, null], ['jolly', 'speed', 'special_attack', 'speed', 'special_attack'],
    ['naive', 'speed', 'special_defence', 'speed', 'special_defense'], ['modest', 'special_attack', 'attack', 'special_attack', 'attack'],
    ['mild', 'special_attack', 'defence', 'special_attack', 'defense'], ['quiet', 'special_attack', 'speed', 'special_attack', 'speed'],
    ['bashful', '', '', null, null], ['rash', 'special_attack', 'special_defence', 'special_attack', 'special_defense'],
    ['calm', 'special_defence', 'attack', 'special_defense', 'attack'], ['gentle', 'special_defence', 'defence', 'special_defense', 'defense'],
    ['sassy', 'special_defence', 'speed', 'special_defense', 'speed'], ['careful', 'special_defence', 'special_attack', 'special_defense', 'special_attack'],
    ['quirky', '', '', null, null],
  ])('성격 %s의 상승과 하락 능력치를 손실 없이 정규화한다', (id, up, down, increasedStat, decreasedStat) => {
    expect(normalizeNatureRow({ id, nameKo: '성격', UpStat: up, DownStat: down })).toMatchObject({ increasedStat, decreasedStat })
  })

  it('18개 타입과 스텔라로 19개 테라타입을 만들고 특수 폼을 제한한다', () => {
    const teraTypes = buildTeraTypes(mechanicsSource.types)
    const options = buildFormTeraOptions(forms.slice(3, 9), teraTypes)
    const idsByForm = Object.groupBy(options, (row) => row.formId)

    expect(teraTypes).toHaveLength(19)
    expect(teraTypes.at(-1)).toEqual({ id: 'stellar', nameKo: '스텔라', referenceTypeId: null, sortOrder: 19 })
    expect(idsByForm['ogerpon-normal']?.map((row) => row.teraTypeId)).toEqual(['grass'])
    expect(idsByForm['ogerpon-wellspring']?.map((row) => row.teraTypeId)).toEqual(['water'])
    expect(idsByForm['ogerpon-hearthflame']?.map((row) => row.teraTypeId)).toEqual(['fire'])
    expect(idsByForm['ogerpon-cornerstone']?.map((row) => row.teraTypeId)).toEqual(['rock'])
    expect(idsByForm['terapagos-normal']?.map((row) => row.teraTypeId)).toEqual(['stellar'])
  })

  it('aspects 일치와 명시적 별칭으로 거다이맥스 소스 폼을 연결한다', () => {
    expect(buildFormGigantamaxOptions(forms.slice(8))).toEqual([
      { sourceFormId: 'venusaur-normal', gigantamaxFormId: 'venusaur-gmax' },
      { sourceFormId: 'toxtricity-normal', gigantamaxFormId: 'toxtricity-gmax' },
      { sourceFormId: 'urshifu-normal', gigantamaxFormId: 'urshifu-gmax' },
    ])
  })

  describe.runIf(runReferenceDataIntegration)('실제 Cobbleverse 원본 통합', () => {
  it('Cobbleverse 전체 원본을 1,498개 전투 폼과 정확한 테라·거다이맥스 관계로 만든다', () => {
    const result = productionDataset()

    expect(result.forms).toHaveLength(1_498)
    expect(result.forms.filter((form) => !form.isBattleOnly)).toHaveLength(1_334)
    expect(result.formTeraOptions).toHaveLength(25_184)
    expect(result.formGigantamaxOptions).toHaveLength(42)
    expect(result.battleOnlyDiagnostics).toHaveLength(9)
    expect(result.battleOnlyDiagnostics).toContain('forms:charizard-megax:battle-only:csv=false:raw=true')
    expect(result.forms.find((form) => form.id === 'charizard-megax')?.isBattleOnly).toBe(true)
    expect(result.formGigantamaxOptions).toEqual(expect.arrayContaining([
      { sourceFormId: 'toxtricity-normal', gigantamaxFormId: 'toxtricity-gmax' },
      { sourceFormId: 'toxtricity-lowkey', gigantamaxFormId: 'toxtricity-lowkeygmax' },
      { sourceFormId: 'urshifu-normal', gigantamaxFormId: 'urshifu-gmax' },
      { sourceFormId: 'urshifu-rapidstrike', gigantamaxFormId: 'urshifu-rapidstrikegmax' },
      { sourceFormId: 'alcremie-normal', gigantamaxFormId: 'alcremie-gmax' },
      { sourceFormId: 'alcremie-saltedcream', gigantamaxFormId: 'alcremie-gmax' },
    ]))
  })

  it('실제 원본의 폼은 패키지 한국어 키를 우선하고 영문 토큰을 표시값으로 남기지 않는다', () => {
    const result = productionDataset()

    expect(result.forms.find((form) => form.id === 'venusaur-gmax')?.nameKo)
      .toBe('거다이맥스 이상해꽃')
    expect(result.forms.find((form) => form.id === 'lucario-cafecostume')?.nameKo)
      .toBe('카페 루카리오')
    expect(result.forms.find((form) => form.id === 'unown-form-26')?.nameKo)
      .toBe('안농 · 느낌표의 모습')
    expect(result.forms.find((form) => form.id === 'vulpix-form2')?.nameKo)
      .toBe('식스테일 · 원본에서 세부 정보가 제공되지 않은 별도 모습')
    expect(result.forms.every((form) => hangulPattern.test(form.nameKo))).toBe(true)
    expect(result.forms.every((form) => !/한국어 이름 미제공 모습 \d+/u.test(form.nameKo))).toBe(true)
  })

  it('한국어가 없는 Minecraft 도구도 영문 이름·설명을 공개 후보에 남기지 않는다', () => {
    const result = productionDataset()

    expect(result.items.find((item) => item.id === 'acacia_log')).toMatchObject({
      nameKo: '아카시아나무 원목',
    })
    expect(result.items.find((item) => item.id === 'melon_seeds')).toMatchObject({
      nameKo: '수박씨',
    })
    expect(result.items.find((item) => item.id === 'raw_cod')).toMatchObject({
      nameKo: '익히지 않은 대구',
    })
    expect(result.items.find((item) => item.id === 'eye_of_ender')).toMatchObject({
      nameKo: '엔더의 눈',
    })
    expect(result.items.find((item) => item.id === 'slimeball')).toMatchObject({
      nameKo: '슬라임볼',
    })
    expect(result.items.find((item) => item.id === 'poke_puff')).toMatchObject({
      nameKo: '포플레',
    })
    expect(result.items.find((item) => item.id === 'focus_sash')?.descriptionKo)
      .toBe('지니게 하면 HP가 꽉 찼을 때 기절할 듯한 기술을 당해도 HP 1로 한 번은 버틴다 사용 시 소모된다')
    expect(result.items.find((item) => item.id === 'bug_gem')?.descriptionKo)
      .toBe('벌레타입의 주얼. 지니게 하면 한 번만 벌레 기술의 위력이 강해진다 사용 시 소모된다')
    expect(result.items.find((item) => item.id === 'metal_coat')?.descriptionKo)
      .toBe('지니게 하면 강철타입 기술의 위력이 올라간다 롱스톤 또는 스라크에게 지니게 한 뒤 통신교환을 하면 각각 강철톤, 핫삼으로 진화한다')
    expect(result.items.find((item) => item.id === 'kings_rock')?.descriptionKo)
      .toBe('지니게 하면 공격해서 데미지를 줄 때 상대를 풀죽이기도 한다 야돈 또는 슈륙챙이에 지니게 한 뒤 통신교환을 하면 각각 야도킹, 왕구리로 진화한다')
    expect(result.items.filter((item) => item.descriptionKo?.includes('한국어 설명이 원본에 제공되지 않습니다')))
      .toHaveLength(231)
    expect(result.items.every((item) => (
      hangulPattern.test(item.nameKo) && hangulPattern.test(item.descriptionKo ?? '')
    ))).toBe(true)
    expect(result.items.every((item) => !/한국어 이름 미제공 도구 \d+/u.test(item.nameKo))).toBe(true)
  })

  it('메가 대상을 같은 종의 폼으로 정규화하고 모든 진화 조건을 한국어로 제공한다', () => {
    const result = productionDataset()
    const report = validateReferenceData(result)

    expect(result.evolutions.find((evolution) => evolution.id === 'gengar>megagengar:71'))
      .toMatchObject({
        fromSpeciesId: 'gengar',
        toSpeciesId: 'gengar',
        toFormId: 'gengar-mega',
        conditionKo: '키스톤 사용',
      })
    expect(result.evolutions.every((evolution) => hangulPattern.test(evolution.conditionKo)))
      .toBe(true)
    expect(result.evolutions.find((evolution) => evolution.id === 'milotic>megamilotic:233'))
      .toMatchObject({
        toSpeciesId: 'milotic',
        toFormId: null,
        conditionKo: '키스톤 사용; 원본에 대상 메가 폼이 없음',
      })
    expect(report.brokenReferences).toEqual([])
  })

  it('진화 조건은 레벨·도구·기술·시간·바이옴·능력치·누적 행동 의미를 보존한다', () => {
    const result = productionDataset()
    const conditions = result.evolutions.map((evolution) => evolution.conditionKo)

    expect(conditions).toContain('레벨 50 이상; 비가 오는 동안')
    expect(conditions).toContain('레벨 20 이상; 공격과 방어가 같음')
    expect(conditions).toContain('레벨 30 이상; 뒤집어엎기 기술을 알고 있음')
    expect(conditions).toContain('레벨업; 피해 49 이상 받기; 모래 바이옴')
    expect(conditions).toContain('급소 3회 적중')
    expect(conditions).toContain('반동 피해 누적 294 이상')
    expect(conditions).toContain('분노의주먹 20회 사용')
    expect(conditions).toContain('모으령의 코인 999개 보유')
    expect(conditions).toContain('피트블록 사용; 보름달; 밤')
    expect(conditions).toContain('천둥의돌 사용; 알로라 피카츄 진화 바이옴이 아님')
    expect(conditions.some((condition) => condition.includes('성격이 명랑'))).toBe(true)
    expect(conditions.some((condition) => condition.includes('왕의징표석을 지닌 절각참 3마리 처치')))
      .toBe(true)
    expect(conditions.every((condition) => !condition.includes('추가 조건 충족'))).toBe(true)
    expect(() => localizeEvolutionConditionForPublication(
      'Unknown source atom',
      'level_up',
      {},
    )).toThrow('evolutions:unlocalized-condition:Unknown source atom')
  })
  })
})
