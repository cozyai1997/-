import mechanicsSource from '../fixtures/reference-data/battle-mechanics/mechanics-source.json'
import { describe, expect, it } from 'vitest'
import type { ReferenceFormRow } from '@/features/localization/reference-data-validation'
import {
  buildFormGigantamaxOptions,
  buildFormTeraOptions,
  buildTeraTypes,
  normalizeNatureRow,
  resolveInheritedBaseStats,
} from '../../scripts/data/normalize-pokemon-battle-data'
import { importReferenceData } from '../../scripts/data/import-reference-data'

const forms = mechanicsSource.forms as ReferenceFormRow[]

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

  it('Cobbleverse 전체 원본을 1,498개 전투 폼과 정확한 테라·거다이맥스 관계로 만든다', () => {
    const result = importReferenceData('C:\\Users\\PARKSUNGSIK\\OneDrive\\문서\\Desktop\\Cobbleverse_Pokemon_Manager_Package_v1.3_TABLE_FIX')

    expect(result.forms).toHaveLength(1_498)
    expect(result.forms.filter((form) => !form.isBattleOnly)).toHaveLength(1_334)
    expect(result.formTeraOptions).toHaveLength(25_184)
    expect(result.formGigantamaxOptions).toHaveLength(42)
    expect(result.battleOnlyDiagnostics).toHaveLength(9)
    expect(result.battleOnlyDiagnostics).toContain('forms:charizard-megax:battle-only:csv=false:raw=true')
    expect(result.forms.find((form) => form.id === 'charizard-megax')?.isBattleOnly).toBe(true)
    expect(result.formGigantamaxOptions).toEqual(expect.arrayContaining([
      { sourceFormId: 'toxtricity-normal', gigantamaxFormId: 'toxtricity-gmax' },
      { sourceFormId: 'urshifu-normal', gigantamaxFormId: 'urshifu-gmax' },
      { sourceFormId: 'urshifu-rapidstrike', gigantamaxFormId: 'urshifu-rapidstrikegmax' },
      { sourceFormId: 'alcremie-normal', gigantamaxFormId: 'alcremie-gmax' },
      { sourceFormId: 'alcremie-saltedcream', gigantamaxFormId: 'alcremie-gmax' },
    ]))
  })
})
