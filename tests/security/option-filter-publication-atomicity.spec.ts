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
  thirdSuccessfulBatch: randomUUID(),
  obsoleteTera: randomUUID(),
  rotationSpecies: randomUUID(),
  rotationForm: randomUUID(),
  type: randomUUID(),
  species: randomUUID(),
  baseForm: randomUUID(),
  form: randomUUID(),
  ability: randomUUID(),
  move: randomUUID(),
}

let rotationOwnerId: string | null = null

const canonicalTeraIdentifiers = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy', 'stellar',
] as const

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
      'learn_level', 0,
      'condition_ko', '레벨 상승으로 습득'
    )
  from generate_series(0, 116518) as value;

  insert into public.reference_option_filter_publication_staging (
    batch_id, publication_id, row_kind, source_order, payload
  )
  select '${batchId}', '${ids.publication}', 'form_battle_profile', source_order,
    jsonb_build_object(
      'form_id', form_id,
      'base_hp', 55, 'base_attack', 55, 'base_defense', 50,
      'base_special_attack', 45, 'base_special_defense', 65, 'base_speed', 55,
      'is_battle_only', source_order >= 1334
    )
  from (
    select id as form_id, row_number() over (order by id) - 1 as source_order
    from public.reference_forms
    where publication_id = '${ids.publication}'
  ) as staged_forms;

  insert into public.reference_natures (publication_id, identifier, name_ko)
  select '${ids.publication}', 'atomic-nature-' || value || '-${ids.publication}', '성격 ' || value
  from generate_series(0, 24) as value
  on conflict (identifier) do nothing;

  insert into public.reference_option_filter_publication_staging (
    batch_id, publication_id, row_kind, source_order, payload
  )
  select '${batchId}', '${ids.publication}', 'nature_adjustment', value,
    jsonb_build_object(
      'nature_id', nature_id,
      'increased_stat', null,
      'decreased_stat', null
    )
  from (
    select id as nature_id, row_number() over (order by id) - 1 as value
    from public.reference_natures
    where publication_id = '${ids.publication}'
  ) as staged_natures;

  insert into public.reference_option_filter_publication_staging (
    batch_id, publication_id, row_kind, source_order, payload
  )
  select '${batchId}', '${ids.publication}', 'tera_type', ordinality - 1,
    jsonb_build_object(
      'tera_type_id', gen_random_uuid(),
      'identifier', identifier,
      'name_ko', '테라 ' || identifier,
      'reference_type_id', case when identifier = 'stellar' then null else '${ids.type}'::uuid end,
      'sort_order', ordinality - 1,
      'is_active', true
    )
  from unnest(array['${canonicalTeraIdentifiers.join("','")}']) with ordinality as tera(identifier, ordinality);

  insert into public.reference_option_filter_publication_staging (
    batch_id, publication_id, row_kind, source_order, payload
  )
  select '${batchId}', '${ids.publication}', 'form_tera_option', value,
    jsonb_build_object(
      'form_id', form_id,
      'tera_type_id', tera_type_id
    )
  from (
    select forms.id as form_id, tera.payload ->> 'tera_type_id' as tera_type_id,
      row_number() over (order by forms.id, tera.source_order) - 1 as value
    from public.reference_forms as forms
    cross join public.reference_option_filter_publication_staging as tera
    where forms.publication_id = '${ids.publication}'
      and tera.batch_id = '${batchId}'
      and tera.row_kind = 'tera_type'
    limit 25184
  ) as staged_options;

  insert into public.reference_option_filter_publication_staging (
    batch_id, publication_id, row_kind, source_order, payload
  )
  select '${batchId}', '${ids.publication}', 'form_gigantamax_option', value,
    jsonb_build_object(
      'source_form_id', source_form_id,
      'gigantamax_form_id', form_id
    )
  from (
    select target.id as form_id, source.id as source_form_id,
      row_number() over (order by target.id desc) - 1 as value
    from (select id from public.reference_forms where publication_id = '${ids.publication}' order by id limit 1) as source
    cross join (select id from public.reference_forms where publication_id = '${ids.publication}' order by id desc limit 42) as target
    limit 42
  ) as staged_gmax;

  ${failAfterMutableWrites ? `update public.reference_option_filter_publication_staging as duplicate
  set payload = original.payload
  from public.reference_option_filter_publication_staging as original
  where duplicate.batch_id = '${batchId}'
    and duplicate.row_kind = 'form_tera_option'
    and duplicate.source_order = 25183
    and original.batch_id = '${batchId}'
    and original.row_kind = 'form_tera_option'
    and original.source_order = 0;` : ''}
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
    if (rotationOwnerId) collect('회전 소유자 삭제', (await admin.auth.admin.deleteUser(rotationOwnerId)).error)
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
    collect('거다이맥스 관계 삭제', (await admin
      .from('reference_form_gigantamax_options')
      .delete()
      .eq('publication_id', ids.publication)).error)
    collect('테라 타입 관계 삭제', (await admin
      .from('reference_form_tera_options')
      .delete()
      .eq('publication_id', ids.publication)).error)
    collect('테라 타입 삭제', (await admin
      .from('reference_tera_types')
      .delete()
      .eq('publication_id', ids.publication)).error)
    collect('성격 삭제', (await admin
      .from('reference_natures')
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
    collect('은퇴 회전 모습 삭제', (await admin.from('reference_forms').delete().eq('id', ids.rotationForm)).error)
    collect('모습 삭제', (await admin
      .from('reference_forms')
      .delete()
      .eq('publication_id', ids.publication)).error)
    collect('은퇴 회전 종 삭제', (await admin.from('reference_species').delete().eq('id', ids.rotationSpecies)).error)
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

  it('후반 Tera 옵션 PK 실패가 먼저 적용한 move/base-link까지 롤백한다', async () => {
    runLocalSql(stagedRowsSql(ids.failedBatch, true))
    const replacement = await admin.rpc('replace_pokemon_option_filter_reference_data', {
      p_publication_id: ids.publication,
      p_batch_id: ids.failedBatch,
    })
    expect(replacement.error?.code).toBe('23505')

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

  it('active publication을 완전히 교체하고 아홉 종류 staging을 모두 지운다', async () => {
    for (const batchId of [ids.firstSuccessfulBatch]) {
      runLocalSql(stagedRowsSql(batchId, false))
      runLocalSql(`update public.reference_option_filter_publication_staging
        set payload = jsonb_set(payload, '{identifier}', '"count-correct-but-invalid"')
        where batch_id = '${batchId}' and row_kind = 'tera_type' and source_order = 0;`)
      const canonicalSet = await admin.rpc('replace_pokemon_option_filter_reference_data', {
        p_publication_id: ids.publication,
        p_batch_id: batchId,
      })
      expect(canonicalSet.error?.message).toContain('canonical 19')
      runLocalSql(`update public.reference_option_filter_publication_staging
        set payload = jsonb_set(payload, '{identifier}', '"normal"')
        where batch_id = '${batchId}' and row_kind = 'tera_type' and source_order = 0;`)
      const replacement = await admin.rpc('replace_pokemon_option_filter_reference_data', {
        p_publication_id: ids.publication,
        p_batch_id: batchId,
      })
      expect(replacement.error).toBeNull()
    }

    const [moveCount, formAbilityCount, learnsetCount, battleProfileCount, battleOnlyCount, natureCount, teraTypeCount, teraOptionCount, gmaxCount, move, form, stagingResidue] = await Promise.all([
      admin.from('reference_moves').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_form_abilities').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_move_learnsets').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_forms').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication).not('base_hp', 'is', null),
      admin.from('reference_forms').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication).eq('is_battle_only', true),
      admin.from('reference_natures').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_tera_types').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_form_tera_options').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_form_gigantamax_options').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_moves').select('name_ko').eq('id', ids.move).single(),
      admin.from('reference_forms').select('base_form_id').eq('id', ids.form).single(),
      admin.from('reference_option_filter_publication_staging').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
    ])
    expect(moveCount.count).toBe(826)
    expect(formAbilityCount.count).toBe(3_055)
    expect(learnsetCount.count).toBe(116_519)
    expect(battleProfileCount.count).toBe(1_498)
    expect(battleOnlyCount.count).toBe(164)
    expect(natureCount.count).toBe(25)
    expect(teraTypeCount.count).toBe(19)
    expect(teraOptionCount.count).toBe(25_184)
    expect(gmaxCount.count).toBe(42)
    expect(move.data).toEqual({ name_ko: '새 기술 0' })
    expect(form.data).toEqual({ base_form_id: ids.baseForm })
    expect(stagingResidue.count).toBe(0)
  }, 60_000)

  it('이전 게시본의 전투 관계를 지운 뒤 Tera 안정 UUID를 새 active 게시본으로 회전한다', async () => {
    const normal = await admin.from('reference_tera_types')
      .select('id').eq('publication_id', ids.publication).eq('identifier', 'normal').single()
    expect(normal.error).toBeNull()
    const option = await admin.from('reference_form_tera_options')
      .select('form_id').eq('publication_id', ids.publication).eq('tera_type_id', normal.data!.id).limit(1).single()
    expect(option.error).toBeNull()
    const selectedForm = await admin.from('reference_forms').select('species_id').eq('id', option.data!.form_id).single()
    expect(selectedForm.error).toBeNull()
    const owner = await admin.auth.admin.createUser({
      email: `atomic-rotation-${randomUUID()}@example.test`,
      password: `Rotation-${randomUUID()}-A1!`,
      email_confirm: true,
    })
    expect(owner.error).toBeNull()
    rotationOwnerId = owner.data.user!.id
    const owned = await admin.from('owned_pokemon').insert({
      user_id: rotationOwnerId,
      species_id: selectedForm.data!.species_id,
      form_id: option.data!.form_id,
      gender: 'genderless',
      level: 5,
      tera_type_id: normal.data!.id,
    })
    expect(owned.error).toBeNull()

    expect((await admin.from('reference_form_tera_options')
      .delete().eq('publication_id', ids.publication).eq('tera_type_id', normal.data!.id)).error).toBeNull()
    expect((await admin.from('reference_tera_types').update({ reference_type_id: null }).eq('id', normal.data!.id)).error).toBeNull()
    expect((await admin.from('reference_tera_types')
      .update({ publication_id: ids.retiredPublication }).eq('id', normal.data!.id)).error).toBeNull()
    expect((await admin.from('reference_tera_types').insert({
      id: ids.obsoleteTera,
      publication_id: ids.publication,
      identifier: `atomic-obsolete-${ids.obsoleteTera}`,
      name_ko: '폐기 테라',
      sort_order: 0,
      is_active: true,
    })).error).toBeNull()
    runLocalSql(`do $swap$
begin
  update public.reference_tera_types set sort_order = -1
    where publication_id = '${ids.publication}' and identifier = 'fighting';
  update public.reference_tera_types set sort_order = 1
    where publication_id = '${ids.publication}' and identifier = 'flying';
  update public.reference_tera_types set sort_order = 2
    where publication_id = '${ids.publication}' and identifier = 'fighting';
end
$swap$;`)
    expect((await admin.from('reference_species').insert({
      id: ids.rotationSpecies,
      publication_id: ids.retiredPublication,
      national_dex_number: 9_999,
      identifier: `atomic-retired-${ids.rotationSpecies}`,
      name_ko: '이전 회전 종',
      description_ko: '이전 게시본 관계 검증용',
    })).error).toBeNull()
    expect((await admin.from('reference_forms').insert({
      id: ids.rotationForm,
      publication_id: ids.retiredPublication,
      species_id: ids.rotationSpecies,
      identifier: `atomic-retired-form-${ids.rotationForm}`,
      name_ko: '이전 회전 모습',
      is_default: true,
    })).error).toBeNull()
    expect((await admin.from('reference_form_tera_options').insert({
      publication_id: ids.retiredPublication,
      form_id: ids.rotationForm,
      tera_type_id: normal.data!.id,
    })).error).toBeNull()

    runLocalSql(stagedRowsSql(ids.secondSuccessfulBatch, false))
    const replacement = await admin.rpc('replace_pokemon_option_filter_reference_data', {
      p_publication_id: ids.publication,
      p_batch_id: ids.secondSuccessfulBatch,
    })
    expect(replacement.error).toBeNull()
    const [rotated, ownedAfter, retiredOptions, obsolete] = await Promise.all([
      admin.from('reference_tera_types').select('id,publication_id,reference_type_id')
        .eq('identifier', 'normal').single(),
      admin.from('owned_pokemon').select('tera_type_id').eq('user_id', rotationOwnerId).single(),
      admin.from('reference_form_tera_options').select('form_id', { count: 'exact', head: true })
        .eq('publication_id', ids.retiredPublication).eq('tera_type_id', normal.data!.id),
      admin.from('reference_tera_types').select('publication_id,is_active').eq('id', ids.obsoleteTera).single(),
    ])
    expect(rotated.data).toEqual({ id: normal.data!.id, publication_id: ids.publication, reference_type_id: ids.type })
    expect(ownedAfter.data).toEqual({ tera_type_id: normal.data!.id })
    expect(retiredOptions.count).toBe(0)
    expect(obsolete.data).toEqual({ publication_id: ids.publication, is_active: false })

    const beforeIdempotent = await Promise.all([
      admin.from('reference_tera_types').select('id,identifier,reference_type_id,sort_order,is_active')
        .eq('publication_id', ids.publication).order('identifier'),
      admin.from('reference_moves').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_forms').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_form_tera_options').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_form_gigantamax_options').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
    ])
    runLocalSql(stagedRowsSql(ids.thirdSuccessfulBatch, false))
    const idempotent = await admin.rpc('replace_pokemon_option_filter_reference_data', {
      p_publication_id: ids.publication,
      p_batch_id: ids.thirdSuccessfulBatch,
    })
    expect(idempotent.error).toBeNull()
    const afterIdempotent = await Promise.all([
      admin.from('reference_tera_types').select('id,identifier,reference_type_id,sort_order,is_active')
        .eq('publication_id', ids.publication).order('identifier'),
      admin.from('reference_moves').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_forms').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_form_tera_options').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_form_gigantamax_options').select('*', { count: 'exact', head: true }).eq('publication_id', ids.publication),
      admin.from('reference_option_filter_publication_staging').select('*', { count: 'exact', head: true })
        .eq('publication_id', ids.publication),
    ])
    expect(afterIdempotent.slice(0, 5).map(({ data, count }) => ({ data, count })))
      .toEqual(beforeIdempotent.map(({ data, count }) => ({ data, count })))
    expect(afterIdempotent[5].count).toBe(0)
  }, 60_000)

  it('은퇴 게시본은 교체 대상으로 받지 않는다', async () => {
    const replacement = await admin.rpc('replace_pokemon_option_filter_reference_data', {
      p_publication_id: ids.retiredPublication,
      p_batch_id: randomUUID(),
    })
    expect(replacement.error?.message).toContain('active')
  })
})
