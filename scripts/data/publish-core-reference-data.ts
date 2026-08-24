import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  analyzeSourceDiagnostics,
  collectEvolutionFormIntegrityIssues,
  type ReferenceDataset,
} from '../../src/features/localization/reference-data-validation'

const hangulPattern = /[ㄱ-ㅎㅏ-ㅣ가-힣]/u

const typeColors: Record<string, string> = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
}

const formNames: Record<string, string> = {
  Normal: '일반', Gmax: '거다이맥스', Mega: '메가진화', 'Mega-X': '메가진화 X',
  'Mega-Y': '메가진화 Y', Alola: '알로라의 모습', Galar: '가라르의 모습',
  Hisui: '히스이의 모습', Paldea: '팔데아의 모습', Primal: '원시회귀',
  Origin: '오리진폼', Therian: '영물폼', Crowned: '왕의 모습',
}

type CoreReferenceData = ReturnType<typeof prepareCoreReferenceData>

function localizedFormName(value: string): string {
  if (hangulPattern.test(value)) return value.trim()
  if (formNames[value]) return formNames[value]

  const translated = value
    .replaceAll('Mega', '메가진화')
    .replaceAll('Gmax', '거다이맥스')
    .replaceAll('Alola', '알로라')
    .replaceAll('Galar', '가라르')
    .replaceAll('Hisui', '히스이')
    .replaceAll('Paldea', '팔데아')
    .replaceAll('Origin', '오리진')
    .replaceAll('Form', '폼')
  return hangulPattern.test(translated) ? translated : '특수 모습'
}

export function prepareCoreReferenceData(dataset: ReferenceDataset) {
  const speciesIds = new Set(dataset.species.map((row) => row.id))
  const typeIds = new Set(dataset.types.map((row) => row.id))

  const types = dataset.types.map((row, index) => ({
    identifier: row.id,
    nameKo: row.nameKo,
    colorHex: typeColors[row.id] ?? '#64748B',
    sortOrder: index,
  }))
  const species = dataset.species.map((row) => ({
    identifier: row.id,
    nationalDexNumber: row.nationalDexNumber,
    nameKo: row.nameKo,
    descriptionKo: row.descriptionKo ?? '설명 정보가 없습니다.',
    primaryTypeIdentifier: row.primaryTypeId ?? null,
    secondaryTypeIdentifier: row.secondaryTypeId ?? null,
  }))
  const forms = dataset.forms
    .filter((row) => speciesIds.has(row.speciesId))
    .map((row) => ({
      identifier: row.id,
      speciesIdentifier: row.speciesId,
      nameKo: localizedFormName(row.nameKo),
      primaryTypeIdentifier: row.primaryTypeId && typeIds.has(row.primaryTypeId)
        ? row.primaryTypeId
        : null,
      secondaryTypeIdentifier: row.secondaryTypeId && typeIds.has(row.secondaryTypeId)
        ? row.secondaryTypeId
        : null,
      isDefault: row.id === `${row.speciesId}-normal`,
    }))
  const abilities = dataset.abilities.map((row) => ({
    identifier: row.id,
    nameKo: row.nameKo,
    descriptionKo: row.descriptionKo ?? '설명 정보가 없습니다.',
  }))
  const items = dataset.items
    .filter((row) => hangulPattern.test(row.nameKo) && hangulPattern.test(row.descriptionKo ?? ''))
    .map((row) => ({
      identifier: row.id,
      nameKo: row.nameKo,
      descriptionKo: row.descriptionKo ?? '',
    }))
  const natures = dataset.natures.map((row) => ({
    identifier: row.id,
    nameKo: row.nameKo,
    increasedStat: null,
    decreasedStat: null,
  }))
  const evolutions = analyzeEvolutionPublication(dataset).evolutions
  const typeMatchups = dataset.typeMatchups
    .filter((row) => typeIds.has(row.attackingTypeId) && typeIds.has(row.defendingTypeId))
    .map((row) => ({
      attackingTypeIdentifier: row.attackingTypeId,
      defendingTypeIdentifier: row.defendingTypeId,
      multiplier: row.multiplier,
    }))

  return { types, species, forms, abilities, items, natures, evolutions, typeMatchups }
}

