import axios from 'axios'
import type { MediaPreview, SystemCheck } from '../types/media'
import type { CreateDownload, DownloadJob } from '../types/download'

export const api = axios.create({ baseURL: 'http://127.0.0.1:8000/api', timeout: 120_000 })

export async function inspectMedia(url: string): Promise<MediaPreview> {
  return (await api.post<MediaPreview>('/media/inspect', { url })).data
}

export async function checkSystem(): Promise<SystemCheck> {
  return (await api.get<SystemCheck>('/system/check', { timeout: 15_000 })).data
}

export async function createDownload(request: CreateDownload): Promise<DownloadJob> {
  return (await api.post<DownloadJob>('/downloads', request)).data
}

export async function listDownloads(): Promise<DownloadJob[]> {
  return (await api.get<DownloadJob[]>('/downloads', { timeout: 15_000 })).data
}

export async function cancelDownload(id: string): Promise<{ id: string; status: string }> {
  return (await api.post(`/downloads/${encodeURIComponent(id)}/cancel`)).data
}

export async function retryDownload(id: string): Promise<DownloadJob> {
  return (await api.post<DownloadJob>(`/downloads/${encodeURIComponent(id)}/retry`)).data
}

export function errorMessage(error: unknown, fallback = 'Bağlantı incelenemedi. Lütfen yeniden deneyin.'): string {
  if (axios.isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!error.response) return 'Yerel uygulamaya bağlanılamadı. Backend’in açık olduğunu kontrol edin.'
  }
  return fallback
}
