export type PokemonBattleBadgesProps = {
  teraTypeNameKo: string | null
  hasGigantamaxFactor: boolean
}

export function PokemonBattleBadges({
  teraTypeNameKo,
  hasGigantamaxFactor,
}: PokemonBattleBadgesProps) {
  return (
    <div className="battle-badges">
      <span className="battle-badge">테라타입: {teraTypeNameKo ?? '미지정'}</span>
      <span className="battle-badge">
        {hasGigantamaxFactor ? '거다이맥스 인자 보유' : '거다이맥스 인자 없음'}
      </span>
    </div>
  )
}
