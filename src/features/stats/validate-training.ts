import { statKeys, type StatBlock, type TrainingValidationInput } from './types'

export function validateIv(iv: StatBlock): string[] {
  return statKeys.some((key) => !Number.isInteger(iv[key]) || iv[key] < 0 || iv[key] > 31)
    ? ['IV는 각 능력치마다 0부터 31 사이의 정수여야 합니다.']
    : []
}

export function validateEv(ev: StatBlock): string[] {
  const errors: string[] = []
  if (statKeys.some((key) => !Number.isInteger(ev[key]) || ev[key] < 0 || ev[key] > 252)) {
    errors.push('개별 EV는 0부터 252 사이의 정수여야 합니다.')
  }
  if (statKeys.reduce((total, key) => total + ev[key], 0) > 510) {
    errors.push('EV 총합은 510 이하여야 합니다.')
  }
  return errors
}

export function validateTraining(input: TrainingValidationInput): string[] {
  const errors: string[] = []
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 100) {
    errors.push('레벨은 1부터 100 사이의 정수여야 합니다.')
  }
  if (statKeys.some((key) => (
    !Number.isInteger(input.baseStats[key])
    || input.baseStats[key] < 1
    || input.baseStats[key] > 255
  ))) {
    errors.push('종족값은 각 능력치마다 1부터 255 사이의 정수여야 합니다.')
  }
  return [...errors, ...validateIv(input.iv), ...validateEv(input.ev)]
}
