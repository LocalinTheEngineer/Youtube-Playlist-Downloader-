import type { CreateDownload, DownloadItem, DownloadJob } from '../types/download'
import type { MediaPreview, SystemCheck } from '../types/media'

const entries: MediaPreview['entries'] = [
  { id: 'demo-01', title: 'Gece Yolculuğu', position: 1, available: true, duration: 247, url: null, thumbnail: null },
  { id: 'demo-02', title: 'Şehrin Işıkları', position: 2, available: true, duration: 193, url: null, thumbnail: null },
  { id: 'demo-03', title: 'Sessiz Bir Sabah', position: 3, available: true, duration: 318, url: null, thumbnail: null },
  { id: 'demo-04', title: 'Yolun Sonunda', position: 4, available: true, duration: 226, url: null, thumbnail: null },
  { id: null, title: 'Gizli video', position: 5, available: false, duration: null, url: null, thumbnail: null },
]

const preview: MediaPreview = {
  id: 'PL_PLAYLIST_STUDIO_DEMO',
  title: 'Playlist Studio · Örnek Liste',
  channel: 'Etkileşimli ürün demosu',
  webpage_url: null,
  is_playlist: true,
  thumbnail: null,
  item_count: entries.length,
  entries,
}

const jobs = new Map<string, DownloadJob>()
const timers = new Map<string, ReturnType<typeof setInterval>>()
const listeners = new Map<string, Set<(job: DownloadJob) => void>>()
let nextJob = 1

const clone = <T,>(value: T): T => structuredClone(value)
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function validateDemoUrl(value: string) {
  let parsed: URL
  try { parsed = new URL(value) }
  catch { throw new Error('Geçerli bir YouTube bağlantısı girin.') }
  const hosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'])
  if (parsed.protocol !== 'https:' || !hosts.has(parsed.hostname.toLowerCase())) {
    throw new Error('Yalnızca HTTPS YouTube bağlantıları kabul edilir.')
  }
}

function publish(job: DownloadJob) {
  jobs.set(job.id, clone(job))
  listeners.get(job.id)?.forEach((listener) => listener(clone(job)))
}

function stopTimer(id: string) {
  const timer = timers.get(id)
  if (timer) clearInterval(timer)
  timers.delete(id)
}

function runDemo(id: string) {
  stopTimer(id)
  const timer = setInterval(() => {
    const job = jobs.get(id)
    if (!job || ['completed', 'failed', 'cancelled', 'interrupted'].includes(job.status)) {
      stopTimer(id)
      return
    }
    if (job.status === 'queued') job.status = 'downloading'
    const active = job.items.find((item) => item.status !== 'completed')
    if (!active) {
      if (job.status === 'postprocessing') {
        job.status = 'completed'
        stopTimer(id)
      } else job.status = 'postprocessing'
      publish(job)
      return
    }
    active.status = 'downloading'
    active.progress = Math.min(100, active.progress + 25)
    active.total_bytes = 24_000_000
    active.downloaded_bytes = active.total_bytes * active.progress / 100
    active.speed = 6_400_000
    active.eta = Math.ceil((100 - active.progress) / 25)
    if (active.progress === 100) {
      active.status = 'completed'
      active.speed = null
      active.eta = 0
      job.completed_items += 1
    }
    publish(job)
  }, 350)
  timers.set(id, timer)
}

export async function inspectDemoMedia(url: string): Promise<MediaPreview> {
  validateDemoUrl(url)
  await wait(450)
  return clone({ ...preview, webpage_url: url })
}

export async function checkDemoSystem(): Promise<SystemCheck> {
  return {
    ready: true,
    checked_at: new Date().toISOString(),
    components: [{ name: 'Demo modu', ready: true, version: '1.0', message: 'Gerçek medya indirilmez.' }],
  }
}

export async function createDemoDownload(request: CreateDownload): Promise<DownloadJob> {
  await wait(250)
  const selected = entries.filter((entry) => entry.id && request.video_ids.includes(entry.id))
  if (!selected.length) throw new Error('Demo için en az bir video seçin.')
  const id = `demo-${nextJob++}`
  const items: DownloadItem[] = selected.map((entry, index) => ({
    id: index + 1,
    video_id: entry.id,
    title: entry.title,
    status: 'queued',
    progress: 0,
    downloaded_bytes: 0,
    total_bytes: null,
    speed: null,
    eta: null,
    error_message: null,
  }))
  const job: DownloadJob = {
    id,
    playlist_title: preview.title,
    status: 'queued',
    total_items: items.length,
    completed_items: 0,
    failed_items: 0,
    output_directory: `downloads/${request.output_directory === '.' ? '' : request.output_directory}`.replace(/\/$/, ''),
    format_preset: request.format_preset,
    error_message: null,
    items,
  }
  publish(job)
  runDemo(id)
  return clone(job)
}

export async function listDemoDownloads(): Promise<DownloadJob[]> {
  return [...jobs.values()].reverse().map(clone)
}

export function openDemoEvents(id: string): EventSource {
  class DemoEventSource extends EventTarget {
    closed = false
    private listener = (job: DownloadJob) => {
      if (!this.closed) this.dispatchEvent(new MessageEvent('progress', { data: JSON.stringify(job) }))
    }

    constructor() {
      super()
      const subscribers = listeners.get(id) ?? new Set()
      subscribers.add(this.listener)
      listeners.set(id, subscribers)
      setTimeout(() => {
        if (this.closed) return
        this.dispatchEvent(new Event('open'))
        const job = jobs.get(id)
        if (job) this.listener(clone(job))
      }, 0)
    }

    close() {
      this.closed = true
      listeners.get(id)?.delete(this.listener)
    }
  }
  return new DemoEventSource() as unknown as EventSource
}

export async function cancelDemoDownload(id: string): Promise<{ id: string; status: string }> {
  const job = jobs.get(id)
  if (!job) throw new Error('Demo işi bulunamadı.')
  stopTimer(id)
  job.status = 'cancelled'
  job.items.forEach((item) => { if (item.status !== 'completed') item.status = 'cancelled' })
  publish(job)
  return { id, status: 'cancelled' }
}

export async function retryDemoDownload(): Promise<DownloadJob> {
  throw new Error('Demo işlerinde yeniden deneme gerekmiyor.')
}
