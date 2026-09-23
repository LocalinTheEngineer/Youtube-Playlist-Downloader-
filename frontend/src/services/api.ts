import axios from 'axios'
import type { MediaPreview, SystemCheck } from '../types/media'

export const api = axios.create({ baseURL: 'http://127.0.0.1:8000/api', timeout: 120_000 })

export async function inspectMedia(url: string): Promise<MediaPreview> {
  return (await api.post<MediaPreview>('/media/inspect', { url })).data
}

export async function checkSystem(): Promise<SystemCheck> {
  return (await api.get<SystemCheck>('/system/check', { timeout: 15_000 })).data
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!error.response) return 'Yerel uygulamaya bağlanılamadı. Backend’in açık olduğunu kontrol edin.'
  }
  return 'Bağlantı incelenemedi. Lütfen yeniden deneyin.'
}
