import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { inspectMedia, checkSystem } from './services/api'
import { useDownloadStore } from './stores/downloadStore'
import type { MediaPreview } from './types/media'

vi.mock('./services/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./services/api')>(),
  inspectMedia: vi.fn(), checkSystem: vi.fn(),
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
  vi.mocked(checkSystem).mockResolvedValue({ ready: true, checked_at: '2026-09-23', components: [] })
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
