import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

import {
  assertValidReferenceDataForPublication,
  firstValidationIssue,
  validateReferenceData,
  type ReferenceDataset,
  type SourceDiagnostic,
  type ValidationReport,
} from '../../src/features/localization/reference-data-validation'
import { importReferenceData } from './import-reference-data'

const reviewedProductionSourceDiagnostics: SourceDiagnostic[] = [
  {
    code: 'missing-evolution-target-form', table: 'evolutions',
    key: 'milotic>megamilotic:233', target: 'forms:milotic-mega',
  },
  {
    code: 'missing-evolution-target-form', table: 'evolutions',
    key: 'milotic>megamilotic:234', target: 'forms:milotic-mega',
  },
]

export type CandidateValidationArtifact = ValidationReport & {
  candidateDigest: string
}

export type ReferenceDatasetAuthentication = {
  method: 'trusted-source-reimport-sha256'
  candidateDigest: string
  trustedSourceDigest: string
  evolutionAccounting: {
    sourceCount: 602
    publishableCount: 600
    excludedMissingTargetCount: 2
  }
  validationReport: CandidateValidationArtifact
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const row = value as Record<string, unknown>
  return `{${Object.keys(row).filter((key) => row[key] !== undefined).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(row[key])}`
  )).join(',')}}`
}

export function canonicalReferenceDatasetDigest(dataset: ReferenceDataset): string {
  return createHash('sha256').update(canonicalJson(dataset)).digest('hex')
}

export function createCandidateValidationArtifact(
  dataset: ReferenceDataset,
): CandidateValidationArtifact {
  return {
    ...validateReferenceData(dataset),
    candidateDigest: canonicalReferenceDatasetDigest(dataset),
  }
}

export function verifyCandidateValidationArtifact(
  dataset: ReferenceDataset,
  artifact: CandidateValidationArtifact,
): CandidateValidationArtifact {
  const computed = createCandidateValidationArtifact(dataset)
  if (!computed.valid) {
    throw new Error(`기준데이터 검증 실패: ${firstValidationIssue(computed)}`)
  }
  if (artifact.candidateDigest !== computed.candidateDigest) {
    throw new Error('validation-report:candidate-digest')
  }
  if (canonicalJson(artifact) !== canonicalJson(computed)) {
    throw new Error('validation-report:content-mismatch')
  }
  return computed
}

function assertReviewedProductionEvolutionAccounting(dataset: ReferenceDataset): void {
  if (
    dataset.evolutions.length !== 602
    || canonicalJson(dataset.sourceDiagnostics ?? []) !== canonicalJson(reviewedProductionSourceDiagnostics)
  ) {
    throw new Error('production-evolution-accounting:expected=602=600+2')
  }
}

export function authenticateReferenceDatasetAgainstTrustedDataset(
  candidate: ReferenceDataset,
  trustedDataset: ReferenceDataset,
): ReferenceDatasetAuthentication {
  assertReviewedProductionEvolutionAccounting(trustedDataset)
  assertValidReferenceDataForPublication(trustedDataset)
  const validationReport = createCandidateValidationArtifact(candidate)
  if (!validationReport.valid) {
    throw new Error(`기준데이터 검증 실패: ${firstValidationIssue(validationReport)}`)
  }
  const trustedSourceDigest = canonicalReferenceDatasetDigest(trustedDataset)
  if (validationReport.candidateDigest !== trustedSourceDigest) {
    throw new Error(
      `reference-data-authentication:candidate-digest=${validationReport.candidateDigest}:trusted=${trustedSourceDigest}`,
    )
  }
  return {
    method: 'trusted-source-reimport-sha256',
    candidateDigest: validationReport.candidateDigest,
    trustedSourceDigest,
    evolutionAccounting: {
      sourceCount: 602,
      publishableCount: 600,
      excludedMissingTargetCount: 2,
    },
    validationReport,
  }
}

export function authenticateReferenceDataset(
  candidate: ReferenceDataset,
  trustedSourceRoot: string,
): ReferenceDatasetAuthentication {
  const trustedDataset = importReferenceData(resolve(trustedSourceRoot))
  return authenticateReferenceDatasetAgainstTrustedDataset(candidate, trustedDataset)
}
