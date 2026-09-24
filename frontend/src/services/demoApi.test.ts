import { afterEach, expect, test, vi } from 'vitest'
import {
  cancelDemoDownload,
  createDemoDownload,
  inspectDemoMedia,
  listDemoDownloads,
  openDemoEvents,
} from './demoApi'

afterEach(() => {
  vi.useRealTimers()
})

test('returns sample content only for supported YouTube URLs', async () => {
  vi.useFakeTimers()
  const request = inspectDemoMedia('https://www.youtube.com/playlist?list=demo')
  await vi.advanceTimersByTimeAsync(450)
  const preview = await request

  expect(preview.title).toContain('Örnek Liste')
  expect(preview.entries).toHaveLength(5)
  await expect(inspectDemoMedia('https://example.com/not-youtube')).rejects.toThrow('YouTube')
})

test('simulates progress events until the selected items complete', async () => {
  vi.useFakeTimers()
  const creation = createDemoDownload({
    url: 'https://youtube.com/playlist?list=demo',
    video_ids: ['demo-01', 'demo-03'],
    format_preset: '720p',
    output_directory: 'Favoriler',
  })
  await vi.advanceTimersByTimeAsync(250)
  const job = await creation
  const source = openDemoEvents(job.id)
  const updates: string[] = []
  source.addEventListener('progress', (event) => updates.push(JSON.parse((event as MessageEvent<string>).data).status))

  await vi.advanceTimersByTimeAsync(5_000)
  const saved = (await listDemoDownloads()).find((item) => item.id === job.id)

  expect(updates).toContain('downloading')
  expect(saved?.status).toBe('completed')
  expect(saved?.completed_items).toBe(2)
  source.close()
})

test('cancels an active demo job', async () => {
  vi.useFakeTimers()
  const creation = createDemoDownload({
    url: 'https://youtu.be/demo',
    video_ids: ['demo-01'],
    format_preset: 'audio',
    output_directory: '.',
  })
  await vi.advanceTimersByTimeAsync(250)
  const job = await creation

  expect(await cancelDemoDownload(job.id)).toEqual({ id: job.id, status: 'cancelled' })
  expect((await listDemoDownloads()).find((item) => item.id === job.id)?.status).toBe('cancelled')
})
