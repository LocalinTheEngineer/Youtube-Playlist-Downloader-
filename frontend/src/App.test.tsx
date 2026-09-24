import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { inspectMedia, checkSystem, createDownload, listDownloads, cancelDownload, retryDownload } from './services/api'
import { useDownloadStore } from './stores/downloadStore'
import type { MediaPreview } from './types/media'
import type { DownloadJob } from './types/download'

vi.mock('./services/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./services/api')>(),
  inspectMedia: vi.fn(), checkSystem: vi.fn(), createDownload: vi.fn(), listDownloads: vi.fn(), cancelDownload: vi.fn(), retryDownload: vi.fn(),
}))

const preview: MediaPreview = {
  id: 'PLtest', title: 'Favoriler', channel: 'Örnek kanal', webpage_url: null,
  is_playlist: true, thumbnail: null, item_count: 3,
  entries: [
    { id: 'one', title: 'İlk video', position: 1, available: true, duration: 65, url: null, thumbnail: null },
    { id: 'two', title: 'İkinci video', position: 2, available: true, duration: 120, url: null, thumbnail: null },
    { id: 'gone', title: 'Silinen video', position: 3, available: false, duration: null, url: null, thumbnail: null },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  useDownloadStore.getState().reset()
  useDownloadStore.setState({ formatPreset: 'best', outputDirectory: '', activeJobId: null })
  vi.mocked(checkSystem).mockResolvedValue({ ready: true, checked_at: '2026-09-23', components: [] })
  vi.mocked(listDownloads).mockResolvedValue([])
})

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><App /></QueryClientProvider>)
  return userEvent.setup()
}

test('inspects a link and selects only available videos', async () => {
  vi.mocked(inspectMedia).mockResolvedValue(preview)
  const user = renderApp()
  expect(screen.getByRole('button', { name: 'İncele' })).toBeDisabled()
  await user.type(screen.getByLabelText('YouTube bağlantısı'), 'https://youtube.com/playlist?list=PLtest')
  await user.click(screen.getByRole('button', { name: 'İncele' }))
  expect(await screen.findByRole('heading', { name: 'Favoriler' })).toBeVisible()
  expect(inspectMedia).toHaveBeenCalledWith('https://youtube.com/playlist?list=PLtest', expect.anything())
  expect(screen.getByRole('checkbox', { name: 'Silinen video' })).toBeDisabled()
  expect(screen.getByText('2 video seçildi')).toBeVisible()
  await user.click(screen.getByRole('checkbox', { name: 'İlk video' }))
  expect(screen.getByRole('checkbox', { name: 'Tümünü seç' })).toBePartiallyChecked()
  expect(useDownloadStore.getState().selectedIds).toEqual(['two'])
  await user.click(screen.getByRole('checkbox', { name: 'Tümünü seç' }))
  expect(useDownloadStore.getState().selectedIds).toEqual(['one', 'two'])
  await user.click(screen.getByRole('checkbox', { name: 'Tümünü seç' }))
  expect(screen.getByText('0 video seçildi')).toBeVisible()
})

test('clears old selections and shows an error when a new inspection fails', async () => {
  useDownloadStore.getState().setMedia(preview, 'https://youtube.com/playlist?list=PLtest')
  vi.mocked(inspectMedia).mockRejectedValue(new Error('offline'))
  const user = renderApp()
  await user.type(screen.getByLabelText('YouTube bağlantısı'), 'https://youtu.be/example')
  await user.click(screen.getByRole('button', { name: 'İncele' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Bağlantı incelenemedi')
  expect(screen.queryByRole('heading', { name: 'Favoriler' })).not.toBeInTheDocument()
  expect(useDownloadStore.getState().selectedIds).toEqual([])
})

test('shows a single video as a selectable row', async () => {
  vi.mocked(inspectMedia).mockResolvedValue({ ...preview, is_playlist: false, item_count: 1, entries: [preview.entries[0]] })
  const user = renderApp()
  await user.type(screen.getByLabelText('YouTube bağlantısı'), 'https://youtu.be/example')
  await user.click(screen.getByRole('button', { name: 'İncele' }))
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'İlk video' })).toBeChecked())
  expect(screen.getByText('TEK VİDEO')).toBeVisible()
})

const job: DownloadJob = {
  id: 'job-one', playlist_title: 'Favoriler', status: 'queued', total_items: 1,
  completed_items: 0, failed_items: 0, output_directory: 'downloads/Müzik', format_preset: '720p', error_message: null,
  items: [{ id: 1, video_id: 'one', title: 'İlk video', status: 'queued', progress: 0, downloaded_bytes: 0, total_bytes: null, speed: null, eta: null, error_message: null }],
}

