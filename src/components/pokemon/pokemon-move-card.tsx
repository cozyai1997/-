type PokemonMoveCardData = {
  nameKo: string
  descriptionKo: string
  typeKo: string
  damageClassKo: string
  power: number | null
  accuracy: number | null
  pp: number | null
}

export type PokemonMoveCardProps = {
  move: PokemonMoveCardData
  heading?: string
  conditionKo?: string | null
}

export function basicPpLabel(pp: number | null) {
  return `기본 PP: ${pp ?? '확인 불가'}`
}

export function PokemonMoveCard({ move, heading, conditionKo }: PokemonMoveCardProps) {
  return (
    <article className="pokemon-move-card" aria-label={move.nameKo}>
      {heading ? <p className="pokemon-move-heading">{heading}</p> : null}
      <h3>{move.nameKo}</h3>
      <dl>
        <div><dt>타입</dt><dd>{move.typeKo}</dd></div>
        <div><dt>분류</dt><dd>{move.damageClassKo}</dd></div>
        <div><dt>위력</dt><dd>{move.power ?? '해당 없음'}</dd></div>
        <div><dt>명중률</dt><dd>{move.accuracy ?? '해당 없음'}</dd></div>
      </dl>
      <p>{basicPpLabel(move.pp)}</p>
      {conditionKo ? <p>습득 조건: {conditionKo}</p> : null}
      <p>{move.descriptionKo}</p>
    </article>
  )
}
