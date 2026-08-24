'use client'

import type { MoveOption } from '@/features/owned-pokemon/repository'
import { PokemonMoveCard } from '@/components/pokemon/pokemon-move-card'

export type PokemonMoveSlotProps = {
  kind: 'current' | 'target'
  slot: number
  moveId: string
  conditionKo?: string
  moves: MoveOption[]
  selectedMoveIds: ReadonlySet<string>
  disabled: boolean
  onMoveChange: (slot: number, moveId: string) => void
  onRouteChange?: (slot: number, conditionKo: string) => void
}

export function PokemonMoveSlot({
  kind,
  slot,
  moveId,
  conditionKo,
  moves,
  selectedMoveIds,
  disabled,
  onMoveChange,
  onRouteChange,
}: PokemonMoveSlotProps) {
  const number = slot + 1
  const kindKo = kind === 'current' ? '현재' : '목표'
  const selectId = `${kind}-move-${number}`
  const detailId = `${selectId}-detail`
  const selectedMove = moves.find((move) => move.id === moveId)
  const groups = groupMovesByPrimaryRoute(moves)

  return (
    <div className="move-slot">
      <label htmlFor={selectId}>{kindKo} 기술 {number}</label>
      <select
        id={selectId}
        value={moveId}
        disabled={disabled}
        aria-describedby={selectedMove ? detailId : undefined}
        onChange={(event) => onMoveChange(slot, event.target.value)}
      >
        <option value="">미지정</option>
        {groups.map(([methodKo, groupedMoves]) => (
          <optgroup key={methodKo} label={methodKo}>
            {groupedMoves.map((move) => (
              <option
                key={move.id}
                value={move.id}
                disabled={move.id !== moveId && selectedMoveIds.has(move.id)}
              >
                {moveOptionLabel(move)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {selectedMove ? (
        <div id={detailId} className="move-details">
          <PokemonMoveCard move={selectedMove} />
        </div>
      ) : null}
      {kind === 'target' && selectedMove && selectedMove.routes.length > 1 ? (
        <>
          <label htmlFor={`target-route-${number}`}>목표 습득 방법 {number}</label>
          <select
            id={`target-route-${number}`}
            value={conditionKo ?? selectedMove.routes[0].conditionKo}
            onChange={(event) => onRouteChange?.(slot, event.target.value)}
          >
            {selectedMove.routes.map((route) => (
              <option key={`${route.methodKo}-${route.conditionKo}`} value={route.conditionKo}>
                {route.methodKo} · {route.conditionKo}
              </option>
            ))}
          </select>
        </>
      ) : null}
    </div>
  )
}

export function groupMovesByPrimaryRoute(moves: MoveOption[]) {
  const groups = new Map<string, MoveOption[]>()
  for (const move of moves) {
    const methodKo = move.routes[0]?.methodKo ?? '기타 습득 방법'
    const group = groups.get(methodKo) ?? []
    group.push(move)
    groups.set(methodKo, group)
  }
  return [...groups.entries()]
}

function moveOptionLabel(move: MoveOption) {
  const routeSummary = move.routes
    .map((route) => `${route.methodKo} ${route.conditionKo}`)
    .join(' / ')
  return `${move.nameKo} · ${routeSummary}`
}