test('submits the inspected source with selected IDs, quality and folder', async () => {
  useDownloadStore.getState().setMedia(preview, 'https://youtube.com/playlist?list=PLtest')
  vi.mocked(createDownload).mockImplementation(async () => {
    vi.mocked(listDownloads).mockResolvedValue([job])
    return job
  })
  const user = renderApp()
  await user.click(screen.getByRole('checkbox', { name: 'İkinci video' }))
  await user.selectOptions(screen.getByLabelText('Kalite'), '720p')
  await user.type(screen.getByLabelText('Hedef alt klasör'), 'Müzik')
  await waitFor(() => expect(screen.getByRole('button', { name: 'İndirmeyi başlat' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'İndirmeyi başlat' }))
  expect(await screen.findByText('İş kuyruğa eklendi. İlerlemeyi İndirmeler ekranından takip edebilirsin.')).toBeVisible()
  expect(createDownload).toHaveBeenCalledTimes(1)
  expect(vi.mocked(createDownload).mock.calls[0][0]).toEqual({ url: 'https://youtube.com/playlist?list=PLtest', video_ids: ['one'], format_preset: '720p', output_directory: 'Müzik' })
  expect(useDownloadStore.getState().activeJobId).toBe(job.id)
  await user.click(screen.getByRole('button', { name: 'İndirmeler' }))
  expect(await screen.findByRole('heading', { name: 'İndirmeler', level: 1 })).toBeVisible()
})

test('rejects folder traversal and disables submit with no selection', async () => {
  useDownloadStore.getState().setMedia(preview, 'https://youtube.com/playlist?list=PLtest')
  const user = renderApp()
  await user.type(screen.getByLabelText('Hedef alt klasör'), '../outside')
  await waitFor(() => expect(screen.getByRole('button', { name: 'İndirmeyi başlat' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'İndirmeyi başlat' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('alt klasör adı')
  expect(createDownload).not.toHaveBeenCalled()
  await user.click(screen.getByRole('checkbox', { name: 'Tümünü seç' }))
  expect(screen.getByRole('button', { name: 'İndirmeyi başlat' })).toBeDisabled()
})

test('audio mode uses the audio preset and fixes its bitrate', async () => {
  useDownloadStore.getState().setMedia(preview, 'https://youtube.com/playlist?list=PLtest')
  const user = renderApp()
  await user.selectOptions(screen.getByLabelText('Çıktı biçimi'), 'audio')
  expect(screen.getByLabelText('Kalite')).toBeDisabled()
  expect(useDownloadStore.getState().formatPreset).toBe('audio')
})

test('updates the estimated MB or GB range when selection and quality change', async () => {
  useDownloadStore.getState().setMedia(preview, 'https://youtube.com/playlist?list=PLtest')
  const user = renderApp()
  expect(screen.getByText('Tahmini indirme boyutu')).toBeVisible()
  const initial = screen.getByText(/Yaklaşık .*–/).textContent
  await user.selectOptions(screen.getByLabelText('Kalite'), '480p')
  const lowerQuality = screen.getByText(/Yaklaşık .*–/).textContent
  expect(lowerQuality).not.toBe(initial)
  await user.click(screen.getByRole('checkbox', { name: 'İkinci video' }))
  expect(screen.getByText(/Yaklaşık .*–/).textContent).not.toBe(lowerQuality)
})

test('requests cancellation and keeps pending cancellation distinct from completion', async () => {
  vi.mocked(listDownloads).mockResolvedValue([{ ...job, status: 'downloading' }])
  vi.mocked(cancelDownload).mockResolvedValue({ id: job.id, status: 'cancel_requested' })
  const user = renderApp()
  await user.click(screen.getByRole('button', { name: 'İndirmeler' }))
  await user.click(await screen.findByRole('button', { name: 'İptal et' }))
  expect(await screen.findByText('İptal bekleniyor')).toBeVisible()
  expect(screen.getByRole('button', { name: 'İptal istendi' })).toBeDisabled()
  expect(vi.mocked(cancelDownload).mock.calls[0][0]).toBe(job.id)
})

test('retry tracks the new job rather than changing the failed job', async () => {
  vi.mocked(listDownloads).mockResolvedValue([{ ...job, status: 'failed', failed_items: 1 }])
  vi.mocked(retryDownload).mockResolvedValue({ ...job, id: 'new-job' })
  const user = renderApp()
  await user.click(screen.getByRole('button', { name: 'İndirmeler' }))
  await user.click(await screen.findByRole('button', { name: 'Başarısız videoları yeniden dene' }))
  await waitFor(() => expect(useDownloadStore.getState().activeJobId).toBe('new-job'))
  expect(vi.mocked(retryDownload).mock.calls[0][0]).toBe(job.id)
})
