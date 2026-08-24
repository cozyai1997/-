import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import {
  authenticateReferenceDatasetAgainstTrustedDataset,
  createCandidateValidationArtifact,
  verifyCandidateValidationArtifact,
} from '../../scripts/data/authenticate-reference-data'
import { createProductionReferenceCandidate } from '../fixtures/reference-data/production-candidate'

describe('운영 기준데이터 원본 인증', () => {
  it('독립 재생성 후보와 전체 canonical digest가 같은 경우만 인증한다', () => {
    const candidate = createProductionReferenceCandidate()
    const trustedDataset = structuredClone(candidate)

    const authentication = authenticateReferenceDatasetAgainstTrustedDataset(
      candidate,
      trustedDataset,
    )

    expect(authentication.candidateDigest).toMatch(/^[0-9a-f]{64}$/u)
    expect(authentication.trustedSourceDigest).toBe(authentication.candidateDigest)
    expect(authentication.evolutionAccounting).toEqual({
      sourceCount: 602,
      publishableCount: 600,
      excludedMissingTargetCount: 2,
    })
  })

  it('validator를 계속 통과하는 후보 내용 편집도 trusted-source digest 불일치로 거부한다', () => {
    const trustedDataset = createProductionReferenceCandidate()
    const candidate = structuredClone(trustedDataset)
    candidate.items[0].descriptionKo = '검증을 통과하지만 원본과 다른 한국어 설명이다.'

    expect(() => authenticateReferenceDatasetAgainstTrustedDataset(candidate, trustedDataset))
      .toThrow('candidate-digest')
  })

  it.each([
    ['zero', 0],
    ['one', 1],
  ] as const)('trusted source의 검토된 Milotic gap이 %s개면 거부한다', (_label, gapCount) => {
    const trustedDataset = createProductionReferenceCandidate()
    const candidate = structuredClone(trustedDataset)
    for (let index = gapCount; index < 2; index += 1) {
      trustedDataset.evolutions[index] = {
        id: `species-a>species-a:trusted-${index}`,
        fromSpeciesId: 'species-a', fromFormId: 'form-0', toSpeciesId: 'species-a',
        toFormId: `form-${700 + index}`, conditionKo: `검토용 진화 ${index}`,
      }
    }
    trustedDataset.sourceDiagnostics = trustedDataset.sourceDiagnostics?.slice(0, gapCount)

    expect(() => authenticateReferenceDatasetAgainstTrustedDataset(candidate, trustedDataset))
      .toThrow('production-evolution-accounting')
  })

  it.each([
    ['diagnostic', (candidate: ReturnType<typeof createProductionReferenceCandidate>) => {
      candidate.sourceDiagnostics![0].target = 'forms:milotic-gmax'
    }],
    ['evolution', (candidate: ReturnType<typeof createProductionReferenceCandidate>) => {
      candidate.evolutions[2].conditionKo = '원본과 다른 진화 조건'
    }],
    ['candidate', (candidate: ReturnType<typeof createProductionReferenceCandidate>) => {
      candidate.abilities[0].descriptionKo = '원본과 다른 특성 설명이다.'
    }],
  ] as const)('%s 내용이 편집된 candidate는 인증하지 않는다', (_label, edit) => {
    const trustedDataset = createProductionReferenceCandidate()
    const candidate = structuredClone(trustedDataset)
    edit(candidate)

    expect(() => authenticateReferenceDatasetAgainstTrustedDataset(candidate, trustedDataset)).toThrow()
  })

  it('검증 보고서는 candidate digest를 포함하고 다른 후보에 재사용할 수 없다', () => {
    const candidate = createProductionReferenceCandidate()
    const artifact = createCandidateValidationArtifact(candidate)
    const edited = structuredClone(candidate)
    edited.items[0].descriptionKo = '유효하지만 보고서 생성 당시와 다른 설명이다.'

    expect(artifact.candidateDigest).toMatch(/^[0-9a-f]{64}$/u)
    expect(() => verifyCandidateValidationArtifact(edited, artifact))
      .toThrow('validation-report:candidate-digest')
  })

  it('외부 보고서의 valid=true를 신뢰하지 않고 후보를 다시 검증한다', () => {
    const candidate = createProductionReferenceCandidate()
    const artifact = createCandidateValidationArtifact(candidate)
    candidate.items[0].nameKo = '%s포플레'

    expect(() => verifyCandidateValidationArtifact(candidate, artifact))
      .toThrow('기준데이터 검증 실패')
  })

  it.each([
    ['data:publish', 'scripts/data/publish-reference-data.ts', true],
    ['data:publish:option-filters', 'scripts/data/publish-pokemon-option-filter-reference-data.ts', false],
  ] as const)('%s CLI는 trusted source 인수 없이 시작하지 않는다', (_label, script, withReport) => {
    const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'pokemon-publication-auth-'))
    const inputPath = resolve(temporaryDirectory, 'candidate.json')
    const reportPath = resolve(temporaryDirectory, 'validation-report.json')
    const statePath = resolve(temporaryDirectory, 'publication-state.json')
    const candidate = createProductionReferenceCandidate()
    writeFileSync(inputPath, JSON.stringify(candidate), 'utf8')
    writeFileSync(reportPath, JSON.stringify(createCandidateValidationArtifact(candidate)), 'utf8')

    try {
      const arguments_ = [
        resolve('node_modules/tsx/dist/cli.mjs'), resolve(script), '--input', inputPath,
      ]
      if (withReport) arguments_.push('--report', reportPath, '--state', statePath)
      const result = spawnSync(process.execPath, arguments_, {
        cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
      })

      expect(result.status).not.toBe(0)
      expect(`${result.stdout}${result.stderr}`).toContain('--source')
      expect(existsSync(statePath)).toBe(false)
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })
})
