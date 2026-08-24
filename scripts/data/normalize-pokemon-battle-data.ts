import { nonHpStatKeys, statKeys, type NonHpStatKey, type StatBlock } from '../../src/features/stats/types'
import type {
  ReferenceFormGigantamaxOptionRow,
  ReferenceFormRow,
  ReferenceFormTeraOptionRow,
  ReferenceNatureRow,
  ReferenceTeraTypeRow,
} from '../../src/features/localization/reference-data-validation'

type NatureSourceRow = {
  id: string
  nameKo: string
  UpStat?: string
  DownStat?: string
}

type ReferenceTypeRow = { id: string; nameKo: string }

function normalizeAspects(aspects: string[]): string[] {
  return [...new Set(aspects.map((aspect) => aspect.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

function assertValidStatBlock(formId: string, stats: StatBlock): 'inherit' | 'value' {
  const values = statKeys.map((key) => stats[key])
  const zeroCount = values.filter((value) => value === 0).length
  if (zeroCount === statKeys.length) return 'inherit'
  if (zeroCount > 0) throw new Error(`forms:${formId}:partial-zero-base-stats`)
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1 || value > 255) {
      throw new Error(`forms:${formId}:invalid-base-stats`)
    }
  }
  return 'value'
}

export function resolveInheritedBaseStats(forms: ReferenceFormRow[]): ReferenceFormRow[] {
  const formsById = new Map(forms.map((form) => [form.id, form]))
  const resolved = new Map<string, StatBlock>()
  const resolving = new Set<string>()

  function resolveStats(form: ReferenceFormRow): StatBlock {
    const cached = resolved.get(form.id)
    if (cached) return cached
    if (resolving.has(form.id)) throw new Error(`forms:${form.id}:base-stats-cycle`)
    resolving.add(form.id)
    const kind = assertValidStatBlock(form.id, form.baseStats)
    let stats = form.baseStats
    if (kind === 'inherit') {
      if (!form.baseFormId) throw new Error(`forms:${form.id}:missing-base-form`)
      const parent = formsById.get(form.baseFormId)
      if (!parent) throw new Error(`forms:${form.id}:missing-base-form:${form.baseFormId}`)
      stats = resolveStats(parent)
    }
    resolving.delete(form.id)
    resolved.set(form.id, stats)
    return stats
  }

  return forms.map((form) => ({
    ...form,
    baseStats: { ...resolveStats(form) },
    aspects: normalizeAspects(form.aspects),
  }))
}

function normalizeNatureStat(value: string | undefined, field: 'UpStat' | 'DownStat'): NonHpStatKey | null {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  const canonical = normalized === 'defence'
    ? 'defense'
    : normalized === 'special_defence'
      ? 'special_defense'
      : normalized
  if (!nonHpStatKeys.includes(canonical as NonHpStatKey)) {
    throw new Error(`natures:${field}:unsupported-stat:${normalized}`)
  }
  return canonical as NonHpStatKey
}

export function normalizeNatureRow(row: NatureSourceRow): ReferenceNatureRow {
  const increasedStat = normalizeNatureStat(row.UpStat, 'UpStat')
  const decreasedStat = normalizeNatureStat(row.DownStat, 'DownStat')
  if ((increasedStat === null) !== (decreasedStat === null)) {
    throw new Error(`natures:${row.id}:incomplete-adjustment`)
  }
  return { id: row.id, nameKo: row.nameKo, increasedStat, decreasedStat }
}

export function buildTeraTypes(types: ReferenceTypeRow[]): ReferenceTeraTypeRow[] {
  const ids = new Set<string>()
  const teraTypes = types.map((type, index) => {
    if (!type.id || ids.has(type.id)) throw new Error(`tera-types:duplicate:${type.id}`)
    ids.add(type.id)
    return { id: type.id, nameKo: type.nameKo, referenceTypeId: type.id, sortOrder: index }
  })
  return [...teraTypes, { id: 'stellar', nameKo: '스텔라', referenceTypeId: null, sortOrder: 19 }]
}

function ogerponTeraType(form: ReferenceFormRow): string {
  if (form.id === 'ogerpon-normal') return 'grass'
  if (form.aspects.includes('wellspring-mask')) return 'water'
  if (form.aspects.includes('hearthflame-mask')) return 'fire'
  if (form.aspects.includes('cornerstone-mask')) return 'rock'
  if (form.aspects.includes('teal-mask')) return 'grass'
  throw new Error(`forms:${form.id}:unknown-ogerpon-mask`)
}

export function buildFormTeraOptions(
  forms: ReferenceFormRow[],
  teraTypes: ReferenceTeraTypeRow[],
): ReferenceFormTeraOptionRow[] {
  const teraTypeIds = teraTypes.map((type) => type.id)
  return forms.flatMap((form) => {
    if (form.isBattleOnly) return []
    if (form.speciesId === 'ogerpon') return [{ formId: form.id, teraTypeId: ogerponTeraType(form) }]
    if (form.speciesId === 'terapagos') return [{ formId: form.id, teraTypeId: 'stellar' }]
    return teraTypeIds.map((teraTypeId) => ({ formId: form.id, teraTypeId }))
  })
}

function aspectKey(aspects: string[]): string {
  return normalizeAspects(aspects).join('\u0000')
}

const gmaxSourceAliases = new Map<string, string>([
  ['toxtricity:amped-form', 'toxtricity-normal'],
  ['urshifu:single_strike-style', 'urshifu-normal'],
])

const alcremieSources = [
  'alcremie-normal',
  'alcremie-caramelswirl',
  'alcremie-lemoncream',
  'alcremie-matchacream',
  'alcremie-mintcream',
  'alcremie-rainbowswirl',
  'alcremie-rubycream',
  'alcremie-rubyswirl',
  'alcremie-saltedcream',
]

export function buildFormGigantamaxOptions(forms: ReferenceFormRow[]): ReferenceFormGigantamaxOptionRow[] {
  const playable = forms.filter((form) => !form.isBattleOnly)
  const bySpeciesAndAspect = new Map<string, ReferenceFormRow[]>()
  for (const form of playable) {
    const key = `${form.speciesId}:${aspectKey(form.aspects)}`
    bySpeciesAndAspect.set(key, [...(bySpeciesAndAspect.get(key) ?? []), form])
  }

  return forms.flatMap((target) => {
    const targetAspects = normalizeAspects(target.aspects)
    if (!target.isBattleOnly || !targetAspects.includes('gmax')) return []
    if (target.id === 'alcremie-gmax') {
      return alcremieSources.map((sourceFormId) => ({ sourceFormId, gigantamaxFormId: target.id }))
    }
    const withoutGmax = targetAspects.filter((aspect) => aspect !== 'gmax')
    const alias = gmaxSourceAliases.get(`${target.speciesId}:${aspectKey(withoutGmax)}`)
    const matches = alias
      ? playable.filter((form) => form.id === alias)
      : bySpeciesAndAspect.get(`${target.speciesId}:${aspectKey(withoutGmax)}`) ?? []
    if (matches.length !== 1) {
      throw new Error(`forms:${target.id}:ambiguous-gigantamax-source`)
    }
    return [{ sourceFormId: matches[0].id, gigantamaxFormId: target.id }]
  })
}
