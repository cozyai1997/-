import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  type ReferenceDataset,
} from '../../src/features/localization/reference-data-validation'
import { createCandidateValidationArtifact } from './authenticate-reference-data'

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

export function writeJsonAtomically(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  JSON.parse(readFileSync(temporary, 'utf8'))
  renameSync(temporary, path)
}

function main(): void {
  const input = argument('--input')
  const reportPath = argument('--report')
  if (!input) {
    throw new Error('사용법: tsx scripts/data/validate-reference-data.ts --input <후보 JSON> [--report <보고서 JSON>]')
  }
  const dataset = JSON.parse(readFileSync(resolve(input), 'utf8')) as ReferenceDataset
  const report = createCandidateValidationArtifact(dataset)
  if (reportPath) writeJsonAtomically(resolve(reportPath), report)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.valid) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
