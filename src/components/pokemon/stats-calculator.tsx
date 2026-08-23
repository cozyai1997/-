'use client'

import { useMemo, useState } from 'react'

import { calculateAllStats } from '@/features/stats/calculate-stat'
import {
  nonHpStatKeys,
  statKeys,
  type CalculatedStats,
  type NatureAdjustment,
  type StatBlock,
  type StatCalculationInput,
  type StatKey,
} from '@/features/stats/types'
import { validateTraining } from '@/features/stats/validate-training'

const labels: Record<StatKey, string> = {
  hp: 'HP',
  attack: '공격',
  defense: '방어',
  special_attack: '특수공격',
  special_defense: '특수방어',
  speed: '스피드',
}

const initialInput: StatCalculationInput = {
  baseStats: { hp: 70, attack: 110, defense: 70, special_attack: 115, special_defense: 70, speed: 90 },
  iv: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
  ev: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
  level: 50,
  nature: { increased: null, decreased: null },
}

export function StatsCalculator() {
  const [input, setInput] = useState(initialInput)
  const [result, setResult] = useState<CalculatedStats | null>(() => calculateAllStats(initialInput))
  const [errors, setErrors] = useState<string[]>([])
  const evTotal = useMemo(
    () => statKeys.reduce((total, key) => total + input.ev[key], 0),
    [input.ev],
  )

  function updateBlock(block: 'baseStats' | 'iv' | 'ev', key: StatKey, value: number) {
    setResult(null)
    setErrors([])
    setInput((current) => ({
      ...current,
      [block]: { ...current[block], [key]: value } satisfies StatBlock,
    }))
  }

  function updateNature(field: keyof NatureAdjustment, value: string) {
    setResult(null)
    setErrors([])
    setInput((current) => ({
      ...current,
      nature: {
        ...current.nature,
        [field]: value === '' ? null : value as NatureAdjustment[typeof field],
      },
    }))
  }

  function calculate() {
    const nextErrors = validateTraining(input)
    setErrors(nextErrors)
    if (nextErrors.length) {
      setResult(null)
      return
    }
    setResult(calculateAllStats(input))
  }

  return (
    <section className="stats-calculator" aria-labelledby="stats-input-title">
      <div className="stats-toolbar">
        <div>
          <h2 id="stats-input-title">계산 조건</h2>
          <p>루카리오 예시값이 입력되어 있습니다. 원하는 포켓몬 값으로 바꿔 계산하세요.</p>
        </div>
        <label htmlFor="calculator-level">레벨
          <input
            id="calculator-level"
            type="number"
            min={1}
            max={100}
            value={input.level}
            onChange={(event) => {
              setResult(null)
              setErrors([])
              setInput({ ...input, level: Number(event.target.value) })
            }}
          />
        </label>
      </div>

      <div className="nature-controls">
        <label htmlFor="nature-increased">상승 능력치
          <select id="nature-increased" value={input.nature.increased ?? ''} onChange={(event) => updateNature('increased', event.target.value)}>
            <option value="">없음</option>
            {nonHpStatKeys.map((key) => <option key={key} value={key}>{labels[key]}</option>)}
          </select>
        </label>
        <label htmlFor="nature-decreased">하락 능력치
          <select id="nature-decreased" value={input.nature.decreased ?? ''} onChange={(event) => updateNature('decreased', event.target.value)}>
            <option value="">없음</option>
            {nonHpStatKeys.map((key) => <option key={key} value={key}>{labels[key]}</option>)}
          </select>
        </label>
        <p>같은 능력치를 선택하면 보정 없는 성격으로 계산합니다.</p>
      </div>

      <div className="stats-input-grid" role="group" aria-label="종족값 IV EV 입력">
        {statKeys.map((key) => (
          <fieldset key={key}>
            <legend>{labels[key]}</legend>
            <label htmlFor={`base-${key}`}>{labels[key]} 종족값
              <input id={`base-${key}`} type="number" min={1} max={255} value={input.baseStats[key]} onChange={(event) => updateBlock('baseStats', key, Number(event.target.value))} />
            </label>
            <label htmlFor={`iv-${key}`}>{labels[key]} IV
              <input id={`iv-${key}`} type="number" min={0} max={31} value={input.iv[key]} onChange={(event) => updateBlock('iv', key, Number(event.target.value))} />
            </label>
            <label htmlFor={`ev-${key}`}>{labels[key]} EV
              <input id={`ev-${key}`} type="number" min={0} max={252} value={input.ev[key]} onChange={(event) => updateBlock('ev', key, Number(event.target.value))} />
            </label>
          </fieldset>
        ))}
      </div>

      <div className="stats-actions">
        <span className={evTotal > 510 ? 'limit-exceeded' : ''}>EV 총합 {evTotal} / 510</span>
        <button type="button" className="primary-button" onClick={calculate}>능력치 계산하기</button>
      </div>
      {errors.length ? (
        <div className="calculation-errors" role="alert">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      ) : null}

      {result ? <div className="stats-result-panel">
        <h2>계산 결과</h2>
        <table>
          <thead><tr><th>능력치</th><th>종족값</th><th>IV</th><th>EV</th><th>최종</th></tr></thead>
          <tbody>
            {statKeys.map((key) => (
              <tr key={key}>
                <th scope="row">{labels[key]}</th>
                <td>{input.baseStats[key]}</td>
                <td>{input.iv[key]}</td>
                <td>{input.ev[key]}</td>
                <td><strong>{result[key]}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div> : null}
    </section>
  )
}
