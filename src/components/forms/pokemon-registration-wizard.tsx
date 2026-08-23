'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import {
  createOwnedPokemon,
  listOwnedPokemonEditOptions,
  type OwnedPokemonEditOptions,
} from '@/features/owned-pokemon/repository'
import {
  createRegistrationDraft,
  readRegistrationDraft,
  reconcileSpeciesSelection,
  registrationDraftKey,
  type RegistrationDraft,
} from '@/features/owned-pokemon/registration-state'
import { statKeys, validateOwnedPokemon } from '@/features/owned-pokemon/schema'

const stepTitles = [
  '종·모습',
  '기본 정보',
  '성격·특성',
  '원본·실전 IV',
  'EV',
  '현재·목표 기술',
  '이미지·최종 확인',
]

const statLabels = {
  hp: 'HP',
  attack: '공격',
  defense: '방어',
  special_attack: '특수공격',
  special_defense: '특수방어',
  speed: '스피드',
} as const

export function PokemonRegistrationWizard() {
  const router = useRouter()
  const [draft, setDraft] = useState<RegistrationDraft>(createRegistrationDraft)
  const [options, setOptions] = useState<OwnedPokemonEditOptions>({
    species: [],
    natures: [],
    abilities: [],
    items: [],
  })
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const selectedSpecies = useMemo(
    () => options.species.find((item) => item.id === draft.speciesId),
    [draft.speciesId, options.species],
  )

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) setDraft(readRegistrationDraft(sessionStorage))
    })
    listOwnedPokemonEditOptions(createClient())
      .then((loadedOptions) => {
        if (active) setOptions(loadedOptions)
      })
      .catch(() => {
        if (active) setMessage('포켓몬 기준데이터를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (ready) sessionStorage.setItem(registrationDraftKey, JSON.stringify(draft))
  }, [draft, ready])

  function update(patch: Partial<RegistrationDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function chooseSpecies(speciesId: string) {
    const option = options.species.find((item) => item.id === speciesId)
    const form = option?.forms.find((item) => item.isDefault) ?? option?.forms[0]
    setDraft((current) => reconcileSpeciesSelection(current, speciesId, form?.id ?? ''))
  }

  function next() {
    if (draft.step === 1 && (!draft.speciesId || !draft.formId)) {
      setMessage('포켓몬 종을 선택해 주세요.')
      return
    }
    setMessage('')
    update({ step: Math.min(7, draft.step + 1) })
  }

  async function submit() {
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

  return (
    <section className="registration-card" aria-labelledby="registration-title">
      <div className="registration-progress">
        <span>{draft.step} / 7단계</span>
        <progress value={draft.step} max={7}>7단계 중 {draft.step}단계</progress>
      </div>
      <h1 id="registration-title">{stepTitles[draft.step - 1]}</h1>

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
            <select id="form" value={draft.formId} onChange={(event) => update({ formId: event.target.value })}>
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
            <select id="ability" value={draft.abilityId ?? ''} onChange={(event) => update({ abilityId: event.target.value || null })}>
              <option value="">미지정</option>{options.abilities.map((item) => <option key={item.id} value={item.id}>{item.nameKo}</option>)}
            </select>
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
            <p>현재 기술과 목표 기술은 기술 적법성 기능에서 연결됩니다.</p>
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
            <p>개인 이미지는 다음 단계에서 비공개 업로드로 지원됩니다.</p>
          </div>
        ) : null}
      </div>

      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <div className="wizard-actions">
        {draft.step > 1 ? <button type="button" className="text-button" onClick={() => update({ step: draft.step - 1 })}>이전</button> : null}
        {draft.step < 7 ? <button type="button" className="primary-button" onClick={next}>다음</button> : <button type="button" className="primary-button" onClick={submit}>등록 완료</button>}
      </div>
    </section>
  )
}
