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
      <p className="page-description">종족값·실전 IV·EV·레벨·성격 보정을 적용해 최종 능력치를 계산합니다.</p>
      <StatsCalculator />
    </main>
  )
}
