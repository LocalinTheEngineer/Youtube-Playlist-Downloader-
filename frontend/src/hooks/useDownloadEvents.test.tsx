import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { FakeEventSource } from '../testSetup'
import type { DownloadJob } from '../types/download'
import { useDownloadEvents } from './useDownloadEvents'

const job: DownloadJob = {
  id: 'job-one', playlist_title: 'Example', status: 'downloading', total_items: 1,
  completed_items: 0, failed_items: 0, output_directory: 'downloads', format_preset: 'best', error_message: null,
  items: [{ id: 1, video_id: 'video', title: 'Video', status: 'downloading', progress: 0, downloaded_bytes: 0, total_bytes: 100, speed: null, eta: null, error_message: null }],
}

beforeEach(() => { FakeEventSource.instances = [] })

function setup(enabled = true) {
  const client = new QueryClient()
  client.setQueryData(['downloads'], [job])
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const hook = renderHook(({ active }) => useDownloadEvents(job.id, active), { wrapper, initialProps: { active: enabled } })
  return { client, ...hook }
}

test('updates progress without opening a new stream for each snapshot', () => {
  const { client, result, rerender, unmount } = setup()
  const source = FakeEventSource.instances[0]
  expect(source.url).toBe('http://127.0.0.1:8000/api/downloads/job-one/events')
  const updated = { ...job, items: [{ ...job.items[0], progress: 60, downloaded_bytes: 60 }] }
  act(() => source.emit(updated))
  expect(client.getQueryData(['downloads'])).toEqual([updated])
  expect(result.current).toBe('live')
  rerender({ active: true })
  expect(FakeEventSource.instances).toHaveLength(1)
  unmount()
  expect(source.closed).toBe(true)
})

test('keeps the browser reconnecting stream and restores its live indicator', () => {
  const { result, unmount } = setup()
  const source = FakeEventSource.instances[0]
  act(() => source.dispatchEvent(new Event('error')))
  expect(result.current).toBe('reconnecting')
  expect(source.closed).toBe(false)
  act(() => source.dispatchEvent(new Event('open')))
  expect(result.current).toBe('live')
  expect(FakeEventSource.instances).toHaveLength(1)
  unmount()
})

test('closes terminal streams and ignores late events', () => {
  const { client, unmount } = setup()
  const source = FakeEventSource.instances[0]
  const completed = { ...job, status: 'completed', completed_items: 1, items: [{ ...job.items[0], status: 'completed', progress: 100 }] }
  act(() => source.emit(completed))
  expect(source.closed).toBe(true)
  act(() => source.emit(job))
  expect(client.getQueryData(['downloads'])).toEqual([completed])
  unmount()
})

test('ignores malformed, wrong-job and invalid progress events', () => {
  const { client, unmount } = setup()
  const source = FakeEventSource.instances[0]
  act(() => {
    source.dispatchEvent(new MessageEvent('progress', { data: '{bad json' }))
    source.emit({ ...job, id: 'another-job' })
    source.emit({ ...job, items: [{ ...job.items[0], progress: 500 }] })
    source.emit({ ...job, status: 'unknown' })
  })
  expect(client.getQueryData(['downloads'])).toEqual([job])
  unmount()
})

test('does not subscribe to terminal or unselected jobs and closes disabled streams', () => {
  const { rerender, unmount } = setup(false)
  expect(FakeEventSource.instances).toHaveLength(0)
  rerender({ active: true })
  expect(FakeEventSource.instances).toHaveLength(1)
  rerender({ active: false })
  expect(FakeEventSource.instances[0].closed).toBe(true)
  unmount()
})
