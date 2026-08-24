'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { retrySupabaseRead } from '@/lib/supabase/retry'
import { PokemonMoveSlot } from '@/components/forms/pokemon-move-slot'
import {
  createOwnedPokemon,
  listOwnedPokemonEditOptions,
  listPokemonFilteredOptions,
  type MoveOption,
  type OwnedPokemonEditOptions,
  type PokemonFilteredOptions,
} from '@/features/owned-pokemon/repository'
import {
  createRegistrationDraft,
  readRegistrationDraft,
  reconcileFilteredSelections,
  reconcileSpeciesSelection,
  registrationDraftKey,
  type RegistrationDraft,
} from '@/features/owned-pokemon/registration-state'
import { statKeys, validateOwnedPokemon } from '@/features/owned-pokemon/schema'

const stepTitles = [
  '종·모습', '기본 정보', '성격·특성', '원본·실전 IV', 'EV',
  '현재·목표 기술', '이미지·최종 확인',
]

const statLabels = {
  hp: 'HP',
  attack: '공격',
  defense: '방어',
  special_attack: '특수공격',
  special_defense: '특수방어',
  speed: '스피드',
} as const

const emptyEditOptions: OwnedPokemonEditOptions = {
  species: [], natures: [], abilities: [], items: [],
}
const emptyFilteredOptions: PokemonFilteredOptions = {
  abilities: [],
  moves: [],
  battle: {
    baseStats: null,
    hpRule: 'standard',
    teraTypes: [],
    canGigantamax: false,
  },
}
const moveSlots = [0, 1, 2, 3] as const

type FilterStatus = 'idle' | 'loading' | 'loaded' | 'error'
type ReferenceStatus = 'loading' | 'loaded' | 'error'

function selectedMoveNames(
  selected: ReadonlyArray<{ moveId: string }>,
  moves: MoveOption[],
) {
  const names = selected
    .map((entry) => moves.find((move) => move.id === entry.moveId)?.nameKo)
    .filter((name): name is string => Boolean(name))
  return names.length ? names.join(', ') : '미지정'
}

