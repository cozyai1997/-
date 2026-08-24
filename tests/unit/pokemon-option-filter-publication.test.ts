import { describe, expect, it, vi } from 'vitest'

import {
  assertKoreanOptionDisplayValues,
  assertOptionFilterCandidate,
  assertOptionFilterPublicationCounts,
  prepareBattlePublicationRows,
  publishPokemonOptionFilterReferenceData,
} from '../../scripts/data/publish-pokemon-option-filter-reference-data'
import {
  assertValidReferenceDataForPublication,
  type ReferenceDataset,
} from '@/features/localization/reference-data-validation'
import { createProductionReferenceCandidate } from '../fixtures/reference-data/production-candidate'

const validCandidate = createProductionReferenceCandidate()

function assertPublishableOptionCandidate(candidate: ReferenceDataset): void {
  assertOptionFilterCandidate(candidate)
  assertValidReferenceDataForPublication(candidate)
}

const sourceMock = vi.hoisted(() => ({
  trustedDataset: null as ReferenceDataset | null,
}))

vi.mock('../../scripts/data/import-reference-data', () => ({
  importReferenceData: () => {
    if (!sourceMock.trustedDataset) throw new Error('trusted source fixture missing')
    return structuredClone(sourceMock.trustedDataset)
  },
}))

function createPublisherHarness(
  candidate: ReferenceDataset,
  options: { failInsertAt?: number; rpcError?: string; cleanupError?: string } = {},
) {
  const publicationId = '00000000-0000-4000-8000-000000000099'
  const databaseRows: Record<string, Array<Record<string, unknown>>> = {
    reference_types: candidate.types.map((row, index) => ({ id: `type-${index}`, identifier: row.id })),
    reference_species: candidate.species.map((row, index) => ({ id: `species-${index}`, identifier: row.id })),
    reference_forms: candidate.forms.map((row, index) => ({
      id: `form-${index}`, identifier: row.id, publication_id: publicationId,
      species_id: `species-${candidate.species.findIndex((species) => species.id === row.speciesId)}`,
      name_ko: row.nameKo, primary_type_id: null, secondary_type_id: null,
      is_default: row.id === `${row.speciesId}-normal`, is_active: true,
    })),
    reference_abilities: candidate.abilities.map((row, index) => ({ id: `ability-${index}`, identifier: row.id })),
    reference_natures: candidate.natures.map((row, index) => ({ id: `nature-${index}`, identifier: row.id })),
  }
  const filters: Array<[string, unknown]> = []
  const publicationQuery = {
    select() { return publicationQuery },
    eq(column: string, value: unknown) {
      filters.push([column, value])
      return publicationQuery
    },
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: publicationId }, error: null }),
  }
  let insertCalls = 0
  const stagingQuery = {
    insert: vi.fn(async (rows: unknown[]) => {
      void rows
      insertCalls += 1
      return insertCalls === options.failInsertAt
        ? { error: { message: 'second batch failed' } }
        : { error: null }
    }),
    delete: vi.fn(() => stagingQuery),
    eq: vi.fn(() => stagingQuery),
    then(resolve: (value: { error: { message: string } | null }) => unknown) {
      return Promise.resolve({
        error: options.cleanupError ? { message: options.cleanupError } : null,
      }).then(resolve)
    },
  }
  const selectQuery = (table: string) => ({
    select() { return this },
    eq() { return this },
    order() { return this },
    range(start: number, end: number) {
      return Promise.resolve({ data: databaseRows[table].slice(start, end + 1), error: null })
    },
  })
  const rpc = vi.fn().mockResolvedValue(options.rpcError
    ? { error: { message: options.rpcError } }
    : { error: null })
  const client = {
    from: vi.fn((table: string) => table === 'data_publications'
      ? publicationQuery
      : table === 'reference_option_filter_publication_staging'
        ? stagingQuery
        : selectQuery(table)),
    rpc,
  }
  return { client, filters, publicationId, rpc, stagingQuery }
}

