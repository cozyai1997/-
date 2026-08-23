// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type LocalEnvironment = { API_URL: string; SERVICE_ROLE_KEY: string }

let admin: SupabaseClient
let previousActivePublicationId: string | null = null
const ids = {
  publication: randomUUID(),
  retiredPublication: randomUUID(),
  failedBatch: randomUUID(),
  firstSuccessfulBatch: randomUUID(),
  secondSuccessfulBatch: randomUUID(),
  type: randomUUID(),
  species: randomUUID(),
  baseForm: randomUUID(),
  form: randomUUID(),
  ability: randomUUID(),
  move: randomUUID(),
}

function localEnvironment(): LocalEnvironment {
  const cliPath = resolve(process.cwd(), 'node_modules/supabase/dist/supabase.js')
  const result = spawnSync(process.execPath, [cliPath, 'status', '-o', 'env'], {
    cwd: process.cwd(), encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error('로컬 Supabase가 실행 중이어야 합니다.')
  const values = Object.fromEntries(
    result.stdout
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/u))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1], match[2]]),
  )
  if (!values.API_URL || !values.SERVICE_ROLE_KEY) {
    throw new Error('로컬 서비스 역할 환경을 찾지 못했습니다.')
  }
  return values as LocalEnvironment
}

function runLocalSql(sql: string): void {
  const cliPath = resolve(process.cwd(), 'node_modules/supabase/dist/supabase.js')
  const result = spawnSync(process.execPath, [cliPath, 'db', 'query', '--local', sql], {
    cwd: process.cwd(), encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join('\n') || '로컬 SQL 준비에 실패했습니다.')
  }
}

function setupSql(): string {
  const dex = 8_000 + (Number.parseInt(ids.publication.slice(0, 6), 16) % 1_000)
  return `do $setup$
begin
  insert into public.data_publications (
    id, version, status, validated_at, activated_at
  ) values (
    '${ids.publication}', 'atomic-${ids.publication}', 'active', now(), now()
  );
  insert into public.data_publications (id, version, status)
    values ('${ids.retiredPublication}', 'atomic-retired-${ids.retiredPublication}', 'retired');
  insert into public.reference_types (
    id, publication_id, identifier, name_ko, color_hex, sort_order
  ) values (
    '${ids.type}', '${ids.publication}', 'atomic-${ids.type}', '노말', '#A8A77A', 0
  );
  insert into public.reference_species (
    id, publication_id, national_dex_number, identifier, name_ko, description_ko
  ) values (
    '${ids.species}', '${ids.publication}', ${dex}, 'atomic-${ids.species}',
    '이브이', '원자 교체 검증용'
  );
  insert into public.reference_forms (
    id, publication_id, species_id, identifier, name_ko, is_default
  ) values (
    '${ids.baseForm}', '${ids.publication}', '${ids.species}',
    'atomic-base-${ids.baseForm}', '기본 모습', true
  ), (
    '${ids.form}', '${ids.publication}', '${ids.species}',
    'atomic-target-${ids.form}', '대상 모습', false
  );
  insert into public.reference_forms (
    publication_id, species_id, identifier, name_ko, is_default
  )
  select '${ids.publication}', '${ids.species}',
    'atomic-extra-${ids.publication}-' || value,
    '추가 모습 ' || value,
    false
  from generate_series(1, 1496) as value;
  insert into public.reference_abilities (
    id, publication_id, identifier, name_ko, description_ko
  ) values (
    '${ids.ability}', '${ids.publication}', 'atomic-${ids.ability}',
    '적응력', '같은 타입 기술이 강해진다.'
  );
  insert into public.reference_moves (
    id, publication_id, identifier, name_ko, description_ko,
    type_id, damage_class, pp
  ) values (
    '${ids.move}', '${ids.publication}', 'atomic-move-0-${ids.publication}',
    '기존 몸통박치기', '기존 기술 설명', '${ids.type}', 'physical', 35
  );
  insert into public.reference_form_abilities (
    publication_id, form_id, ability_id, slot, is_hidden
  ) values (
    '${ids.publication}', '${ids.form}', '${ids.ability}', 'first', false
  );
  insert into public.reference_move_learnsets (
    publication_id, species_id, form_id, move_id,
    learn_method, learn_level, condition_ko
  ) values (
    '${ids.publication}', '${ids.species}', null, '${ids.move}',
    'level', 0, '레벨 상승으로 습득'
  );
end
$setup$;`
}

