import { StatsCalculator } from '@/components/pokemon/stats-calculator'

export default function StatsPage() {
  return (
    <main className="owned-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">육성 도구</p>
          <h1>능력치 계산</h1>
        </div>
      </div>
      <p className="page-description">종족값 Base Stats·적용 IV (왕관 보정 포함)·노력치 EV·레벨·성격 보정·HP 규칙을 적용해 실제 능력치 Stats를 계산합니다.</p>
      <StatsCalculator />
    </main>
  )
}