describe('포켓몬 선택 필터 게시', () => {
  it('인증된 candidate digest를 교체 RPC 트랜잭션에 전달한다', async () => {
    const candidate = createProductionReferenceCandidate()
    sourceMock.trustedDataset = structuredClone(candidate)
    const { client, filters, publicationId, rpc, stagingQuery } = createPublisherHarness(candidate)

    await publishPokemonOptionFilterReferenceData(candidate, 'trusted-source', client as never)

    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('replace_pokemon_option_filter_reference_data', {
      p_publication_id: publicationId,
      p_batch_id: expect.any(String),
      p_candidate_digest: expect.stringMatching(/^[0-9a-f]{64}$/u),
      p_expected_version: candidate.version,
    })
    expect(filters).toEqual([
      ['version', candidate.version],
      ['status', 'active'],
    ])
    expect(stagingQuery.insert.mock.calls.length).toBeGreaterThan(1)
    expect(stagingQuery.insert.mock.calls.every(([batch]) => (
      Array.isArray(batch) && batch.length <= 750
    ))).toBe(true)
    expect(stagingQuery.delete).not.toHaveBeenCalled()
  }, 30_000)
  it('전투 게시 행은 내부 UUID를 연결하고 화면용 이름은 한국어만 유지한다', () => {
    const dataset = {
      ...createProductionReferenceCandidate(),
      forms: [
        {
          id: 'form-a', speciesId: 'species-a', baseFormId: null, nameKo: '일반',
          primaryTypeId: 'normal', secondaryTypeId: null,
          baseStats: { hp: 50, attack: 51, defense: 52, special_attack: 53, special_defense: 54, speed: 55 },
          isBattleOnly: false, aspects: [],
        },
        {
          id: 'form-a-gmax', speciesId: 'species-a', baseFormId: 'form-a', nameKo: '거다이맥스',
          primaryTypeId: 'normal', secondaryTypeId: null,
          baseStats: { hp: 50, attack: 51, defense: 52, special_attack: 53, special_defense: 54, speed: 55 },
          isBattleOnly: true, aspects: ['gmax'],
        },
      ],
      natures: [{ id: 'hardy', nameKo: '노력', increasedStat: null, decreasedStat: null }],
      teraTypes: [{ id: 'normal', nameKo: '노말', referenceTypeId: 'normal', sortOrder: 0 }],
      formTeraOptions: [{ formId: 'form-a', teraTypeId: 'normal' }],
      formGigantamaxOptions: [{ sourceFormId: 'form-a', gigantamaxFormId: 'form-a-gmax' }],
    } as ReferenceDataset

    const rows = prepareBattlePublicationRows(dataset, {
      formIds: new Map([
        ['form-a', '00000000-0000-4000-8000-000000000001'],
        ['form-a-gmax', '00000000-0000-4000-8000-000000000005'],
      ]),
      natureIds: new Map([['hardy', '00000000-0000-4000-8000-000000000002']]),
      teraTypeIds: new Map([['normal', '00000000-0000-4000-8000-000000000003']]),
      typeIds: new Map([['normal', '00000000-0000-4000-8000-000000000004']]),
    })

    expect(rows).toEqual([
      {
        rowKind: 'form_battle_profile',
        payload: {
          form_id: '00000000-0000-4000-8000-000000000001', base_form_id: null,
          base_hp: 50, base_attack: 51, base_defense: 52, base_special_attack: 53,
          base_special_defense: 54, base_speed: 55, is_battle_only: false,
        },
      },
      {
        rowKind: 'form_battle_profile',
        payload: {
          form_id: '00000000-0000-4000-8000-000000000005',
          base_form_id: '00000000-0000-4000-8000-000000000001',
          base_hp: 50, base_attack: 51, base_defense: 52, base_special_attack: 53,
          base_special_defense: 54, base_speed: 55, is_battle_only: true,
        },
      },
      {
        rowKind: 'nature_adjustment',
        payload: {
          nature_id: '00000000-0000-4000-8000-000000000002',
          increased_stat: null, decreased_stat: null,
        },
      },
      {
        rowKind: 'tera_type',
        payload: {
          tera_type_id: '00000000-0000-4000-8000-000000000003', identifier: 'normal', name_ko: '노말',
          reference_type_id: '00000000-0000-4000-8000-000000000004', sort_order: 0,
        },
      },
      {
        rowKind: 'form_tera_option',
        payload: {
          form_id: '00000000-0000-4000-8000-000000000001',
          tera_type_id: '00000000-0000-4000-8000-000000000003',
        },
      },
      {
        rowKind: 'form_gigantamax_option',
        payload: {
          source_form_id: '00000000-0000-4000-8000-000000000001',
          gigantamax_form_id: '00000000-0000-4000-8000-000000000005',
        },
      },
    ])
    expect(JSON.stringify(rows)).not.toContain('form-a')
    expect(rows.find((row) => row.rowKind === 'tera_type')?.payload.name_ko).toBe('노말')
  })

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

  it('전투 의미 계약을 위반한 후보를 거부한다', () => {
    const candidate = structuredClone(validCandidate)
    candidate.forms[0].baseStats.hp = 0

    expect(() => assertPublishableOptionCandidate(candidate)).toThrow('forms:form-0:baseStats')
  })

  it('중복 관계가 있으면 전체 validator가 거부한다', () => {
    const candidate = structuredClone(validCandidate)
    candidate.learnsets[1] = { ...candidate.learnsets[0] }

    expect(() => assertPublishableOptionCandidate(candidate))
      .toThrow('learnsets:species-a::move-0:level:1:레벨 1에 습득 0:duplicate')
  })

  it.each([
    ['printf', (candidate: ReferenceDataset) => { candidate.items[0].nameKo = '%s포플레' }, '%s'],
    ['brace', (candidate: ReferenceDataset) => { candidate.items[0].descriptionKo = '{count}개 사용' }, '{count}'],
  ] as const)('%s 표시 토큰이 있으면 전체 validator가 거부한다', (
    _label,
    tamper,
    token,
  ) => {
    const candidate = structuredClone(validCandidate)
    tamper(candidate)

    expect(() => assertPublishableOptionCandidate(candidate)).toThrow(token)
  })

  it('검토 허용 목록에 없는 누락 메가 진단을 거부한다', () => {
    const candidate = structuredClone(validCandidate)
    candidate.evolutions[0] = {
      id: 'species-a>megaspecies-a:0', fromSpeciesId: 'species-a', fromFormId: 'form-0',
      toSpeciesId: 'species-a', conditionKo: '키스톤 사용',
    }
    candidate.sourceDiagnostics = [{
      code: 'missing-evolution-target-form', table: 'evolutions',
      key: 'species-a>megaspecies-a:0', target: 'forms:species-a-mega',
    }]

    expect(() => assertPublishableOptionCandidate(candidate))
      .toThrow('sourceDiagnostics:species-a>megaspecies-a:0:unreviewed')
  })

  it('행 수 또는 보고 수가 맞지 않으면 거부한다', () => {
    const candidate = {
      version: 'fixture-v1', sourceCommits: {}, sha256: {},
      reportedCounts: { types: 0, species: 0, forms: 0, abilities: 0, moves: 825, learnsets: 116519, items: 0, evolutions: 0, formAbilities: 3055, natures: 0, typeMatchups: 0 },
      types: [], species: [], forms: [], abilities: [], moves: [], learnsets: [], items: [], evolutions: [], formAbilities: [], natures: [], typeMatchups: [],
    } as unknown as ReferenceDataset

    expect(() => assertPublishableOptionCandidate(candidate))
      .toThrow('moves:actual=0:reported=825:expected=826')
  })

  it.each([
    ['forms', 1497, 1498, 'forms:actual=1497:reported=1498:expected=1498'],
    ['formAbilities', 3054, 3055, 'formAbilities:actual=3054:reported=3055:expected=3055'],
    ['learnsets', 116519, 116518, 'learnsets:actual=116519:reported=116518:expected=116519'],
  ] as const)('%s의 실제 또는 보고 행 수 불일치를 거부한다', (key, actual, reported, expected) => {
    const candidate = {
      moves: Array.from({ length: 826 }),
      forms: Array.from({ length: key === 'forms' ? actual : 1498 }),
      formAbilities: Array.from({ length: key === 'formAbilities' ? actual : 3055 }),
      learnsets: Array.from({ length: key === 'learnsets' ? actual : 116519 }),
      reportedCounts: {
        moves: 826,
        forms: key === 'forms' ? reported : 1498,
        formAbilities: key === 'formAbilities' ? reported : 3055,
        learnsets: key === 'learnsets' ? reported : 116519,
        natures: 25,
        teraTypes: 19,
        formTeraOptions: 25_184,
        formGigantamaxOptions: 42,
      },
      natures: Array.from({ length: 25 }),
      teraTypes: Array.from({ length: 19 }),
      formTeraOptions: Array.from({ length: 25_184 }),
      formGigantamaxOptions: Array.from({ length: 42 }),
    } as unknown as Pick<
      ReferenceDataset,
      | 'moves'
      | 'forms'
      | 'formAbilities'
      | 'learnsets'
      | 'natures'
      | 'teraTypes'
      | 'formTeraOptions'
      | 'formGigantamaxOptions'
      | 'reportedCounts'
    >

    expect(() => assertOptionFilterPublicationCounts(candidate)).toThrow(expected)
  })

  it.each([
    [
      '기술 타입 식별자',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        moves: candidate.moves.map((row, index) => index === 0
          ? { ...row, typeId: 'missing-type' }
          : row),
      }),
      'moves:move-0:typeId',
    ],
    [
      '특성 한국어 설명',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        abilities: [{ ...candidate.abilities[0], descriptionKo: 'English only' }],
      }),
      'abilities:ability-a:descriptionKo',
    ],
    [
      '기술 습득 한국어 조건',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        learnsets: candidate.learnsets.map((row, index) => index === 0
          ? { ...row, conditionKo: 'Level 1' }
          : row),
      }),
      'learnsets:0:conditionKo',
    ],
    [
      '기술 습득 기술 참조',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        learnsets: candidate.learnsets.map((row, index) => index === 0
          ? { ...row, moveId: 'missing-move' }
          : row),
      }),
      'learnsets:0:moveId',
    ],
    [
      '기본 모습의 같은 종 소속',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        species: [
          ...candidate.species,
          {
            id: 'species-b', nationalDexNumber: 2, nameKo: '이상해풀',
            descriptionKo: '두 번째 검증용 포켓몬이다.',
          },
        ],
        forms: candidate.forms.map((row, index) => index === 1
          ? { ...row, speciesId: 'species-b', baseFormId: 'form-0' }
          : row),
      }),
      'forms:form-1:baseFormId',
    ],
    [
      '폼 특성 종 일치',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        species: [
          ...candidate.species,
          {
            id: 'species-b', nationalDexNumber: 2, nameKo: '이상해풀',
            descriptionKo: '두 번째 검증용 포켓몬이다.',
          },
        ],
        formAbilities: candidate.formAbilities.map((row, index) => index === 0
          ? { ...row, speciesId: 'species-b' }
          : row),
      }),
      'formAbilities:0:speciesId',
    ],
    [
      '폼 특성 특성 참조',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        formAbilities: candidate.formAbilities.map((row, index) => index === 0
          ? { ...row, abilityId: 'missing-ability' }
          : row),
      }),
      'formAbilities:0:abilityId',
    ],
  ] as const)('행 수가 맞아도 %s 계약 위반을 거부한다', (
    _label,
    modify,
    expected,
  ) => {
    expect(() => assertPublishableOptionCandidate(modify(validCandidate))).toThrow(expected)
  })

  it('스테이징 배치가 실패하면 기존 게시본 교체를 호출하지 않는다', async () => {
    const candidate = createProductionReferenceCandidate()
    sourceMock.trustedDataset = structuredClone(candidate)
    const { client, rpc, stagingQuery } = createPublisherHarness(candidate, { failInsertAt: 2 })

    await expect(publishPokemonOptionFilterReferenceData(
      candidate, 'trusted-source', client as never,
    )).rejects.toThrow('second batch failed')

    expect(stagingQuery.insert).toHaveBeenCalledTimes(2)
    expect(rpc).not.toHaveBeenCalled()
    expect(stagingQuery.delete).toHaveBeenCalledOnce()
  }, 30_000)

  it('교체 RPC가 실패하면 원래 오류를 유지하면서 해당 시도의 스테이징을 정리한다', async () => {
    const candidate = createProductionReferenceCandidate()
    sourceMock.trustedDataset = structuredClone(candidate)
    const { client, rpc, stagingQuery } = createPublisherHarness(candidate, {
      rpcError: 'replacement RPC failed',
    })

    await expect(publishPokemonOptionFilterReferenceData(
      candidate, 'trusted-source', client as never,
    )).rejects.toThrow('replacement RPC failed')

    expect(rpc).toHaveBeenCalledOnce()
    expect(stagingQuery.delete).toHaveBeenCalledOnce()
  }, 30_000)

  it('스테이징과 cleanup이 모두 실패하면 원래 오류와 cleanup 오류를 함께 반환한다', async () => {
    const candidate = createProductionReferenceCandidate()
    sourceMock.trustedDataset = structuredClone(candidate)
    const { client, publicationId, rpc, stagingQuery } = createPublisherHarness(candidate, {
      failInsertAt: 2,
      cleanupError: 'cleanup failed after staging',
    })

    const rejection = await publishPokemonOptionFilterReferenceData(
      candidate, 'trusted-source', client as never,
    ).then(() => null, (error: unknown) => error)

    expect(rejection).toBeInstanceOf(AggregateError)
    const aggregate = rejection as AggregateError & { cause?: unknown }
    expect(aggregate.errors.map((error) => (error as Error).message)).toEqual([
      'reference_option_filter_publication_staging 게시 실패: second batch failed',
      '포켓몬 선택 필터 스테이징 정리 실패: cleanup failed after staging',
    ])
    expect(aggregate.cause).toBe(aggregate.errors[0])
    const stagedBatchId = (stagingQuery.insert.mock.calls[0][0] as Array<{ batch_id: string }>)[0].batch_id
    expect(stagingQuery.eq.mock.calls).toEqual([
      ['batch_id', stagedBatchId],
      ['publication_id', publicationId],
    ])
    expect(rpc).not.toHaveBeenCalled()
  }, 30_000)

  it('RPC와 cleanup이 모두 실패하면 원래 오류와 cleanup 오류를 함께 반환한다', async () => {
    const candidate = createProductionReferenceCandidate()
    sourceMock.trustedDataset = structuredClone(candidate)
    const { client, publicationId, rpc, stagingQuery } = createPublisherHarness(candidate, {
      rpcError: 'replacement RPC failed',
      cleanupError: 'cleanup failed after RPC',
    })

    const rejection = await publishPokemonOptionFilterReferenceData(
      candidate, 'trusted-source', client as never,
    ).then(() => null, (error: unknown) => error)

    expect(rejection).toBeInstanceOf(AggregateError)
    const aggregate = rejection as AggregateError & { cause?: unknown }
    expect(aggregate.errors.map((error) => (error as Error).message)).toEqual([
      '포켓몬 선택 필터 교체 실패: replacement RPC failed',
      '포켓몬 선택 필터 스테이징 정리 실패: cleanup failed after RPC',
    ])
    expect(aggregate.cause).toBe(aggregate.errors[0])
    const stagedBatchId = (stagingQuery.insert.mock.calls[0][0] as Array<{ batch_id: string }>)[0].batch_id
    expect(stagingQuery.eq.mock.calls).toEqual([
      ['batch_id', stagedBatchId],
      ['publication_id', publicationId],
    ])
    expect(rpc).toHaveBeenCalledOnce()
  }, 30_000)
})