export function PokemonRegistrationWizard() {
  const router = useRouter()
  const [draft, setDraft] = useState<RegistrationDraft>(createRegistrationDraft)
  const [options, setOptions] = useState<OwnedPokemonEditOptions>(emptyEditOptions)
  const [filteredOptions, setFilteredOptions] = useState<PokemonFilteredOptions>(
    emptyFilteredOptions,
  )
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('idle')
  const [referenceStatus, setReferenceStatus] = useState<ReferenceStatus>('loading')
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const requestVersion = useRef(0)
  const mounted = useRef(true)
  const selectedSpecies = useMemo(
    () => options.species.find((item) => item.id === draft.speciesId),
    [draft.speciesId, options.species],
  )
  const selectedAbility = filteredOptions.abilities.find(
    (ability) => ability.id === draft.abilityId,
  )
  const currentMoveIds = new Set(draft.currentMoves.map((move) => move.moveId))
  const targetMoveIds = new Set(draft.targetMoves.map((move) => move.moveId))
  const serializedDraft = JSON.stringify(draft)

  const loadFilteredOptions = useCallback(async (
    speciesId: string,
    formId: string,
  ) => {
    const version = ++requestVersion.current
    if (!speciesId || !formId) {
      setFilteredOptions(emptyFilteredOptions)
      setFilterStatus('idle')
      return
    }

    setFilteredOptions(emptyFilteredOptions)
    setFilterStatus('loading')
    try {
      const client = createClient()
      const loadedOptions = await retrySupabaseRead(
        client,
        () => listPokemonFilteredOptions(client, speciesId, formId),
      )
      if (!mounted.current || requestVersion.current !== version) return
      setDraft((current) => current.speciesId === speciesId && current.formId === formId
        ? reconcileFilteredSelections(current, loadedOptions)
        : current)
      setFilteredOptions(loadedOptions)
      setFilterStatus('loaded')
    } catch {
      if (!mounted.current || requestVersion.current !== version) return
      setFilteredOptions(emptyFilteredOptions)
      setFilterStatus('error')
    }
  }, [])

  const loadEditOptions = useCallback(async () => {
    setReady(false)
    setReferenceStatus('loading')
    setMessage('')
    const client = createClient()
    try {
      const loadedOptions = await retrySupabaseRead(
        client,
        () => listOwnedPokemonEditOptions(client),
      )
      if (!mounted.current) return
      setOptions(loadedOptions)
      setReferenceStatus('loaded')
      setReady(true)
    } catch {
      if (!mounted.current) return
      setOptions(emptyEditOptions)
      setReferenceStatus('error')
      setMessage('포켓몬 기준데이터를 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    let active = true
    mounted.current = true
    const restoredDraft = readRegistrationDraft(sessionStorage)
    queueMicrotask(() => {
      if (!active) return
      setDraft(restoredDraft)
      void loadFilteredOptions(restoredDraft.speciesId, restoredDraft.formId)
      void loadEditOptions()
    })
    return () => {
      active = false
      mounted.current = false
      requestVersion.current += 1
    }
  }, [loadEditOptions, loadFilteredOptions])

  useEffect(() => {
    if (ready) sessionStorage.setItem(registrationDraftKey, serializedDraft)
  }, [ready, serializedDraft])

  function update(patch: Partial<RegistrationDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function chooseSpecies(speciesId: string) {
    const option = options.species.find((item) => item.id === speciesId)
    const form = option?.forms.find((item) => item.isDefault) ?? option?.forms[0]
    const formId = form?.id ?? ''
    setDraft((current) => reconcileSpeciesSelection(current, speciesId, formId))
    void loadFilteredOptions(speciesId, formId)
  }

  function chooseForm(formId: string) {
    const speciesId = draft.speciesId
    setDraft((current) => ({ ...current, formId }))
    void loadFilteredOptions(speciesId, formId)
  }

  function chooseCurrentMove(slot: number, moveId: string) {
    setDraft((current) => {
      const currentMoves = [...current.currentMoves]
      if (moveId) currentMoves[slot] = { moveId }
      else currentMoves.splice(slot, 1)
      return { ...current, currentMoves: currentMoves.filter(Boolean).slice(0, 4) }
    })
  }

  function chooseTargetMove(slot: number, moveId: string) {
    const move = filteredOptions.moves.find((option) => option.id === moveId)
    setDraft((current) => {
      const targetMoves = [...current.targetMoves]
      if (move) targetMoves[slot] = { moveId, conditionKo: move.routes[0]?.conditionKo ?? '' }
      else targetMoves.splice(slot, 1)
      return { ...current, targetMoves: targetMoves.filter(Boolean).slice(0, 4) }
    })
  }

  function chooseTargetRoute(slot: number, conditionKo: string) {
    setDraft((current) => ({
      ...current,
      targetMoves: current.targetMoves.map((move, index) => index === slot
        ? { ...move, conditionKo }
        : move),
    }))
  }

  function next() {
    if (filterBlocked) return
    if (draft.step === 1 && (!draft.speciesId || !draft.formId)) {
      setMessage('포켓몬 종을 선택해 주세요.')
      return
    }
    setMessage('')
    update({ step: Math.min(7, draft.step + 1) })
  }

  async function submit() {
    if (filterBlocked) return
    const errors = validateOwnedPokemon(draft)
    if (errors.length) {
      setMessage(errors[0])
      return
    }
    const client = createClient()
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) {
      router.replace('/login')
      return
    }
    try {
      await createOwnedPokemon(client, draft)
      sessionStorage.removeItem(registrationDraftKey)
      router.replace('/my-pokemon')
      router.refresh()
    } catch {
      setMessage('등록하지 못했습니다. 입력값을 확인해 주세요.')
    }
  }

  const filterStatusMessage = filterStatus === 'loading'
    ? '특성과 기술을 불러오는 중입니다.'
    : filterStatus === 'error'
      ? '특성과 기술을 불러오지 못했습니다. 종과 모습을 다시 선택해 주세요.'
      : ''
  const filterBlocked = Boolean(draft.speciesId && draft.formId)
    && filterStatus !== 'loaded'

  return (
    <section className="registration-card" aria-labelledby="registration-title">
      <div className="registration-progress">
        <span>{draft.step} / 7단계</span>
        <progress value={draft.step} max={7}>7단계 중 {draft.step}단계</progress>
      </div>
      <h1 id="registration-title">{stepTitles[draft.step - 1]}</h1>

      {filterStatusMessage ? (
        <p className={filterStatus === 'error' ? 'form-error' : 'filter-status'} role="status" aria-live="polite">
          {filterStatusMessage}
        </p>
      ) : null}
      {filterStatus === 'error' && draft.speciesId && draft.formId ? (
        <button
          type="button"
          className="text-button"
          onClick={() => void loadFilteredOptions(draft.speciesId, draft.formId)}
        >
          특성·기술 다시 불러오기
        </button>
      ) : null}
      {referenceStatus === 'loading' ? (
        <p className="filter-status" role="status" aria-live="polite">
          포켓몬 기준데이터를 불러오는 중입니다.
        </p>
      ) : null}

      <div className="registration-fields">
        {draft.step === 1 ? (
          <>
            <label htmlFor="species">포켓몬 종</label>
            <select id="species" value={draft.speciesId} onChange={(event) => chooseSpecies(event.target.value)} disabled={!ready}>
              <option value="">선택해 주세요</option>
              {options.species.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nameKo} · 도감번호 #{String(item.nationalDexNumber).padStart(4, '0')}
                </option>
              ))}
            </select>
            <label htmlFor="form">모습</label>
            <select id="form" value={draft.formId} onChange={(event) => chooseForm(event.target.value)} disabled={!draft.speciesId}>
              {(selectedSpecies?.forms ?? []).map((form) => <option key={form.id} value={form.id}>{form.nameKo}</option>)}
            </select>
          </>
        ) : null}

        {draft.step === 2 ? (
          <>
            <label htmlFor="nickname">별명</label>
            <input id="nickname" value={draft.nickname ?? ''} maxLength={40} onChange={(event) => update({ nickname: event.target.value || null })} />
            <label htmlFor="gender">성별</label>
            <select id="gender" value={draft.gender} onChange={(event) => update({ gender: event.target.value as RegistrationDraft['gender'] })}>
              <option value="male">수컷</option><option value="female">암컷</option><option value="genderless">무성</option>
            </select>
            <label htmlFor="level">레벨</label>
            <input id="level" type="number" min={1} max={100} value={draft.level} onChange={(event) => update({ level: Number(event.target.value) })} />
            <label htmlFor="captured-on">포획일</label>
            <input id="captured-on" type="date" value={draft.capturedOn ?? ''} onChange={(event) => update({ capturedOn: event.target.value || null })} />
          </>
        ) : null}

        {draft.step === 3 ? (
          <>
            <label htmlFor="original-nature">원본 성격</label>
            <select id="original-nature" value={draft.originalNatureId ?? ''} onChange={(event) => update({ originalNatureId: event.target.value || null })}>
              <option value="">미지정</option>{options.natures.map((item) => <option key={item.id} value={item.id}>{item.nameKo}</option>)}
            </select>
            <label htmlFor="effective-nature">현재 성격</label>
            <select id="effective-nature" value={draft.effectiveNatureId ?? ''} onChange={(event) => update({ effectiveNatureId: event.target.value || null })}>
              <option value="">미지정</option>{options.natures.map((item) => <option key={item.id} value={item.id}>{item.nameKo}</option>)}
            </select>
            <label htmlFor="ability">특성</label>
            <select
              id="ability"
              value={draft.abilityId ?? ''}
              disabled={filterStatus === 'loading' || filterStatus === 'error'}
              aria-describedby={selectedAbility ? 'selected-ability-description' : undefined}
              onChange={(event) => update({ abilityId: event.target.value || null })}
            >
              <option value="">미지정</option>
              {filteredOptions.abilities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nameKo}{item.isHidden ? ' · 숨겨진 특성' : ''}
                </option>
              ))}
            </select>
            {selectedAbility ? <p id="selected-ability-description">{selectedAbility.descriptionKo}</p> : null}
            {filterStatus === 'loaded' && filteredOptions.abilities.length === 0
              ? <p role="status" aria-live="polite">선택한 모습에 등록된 특성이 없습니다.</p>
              : null}
          </>
        ) : null}
        {draft.step === 4 ? (
          <div className="stat-grid">
            {statKeys.map((key) => (
              <div key={key}>
                <strong>{statLabels[key]}</strong>
                <label htmlFor={`original-${key}`}>원본 IV</label>
                <input id={`original-${key}`} type="number" min={0} max={31} value={draft.originalIv[key]} onChange={(event) => update({ originalIv: { ...draft.originalIv, [key]: Number(event.target.value) } })} />
                <label htmlFor={`effective-${key}`}>실전 IV</label>
                <input id={`effective-${key}`} type="number" min={draft.originalIv[key]} max={31} value={draft.effectiveIv[key]} onChange={(event) => update({ effectiveIv: { ...draft.effectiveIv, [key]: Number(event.target.value) } })} />
              </div>
            ))}
          </div>
        ) : null}
        {draft.step === 5 ? (
          <div className="stat-grid">
            {statKeys.map((key) => (
              <div key={key}>
                <label htmlFor={`ev-${key}`}><strong>{statLabels[key]} EV</strong></label>
                <input id={`ev-${key}`} type="number" min={0} max={252} value={draft.ev[key]} onChange={(event) => update({ ev: { ...draft.ev, [key]: Number(event.target.value) } })} />
              </div>
            ))}
          </div>
        ) : null}
        {draft.step === 6 ? (
          <>
            {filterStatus === 'loaded' && filteredOptions.moves.length === 0
              ? <p role="status" aria-live="polite">선택한 종에 등록된 기술이 없습니다.</p>
              : null}
            <div className="move-slot-grid">
              <fieldset>
                <legend>현재 기술</legend>
                {moveSlots.map((slot) => (
                  <PokemonMoveSlot
                    key={`current-${slot}`}
                    kind="current"
                    slot={slot}
                    moveId={draft.currentMoves[slot]?.moveId ?? ''}
                    moves={filteredOptions.moves}
                    selectedMoveIds={currentMoveIds}
                    disabled={filterBlocked || slot > draft.currentMoves.length}
                    onMoveChange={chooseCurrentMove}
                  />
                ))}
              </fieldset>
              <fieldset>
                <legend>목표 기술</legend>
                {moveSlots.map((slot) => (
                  <PokemonMoveSlot
                    key={`target-${slot}`}
                    kind="target"
                    slot={slot}
                    moveId={draft.targetMoves[slot]?.moveId ?? ''}
                    conditionKo={draft.targetMoves[slot]?.conditionKo}
                    moves={filteredOptions.moves}
                    selectedMoveIds={targetMoveIds}
                    disabled={filterBlocked || slot > draft.targetMoves.length}
                    onMoveChange={chooseTargetMove}
                    onRouteChange={chooseTargetRoute}
                  />
                ))}
              </fieldset>
            </div>
            <label htmlFor="held-item">지닌 도구</label>
            <select id="held-item" value={draft.heldItemId ?? ''} onChange={(event) => update({ heldItemId: event.target.value || null })}>
              <option value="">없음</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.nameKo}</option>)}
            </select>
          </>
        ) : null}
        {draft.step === 7 ? (
          <div className="registration-summary">
            <strong>{draft.nickname || selectedSpecies?.nameKo || '이름 없음'}</strong>
            <span>{selectedSpecies?.nameKo} · Lv. {draft.level}</span>
            <p>특성: {selectedAbility?.nameKo ?? '미지정'}</p>
            <p>현재 기술: {selectedMoveNames(draft.currentMoves, filteredOptions.moves)}</p>
            <p>목표 기술: {selectedMoveNames(draft.targetMoves, filteredOptions.moves)}</p>
            <p>개인 이미지는 다음 단계에서 비공개 업로드로 지원됩니다.</p>
          </div>
        ) : null}
      </div>

      {message ? <p className="form-error" role="alert">{message}</p> : null}
      {referenceStatus === 'error' ? (
        <button type="button" className="text-button" onClick={() => void loadEditOptions()}>
          기준데이터 다시 불러오기
        </button>
      ) : null}
      <div className="wizard-actions">
        {draft.step > 1 ? <button type="button" className="text-button" onClick={() => update({ step: draft.step - 1 })}>이전</button> : null}
        {draft.step < 7
          ? <button type="button" className="primary-button" onClick={next} disabled={!ready || filterBlocked}>다음</button>
          : <button type="button" className="primary-button" onClick={submit} disabled={!ready || filterBlocked}>등록 완료</button>}
      </div>
    </section>
  )
}