function stagedRowsSql(batchId: string, failAfterMutableWrites: boolean): string {
  return `do $stage$
begin
  insert into public.reference_option_filter_publication_staging (
    batch_id, publication_id, row_kind, source_order, payload
  )
  select '${batchId}', '${ids.publication}', 'move', value,
    jsonb_build_object(
      'identifier', 'atomic-move-' || value || '-${ids.publication}',
      'name_ko', '새 기술 ' || value,
      'description_ko', '새 기술 한국어 설명 ' || value,
      'type_id', '${ids.type}',
      'damage_class', 'physical',
      'power', 40,
      'accuracy', 100,
      'pp', 35,
      'is_active', true
    )
  from generate_series(0, 825) as value;

  insert into public.reference_option_filter_publication_staging (
    batch_id, publication_id, row_kind, source_order, payload
  )
  select '${batchId}', '${ids.publication}', 'form_base_link', source_order,
    jsonb_build_object(
      'form_id', form_id,
      'base_form_id', case when form_id = '${ids.form}'::uuid then '${ids.baseForm}'::uuid else null end
    )
  from (
    select id as form_id, row_number() over (order by id) - 1 as source_order
    from public.reference_forms
    where publication_id = '${ids.publication}'
  ) as staged_forms;

  insert into public.reference_option_filter_publication_staging (
    batch_id, publication_id, row_kind, source_order, payload
  )
  select '${batchId}', '${ids.publication}', 'form_ability', value,
    jsonb_build_object(
      'form_id', '${ids.form}',
      'ability_id', '${ids.ability}',
      'slot', 'first',
      'is_hidden', false
    )
  from generate_series(0, 3054) as value;

  insert into public.reference_option_filter_publication_staging (
    batch_id, publication_id, row_kind, source_order, payload
  )
  select '${batchId}', '${ids.publication}', 'learnset', value,
    jsonb_build_object(
      'species_id', '${ids.species}',
      'form_id', null,
      'move_identifier', 'atomic-move-' || (value % 826) || '-${ids.publication}',
      'learn_method', 'level',
      'learn_level', case when ${failAfterMutableWrites ? 'value = 116518' : 'false'} then 101 else 0 end,
      'condition_ko', '레벨 상승으로 습득'
    )
  from generate_series(0, 116518) as value;
end
$stage$;`
}

const describeLocalSupabase = process.env.RUN_SUPABASE_INTEGRATION === '1' ? describe : describe.skip

