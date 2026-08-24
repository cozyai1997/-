import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'csv-parse/sync'
import type { ReferenceDataset } from '../../src/features/localization/reference-data-validation'
import {
  buildFormGigantamaxOptions,
  buildFormTeraOptions,
  buildTeraTypes,
  normalizeNatureRow,
  resolveInheritedBaseStats,
} from './normalize-pokemon-battle-data'

type CsvRow = Record<string, string>
type Localization = Record<string, string>
type NameLookups = { items?: Map<string, string>; moves?: Map<string, string> }

type FormSourceRow = Pick<CsvRow, 'FormID' | 'SpeciesID' | 'BaseFormID' | 'FormKO' | 'Type1' | 'Type2'>
  & Partial<Pick<CsvRow, 'FormEN' | 'BaseHP' | 'BaseAtk' | 'BaseDef' | 'BaseSpA' | 'BaseSpD' | 'BaseSpe' | 'BattleOnly'>>
type MoveSourceRow = Pick<CsvRow, 'MoveID' | 'NameKO' | 'Type' | 'Category' | 'Power' | 'Accuracy' | 'PP'>
type LearnsetSourceRow = Pick<CsvRow, 'SpeciesID' | 'FormID' | 'MoveID' | 'SourceType' | 'SourceValue' | 'MinLevel'>
type FormAbilitySourceRow = Pick<CsvRow, 'FormID' | 'SpeciesID' | 'AbilityID' | 'Slot' | 'Hidden'>

const itemNames = new Map<string, string>([
  ['Thunder Stone', '천둥의돌'],
  ['Water Stone', '물의돌'],
  ['Fire Stone', '불꽃의돌'],
  ['Leaf Stone', '리프의돌'],
  ['Moon Stone', '달의돌'],
  ['Sun Stone', '태양의돌'],
  ['Ice Stone', '얼음의돌'],
  ['Dusk Stone', '어둠의돌'],
  ['Shiny Stone', '빛의돌'],
  ['Metal Coat', '금속코트'],
  ['Kings Rock', '왕의징표석'],
  ['Wide Lens', '광각렌즈'],
  ['Mega Ring', '메가링'],
  ['Key Stone', '키스톤'],
])

function readCsv(path: string): CsvRow[] {
  return parse(readFileSync(path, 'utf8'), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[]
}

function fileHash(path: string, algorithm: 'sha1' | 'sha256'): string {
  return createHash(algorithm).update(readFileSync(path)).digest('hex')
}

function localized(localization: Localization, key: string, fallback: string): string {
  const value = localization[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback.trim()
}

function requiredLocalized(localization: Localization, key: string): string {
  const value = localization[key]
  return typeof value === 'string' ? value.trim() : ''
}

function nullableInteger(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed)) throw new Error(`정수가 아닌 원본 값입니다: ${value}`)
  return parsed
}

function requiredInteger(value: string, field: string): number {
  const parsed = nullableInteger(value)
  if (parsed === null) throw new Error(`비어 있는 ${field} 원본 값입니다`)
  return parsed
}

function requiredBoolean(value: string, field: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  throw new Error(`지원하지 않는 ${field} 원본 값입니다: ${value}`)
}

export function normalizeDamageClass(value: string): 'physical' | 'special' | 'status' {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'physical' || normalized === 'special' || normalized === 'status') {
    return normalized
  }
  throw new Error(`지원하지 않는 기술 분류입니다: ${value}`)
}

export function normalizeLearnMethod(
  value: string,
): 'level' | 'tm' | 'tutor' | 'egg' | 'legacy' | 'special' | 'form_change' {
  const normalized = value.trim().toLowerCase()
  if (['level', 'tm', 'tutor', 'egg', 'legacy', 'special', 'form_change'].includes(normalized)) {
    return normalized as ReturnType<typeof normalizeLearnMethod>
  }
  throw new Error(`지원하지 않는 기술 습득 경로입니다: ${value}`)
}

export function normalizeFormRow(row: FormSourceRow) {
  return {
    id: row.FormID,
    speciesId: row.SpeciesID,
    baseFormId: row.BaseFormID || null,
    nameKo: row.FormKO,
    primaryTypeId: row.Type1 || null,
    secondaryTypeId: row.Type2 || null,
    baseStats: {
      hp: requiredInteger(row.BaseHP ?? '0', 'BaseHP'),
      attack: requiredInteger(row.BaseAtk ?? '0', 'BaseAtk'),
      defense: requiredInteger(row.BaseDef ?? '0', 'BaseDef'),
      special_attack: requiredInteger(row.BaseSpA ?? '0', 'BaseSpA'),
      special_defense: requiredInteger(row.BaseSpD ?? '0', 'BaseSpD'),
      speed: requiredInteger(row.BaseSpe ?? '0', 'BaseSpe'),
    },
    isBattleOnly: requiredBoolean(row.BattleOnly ?? 'False', 'BattleOnly'),
    aspects: [],
  }
}

