import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { openDownloadEvents } from '../services/api'
import { isTerminal } from '../types/download'
import type { DownloadJob } from '../types/download'

const statuses = ['queued', 'inspecting', 'downloading', 'postprocessing', 'completed', 'failed', 'cancelled', 'interrupted']
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const optionalString = (value: unknown) => value === null || typeof value === 'string'
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

function validJob(value: unknown, id: string): value is DownloadJob {
  if (!record(value) || value.id !== id || !statuses.includes(String(value.status))) return false
  if (!optionalString(value.playlist_title) || !optionalString(value.error_message) || typeof value.output_directory !== 'string') return false
  if (!['best', '1080p', '720p', '480p', 'audio'].includes(String(value.format_preset))) return false
  if (![value.total_items, value.completed_items, value.failed_items].every(number) || !Array.isArray(value.items)) return false
  return value.items.every((item) => record(item) && number(item.id) && typeof item.title === 'string'
    && optionalString(item.video_id) && optionalString(item.error_message)
    && [...statuses, 'skipped'].includes(String(item.status))
    && number(item.progress) && item.progress <= 100 && number(item.downloaded_bytes)
    && [item.total_bytes, item.speed, item.eta].every((field) => field === null || number(field)))
}

export function useDownloadEvents(id: string, enabled: boolean) {
  const client = useQueryClient()
  const [connection, setConnection] = useState<'connecting' | 'live' | 'reconnecting'>('connecting')
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    const source = openDownloadEvents(id)
    const opened = () => { if (!disposed) setConnection('live') }
    const failed = () => { if (!disposed) setConnection('reconnecting') }
    const progress = (event: Event) => {
      if (disposed) return
      let value: unknown
      try { value = JSON.parse((event as MessageEvent<string>).data) }
      catch { failed(); return }
      if (!validJob(value, id)) { failed(); return }
      const job = value
      setConnection('live')
      client.setQueryData<DownloadJob[]>(['downloads'], (jobs = []) => jobs.map((previous) => {
        if (previous.id !== id || (isTerminal(previous.status) && !isTerminal(job.status))) return previous
        return job
      }))
      if (isTerminal(job.status)) {
        disposed = true
        source.close()
      }
    }
    source.addEventListener('open', opened)
    source.addEventListener('error', failed)
    source.addEventListener('progress', progress)
    return () => {
      disposed = true
      source.removeEventListener('open', opened)
      source.removeEventListener('error', failed)
      source.removeEventListener('progress', progress)
      source.close()
    }
  }, [client, id, enabled])
  return connection
}