describeLocalSupabase('포켓몬 선택 필터 원자 교체', () => {
  beforeAll(async () => {
    const environment = localEnvironment()
    admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const previousActive = await admin
      .from('data_publications')
      .select('id')
      .eq('status', 'active')
      .maybeSingle()
    if (previousActive.error) throw previousActive.error
    previousActivePublicationId = previousActive.data?.id ?? null
    if (previousActivePublicationId) {
      const retired = await admin
        .from('data_publications')
        .update({ status: 'retired' })
        .eq('id', previousActivePublicationId)
      if (retired.error) throw retired.error
    }
    runLocalSql(setupSql())
  })

  afterAll(async () => {
    if (!admin) return
    const failures: string[] = []
    const collect = (label: string, error: { message?: string } | null) => {
      if (error) failures.push(`${label}: ${error.message ?? '알 수 없는 오류'}`)
    }
    collect('시험 게시본 은퇴', (await admin
      .from('data_publications')
      .update({ status: 'retired' })
      .eq('id', ids.publication)).error)
    if (previousActivePublicationId) {
      collect('기존 게시본 복구', (await admin
        .from('data_publications')
        .update({ status: 'active' })
        .eq('id', previousActivePublicationId)).error)
    }
    collect('스테이징 삭제', (await admin
      .from('reference_option_filter_publication_staging')
      .delete()
      .eq('publication_id', ids.publication)).error)
    collect('폼 특성 삭제', (await admin
      .from('reference_form_abilities')
      .delete()
      .eq('publication_id', ids.publication)).error)
    collect('기술 습득 삭제', (await admin
      .from('reference_move_learnsets')
      .delete()
      .eq('publication_id', ids.publication)).error)
    collect('기술 삭제', (await admin
      .from('reference_moves')
      .delete()
      .eq('publication_id', ids.publication)).error)
    collect('특성 삭제', (await admin.from('reference_abilities').delete().eq('id', ids.ability)).error)
    collect('모습 링크 해제', (await admin
      .from('reference_forms')
      .update({ base_form_id: null })
      .eq('publication_id', ids.publication)).error)
    collect('모습 삭제', (await admin
      .from('reference_forms')
      .delete()
      .eq('publication_id', ids.publication)).error)
    collect('종 삭제', (await admin.from('reference_species').delete().eq('id', ids.species)).error)
    collect('타입 삭제', (await admin.from('reference_types').delete().eq('id', ids.type)).error)
    collect('게시본 삭제', (await admin
      .from('data_publications')
      .delete()
      .in('id', [ids.publication, ids.retiredPublication])).error)

    const residue = await Promise.all([
      admin.from('reference_option_filter_publication_staging').select('id', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_moves').select('id', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_forms').select('id', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('data_publications').select('id', { count: 'exact', head: true }).in('id', [ids.publication, ids.retiredPublication]),
    ])
    for (const [index, result] of residue.entries()) {
      collect(`잔존 조회 ${index + 1}`, result.error)
      if ((result.count ?? 0) > 0) failures.push(`잔존 조회 ${index + 1}: ${result.count}개`)
    }
    if (failures.length) throw new Error(`원자 교체 픽스처 정리 실패\n${failures.join('\n')}`)
  })

  it('후반 learnset 제약 실패가 먼저 적용한 move/base-link까지 롤백한다', async () => {
    runLocalSql(stagedRowsSql(ids.failedBatch, true))
    const replacement = await admin.rpc('replace_pokemon_option_filter_reference_data', {
      p_publication_id: ids.publication,
      p_batch_id: ids.failedBatch,
    })
    expect(replacement.error?.code).toBe('23514')

    const [move, form, abilities, learnsets] = await Promise.all([
      admin.from('reference_moves').select('name_ko').eq('id', ids.move).single(),
      admin.from('reference_forms').select('base_form_id').eq('id', ids.form).single(),
      admin.from('reference_form_abilities').select('ability_id').eq('publication_id', ids.publication),
      admin.from('reference_move_learnsets').select('move_id,learn_level').eq('publication_id', ids.publication),
    ])
    expect(move.data).toEqual({ name_ko: '기존 몸통박치기' })
    expect(form.data).toEqual({ base_form_id: null })
    expect(abilities.data).toEqual([{ ability_id: ids.ability }])
    expect(learnsets.data).toEqual([{ move_id: ids.move, learn_level: 0 }])
    const cleanup = await admin
      .from('reference_option_filter_publication_staging')
      .delete()
      .eq('batch_id', ids.failedBatch)
    expect(cleanup.error).toBeNull()
  }, 60_000)

  it('같은 active publication을 두 번 완전히 교체하고 네 종류 staging을 모두 지운다', async () => {
    for (const batchId of [ids.firstSuccessfulBatch, ids.secondSuccessfulBatch]) {
      runLocalSql(stagedRowsSql(batchId, false))
      const replacement = await admin.rpc('replace_pokemon_option_filter_reference_data', {
        p_publication_id: ids.publication,
        p_batch_id: batchId,
      })
      expect(replacement.error).toBeNull()
    }

    const [moveCount, formAbilityCount, learnsetCount, move, form, stagingResidue] = await Promise.all([
      admin.from('reference_moves').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_form_abilities').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_move_learnsets').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_moves').select('name_ko').eq('id', ids.move).single(),
      admin.from('reference_forms').select('base_form_id').eq('id', ids.form).single(),
      admin.from('reference_option_filter_publication_staging').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
    ])
    expect(moveCount.count).toBe(826)
    expect(formAbilityCount.count).toBe(3_055)
    expect(learnsetCount.count).toBe(116_519)
    expect(move.data).toEqual({ name_ko: '새 기술 0' })
    expect(form.data).toEqual({ base_form_id: ids.baseForm })
    expect(stagingResidue.count).toBe(0)
  }, 60_000)

  it('은퇴 게시본은 교체 대상으로 받지 않는다', async () => {
    const replacement = await admin.rpc('replace_pokemon_option_filter_reference_data', {
      p_publication_id: ids.retiredPublication,
      p_batch_id: randomUUID(),
    })
    expect(replacement.error?.message).toContain('active')
  })
})
