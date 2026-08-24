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
const hangulPattern = /[ㄱ-ㅎㅏ-ㅣ가-힣]/u
const directFormNamesKo = new Map<string, string>([
  ['pikachu-belle', '피카츄 마담'], ['pikachu-cosplay', '옷갈아입기 피카츄'],
  ['pikachu-libre', '피카츄 마스크드'], ['pikachu-phd', '피카츄 박사'],
  ['pikachu-popstar', '피카츄 아이돌'], ['pikachu-rockstar', '피카츄 하드록'],
  ['vulpix-form2', '식스테일 · 원본에서 세부 정보가 제공되지 않은 별도 모습'],
  ['ninetales-form2', '나인테일 · 원본에서 세부 정보가 제공되지 않은 별도 모습'],
  ['mewtwo-megaax', '메가뮤츠 에이엑스'], ['mewtwo-megaay', '메가뮤츠 에이와이'],
  ['mewtwo-megasx', '메가뮤츠 에스엑스'], ['mewtwo-megasy', '메가뮤츠 에스와이'],
  ['pichu-spikyeared', '삐쭉귀 피츄'], ['unown-form-26', '안농 · 느낌표의 모습'],
  ['unown-form-27', '안농 · 물음표의 모습'], ['groudon-virus', '바이러스 그란돈'],
  ['scrafty-form2', '곤율거니 · 원본에서 세부 정보가 제공되지 않은 별도 모습'],
  ['floette-ange', '천사 플라엣테'], ['floette-megae', '메가플라엣테 이'],
  ['zygarde-megac', '메가지가르데 씨'], ['magearna-megao', '메가마기아나 오'],
  ['tatsugiri-megad', '메가싸리용 디'], ['tatsugiri-megas', '메가싸리용 에스'],
])
const lucarioCostumeLabelsKo = new Map<string, string>([
  ['cafe', '카페'], ['captain', '캡틴'], ['chef', '셰프'], ['concert', '콘서트'],
  ['costumeparty', '파티 코스튬'], ['holiday', '홀리데이'], ['martialarts', '마셜아츠'],
  ['ruins', '유적'], ['space', '우주'],
])
const incineroarLabelsKo = new Map<string, string>([
  ['acepride', '에이스 프라이드'], ['bipride', '바이 프라이드'], ['champion', '챔피언'],
  ['dancer', '댄서'], ['panpride', '팬 프라이드'], ['pride', '프라이드'],
  ['royalmask', '로열 마스크'], ['summer', '서머'], ['teamskull', '스컬단'],
  ['tekken', '철권'], ['transpride', '트랜스 프라이드'],
])
const genesectCassetteLabelsKo = new Map<string, string>([
  ['burn', '버닝카세트'], ['chill', '프리즈카세트'],
  ['douse', '아쿠아카세트'], ['shock', '라이트닝카세트'],
])
const ogerponMaskLabelsKo = new Map<string, string>([
  ['cornerstonetera', '주춧돌 가면 테라스탈'], ['hearthflametera', '화덕 가면 테라스탈'],
  ['tealtera', '벽록 가면 테라스탈'], ['wellspringtera', '우물 가면 테라스탈'],
])
// Pinned values from Minecraft's ko_kr item.minecraft/block.minecraft resource keys.
const minecraftItemNamesKo = new Map<string, string>([
  ['melon_seeds', '수박씨'], ['blaze_powder', '블레이즈 가루'], ['turtle_scute', '거북 인갑'],
  ['string', '실'], ['feather', '깃털'], ['chicken', '익히지 않은 닭고기'], ['rotten_flesh', '썩은 살점'],
  ['armadillo_scute', '아르마딜로 인갑'], ['sweet_berries', '달콤한 열매'], ['phantom_membrane', '팬텀 막'],
  ['honey_bottle', '꿀이 든 병'], ['red_mushroom', '빨간색 버섯'], ['dirt', '흙'], ['potato', '감자'],
  ['gold_nugget', '금 조각'], ['bone', '뼈다귀'], ['ender_pearl', '엔더 진주'], ['ink_sac', '먹물 주머니'],
  ['glow_ink_sac', '발광 먹물 주머니'], ['gravel', '자갈'], ['leather', '가죽'], ['raw_iron', '철 원석'],
  ['cod', '익히지 않은 대구'], ['slime_ball', '슬라임볼'], ['stone', '돌'], ['gunpowder', '화약'], ['egg', '달걀'],
  ['vine', '덩굴'], ['prismarine_shard', '프리즈머린 조각'], ['salmon', '익히지 않은 연어'], ['bone_meal', '뼛가루'],
  ['redstone', '레드스톤 가루'], ['beef', '익히지 않은 소고기'], ['heart_of_the_sea', '바다의 심장'],
  ['nautilus_shell', '앵무조개 껍데기'], ['apple', '사과'], ['nether_star', '네더의 별'], ['cooked_chicken', '익힌 닭고기'],
  ['dragon_breath', '드래곤의 숨결'], ['spider_eye', '거미 눈'], ['prismarine_crystals', '프리즈머린 수정'],
  ['mutton', '익히지 않은 양고기'], ['white_wool', '하얀색 양털'], ['verdant_froglight', '잔딧빛 개구리불'],
  ['sunflower', '해바라기'], ['wheat_seeds', '밀 씨앗'], ['clay_ball', '점토 덩이'], ['pufferfish', '복어'],
  ['magma_cream', '마그마 크림'], ['basalt', '현무암'], ['porkchop', '익히지 않은 돼지고기'],
  ['brown_wool', '갈색 양털'], ['lily_pad', '수련잎'], ['dark_oak_sapling', '짙은 참나무 묘목'],
  ['brown_mushroom', '갈색 버섯'], ['flint', '부싯돌'], ['amethyst_shard', '자수정 조각'],
  ['diamond', '다이아몬드'], ['emerald', '에메랄드'], ['rose_bush', '장미 덤불'], ['bone_block', '뼈 블록'],
  ['coal', '석탄'], ['bamboo', '대나무'], ['cactus', '선인장'], ['ender_eye', '엔더의 눈'],
  ['oak_sapling', '참나무 묘목'], ['honeycomb', '벌집 조각'], ['rabbit', '익히지 않은 토끼고기'],
  ['rabbit_hide', '토끼 가죽'], ['rabbit_foot', '토끼발'], ['carrot', '당근'], ['sand', '모래'],
  ['blue_wool', '파란색 양털'], ['raw_copper', '구리 원석'], ['light_blue_wool', '하늘색 양털'],
  ['terracotta', '테라코타'], ['iron_helmet', '철 투구'], ['candle', '초'], ['mud', '진흙'],
  ['pearlescent_froglight', '진줏빛 개구리불'], ['poppy', '양귀비'], ['iron_nugget', '철 조각'], ['iron_sword', '철 검'],
  ['sugar', '설탕'], ['cake', '케이크'], ['kelp', '켈프'], ['name_tag', '이름표'], ['ominous_trial_key', '불길한 시련 열쇠'],
  ['trial_key', '시련 열쇠'], ['jack_o_lantern', '잭오랜턴'], ['resin_clump', '수지 덩어리'], ['pumpkin_seeds', '호박씨'],
  ['acacia_log', '아카시아나무 원목'],
  ['echo_shard', '메아리 조각'], ['iron_ingot', '철 주괴'], ['iron_block', '철 블록'],
  ['cobblestone', '조약돌'], ['golden_helmet', '금 투구'], ['blue_ice', '푸른얼음'],
  ['diamond_sword', '다이아몬드 검'], ['stone_axe', '돌 도끼'], ['calcite', '방해석'], ['ochre_froglight', '황톳빛 개구리불'],
  ['dead_bush', '마른 덤불'], ['ice', '얼음'], ['brush', '솔'], ['shears', '가위'], ['jungle_sapling', '정글나무 묘목'],
  ['dandelion', '민들레'], ['bucket', '양동이'], ['lava_bucket', '용암 양동이'], ['milk_bucket', '우유 양동이'],
  ['glass_bottle', '유리병'], ['spruce_sapling', '가문비나무 묘목'], ['powder_snow_bucket', '가루눈 양동이'],
  ['water_bucket', '물 양동이'],
])
const minecraftItemAliases = new Map<string, string>([
  ['raw_cod', 'cod'], ['eye_of_ender', 'ender_eye'], ['slimeball', 'slime_ball'],
])
const cobblemonItemNameSupplementsKo = new Map<string, string>([
  ['kasid_berry', '카시드열매'], ['payaba_berry', '파야열매'],
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

function koreanValue(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return hangulPattern.test(trimmed) ? trimmed : null
}

function localizedFormName(
  localization: Localization,
  row: FormSourceRow,
  speciesNameKo: string,
): string {
  const localizedName = koreanValue(localization[`cobblemon.ui.pokedex.info.form.${row.FormID}`])
    ?? koreanValue(row.FormKO)
  if (localizedName) return localizedName

  const directName = directFormNamesKo.get(row.FormID)
  if (directName) return directName

  if (row.FormID === 'lucario-megaz') return '메가제트 루카리오'
  const lucarioMatch = /^lucario-(mega)?(.+)costume$/u.exec(row.FormID)
  if (lucarioMatch) {
    const label = lucarioCostumeLabelsKo.get(lucarioMatch[2])
    if (label) return `${lucarioMatch[1] ? '메가 ' : ''}${label} 루카리오`
  }

  const incineroarMatch = /^incineroar-(.+)$/u.exec(row.FormID)
  if (incineroarMatch) {
    const label = incineroarLabelsKo.get(incineroarMatch[1])
    if (label) return `${label} 어흥염`
  }

  const genesectMatch = /^genesect-(.+)$/u.exec(row.FormID)
  if (genesectMatch) {
    const label = genesectCassetteLabelsKo.get(genesectMatch[1])
    if (label) return `${speciesNameKo} (${label})`
  }

  const ogerponMatch = /^ogerpon-(.+)$/u.exec(row.FormID)
  if (ogerponMatch) {
    const label = ogerponMaskLabelsKo.get(ogerponMatch[1])
    if (label) return `${label} ${speciesNameKo}`
  }

  const genericName = new Map<string, string>([
    ['Mega', `메가${speciesNameKo}`], ['Mega-X', `메가${speciesNameKo} 엑스`],
    ['Mega-Y', `메가${speciesNameKo} 와이`], ['Mega-Z', `메가${speciesNameKo} 제트`],
    ['Primal', `원시${speciesNameKo}`], ['Armored', `아머드${speciesNameKo}`],
    ['Shadow', `섀도${speciesNameKo}`], ['White-Striped', `백색줄무늬 ${speciesNameKo}`],
    ['Low-Key-Gmax', `로우키 거다이맥스 ${speciesNameKo}`], ['Core', `코어 ${speciesNameKo}`],
    ['Eternamax-wild', `무한다이맥스 ${speciesNameKo}`], ['Wild', `야생 ${speciesNameKo}`],
  ]).get(row.FormKO)
  if (genericName) return genericName

  throw new Error(`forms:${row.FormID}:unlocalized-form-token:${row.FormKO}`)
}

function localizedItemDisplay(
  localization: Localization,
  row: CsvRow,
): { nameKo: string; descriptionKo: string } {
  const minecraftId = minecraftItemAliases.get(row.ItemID) ?? row.ItemID
  const nameKo = koreanValue(localization[`item.cobblemon.${row.ItemID}`])
    ?? koreanValue(row.NameKO)
    ?? minecraftItemNamesKo.get(minecraftId)
    ?? cobblemonItemNameSupplementsKo.get(row.ItemID)
  if (!nameKo) throw new Error(`items:${row.ItemID}:unlocalized-name`)
  const descriptionKo = koreanValue(localization[`item.cobblemon.${row.ItemID}.tooltip`])
    ?? koreanValue(row.Effect)
    ?? `${nameKo}의 한국어 설명이 원본에 제공되지 않습니다.`
  return { nameKo, descriptionKo }
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
    ['Level up', '레벨업'],
    ['Time: Night', '밤'],
    ['Time: Day', '낮'],
    ['Time: Dusk', '황혼'],
    ['Female only', '암컷만'],
    ['Male only', '수컷만'],
    ['During rain', '비가 오는 동안'],
    ['Moon FULL MOON', '보름달'],
    ['Attack = Defence', '공격과 방어가 같음'],
    ['Attack > Defence', '공격이 방어보다 높음'],
    ['Defence > Attack', '방어가 공격보다 높음'],
    ['Land 3 critical hits', '급소 3회 적중'],
    ['Take 294 recoil damage', '반동 피해 누적 294 이상'],
    ['Take 49 damage', '피해 49 이상 받기'],
    ['Use Ragefist 20 time(s)', '분노의주먹 20회 사용'],
    ['Property gimmighoul gimmighoul_coins=999', '모으령의 코인 999개 보유'],
    ['Property nickname=Dinnerbone', '별명을 디너본으로 설정'],
    ['Property nickname=Grumm', '별명을 그럼으로 설정'],
    ['Property wurmple cocoon_species=cascoon', '카스쿤으로 진화하는 개체'],
    ['Property wurmple cocoon_species=silcoon', '실쿤으로 진화하는 개체'],
    ['Party member: Karrablast', '파티에 딱정곤이 있음'],
    ['Party member: Remoraid', '파티에 총어가 있음'],
    ['Party member: Reshiram', '파티에 레시라무가 있음'],
    ['Party member: Type=dark', '파티에 악타입 포켓몬이 있음'],
    ['Party member: Zekrom', '파티에 제크로무가 있음'],
    ['Trade with Karrablast', '딱정곤과 통신 교환'],
    ['Trade with Shelmet', '쪼마리와 통신 교환'],
    ['Biome Is Nether', '네더 바이옴'],
    ['Biome Is Sandy', '모래 바이옴'],
    ['Not in biome Is Nether', '네더 바이옴이 아님'],
    ['Not in biome Is Overworld', '오버월드 바이옴이 아님'],
    ['Not in biome Evolution Regional Cubone Alolabiome', '알로라 탕구리 진화 바이옴이 아님'],
    ['Not in biome Evolution Regional Cubone Kantobiome', '관동 탕구리 진화 바이옴이 아님'],
    ['Not in biome Evolution Regional Pikachu Alolabiome', '알로라 피카츄 진화 바이옴이 아님'],
    ['Not in biome Evolution Regional Pikachu Kantobiome', '관동 피카츄 진화 바이옴이 아님'],
    ['Biome Evolution Vivillon Forsaken', '버림받은 비비용 진화 바이옴'],
    ['Biome Evolution Vivillon Inferno', '인페르노 비비용 진화 바이옴'],
    ['Biome Evolution Vivillon Void', '공허 비비용 진화 바이옴'],
    ['Advancement Catch All Vivillon', '모든 비비용 포획 도전과제 달성'],
    ['Structure Village', '마을 구조물 안'],
    ['Defeat 3 Kings Rock', '왕의징표석을 지닌 절각참 3마리 처치'],
    ['Defeat 3 Bisharp', '절각참 3마리 처치'],
  ])
  if (fixed.has(value)) return fixed.get(value) ?? null

  match = value.match(/^Property toxel nature=(\w+)$/u)
  if (match) {
    const natureNamesKo = new Map<string, string>([
      ['hardy', '노력'], ['lonely', '외로움'], ['brave', '용감'], ['adamant', '고집'],
      ['naughty', '개구쟁이'], ['bold', '대담'], ['docile', '온순'], ['relaxed', '무사태평'],
      ['impish', '장난꾸러기'], ['lax', '촐랑'], ['timid', '겁쟁이'], ['hasty', '성급'],
      ['serious', '성실'], ['jolly', '명랑'], ['naive', '천진난만'], ['modest', '조심'],
      ['mild', '의젓'], ['quiet', '냉정'], ['bashful', '수줍음'], ['rash', '덜렁'],
      ['calm', '차분'], ['gentle', '얌전'], ['sassy', '건방'], ['careful', '신중'],
      ['quirky', '변덕'],
    ])
    const natureName = natureNamesKo.get(match[1])
    return natureName ? `성격이 ${natureName}` : null
  }

  match = value.match(/^Use (.+)$/u)
  if (match) {
    const specialNamesKo = new Map<string, string>([
      ['Dragon Breath', '드래곤의 숨결'], ['Eternamax Orb', '무한다이맥스 오브'],
    ])
    const name = itemNames.get(match[1]) ?? lookups.items?.get(match[1])
      ?? lookups.items?.get(match[1].toLowerCase())
      ?? specialNamesKo.get(match[1])
    return name ? `${name} 사용` : null
  }
  match = value.match(/^Hold (.+)$/u)
  if (match) {
    const specialNamesKo = new Map<string, string>([
      ['Anvil', '모루'], ['Ender Eye', '엔더의 눈'], ['Gem', '보석'],
    ])
    const name = itemNames.get(match[1]) ?? lookups.items?.get(match[1])
      ?? lookups.items?.get(match[1].toLowerCase())
      ?? specialNamesKo.get(match[1])
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
    const specialMoveNamesKo = new Map<string, string>([
      ['Ancientpower', '원시의힘'], ['Barbbarrage', '독침천발'], ['Doublehit', '더블어택'],
      ['Dragoncheer', '드래곤옐'], ['Dragonpulse', '용의파동'], ['Hyperdrill', '하이퍼드릴'],
      ['Psyshieldbash', '배리어러시'], ['Secretsword', '신비의칼'], ['Topsyturvy', '뒤집어엎기'],
      ['Twinbeam', '트윈빔'],
    ])
    const name = lookups.moves?.get(match[1]) ?? lookups.moves?.get(match[1].toLowerCase())
      ?? specialMoveNamesKo.get(match[1])
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

export function localizeEvolutionConditionForPublication(
  source: string,
  method: string,
  lookups: NameLookups,
): string {
  if (!source.trim()) {
    if (method === 'trade') return '통신 교환'
    throw new Error(`evolutions:${method}:empty-condition`)
  }
  return source.split(';').map((part) => {
    const translated = translateConditionPart(part, lookups)
    if (!translated) throw new Error(`evolutions:unlocalized-condition:${part.trim()}`)
    return translated
  }).join('; ')
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
  const speciesNamesKo = new Map(species.map((row) => [row.id, row.nameKo]))
  const forms = resolveInheritedBaseStats(formRows.map((row) => {
    const csv = row as FormSourceRow
    const source = pokemonSources.get(csv.SpeciesID)
    if (!source) throw new Error(`forms:${csv.FormID}:missing-species-source`)
    const speciesNameKo = speciesNamesKo.get(csv.SpeciesID)
    if (!speciesNameKo) throw new Error(`forms:${csv.FormID}:missing-species-name`)
    if (csv.FormEN === 'Normal') {
      const stats = source.baseStats
      return {
        ...normalizeFormRow(csv),
        nameKo: localizedFormName(localization, csv, speciesNameKo),
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
    return {
      ...normalizeFormRow(csv),
      nameKo: localizedFormName(localization, csv, speciesNameKo),
      isBattleOnly: raw.battleOnly,
      aspects: raw.aspects ?? [],
    }
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
    ...localizedItemDisplay(localization, row),
  }))
  const itemNameLookup = new Map(itemRows.map((row, index) => [row.NameEN.toLowerCase(), items[index].nameKo]))
  const moveNameLookup = new Map(moveRows.map((row, index) => [row.NameEN.toLowerCase(), moves[index].nameKo]))
  const speciesIds = new Set(species.map((row) => row.id))
  const formIds = new Set(forms.map((row) => row.id))
  const evolutions = evolutionRows.map((row, index) => {
    const sameSpeciesMegaFormId = `${row.FromSpeciesID}-mega`
    const targetsSameSpeciesMegaForm = !speciesIds.has(row.ToSpeciesID)
      && row.ToSpeciesID === `mega${row.FromSpeciesID}`
    return {
      id: `${row.FromSpeciesID}>${row.ToSpeciesID}:${index}`,
      fromSpeciesId: row.FromSpeciesID,
      toSpeciesId: targetsSameSpeciesMegaForm ? row.FromSpeciesID : row.ToSpeciesID,
      toFormId: targetsSameSpeciesMegaForm && formIds.has(sameSpeciesMegaFormId)
        ? sameSpeciesMegaFormId
        : null,
      conditionKo: `${localizeEvolutionConditionForPublication(row.Condition, row.Method, {
        items: itemNameLookup,
        moves: moveNameLookup,
      })}${targetsSameSpeciesMegaForm && !formIds.has(sameSpeciesMegaFormId)
        ? '; 원본에 대상 메가 폼이 없음'
        : ''}`,
    }
  })
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
