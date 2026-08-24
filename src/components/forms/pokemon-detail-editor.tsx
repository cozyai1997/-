'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PokemonBattleBadges } from '@/components/pokemon/pokemon-battle-badges'
import { PokemonBattleFields } from '@/components/pokemon/pokemon-battle-fields'
import { PokemonMoveCard } from '@/components/pokemon/pokemon-move-card'
import { PokemonStatTable } from '@/components/pokemon/pokemon-stat-table'
import { PrivatePokemonImage } from '@/components/pokemon/private-pokemon-image'
import {
  correctOwnedPokemon,
  listPokemonFilteredOptions,
  type OwnedPokemonDetail,
  type OwnedPokemonEditOptions,
  type PokemonFilteredOptions,
  updateOwnedPokemonQuick,
} from '@/features/owned-pokemon/repository'
import { reconcileBattleSelections } from '@/features/owned-pokemon/registration-state'
import { statKeys, validateOwnedPokemon } from '@/features/owned-pokemon/schema'
import {
  calculateOwnedPokemonStats,
  type OwnedPokemonStatResult,
} from '@/features/stats/calculate-owned-pokemon-stats'
import type { NatureAdjustment } from '@/features/stats/types'
import { createClient } from '@/lib/supabase/client'

const statLabels = {
  hp: 'HP',
  attack: '공격',
  defense: '방어',
  special_attack: '특수공격',
  special_defense: '특수방어',
  speed: '스피드',
} as const

type PokemonDetailEditorProps = {
  initialPokemon: OwnedPokemonDetail
  options: OwnedPokemonEditOptions
  dex: number
  entry: number
}

type FilterStatus = 'idle' | 'loading' | 'loaded' | 'error'

