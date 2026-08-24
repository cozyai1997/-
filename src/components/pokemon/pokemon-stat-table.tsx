import type { OwnedPokemonStatResult } from '@/features/stats/calculate-owned-pokemon-stats'
import { statKeys, type StatBlock, type StatKey } from '@/features/stats/types'

const statLabels: Record<StatKey, string> = {
  hp: 'HP',
  attack: '공격',
  defense: '방어',
  special_attack: '특공',
  special_defense: '특방',
  speed: '스피드',
}

export type PokemonStatTableProps = {
  baseStats: StatBlock | null
  originalIv: StatBlock
  effectiveIv: StatBlock
  ev: StatBlock
  actualStats: OwnedPokemonStatResult
  caption: string
}

export function PokemonStatTable({
  baseStats,
  originalIv,
  effectiveIv,
  ev,
  actualStats,
  caption,
}: PokemonStatTableProps) {
  return (
    <div
      className="pokemon-stat-table"
      role="region"
      aria-label={`${caption} 가로 스크롤 영역`}
      tabIndex={0}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">능력치</th>
            <th scope="col">종족값 Base Stats</th>
            <th scope="col">원본 IV</th>
            <th scope="col">실전 IV</th>
            <th scope="col">노력치 EV</th>
            <th scope="col">실제 능력치 Stats</th>
          </tr>
        </thead>
        <tbody>
          {statKeys.map((key, index) => (
            <tr key={key}>
              <th scope="row">{statLabels[key]}</th>
              <td>{baseStats?.[key] ?? '확인 불가'}</td>
              <td>{originalIv[key]}</td>
              <td>{effectiveIv[key]}</td>
              <td>{ev[key]}</td>
              {actualStats.status === 'ready' ? (
                <td>{actualStats.stats[key]}</td>
              ) : index === 0 ? (
                <td rowSpan={statKeys.length} className="stat-unavailable">
                  계산 불가: {actualStats.reasonKo}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