export function analyzeEvolutionPublication(dataset: ReferenceDataset) {
  const speciesIds = new Set(dataset.species.map((row) => row.id))
  const formIds = new Set(dataset.forms.map((row) => row.id))
  const diagnosticAnalysis = analyzeSourceDiagnostics(dataset)
  if (diagnosticAnalysis.issues.length > 0) throw new Error(diagnosticAnalysis.issues[0])
  const formIntegrityIssues = collectEvolutionFormIntegrityIssues(
    dataset,
    diagnosticAnalysis.trustedMissingTargetKeys,
  )
  if (formIntegrityIssues.length > 0) {
    const issue = formIntegrityIssues[0]
    const label = issue.target.startsWith('formSpecies:')
      ? `toFormSpecies:${issue.target.slice('formSpecies:'.length)}`
      : issue.target
    throw new Error(`evolutions:${issue.key}:${label}`)
  }
  const missingTargetDiagnostics = diagnosticAnalysis.trustedDiagnostics
  const missingTargetKeys = diagnosticAnalysis.trustedMissingTargetKeys
  const evolutions: Array<{
    fromFormIdentifier: string
    toFormIdentifier: string
    conditionKo: string
    sortOrder: number
  }> = []
  let excludedPureSameSpeciesCount = 0
  let excludedMissingTargetCount = 0
  let excludedInvalidCount = 0

  dataset.evolutions.forEach((row, sourceIndex) => {
    const key = row.id ?? `${row.fromSpeciesId}>${row.toSpeciesId}:${sourceIndex}`
    const fromFormIdentifier = row.fromFormId ?? `${row.fromSpeciesId}-normal`
    const toFormIdentifier = row.toFormId ?? `${row.toSpeciesId}-normal`
    if (missingTargetKeys.has(key)) {
      excludedMissingTargetCount += 1
      return
    }
    if (
      !hangulPattern.test(row.conditionKo)
      || !speciesIds.has(row.fromSpeciesId)
      || !speciesIds.has(row.toSpeciesId)
      || !formIds.has(fromFormIdentifier)
      || (row.toFormId !== null && row.toFormId !== undefined && !formIds.has(toFormIdentifier))
    ) {
      excludedInvalidCount += 1
      return
    }
    if (row.fromSpeciesId === row.toSpeciesId && !row.toFormId) {
      excludedPureSameSpeciesCount += 1
      return
    }
    if (!formIds.has(toFormIdentifier)) {
      excludedInvalidCount += 1
      return
    }
    evolutions.push({
      fromFormIdentifier,
      toFormIdentifier,
      conditionKo: row.conditionKo,
      sortOrder: sourceIndex,
    })
  })

  const accountedCount = evolutions.length + excludedPureSameSpeciesCount
    + excludedMissingTargetCount + excludedInvalidCount
  if (accountedCount !== dataset.evolutions.length) {
    throw new Error(`evolutions:accounting:actual=${accountedCount}:source=${dataset.evolutions.length}`)
  }

  return {
    sourceCount: dataset.evolutions.length,
    publishableCount: evolutions.length,
    excludedPureSameSpeciesCount,
    excludedMissingTargetCount,
    excludedInvalidCount,
    missingTargetDiagnostics,
    evolutions,
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function jsonLiteral(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`
}

export function buildCoreReferenceSql(dataset: ReferenceDataset): string {
  const data: CoreReferenceData = prepareCoreReferenceData(dataset)
  const version = sqlLiteral(dataset.version)
  const rowCounts = Object.fromEntries(
    Object.entries(data).map(([key, rows]) => [key, rows.length]),
  )

  return `do $publication$
declare target_publication_id uuid;
begin
perform set_config('statement_timeout', '5min', true);

update public.data_publications
set status = 'retired', retired_at = now()
where status = 'active' and version <> ${version};

insert into public.data_publications (
  version, status, source_manifest, row_counts, sha256, validation_report, validated_at
) values (
  ${version}, 'validated', ${jsonLiteral(dataset.sourceCommits)}, ${jsonLiteral(rowCounts)},
  ${jsonLiteral(dataset.sha256)}, ${jsonLiteral({ valid: true, scope: 'core-registration-data' })}, now()
)
on conflict (version) do update set
  status = 'validated', source_manifest = excluded.source_manifest,
  row_counts = excluded.row_counts, sha256 = excluded.sha256,
  validation_report = excluded.validation_report, validated_at = now(),
  activated_at = null, retired_at = null
returning id into target_publication_id;

insert into public.reference_types (
  publication_id, identifier, name_ko, color_hex, sort_order, is_active
)
select target_publication_id, row.identifier, row."nameKo", row."colorHex", row."sortOrder", true
from jsonb_to_recordset(${jsonLiteral(data.types)})
  as row(identifier text, "nameKo" text, "colorHex" text, "sortOrder" smallint)
on conflict (identifier) do update set
  publication_id = excluded.publication_id, name_ko = excluded.name_ko,
  color_hex = excluded.color_hex, sort_order = excluded.sort_order, is_active = true;

insert into public.reference_species (
  publication_id, national_dex_number, identifier, name_ko, description_ko,
  primary_type_id, secondary_type_id, is_active
)
select target_publication_id, row."nationalDexNumber", row.identifier, row."nameKo", row."descriptionKo",
  primary_type.id, secondary_type.id, true
from jsonb_to_recordset(${jsonLiteral(data.species)})
  as row(identifier text, "nationalDexNumber" smallint, "nameKo" text, "descriptionKo" text,
    "primaryTypeIdentifier" text, "secondaryTypeIdentifier" text)
left join public.reference_types primary_type on primary_type.identifier = row."primaryTypeIdentifier"
left join public.reference_types secondary_type on secondary_type.identifier = row."secondaryTypeIdentifier"
on conflict (identifier) do update set
  publication_id = excluded.publication_id, national_dex_number = excluded.national_dex_number,
  name_ko = excluded.name_ko, description_ko = excluded.description_ko,
  primary_type_id = excluded.primary_type_id, secondary_type_id = excluded.secondary_type_id,
  is_active = true;

update public.reference_forms set is_default = false;
insert into public.reference_forms (
  publication_id, species_id, identifier, name_ko, primary_type_id,
  secondary_type_id, is_default, is_active
)
select target_publication_id, species.id, row.identifier, row."nameKo",
  primary_type.id, secondary_type.id, row."isDefault", true
from jsonb_to_recordset(${jsonLiteral(data.forms)})
  as row(identifier text, "speciesIdentifier" text, "nameKo" text,
    "primaryTypeIdentifier" text, "secondaryTypeIdentifier" text, "isDefault" boolean)
join public.reference_species species on species.identifier = row."speciesIdentifier"
left join public.reference_types primary_type on primary_type.identifier = row."primaryTypeIdentifier"
left join public.reference_types secondary_type on secondary_type.identifier = row."secondaryTypeIdentifier"
on conflict (identifier) do update set
  publication_id = excluded.publication_id, species_id = excluded.species_id,
  name_ko = excluded.name_ko, primary_type_id = excluded.primary_type_id,
  secondary_type_id = excluded.secondary_type_id, is_default = excluded.is_default,
  is_active = true;

update public.reference_species species
set primary_type_id = form.primary_type_id,
  secondary_type_id = form.secondary_type_id
from public.reference_forms form
where form.species_id = species.id and form.is_default;

insert into public.reference_abilities (publication_id, identifier, name_ko, description_ko, is_active)
select target_publication_id, row.identifier, row."nameKo", row."descriptionKo", true
from jsonb_to_recordset(${jsonLiteral(data.abilities)})
  as row(identifier text, "nameKo" text, "descriptionKo" text)
on conflict (identifier) do update set
  publication_id = excluded.publication_id, name_ko = excluded.name_ko,
  description_ko = excluded.description_ko, is_active = true;

insert into public.reference_items (publication_id, identifier, name_ko, description_ko, is_active)
select target_publication_id, row.identifier, row."nameKo", row."descriptionKo", true
from jsonb_to_recordset(${jsonLiteral(data.items)})
  as row(identifier text, "nameKo" text, "descriptionKo" text)
on conflict (identifier) do update set
  publication_id = excluded.publication_id, name_ko = excluded.name_ko,
  description_ko = excluded.description_ko, is_active = true;

insert into public.reference_natures (
  publication_id, identifier, name_ko, increased_stat, decreased_stat, is_active
)
select target_publication_id, row.identifier, row."nameKo", row."increasedStat", row."decreasedStat", true
from jsonb_to_recordset(${jsonLiteral(data.natures)})
  as row(identifier text, "nameKo" text, "increasedStat" text, "decreasedStat" text)
on conflict (identifier) do update set
  publication_id = excluded.publication_id, name_ko = excluded.name_ko,
  increased_stat = excluded.increased_stat, decreased_stat = excluded.decreased_stat,
  is_active = true;

delete from public.reference_evolution_rules rules
where rules.publication_id = target_publication_id;
insert into public.reference_evolution_rules (
  publication_id, from_form_id, to_form_id, condition_ko, sort_order
)
select target_publication_id, source_form.id, target_form.id, row."conditionKo", row."sortOrder"
from jsonb_to_recordset(${jsonLiteral(data.evolutions)})
  as row("fromFormIdentifier" text, "toFormIdentifier" text, "conditionKo" text, "sortOrder" smallint)
join public.reference_forms source_form on source_form.identifier = row."fromFormIdentifier"
join public.reference_forms target_form on target_form.identifier = row."toFormIdentifier";

insert into public.reference_type_matchups (
  attacking_type_id, defending_type_id, multiplier, publication_id
)
select attacking.id, defending.id, row.multiplier, target_publication_id
from jsonb_to_recordset(${jsonLiteral(data.typeMatchups)})
  as row("attackingTypeIdentifier" text, "defendingTypeIdentifier" text, multiplier numeric)
join public.reference_types attacking on attacking.identifier = row."attackingTypeIdentifier"
join public.reference_types defending on defending.identifier = row."defendingTypeIdentifier"
on conflict (attacking_type_id, defending_type_id) do update set
  multiplier = excluded.multiplier, publication_id = excluded.publication_id;

update public.data_publications
set status = 'active', activated_at = now(), retired_at = null
where version = ${version};
end
$publication$;
`
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function main(): void {
  const input = argument('--input')
  const output = argument('--output')
  if (!input || !output) {
    throw new Error('사용법: tsx scripts/data/publish-core-reference-data.ts --input <후보 JSON> --output <SQL 파일>')
  }
  const dataset = JSON.parse(readFileSync(resolve(input), 'utf8')) as ReferenceDataset
  const target = resolve(output)
  mkdirSync(dirname(target), { recursive: true })
  const temporary = `${target}.tmp`
  writeFileSync(temporary, buildCoreReferenceSql(dataset), 'utf8')
  renameSync(temporary, target)
  process.stdout.write(`${target}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