export function PokemonDetailEditor({ initialPokemon, options, dex, entry }: PokemonDetailEditorProps) {
  const router = useRouter()
  const [pokemon, setPokemon] = useState(initialPokemon)
  const [draft, setDraft] = useState(initialPokemon)
  const [correction, setCorrection] = useState(initialPokemon)
  const [reasonKo, setReasonKo] = useState('')
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [imageRevision, setImageRevision] = useState(0)
  const [quickFilter, setQuickFilter] = useState<{
    key: string
    status: FilterStatus
    options: PokemonFilteredOptions | null
  }>({ key: '', status: 'idle', options: null })
  const [correctionFilterStatus, setCorrectionFilterStatus] = useState<FilterStatus>('idle')
  const quickRequestVersion = useRef(0)
  const correctionRequestVersion = useRef(0)
  const mounted = useRef(true)
  const correctionSpecies = useMemo(
    () => options.species.find((item) => item.id === correction.speciesId),
    [correction.speciesId, options.species],
  )
  const quickFilterKey = `${pokemon.speciesId}\u0000${pokemon.formId}`
  const quickFilterStatus = quickFilter.key === quickFilterKey
    ? quickFilter.status
    : 'loading'
  const quickOptions = quickFilter.key === quickFilterKey ? quickFilter.options : null
  const quickAbilities = quickOptions?.abilities ?? []
  const selectedQuickAbility = quickAbilities.find((ability) => ability.id === draft.abilityId)
  const selectedNature = options.natures.find((nature) => nature.id === pokemon.effectiveNatureId)
  const natureAdjustment = effectiveNatureAdjustment(pokemon.effectiveNatureId, selectedNature)
  const statBattle = quickFilterStatus === 'loaded' && quickOptions
    ? quickOptions.battle
    : quickFilterStatus === 'error'
      ? pokemon.battle
      : null
  const actualStats: OwnedPokemonStatResult = statBattle === null
    ? {
        status: 'unavailable',
        reasonKo: '최신 폼 전투 정보를 불러오지 못해 실제 능력치를 계산할 수 없습니다.',
      }
    : natureAdjustment === undefined
      ? {
          status: 'unavailable',
          reasonKo: '성격 보정 정보가 불완전하여 실제 능력치를 계산할 수 없습니다.',
        }
      : calculateOwnedPokemonStats({
          baseStats: statBattle.baseStats,
          effectiveIv: pokemon.effectiveIv,
          ev: pokemon.ev,
          level: pokemon.level,
          nature: natureAdjustment,
          hpRule: statBattle.hpRule,
        })

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      quickRequestVersion.current += 1
      correctionRequestVersion.current += 1
    }
  }, [])

  useEffect(() => {
    const version = ++quickRequestVersion.current
    const key = `${pokemon.speciesId}\u0000${pokemon.formId}`
    void listPokemonFilteredOptions(createClient(), pokemon.speciesId, pokemon.formId)
      .then((loaded) => {
        if (!mounted.current || quickRequestVersion.current !== version) return
        const allowedAbilityIds = new Set(loaded.abilities.map((ability) => ability.id))
        setDraft((current) => reconcileBattleSelections({
          ...current,
          abilityId: current.abilityId && allowedAbilityIds.has(current.abilityId)
            ? current.abilityId
            : null,
        }, loaded.battle))
        setQuickFilter({ key, status: 'loaded', options: loaded })
      })
      .catch(() => {
        if (!mounted.current || quickRequestVersion.current !== version) return
        setQuickFilter({ key, status: 'error', options: null })
      })
  }, [pokemon.formId, pokemon.speciesId])

  const loadCorrectionOptions = useCallback(async (speciesId: string, formId: string) => {
    const version = ++correctionRequestVersion.current
    setCorrectionFilterStatus('loading')
    try {
      const loaded = await listPokemonFilteredOptions(createClient(), speciesId, formId)
      if (!mounted.current || correctionRequestVersion.current !== version) return
      const allowedAbilityIds = new Set(loaded.abilities.map((ability) => ability.id))
      const speciesChanged = speciesId !== pokemon.speciesId
      setCorrection((current) => {
        if (current.speciesId !== speciesId || current.formId !== formId) return current
        return reconcileBattleSelections({
          ...current,
          abilityId: speciesChanged
            ? null
            : pokemon.abilityId && allowedAbilityIds.has(pokemon.abilityId)
              ? pokemon.abilityId
              : null,
          currentMoves: speciesChanged ? [] : pokemon.currentMoves,
          targetMoves: speciesChanged ? [] : pokemon.targetMoves,
        }, loaded.battle)
      })
      setCorrectionFilterStatus('loaded')
    } catch {
      if (!mounted.current || correctionRequestVersion.current !== version) return
      setCorrectionFilterStatus('error')
    }
  }, [pokemon])

  async function saveQuickEdit() {
    if (quickFilterStatus !== 'loaded') return
    const errors = validateOwnedPokemon(draft)
    if (errors.length) {
      setMessage(errors[0])
      return
    }
    setPending(true)
    try {
      await updateOwnedPokemonQuick(createClient(), pokemon.id, draft)
      const teraTypeNameKo = quickOptions?.battle.teraTypes.find(
        (type) => type.id === draft.teraTypeId,
      )?.nameKo ?? null
      setPokemon({
        ...draft,
        teraTypeNameKo,
        battle: quickOptions?.battle ?? pokemon.battle,
      })
      setMessage('빠른 수정 내용을 저장했습니다.')
    } catch {
      setMessage('빠른 수정 내용을 저장하지 못했습니다.')
    } finally {
      setPending(false)
    }
  }

  async function saveCorrection() {
    if (correctionFilterStatus !== 'loaded') return
    const errors = validateOwnedPokemon(correction)
    if (errors.length) {
      setMessage(errors[0])
      return
    }
    if (reasonKo.trim().length < 5) {
      setMessage('정정 사유를 5자 이상 입력해 주세요.')
      return
    }
    if (!window.confirm('보호 정보를 정정하고 이전 값을 감사 이력에 보존할까요?')) return

    setPending(true)
    try {
      await correctOwnedPokemon(createClient(), pokemon.id, correction, reasonKo)
      if (correction.speciesId !== pokemon.speciesId || correction.formId !== pokemon.formId) {
        router.replace('/my-pokemon')
        router.refresh()
        return
      }
      const correctedPokemon = {
        ...pokemon,
        capturedOn: correction.capturedOn,
        originalIv: correction.originalIv,
      }
      setPokemon(correctedPokemon)
      setDraft(correctedPokemon)
      setCorrectionOpen(false)
      setMessage('보호 정보를 정정하고 변경 이력을 보존했습니다.')
    } catch {
      setMessage('보호 정보를 정정하지 못했습니다.')
    } finally {
      setPending(false)
    }
  }

  function chooseCorrectionSpecies(speciesId: string) {
    const species = options.species.find((item) => item.id === speciesId)
    const form = species?.forms.find((item) => item.isDefault) ?? species?.forms[0]
    const formId = form?.id ?? ''
    setCorrection((current) => ({
      ...current,
      speciesId,
      formId,
      abilityId: speciesId === pokemon.speciesId ? pokemon.abilityId : null,
      currentMoves: speciesId === pokemon.speciesId ? pokemon.currentMoves : [],
      targetMoves: speciesId === pokemon.speciesId ? pokemon.targetMoves : [],
    }))
    if (formId) void loadCorrectionOptions(speciesId, formId)
    else setCorrectionFilterStatus('error')
  }

  function chooseCorrectionForm(formId: string) {
    const speciesId = correction.speciesId
    const speciesChanged = speciesId !== pokemon.speciesId
    setCorrection((current) => ({
      ...current,
      formId,
      abilityId: speciesChanged ? null : pokemon.abilityId,
      currentMoves: speciesChanged ? [] : pokemon.currentMoves,
      targetMoves: speciesChanged ? [] : pokemon.targetMoves,
    }))
    void loadCorrectionOptions(speciesId, formId)
  }

  function toggleCorrection() {
    if (correctionOpen) {
      correctionRequestVersion.current += 1
      setCorrectionOpen(false)
      setCorrectionFilterStatus('idle')
      return
    }
    setCorrection(pokemon)
    setReasonKo('')
    setCorrectionOpen(true)
    void loadCorrectionOptions(pokemon.speciesId, pokemon.formId)
  }

  async function uploadPrivateImage(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('이미지는 5 MiB 이하만 업로드할 수 있습니다.')
      return
    }

    setPending(true)
    const query = `dex=${String(dex).padStart(4, '0')}&entry=${entry}`
    try {
      const prepared = await fetch(`/api/private-images?${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType: file.type, byteSize: file.size }),
      })
      const preparedBody = await prepared.json() as {
        path?: string
        token?: string
        error?: string
      }
      if (!prepared.ok || !preparedBody.path || !preparedBody.token) {
        throw new Error(preparedBody.error ?? '업로드 주소를 만들지 못했습니다.')
      }

      const uploaded = await createClient().storage.from('private-pokemon-images').uploadToSignedUrl(
        preparedBody.path,
        preparedBody.token,
        file,
        { contentType: file.type },
      )
      if (uploaded.error) throw uploaded.error

      const processed = await fetch(`/api/private-images?${query}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: preparedBody.path }),
      })
      const processedBody = await processed.json() as { message?: string; error?: string }
      if (!processed.ok) throw new Error(processedBody.error ?? '이미지를 처리하지 못했습니다.')
      setImageRevision((current) => current + 1)
      setMessage(processedBody.message ?? '비공개 이미지를 저장했습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '비공개 이미지를 저장하지 못했습니다.')
    } finally {
      setPending(false)
    }
  }

  async function deletePrivateImage() {
    if (!window.confirm('등록한 비공개 이미지를 삭제할까요?')) return
    setPending(true)
    try {
      const response = await fetch(
        `/api/private-images?dex=${String(dex).padStart(4, '0')}&entry=${entry}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        const body = await response.json() as { error?: string }
        throw new Error(body.error ?? '이미지를 삭제하지 못했습니다.')
      }
      setImageRevision((current) => current + 1)
      setMessage('비공개 이미지를 삭제했습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '비공개 이미지를 삭제하지 못했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="detail-heading">
        <PrivatePokemonImage
          dex={dex}
          entry={entry}
          revision={imageRevision}
          alt={`${pokemon.nickname || pokemon.nameKo} 개인 이미지`}
          className="detail-pokemon-image"
        />
        <div>
          <Link className="back-link" href="/my-pokemon">← 내 포켓몬</Link>
          <p className="eyebrow">도감번호 #{String(pokemon.nationalDexNumber).padStart(4, '0')}</p>
          <h1>{pokemon.nickname || pokemon.nameKo}</h1>
          <p>{pokemon.nameKo} · {pokemon.formNameKo} · <strong>Lv. {pokemon.level}</strong></p>
          {pokemon.notes ? <p>{pokemon.notes}</p> : null}
          <p>포획일: {pokemon.capturedOn || '미입력'}</p>
          <div aria-label="저장된 전투 설정">
            <PokemonBattleBadges
              teraTypeNameKo={pokemon.teraTypeNameKo}
              hasGigantamaxFactor={pokemon.hasGigantamaxFactor}
            />
          </div>
        </div>
      </div>

      <section className="detail-panel battle-overview" aria-labelledby="battle-overview-title">
        <h2 id="battle-overview-title">전투 정보</h2>
        <PokemonStatTable
          baseStats={statBattle?.baseStats ?? null}
          originalIv={pokemon.originalIv}
          effectiveIv={pokemon.effectiveIv}
          ev={pokemon.ev}
          actualStats={actualStats}
          caption="보유 포켓몬 능력치"
        />
        <div className="detail-move-card-grid">
          {pokemon.currentMoveDetails.map((move, index) => (
            <PokemonMoveCard
              key={`detail-current-${move.moveId}-${move.slot}`}
              move={move}
              heading={`현재 기술 ${index + 1}`}
            />
          ))}
          {pokemon.targetMoveDetails.map((move, index) => (
            <PokemonMoveCard
              key={`detail-target-${move.moveId}-${move.slot}`}
              move={move}
              heading={`목표 기술 ${index + 1}`}
              conditionKo={move.conditionKo}
            />
          ))}
        </div>
      </section>

      <section className="detail-panel image-panel" aria-labelledby="private-image-title">
        <h2 id="private-image-title">비공개 개인 이미지</h2>
        <p>JPEG·PNG·WebP, 최대 5 MiB. 메타데이터를 제거하고 최대 1,024px WebP로 저장합니다.</p>
        <label className="secondary-button file-button" htmlFor="private-image-upload">
          이미지 선택
        </label>
        <input
          id="private-image-upload"
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(event) => uploadPrivateImage(event.target.files?.[0])}
        />
        <button type="button" className="text-button" disabled={pending} onClick={deletePrivateImage}>
          등록 이미지 삭제
        </button>
      </section>

      <div className="detail-grid">
        <section className="detail-panel" aria-labelledby="quick-edit-title">
          <h2 id="quick-edit-title">빠른 수정</h2>
          <p>육성 중 자주 바뀌는 정보입니다.</p>
          <div className="detail-form-grid">
            <label htmlFor="quick-nickname">별명</label>
            <input id="quick-nickname" value={draft.nickname ?? ''} maxLength={40} onChange={(event) => setDraft({ ...draft, nickname: event.target.value || null })} />
            <label htmlFor="quick-level">빠른 수정 레벨</label>
            <input id="quick-level" type="number" min={1} max={100} value={draft.level} onChange={(event) => setDraft({ ...draft, level: Number(event.target.value) })} />
            <label htmlFor="quick-gender">성별</label>
            <select id="quick-gender" value={draft.gender} onChange={(event) => setDraft({ ...draft, gender: event.target.value as OwnedPokemonDetail['gender'] })}>
              <option value="male">수컷</option><option value="female">암컷</option><option value="genderless">무성</option>
            </select>
            <label htmlFor="quick-nature">현재 성격</label>
            <select id="quick-nature" value={draft.effectiveNatureId ?? ''} onChange={(event) => setDraft({ ...draft, effectiveNatureId: event.target.value || null })}>
              <option value="">미지정</option>{options.natures.map((item) => <option key={item.id} value={item.id}>{item.nameKo}</option>)}
            </select>
            <label htmlFor="quick-ability">특성</label>
            <select
              id="quick-ability"
              value={draft.abilityId ?? ''}
              disabled={pending || quickFilterStatus !== 'loaded'}
              aria-describedby={selectedQuickAbility ? 'quick-ability-description' : undefined}
              onChange={(event) => setDraft({ ...draft, abilityId: event.target.value || null })}
            >
              <option value="">미지정</option>
              {quickAbilities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nameKo}{item.isHidden ? ' · 숨겨진 특성' : ''}
                </option>
              ))}
            </select>
            {selectedQuickAbility
              ? <p id="quick-ability-description">{selectedQuickAbility.descriptionKo}</p>
              : null}
            {quickFilterStatus === 'loading'
              ? <p role="status" aria-live="polite">빠른 수정 특성을 불러오는 중입니다.</p>
              : null}
            {quickFilterStatus === 'error'
              ? <p className="form-error" role="status">빠른 수정 특성을 불러오지 못했습니다. 다시 시도해 주세요.</p>
              : null}
            {quickFilterStatus === 'loaded' && quickAbilities.length === 0
              ? <p role="status" aria-live="polite">선택한 모습에 등록된 특성이 없습니다.</p>
              : null}
            {quickFilterStatus === 'loaded' && quickOptions ? (
              <PokemonBattleFields
                teraTypes={quickOptions.battle.teraTypes}
                teraTypeId={draft.teraTypeId}
                canGigantamax={quickOptions.battle.canGigantamax}
                hasGigantamaxFactor={draft.hasGigantamaxFactor}
                onTeraTypeChange={(teraTypeId) => setDraft((current) => ({
                  ...current,
                  teraTypeId,
                }))}
                onGigantamaxFactorChange={(hasGigantamaxFactor) => setDraft((current) => ({
                  ...current,
                  hasGigantamaxFactor,
                }))}
                disabled={pending}
                idPrefix="quick-battle"
              />
            ) : null}
            <label htmlFor="quick-item">지닌 도구</label>
            <select id="quick-item" value={draft.heldItemId ?? ''} onChange={(event) => setDraft({ ...draft, heldItemId: event.target.value || null })}>
              <option value="">없음</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.nameKo}</option>)}
            </select>
            <label htmlFor="quick-notes">메모</label>
            <textarea id="quick-notes" value={draft.notes} maxLength={4000} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </div>
          <h3>적용 IV (왕관 보정 포함)</h3>
          <div className="compact-stat-grid">
            {statKeys.map((key) => (
              <label key={key} htmlFor={`quick-iv-${key}`}>{statLabels[key]} 적용 IV (왕관 보정 포함)
                <input id={`quick-iv-${key}`} type="number" min={draft.originalIv[key]} max={31} value={draft.effectiveIv[key]} onChange={(event) => setDraft({ ...draft, effectiveIv: { ...draft.effectiveIv, [key]: Number(event.target.value) } })} />
              </label>
            ))}
          </div>
          <h3>EV</h3>
          <div className="compact-stat-grid">
            {statKeys.map((key) => (
              <label key={key} htmlFor={`quick-ev-${key}`}>{statLabels[key]}
                <input id={`quick-ev-${key}`} type="number" min={0} max={252} value={draft.ev[key]} onChange={(event) => setDraft({ ...draft, ev: { ...draft.ev, [key]: Number(event.target.value) } })} />
              </label>
            ))}
          </div>
          <button type="button" className="primary-button" disabled={pending || quickFilterStatus !== 'loaded'} onClick={saveQuickEdit}>빠른 수정 저장</button>
        </section>

        <section className="detail-panel" aria-labelledby="evolution-title">
          <h2 id="evolution-title">육성 계획</h2>
          {pokemon.evolutionRules.length ? pokemon.evolutionRules.map((rule) => (
            <div className="evolution-plan" key={`${rule.targetDexNumber}-${rule.conditionKo}`}>
              <strong>{rule.targetNameKo} · 도감번호 #{String(rule.targetDexNumber).padStart(4, '0')}</strong>
              <p>{rule.conditionKo}</p>
              <label><input type="checkbox" /> 진화 조건 확인 완료</label>
            </div>
          )) : <p>현재 모습에서 연결된 진화 조건이 없습니다.</p>}
        </section>
      </div>

      <section className="detail-panel protected-panel" aria-labelledby="protected-title">
        <h2 id="protected-title">보호 정보</h2>
        <p>종·모습·개체값 IV (원본)·포획 정보는 사유와 확인 절차를 거쳐야 정정할 수 있습니다.</p>
        <button type="button" className="secondary-button" onClick={toggleCorrection}>보호 정보 정정 열기</button>
        {correctionOpen ? (
          <div className="correction-form">
            <label htmlFor="correction-species">정정 포켓몬 종</label>
            <select id="correction-species" value={correction.speciesId} onChange={(event) => chooseCorrectionSpecies(event.target.value)}>
              {options.species.map((item) => <option key={item.id} value={item.id}>{item.nameKo} · 도감번호 #{String(item.nationalDexNumber).padStart(4, '0')}</option>)}
            </select>
            <label htmlFor="correction-form">정정 모습</label>
            <select id="correction-form" value={correction.formId} onChange={(event) => chooseCorrectionForm(event.target.value)}>
              {(correctionSpecies?.forms ?? []).map((form) => <option key={form.id} value={form.id}>{form.nameKo}</option>)}
            </select>
            <label htmlFor="correction-captured-on">정정 포획일</label>
            <input id="correction-captured-on" type="date" value={correction.capturedOn ?? ''} onChange={(event) => setCorrection({ ...correction, capturedOn: event.target.value || null })} />
            <div className="compact-stat-grid">
              {statKeys.map((key) => (
                <label key={key} htmlFor={`correction-iv-${key}`}>{statLabels[key]} 개체값 IV (원본)
                  <input id={`correction-iv-${key}`} type="number" min={0} max={correction.effectiveIv[key]} value={correction.originalIv[key]} onChange={(event) => setCorrection({ ...correction, originalIv: { ...correction.originalIv, [key]: Number(event.target.value) } })} />
                </label>
              ))}
            </div>
            <label htmlFor="correction-reason">정정 사유</label>
            <textarea id="correction-reason" value={reasonKo} minLength={5} required onChange={(event) => setReasonKo(event.target.value)} />
            {correctionFilterStatus === 'loading'
              ? <p role="status" aria-live="polite">정정할 모습의 특성을 확인하는 중입니다.</p>
              : null}
            {correctionFilterStatus === 'error'
              ? <p className="form-error" role="status">정정할 모습의 특성을 확인하지 못했습니다. 다시 선택해 주세요.</p>
              : null}
            <button type="button" className="primary-button" disabled={pending || correctionFilterStatus !== 'loaded'} onClick={saveCorrection}>정정 저장</button>
          </div>
        ) : null}
      </section>
      {message ? <p className="save-message" role="status">{message}</p> : null}
    </>
  )
}

function effectiveNatureAdjustment(
  effectiveNatureId: string | null,
  nature: OwnedPokemonEditOptions['natures'][number] | undefined,
): NatureAdjustment | null | undefined {
  if (effectiveNatureId === null) return null
  if (
    !nature
    || !Object.hasOwn(nature, 'increasedStat')
    || !Object.hasOwn(nature, 'decreasedStat')
  ) return undefined
  return {
    increased: nature.increasedStat,
    decreased: nature.decreasedStat,
  }
}
