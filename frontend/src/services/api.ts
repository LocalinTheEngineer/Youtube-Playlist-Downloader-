import axios from 'axios'
import { apiBaseUrl, demoMode } from '../config'
import type { MediaPreview, SystemCheck } from '../types/media'
import type { CreateDownload, DownloadJob } from '../types/download'
import {
  cancelDemoDownload,
  checkDemoSystem,
  createDemoDownload,
  inspectDemoMedia,
  listDemoDownloads,
  openDemoEvents,
  pauseDemoDownload,
  resumeDemoDownload,
  retryDemoDownload,
} from './demoApi'

export const api = axios.create({ baseURL: apiBaseUrl, timeout: 120_000 })

export async function inspectMedia(url: string): Promise<MediaPreview> {
  if (demoMode) return inspectDemoMedia(url)
  return (await api.post<MediaPreview>('/media/inspect', { url })).data
}

export async function checkSystem(): Promise<SystemCheck> {
  if (demoMode) return checkDemoSystem()
  return (await api.get<SystemCheck>('/system/check', { timeout: 15_000 })).data
}

export async function createDownload(request: CreateDownload): Promise<DownloadJob> {
  if (demoMode) return createDemoDownload(request)
  return (await api.post<DownloadJob>('/downloads', request)).data
}

export function duplicateDownloadIds(error: unknown): string[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null
  const detail: unknown = error.response.data?.detail
  if (!detail || typeof detail !== 'object' || !('code' in detail) || detail.code !== 'duplicate_downloads') return null
  if (!('video_ids' in detail) || !Array.isArray(detail.video_ids)) return null
  return detail.video_ids.filter((id): id is string => typeof id === 'string')
}

export async function listDownloads(): Promise<DownloadJob[]> {
  if (demoMode) return listDemoDownloads()
  return (await api.get<DownloadJob[]>('/downloads', { timeout: 15_000 })).data
}

export function openDownloadEvents(id: string): EventSource {
  if (demoMode) return openDemoEvents(id)
  return new EventSource(`${api.defaults.baseURL}/downloads/${encodeURIComponent(id)}/events`)
}

export async function cancelDownload(id: string): Promise<{ id: string; status: string }> {
  if (demoMode) return cancelDemoDownload(id)
  return (await api.post(`/downloads/${encodeURIComponent(id)}/cancel`)).data
}

export async function pauseDownload(id: string): Promise<{ id: string; status: string }> {
  if (demoMode) return pauseDemoDownload(id)
  return (await api.post(`/downloads/${encodeURIComponent(id)}/pause`)).data
}

export async function resumeDownload(id: string): Promise<{ id: string; status: string }> {
  if (demoMode) return resumeDemoDownload(id)
  return (await api.post(`/downloads/${encodeURIComponent(id)}/resume`)).data
}

export async function retryDownload(id: string): Promise<DownloadJob> {
  if (demoMode) return retryDemoDownload()
  return (await api.post<DownloadJob>(`/downloads/${encodeURIComponent(id)}/retry`)).data
}

export function errorMessage(error: unknown, fallback = 'Bağlantı incelenemedi. Lütfen yeniden deneyin.'): string {
  if (axios.isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!error.response) return 'Yerel uygulamaya bağlanılamadı. Backend’in açık olduğunu kontrol edin.'
  }
  if (demoMode && error instanceof Error && error.message) return error.message
  return fallback
}
