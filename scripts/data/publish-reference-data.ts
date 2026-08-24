import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  ReferenceDataset,
  ValidationReport,
} from '../../src/features/localization/reference-data-validation'
import {
  authenticateReferenceDataset,
  verifyCandidateValidationArtifact,
  type CandidateValidationArtifact,
  type ReferenceDatasetAuthentication,
} from './authenticate-reference-data'
import { writeJsonAtomically } from './validate-reference-data'

export type PublicationState = {
  activePublicationId: string | null
  publications: Array<{
    id: string
    version: string
    rowCounts: ValidationReport['rowCounts']
    sourceCommits: Record<string, string>
    sha256: Record<string, string>
    candidateDigest?: string
  }>
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function buildAuthenticatedCandidateState(
  currentState: PublicationState,
  dataset: ReferenceDataset,
  report: CandidateValidationArtifact,
  authentication: ReferenceDatasetAuthentication,
): PublicationState {
  const id = authentication.candidateDigest
  const publication = {
    id,
    version: dataset.version,
    rowCounts: report.rowCounts,
    sourceCommits: dataset.sourceCommits,
    sha256: dataset.sha256,
    candidateDigest: authentication.candidateDigest,
  }
  return {
    activePublicationId: id,
    publications: [...currentState.publications.filter((item) => item.id !== id), publication],
  }
}

function publishAuthenticatedCandidateWithAuthentication(
  currentState: PublicationState,
  dataset: ReferenceDataset,
  artifact: CandidateValidationArtifact,
  authentication: ReferenceDatasetAuthentication,
): PublicationState {
  const computedReport = verifyCandidateValidationArtifact(dataset, artifact)
  return buildAuthenticatedCandidateState(currentState, dataset, computedReport, authentication)
}

export function publishValidatedCandidate(
  currentState: PublicationState,
  dataset: ReferenceDataset,
  artifact: CandidateValidationArtifact,
  trustedSourceRoot: string,
): PublicationState {
  const authentication = authenticateReferenceDataset(dataset, trustedSourceRoot)
  return publishAuthenticatedCandidateWithAuthentication(
    currentState,
    dataset,
    artifact,
    authentication,
  )
}

function main(): void {
  const input = argument('--input')
  const reportPath = argument('--report')
  const source = argument('--source')
  const statePath = argument('--state')
  if (!input || !reportPath || !source || !statePath) {
    throw new Error(
      '사용법: tsx scripts/data/publish-reference-data.ts --input <후보 JSON> --report <검증 artifact JSON> --source <신뢰 원본 폴더> --state <게시 상태 JSON>',
    )
  }
  const dataset = JSON.parse(readFileSync(resolve(input), 'utf8')) as ReferenceDataset
  const report = JSON.parse(readFileSync(resolve(reportPath), 'utf8')) as CandidateValidationArtifact
  const target = resolve(statePath)
  let current: PublicationState = { activePublicationId: null, publications: [] }
  try {
    current = JSON.parse(readFileSync(target, 'utf8')) as PublicationState
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') throw error
  }
  const next = publishValidatedCandidate(current, dataset, report, source)
  if (next === current) {
    throw new Error('검증에 실패한 후보는 게시할 수 없습니다. 기존 활성 게시 버전을 유지합니다.')
  }
  writeJsonAtomically(target, next)
  process.stdout.write(`${next.activePublicationId}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
