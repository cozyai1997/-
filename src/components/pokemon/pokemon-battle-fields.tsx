'use client'

import { useEffect } from 'react'

import type { FormBattleProfile } from '@/features/owned-pokemon/repository'

export type PokemonBattleFieldsProps = {
  teraTypes: FormBattleProfile['teraTypes']
  teraTypeId: string | null
  canGigantamax: boolean
  hasGigantamaxFactor: boolean
  onTeraTypeChange: (teraTypeId: string | null) => void
  onGigantamaxFactorChange: (hasGigantamaxFactor: boolean) => void
  disabled?: boolean
  idPrefix?: string
}

export function PokemonBattleFields({
  teraTypes,
  teraTypeId,
  canGigantamax,
  hasGigantamaxFactor,
  onTeraTypeChange,
  onGigantamaxFactorChange,
  disabled = false,
  idPrefix = 'pokemon-battle',
}: PokemonBattleFieldsProps) {
  const teraSelectId = `${idPrefix}-tera-type`
  const gigantamaxCheckboxId = `${idPrefix}-gigantamax-factor`
  const selectedTeraTypeId = teraTypes.some((type) => type.id === teraTypeId)
    ? teraTypeId ?? ''
    : ''

  useEffect(() => {
    if (!canGigantamax && hasGigantamaxFactor) {
      onGigantamaxFactorChange(false)
    }
  }, [canGigantamax, hasGigantamaxFactor, onGigantamaxFactorChange])

  return (
    <div className="battle-fields">
      <div>
        <label htmlFor={teraSelectId}>테라타입</label>
        <select
          id={teraSelectId}
          value={selectedTeraTypeId}
          disabled={disabled}
          onChange={(event) => onTeraTypeChange(event.target.value || null)}
        >
          <option value="">미지정</option>
          {teraTypes.map((type) => (
            <option key={type.id} value={type.id}>{type.nameKo}</option>
          ))}
        </select>
      </div>
      <div className="battle-checkbox-field">
        <label htmlFor={gigantamaxCheckboxId}>
          <input
            id={gigantamaxCheckboxId}
            type="checkbox"
            checked={canGigantamax && hasGigantamaxFactor}
            disabled={disabled || !canGigantamax}
            onChange={(event) => onGigantamaxFactorChange(event.target.checked)}
          />
          거다이맥스 인자 보유
        </label>
        <span>{canGigantamax ? '거다이맥스 가능' : '거다이맥스 불가능'}</span>
      </div>
    </div>
  )
}
