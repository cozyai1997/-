import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const plan = readFileSync(
  resolve(process.cwd(), 'docs/superpowers/plans/2026-08-24-pokemon-battle-data.md'),
  'utf8',
)

describe('Pokemon battle data production plan', () => {
  it('requires itemized staged-smoke evidence instead of one manual VERIFIED string', () => {
    expect(plan).toContain('$requiredSmokeEvidence = @(')
    expect(plan).toContain('$smokeEvidence = [ordered]@{}')
    expect(plan).toContain('$expectedToken = "PASS:$($requirement.key)"')
    expect(plan).toContain('$smokeEvidence.Count -ne $requiredSmokeEvidence.Count')
    expect(plan).toContain('smokeEvidence=$smokeEvidence')
    expect(plan).not.toContain('$smokeConfirmation')
    expect(plan).not.toContain('VERIFIED 입력')

    for (const key of [
      'sevenStepSave',
      'koreanAndPublicIdentity',
      'abilityFiltering',
      'moveFilteringAndPp',
      'statTermsAndValues',
      'teraAndGigantamax',
      'privateImageLifecycle',
      'browserErrors',
    ]) {
      expect(plan).toContain(`key = '${key}'`)
    }

    for (const exactEvidence of [
      '도감번호 #0025',
      'UUID·pikachu-normal',
      '정전기·피뢰침',
      '맹화',
      '10만볼트',
      '화염방사',
      '기본 PP: 15',
      '종족값 Base Stats',
      '개체값 IV (원본)',
      '적용 IV (왕관 보정 포함)',
      '노력치 EV',
      '실제 능력치 Stats',
      '테라타입: 전기',
      '거다이맥스 인자 보유',
      'private image upload/read/delete',
      '이미지 미등록/삭제 후 GET /api/private-images는 204 No Content',
      'unexpected console error 0건·unexpected failed network 0건',
      'HP/공격/방어/특공/특방/스피드',
    ]) {
      expect(plan).toContain(exactEvidence)
    }
    expect(plan).not.toContain('HP/공격/방어/특수공격/특수방어/스피드')
  })

  it('documents Stellar with the canonical zero-based sort order', () => {
    expect(plan).toContain("{ id: 'stellar', nameKo: '스텔라', referenceTypeId: null, sortOrder: 18 }")
    expect(plan).not.toContain("{ id: 'stellar', nameKo: '스텔라', referenceTypeId: null, sortOrder: 19 }")
  })
})
