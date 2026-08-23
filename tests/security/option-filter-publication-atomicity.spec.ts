// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type LocalEnvironment = { API_URL: string; SERVICE_ROLE_KEY: string }

let admin: SupabaseClient
const ids = {
  publication: randomUUID(),
  batch: randomUUID(),
  type: randomUUID(),
  species: randomUUID(),
  invalidSpecies: randomUUID(),
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
  if (!values.API_URL || !values.SERVICE_ROLE_KEY) throw new Error('로컬 서비스 역할 환경을 찾지 못했습니다.')
  return values as LocalEnvironment
}

function runLocalSql(sql: string): void {
  const cliPath = resolve(process.cwd(), 'node_modules/supabase/dist/supabase.js')
  const result = spawnSync(process.execPath, [cliPath, 'db', 'query', '--local', sql], {
    cwd: process.cwd(), encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(result.stderr || '로컬 SQL 준비에 실패했습니다.')
}

function setupSql(): string {
  const dex = 9000 + (Number.parseInt(ids.publication.slice(0, 6), 16) % 900)
  return `do $setup$
begin
  insert into public.data_publications (id, version) values ('${ids.publication}', 'atomic-${ids.publication}');
  insert into public.reference_types (id, publication_id, identifier, name_ko, color_hex, sort_order)
    values ('${ids.type}', '${ids.publication}', 'atomic-${ids.type}', '노말', '#A8A77A', 0);
  insert into public.reference_species (id, publication_id, national_dex_number, identifier, name_ko, description_ko)
    values ('${ids.species}', '${ids.publication}', ${dex}, 'atomic-${ids.species}', '이브이', '원자 교체 검증용');
  insert into public.reference_forms (id, publication_id, species_id, identifier, name_ko, is_default)
    values ('${ids.form}', '${ids.publication}', '${ids.species}', 'atomic-${ids.form}', '일반', true);
  insert into public.reference_abilities (id, publication_id, identifier, name_ko, description_ko)
    values ('${ids.ability}', '${ids.publication}', 'atomic-${ids.ability}', '적응력', '같은 타입 기술이 강해진다.');
  insert into public.reference_moves (id, publication_id, identifier, name_ko, description_ko, type_id, damage_class, pp)
    values ('${ids.move}', '${ids.publication}', 'atomic-${ids.move}', '몸통박치기', '상대에게 부딪친다.', '${ids.type}', 'physical', 35);
  insert into public.reference_form_abilities (publication_id, form_id, ability_id, slot, is_hidden)
    values ('${ids.publication}', '${ids.form}', '${ids.ability}', 'first', false);
  insert into public.reference_move_learnsets (publication_id, species_id, form_id, move_id, learn_method, learn_level, condition_ko)
    values ('${ids.publication}', '${ids.species}', null, '${ids.move}', 'level', 0, '레벨 상승으로 습득');
  insert into public.reference_option_filter_publication_staging (batch_id, publication_id, row_kind, source_order, payload)
  select '${ids.batch}', '${ids.publication}', 'form_ability', value,
    jsonb_build_object('form_id', '${ids.form}', 'ability_id', '${ids.ability}', 'slot', 'first', 'is_hidden', false)
  from generate_series(0, 3054) as value;
  insert into public.reference_option_filter_publication_staging (batch_id, publication_id, row_kind, source_order, payload)
  select '${ids.batch}', '${ids.publication}', 'learnset', value,
    jsonb_build_object('species_id', '${ids.invalidSpecies}', 'form_id', null, 'move_id', '${ids.move}', 'learn_method', 'level', 'learn_level', 0, 'condition_ko', '레벨 상승으로 습득')
  from generate_series(0, 116518) as value;
end
$setup$;`
}

describe('포켓몬 선택 필터 원자 교체', () => {
  beforeAll(() => {
    const environment = localEnvironment()
    admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    runLocalSql(setupSql())
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('reference_option_filter_publication_staging').delete().eq('batch_id', ids.batch)
    await admin.from('reference_form_abilities').delete().eq('publication_id', ids.publication)
    await admin.from('reference_move_learnsets').delete().eq('publication_id', ids.publication)
    await admin.from('reference_moves').delete().eq('id', ids.move)
    await admin.from('reference_abilities').delete().eq('id', ids.ability)
    await admin.from('reference_forms').delete().eq('id', ids.form)
    await admin.from('reference_species').delete().eq('id', ids.species)
    await admin.from('reference_types').delete().eq('id', ids.type)
    await admin.from('data_publications').delete().eq('id', ids.publication)
  })

  it('교체 RPC의 FK 실패 후에도 기존 live 관계 행을 보존한다', async () => {
    const replacement = await admin.rpc('replace_pokemon_option_filter_reference_data', {
      p_publication_id: ids.publication,
      p_batch_id: ids.batch,
    })
    expect(replacement.error?.code).toBe('23503')

    const [abilities, learnsets] = await Promise.all([
      admin.from('reference_form_abilities').select('ability_id').eq('publication_id', ids.publication),
      admin.from('reference_move_learnsets').select('move_id,learn_level').eq('publication_id', ids.publication),
    ])
    expect(abilities.data).toEqual([{ ability_id: ids.ability }])
    expect(learnsets.data).toEqual([{ move_id: ids.move, learn_level: 0 }])
  })
})