export function normalizeMoveRow(
  row: MoveSourceRow,
  display: { nameKo: string; descriptionKo: string },
) {
  return {
    id: row.MoveID,
    nameKo: display.nameKo,
    descriptionKo: display.descriptionKo,
    typeId: row.Type,
    damageClass: normalizeDamageClass(row.Category),
    power: nullableInteger(row.Power),
    accuracy: nullableInteger(row.Accuracy),
    pp: nullableInteger(row.PP),
  }
}

export function normalizeLearnsetRow(row: LearnsetSourceRow) {
  const learnMethod = normalizeLearnMethod(row.SourceType)
  return {
    speciesId: row.SpeciesID,
    formId: row.FormID || null,
    moveId: row.MoveID,
    learnMethod,
    learnLevel: learnMethod === 'level' ? nullableInteger(row.SourceValue || row.MinLevel) : null,
    conditionKo: localizeLearnsetCondition(learnMethod, row.SourceValue || row.MinLevel),
  }
}

export function normalizeFormAbilityRow(row: FormAbilitySourceRow) {
  return {
    formId: row.FormID,
    speciesId: row.SpeciesID,
    abilityId: row.AbilityID,
    slot: row.Slot,
    isHidden: row.Hidden.trim().toLowerCase() === 'true',
  }
}

function translateConditionPart(part: string, lookups: NameLookups): string | null {
  const value = part.trim()
  let match = value.match(/^Level (\d+)\+$/u)
  if (match) return `레벨 ${match[1]} 이상`
  match = value.match(/^Friendship (\d+)\+$/u)
  if (match) return `친밀도 ${match[1]} 이상`
  match = value.match(/^(\d+) blocks traveled$/u)
  if (match) return `${match[1]}블록 이동`

  const fixed = new Map<string, string>([
    ['Time: Night', '밤'],
    ['Time: Day', '낮'],
    ['Time: Dusk', '황혼'],
    ['Female only', '암컷만'],
    ['Male only', '수컷만'],
  ])
  if (fixed.has(value)) return fixed.get(value) ?? null

  match = value.match(/^Use (.+)$/u)
  if (match) {
    const name = itemNames.get(match[1]) ?? lookups.items?.get(match[1])
    return name ? `${name} 사용` : null
  }
  match = value.match(/^Hold (.+)$/u)
  if (match) {
    const name = itemNames.get(match[1]) ?? lookups.items?.get(match[1])
    return name ? `${name} 지니기` : null
  }
  match = value.match(/^Knows (.+)$/u)
  if (match) {
    const typeMoveNames = new Map<string, string>([
      ['Fairy move', '페어리타입 기술'],
      ['Dark move', '악타입 기술'],
      ['Psychic move', '에스퍼타입 기술'],
    ])
    const typeMoveName = typeMoveNames.get(match[1])
    if (typeMoveName) return `${typeMoveName}을 알고 있음`
    const name = lookups.moves?.get(match[1])
    return name ? `${name} 기술을 알고 있음` : null
  }
  return null
}

export function localizeEvolutionCondition(
  source: string,
  lookups: NameLookups = {},
): { text: string; translated: boolean } {
  if (!source.trim()) return { text: source, translated: false }
  const translatedParts = source.split(';').map((part) => translateConditionPart(part, lookups))
  if (translatedParts.some((part) => part === null)) {
    return { text: source, translated: false }
  }
  return { text: translatedParts.join('; '), translated: true }
}

export function localizeLearnsetCondition(sourceType: string, sourceValue: string): string {
  const localizedByType: Record<string, string> = {
    tm: '기술머신으로 습득',
    tutor: '기술 가르침으로 습득',
    egg: '유전으로 습득',
    legacy: '과거 버전에서 습득',
    special: '특수 조건으로 습득',
    form_change: '폼 변경 시 습득',
  }
  if (sourceType === 'level') {
    const level = Number(sourceValue)
    return level > 0 ? `레벨 ${level}에 습득` : '레벨 상승으로 습득'
  }
  return localizedByType[sourceType] ?? sourceType
}

