export function StatGlossary() {
  return (
    <dl className="stat-glossary">
      <div>
        <dt>종족값 Base Stats</dt>
        <dd>그 포켓몬 종과 폼 자체가 가진 기본 능력치</dd>
      </div>
      <div>
        <dt>개체값 IV (원본)</dt>
        <dd>태어날 때 정해지는 0~31 수치</dd>
      </div>
      <div>
        <dt>노력치 EV</dt>
        <dd>전투나 아이템으로 올리는 훈련 수치, 능력치당 최대 252</dd>
      </div>
      <div>
        <dt>실제 능력치 Stats</dt>
        <dd>현재 레벨에서 실제 전투에 적용되는 HP·공격·방어·특공·특방·스피드 숫자</dd>
      </div>
    </dl>
  )
}
