import type { FormatPreset } from '../types/download'

const bitrateRanges: Record<FormatPreset, readonly [number, number]> = {
  audio: [192_000, 192_000],
  '480p': [900_000, 2_500_000],
  '720p': [1_800_000, 5_000_000],
  '1080p': [3_500_000, 8_000_000],
  best: [5_000_000, 12_000_000],
}

const CONTAINER_OVERHEAD = 1.05

export interface SizeEstimate {
  minimumBytes: number
  maximumBytes: number
  knownItems: number
  unknownItems: number
}

export function estimateDownloadSize(durations: Array<number | null>, preset: FormatPreset): SizeEstimate {
  const knownDurations = durations.filter((duration): duration is number => typeof duration === 'number' && duration > 0)
  const totalSeconds = knownDurations.reduce((total, duration) => total + duration, 0)
  const [minimumBitrate, maximumBitrate] = bitrateRanges[preset]
  return {
    minimumBytes: totalSeconds * minimumBitrate / 8 * CONTAINER_OVERHEAD,
    maximumBytes: totalSeconds * maximumBitrate / 8 * CONTAINER_OVERHEAD,
    knownItems: knownDurations.length,
    unknownItems: durations.length - knownDurations.length,
  }
}

export function formatBytes(bytes: number, locale = 'tr-TR'): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const gigabyte = 1024 ** 3
  const megabyte = 1024 ** 2
  const value = bytes >= gigabyte ? bytes / gigabyte : bytes / megabyte
  const unit = bytes >= gigabyte ? 'GB' : 'MB'
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`
}