export function importReferenceData(sourceRoot: string): ReferenceDataset {
  const fullRoot = join(sourceRoot, 'cobbleverse_data_full')
  const cacheRoot = join(sourceRoot, 'full_data_cache')
  const seedRoot = join(sourceRoot, 'cobbleverse_data')
  const paths = {
    species: join(fullRoot, 'pokemon_full.csv'),
    forms: join(fullRoot, 'forms_full.csv'),
    abilities: join(fullRoot, 'abilities_full.csv'),
    moves: join(fullRoot, 'moves_full.csv'),
    learnsets: join(fullRoot, 'learnsets_full.csv'),
    items: join(fullRoot, 'items_full.csv'),
    evolutions: join(fullRoot, 'evolutions_full.csv'),
    formAbilities: join(fullRoot, 'form_abilities_full.csv'),
    natures: join(seedRoot, 'natures.csv'),
    typeMatchups: join(seedRoot, 'types.csv'),
    localization: join(cacheRoot, 'ko_kr.json'),
    meta: join(cacheRoot, 'meta.json'),
    sourceManifest: join(seedRoot, 'source_manifest.json'),
    pokemonBySlug: join(cacheRoot, 'pokemon-by-slug'),
  }
  const localization = JSON.parse(readFileSync(paths.localization, 'utf8')) as Localization
  const meta = JSON.parse(readFileSync(paths.meta, 'utf8')) as {
    commitSha: string
    moveCount: number
  }
  const sourceManifest = JSON.parse(readFileSync(paths.sourceManifest, 'utf8')) as {
    target_pack: string
    base_game_data: string
  }
  const speciesRows = readCsv(paths.species)
  const formRows = readCsv(paths.forms)
  const abilityRows = readCsv(paths.abilities)
  const moveRows = readCsv(paths.moves)
  const learnsetRows = readCsv(paths.learnsets)
  const itemRows = readCsv(paths.items)
  const evolutionRows = readCsv(paths.evolutions)
  const formAbilityRows = readCsv(paths.formAbilities)
  const natureRows = readCsv(paths.natures)
  const matchupRows = readCsv(paths.typeMatchups)

  const types = Array.from(
    new Map(
      matchupRows.map((row) => [row.AttackType, { id: row.AttackType, nameKo: row.AttackKO }]),
    ).values(),
  )
  const itemNameLookup = new Map(itemRows.map((row) => [row.NameEN, row.NameKO]))
  const moveNameLookup = new Map(moveRows.map((row) => [row.NameEN, row.NameKO]))

  const species = speciesRows.map((row) => ({
    id: row.SpeciesID,
    nationalDexNumber: Number(row.DexNo),
    nameKo: localized(localization, `cobblemon.species.${row.SpeciesID}.name`, row.NameKO),
    descriptionKo: localized(localization, `cobblemon.species.${row.SpeciesID}.desc`, ''),
  }))
  const pokemonSources = new Map(speciesRows.map((row) => [
    row.SpeciesID,
    JSON.parse(readFileSync(join(paths.pokemonBySlug, `${row.SpeciesID}.json`), 'utf8')) as {
      baseStats: Record<string, unknown>
      forms?: Array<{ name: string; aspects?: string[]; battleOnly?: boolean }>
    },
  ]))
  const battleOnlyDiagnostics: string[] = []
  const forms = resolveInheritedBaseStats(formRows.map((row) => {
    const csv = row as FormSourceRow
    const source = pokemonSources.get(csv.SpeciesID)
    if (!source) throw new Error(`forms:${csv.FormID}:missing-species-source`)
    if (csv.FormEN === 'Normal') {
      const stats = source.baseStats
      return {
        ...normalizeFormRow(csv),
        baseStats: {
          hp: requiredInteger(String(stats.hp ?? ''), 'raw.baseStats.hp'),
          attack: requiredInteger(String(stats.attack ?? ''), 'raw.baseStats.attack'),
          defense: requiredInteger(String(stats.defence ?? ''), 'raw.baseStats.defence'),
          special_attack: requiredInteger(String(stats.special_attack ?? ''), 'raw.baseStats.special_attack'),
          special_defense: requiredInteger(String(stats.special_defence ?? ''), 'raw.baseStats.special_defence'),
          speed: requiredInteger(String(stats.speed ?? ''), 'raw.baseStats.speed'),
        },
        aspects: [],
      }
    }
    const matches = source.forms?.filter((form) => form.name === csv.FormEN) ?? []
    if (matches.length !== 1) throw new Error(`forms:${csv.FormID}:raw-form-match`)
    const raw = matches[0]
    const csvBattleOnly = requiredBoolean(csv.BattleOnly ?? 'False', 'BattleOnly')
    if (typeof raw.battleOnly !== 'boolean') throw new Error(`forms:${csv.FormID}:raw-battle-only-missing`)
    if (raw.battleOnly !== csvBattleOnly) {
      battleOnlyDiagnostics.push(`forms:${csv.FormID}:battle-only:csv=${csvBattleOnly}:raw=${raw.battleOnly}`)
    }
    return { ...normalizeFormRow(csv), isBattleOnly: raw.battleOnly, aspects: raw.aspects ?? [] }
  }))
  const abilities = abilityRows.map((row) => ({
    id: row.AbilityID,
    nameKo: requiredLocalized(localization, `cobblemon.ability.${row.AbilityID}`),
    descriptionKo: requiredLocalized(localization, `cobblemon.ability.${row.AbilityID}.desc`),
  }))
  const moves = moveRows.map((row) => normalizeMoveRow(row as MoveSourceRow, {
    nameKo: requiredLocalized(localization, `cobblemon.move.${row.MoveID}`),
    descriptionKo: requiredLocalized(localization, `cobblemon.move.${row.MoveID}.desc`),
  }))
  const learnsets = learnsetRows.map((row) => normalizeLearnsetRow(row as LearnsetSourceRow))
  const items = itemRows.map((row) => ({
    id: row.ItemID,
    nameKo: localized(localization, `item.cobblemon.${row.ItemID}`, row.NameKO),
    descriptionKo: localized(localization, `item.cobblemon.${row.ItemID}.tooltip`, row.Effect),
  }))
  const evolutions = evolutionRows.map((row, index) => ({
    id: `${row.FromSpeciesID}>${row.ToSpeciesID}:${index}`,
    fromSpeciesId: row.FromSpeciesID,
    toSpeciesId: row.ToSpeciesID,
    conditionKo: localizeEvolutionCondition(row.Condition, {
      items: itemNameLookup,
      moves: moveNameLookup,
    }).text,
  }))
  const formAbilities = formAbilityRows.map((row) => normalizeFormAbilityRow(row as FormAbilitySourceRow))
  const natures = natureRows.map((row) => normalizeNatureRow({
    id: row.NatureID,
    nameKo: row.NameKO,
    UpStat: row.UpStat,
    DownStat: row.DownStat,
  }))
  const typeMatchups = matchupRows.map((row) => ({
    attackingTypeId: row.AttackType,
    defendingTypeId: row.DefenseType,
    multiplier: Number(row.Multiplier),
  }))
  const actualCounts = {
    types: types.length,
    species: species.length,
    forms: forms.length,
    abilities: abilities.length,
    moves: moves.length,
    learnsets: learnsets.length,
    items: items.length,
    evolutions: evolutions.length,
    formAbilities: formAbilities.length,
    natures: natures.length,
    typeMatchups: typeMatchups.length,
    teraTypes: 0,
    formTeraOptions: 0,
    formGigantamaxOptions: 0,
  }
  const teraTypes = buildTeraTypes(types)
  const formTeraOptions = buildFormTeraOptions(forms, teraTypes)
  const formGigantamaxOptions = buildFormGigantamaxOptions(forms)
  actualCounts.teraTypes = teraTypes.length
  actualCounts.formTeraOptions = formTeraOptions.length
  actualCounts.formGigantamaxOptions = formGigantamaxOptions.length

  return {
    version: `${sourceManifest.target_pack}+${sourceManifest.base_game_data}`,
    sourceCommits: {
      cobblemon: meta.commitSha,
      koreanLocalizationContent: fileHash(paths.localization, 'sha1'),
    },
    sha256: Object.fromEntries(
      Object.entries(paths)
        .filter(([name]) => name !== 'pokemonBySlug')
        .map(([name, path]) => [name, fileHash(path, 'sha256')]),
    ),
    battleOnlyDiagnostics,
    reportedCounts: actualCounts,
    types,
    species,
    forms,
    abilities,
    moves,
    learnsets,
    items,
    evolutions,
    formAbilities,
    natures,
    typeMatchups,
    teraTypes,
    formTeraOptions,
    formGigantamaxOptions,
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function main(): void {
  const source = argument('--source')
  const output = argument('--output')
  if (!source || !output) {
    throw new Error('사용법: tsx scripts/data/import-reference-data.ts --source <원본 폴더> --output <후보 JSON>')
  }
  const dataset = importReferenceData(resolve(source))
  const target = resolve(output)
  mkdirSync(dirname(target), { recursive: true })
  const temporary = `${target}.tmp`
  writeFileSync(temporary, `${JSON.stringify(dataset)}\n`, 'utf8')
  JSON.parse(readFileSync(temporary, 'utf8'))
  renameSync(temporary, target)
  process.stdout.write(`${target}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
