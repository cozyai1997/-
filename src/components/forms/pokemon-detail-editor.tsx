'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import {
  correctOwnedPokemon,
  type OwnedPokemonDetail,
  type OwnedPokemonEditOptions,
  updateOwnedPokemonQuick,
} from '@/features/owned-pokemon/repository'
import { statKeys, validateOwnedPokemon } from '@/features/owned-pokemon/schema'
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
}

export function PokemonDetailEditor({ initialPokemon, options }: PokemonDetailEditorProps) {
  const router = useRouter()
  const [pokemon, setPokemon] = useState(initialPokemon)
  const [draft, setDraft] = useState(initialPokemon)
  const [correction, setCorrection] = useState(initialPokemon)
  const [reasonKo, setReasonKo] = useState('')
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const correctionSpecies = useMemo(
    () => options.species.find((item) => item.id === correction.speciesId),
    [correction.speciesId, options.species],
  )

  async function saveQuickEdit() {
    const errors = validateOwnedPokemon(draft)
    if (errors.length) {
      setMessage(errors[0])
      return
    }
    setPending(true)
    try {
      await updateOwnedPokemonQuick(createClient(), pokemon.id, draft)
      setPokemon(draft)
      setMessage('빠른 수정 내용을 저장했습니다.')
    } catch {
      setMessage('빠른 수정 내용을 저장하지 못했습니다.')
    } finally {
      setPending(false)
    }
  }

  async function saveCorrection() {
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
      setPokemon(correction)
      setDraft(correction)
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
    setCorrection((current) => ({
      ...current,
      speciesId,
      formId: form?.id ?? '',
    }))
  }

  return (
    <>
      <div className="detail-heading">
        <div>
          <Link className="back-link" href="/my-pokemon">← 내 포켓몬</Link>
          <p className="eyebrow">도감번호 #{String(pokemon.nationalDexNumber).padStart(4, '0')}</p>
          <h1>{pokemon.nickname || pokemon.nameKo}</h1>
          <p>{pokemon.nameKo} · {pokemon.formNameKo} · <strong>Lv. {pokemon.level}</strong></p>
          {pokemon.notes ? <p>{pokemon.notes}</p> : null}
          <p>포획일: {pokemon.capturedOn || '미입력'}</p>
        </div>
      </div>

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
            <select id="quick-ability" value={draft.abilityId ?? ''} onChange={(event) => setDraft({ ...draft, abilityId: event.target.value || null })}>
              <option value="">미지정</option>{options.abilities.map((item) => <option key={item.id} value={item.id}>{item.nameKo}</option>)}
            </select>
            <label htmlFor="quick-item">지닌 도구</label>
            <select id="quick-item" value={draft.heldItemId ?? ''} onChange={(event) => setDraft({ ...draft, heldItemId: event.target.value || null })}>
              <option value="">없음</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.nameKo}</option>)}
            </select>
            <label htmlFor="quick-notes">메모</label>
            <textarea id="quick-notes" value={draft.notes} maxLength={4000} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </div>
          <h3>실전 IV</h3>
          <div className="compact-stat-grid">
            {statKeys.map((key) => (
              <label key={key} htmlFor={`quick-iv-${key}`}>{statLabels[key]}
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
          <button type="button" className="primary-button" disabled={pending} onClick={saveQuickEdit}>빠른 수정 저장</button>
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
        <p>종·모습·원본 IV·포획 정보는 사유와 확인 절차를 거쳐야 정정할 수 있습니다.</p>
        <button type="button" className="secondary-button" onClick={() => setCorrectionOpen((open) => !open)}>보호 정보 정정 열기</button>
        {correctionOpen ? (
          <div className="correction-form">
            <label htmlFor="correction-species">정정 포켓몬 종</label>
            <select id="correction-species" value={correction.speciesId} onChange={(event) => chooseCorrectionSpecies(event.target.value)}>
              {options.species.map((item) => <option key={item.id} value={item.id}>{item.nameKo} · 도감번호 #{String(item.nationalDexNumber).padStart(4, '0')}</option>)}
            </select>
            <label htmlFor="correction-form">정정 모습</label>
            <select id="correction-form" value={correction.formId} onChange={(event) => setCorrection({ ...correction, formId: event.target.value })}>
              {(correctionSpecies?.forms ?? []).map((form) => <option key={form.id} value={form.id}>{form.nameKo}</option>)}
            </select>
            <label htmlFor="correction-captured-on">정정 포획일</label>
            <input id="correction-captured-on" type="date" value={correction.capturedOn ?? ''} onChange={(event) => setCorrection({ ...correction, capturedOn: event.target.value || null })} />
            <div className="compact-stat-grid">
              {statKeys.map((key) => (
                <label key={key} htmlFor={`correction-iv-${key}`}>{statLabels[key]} 원본 IV
                  <input id={`correction-iv-${key}`} type="number" min={0} max={correction.effectiveIv[key]} value={correction.originalIv[key]} onChange={(event) => setCorrection({ ...correction, originalIv: { ...correction.originalIv, [key]: Number(event.target.value) } })} />
                </label>
              ))}
            </div>
            <label htmlFor="correction-reason">정정 사유</label>
            <textarea id="correction-reason" value={reasonKo} minLength={5} required onChange={(event) => setReasonKo(event.target.value)} />
            <button type="button" className="primary-button" disabled={pending} onClick={saveCorrection}>정정 저장</button>
          </div>
        ) : null}
      </section>
      {message ? <p className="save-message" role="status">{message}</p> : null}
    </>
  )
}
