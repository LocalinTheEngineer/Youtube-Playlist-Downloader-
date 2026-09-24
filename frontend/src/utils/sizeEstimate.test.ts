import { describe, expect, test } from 'vitest'
import { estimateDownloadSize, formatBytes } from './sizeEstimate'

describe('download size estimates', () => {
  test('uses selected durations and the chosen quality range', () => {
    const estimate = estimateDownloadSize([60, 120, null], '720p')
    expect(estimate.knownItems).toBe(2)
    expect(estimate.unknownItems).toBe(1)
    expect(estimate.minimumBytes).toBeCloseTo(42_525_000)
    expect(estimate.maximumBytes).toBeCloseTo(118_125_000)
  })

  test('uses a fixed bitrate for MP3 and formats a single estimate', () => {
    const estimate = estimateDownloadSize([600], 'audio')
    expect(estimate.minimumBytes).toBe(estimate.maximumBytes)
    expect(formatBytes(estimate.minimumBytes)).toContain('MB')
  })

  test('formats megabytes and gigabytes for people', () => {
    expect(formatBytes(512 * 1024 ** 2)).toContain('MB')
    expect(formatBytes(2.5 * 1024 ** 3)).toContain('GB')
    expect(estimateDownloadSize([null], 'best').knownItems).toBe(0)
  })
})
