import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { cancelDownload, errorMessage, listDownloads, retryDownload } from '../services/api'
import { isTerminal } from '../types/download'
import type { DownloadJob } from '../types/download'
import { useDownloadStore } from '../stores/downloadStore'
import { useDownloadEvents } from '../hooks/useDownloadEvents'
import { useI18n } from '../i18n/i18n'

const statusKeys = { queued: 'statusQueued', inspecting: 'statusInspecting', downloading: 'statusDownloading', postprocessing: 'statusPostprocessing', completed: 'statusCompleted', failed: 'statusFailed', cancelled: 'statusCancelled', interrupted: 'statusInterrupted', skipped: 'statusSkipped' } as const

function JobCard({ job, streaming }: { job: DownloadJob; streaming: boolean }) {
  const { t } = useI18n()
  const connection = useDownloadEvents(job.id, streaming)
  const client = useQueryClient()
  const { activeJobId, setActiveJob } = useDownloadStore()
  const [cancelRequested, setCancelRequested] = useState(false)
  const cancel = useMutation({ mutationFn: cancelDownload, onSuccess: () => { setCancelRequested(true); void client.invalidateQueries({ queryKey: ['downloads'] }) } })
  const retry = useMutation({ mutationFn: retryDownload, onSuccess: (newJob) => {
    setActiveJob(newJob.id)
    client.setQueryData<DownloadJob[]>(['downloads'], (jobs = []) => [newJob, ...jobs.filter((item) => item.id !== newJob.id)])
    void client.invalidateQueries({ queryKey: ['downloads'] })
  } })
  const terminal = isTerminal(job.status)
  const progress = job.items.length ? job.items.reduce((sum, item) => sum + Math.max(0, Math.min(100, item.progress)), 0) / job.items.length : 0
  return <article className={`job-card ${job.id === activeJobId ? 'active-job' : ''}`} aria-label={job.playlist_title || t('downloadJob')}>
    <div className="job-heading"><h3>{job.playlist_title || t('downloadJob')}</h3><span className={`job-status ${job.status}`}>{cancelRequested && !terminal ? t('cancelPending') : t(statusKeys[job.status])}</span></div>
    <progress value={progress} max={100} aria-label={t('overallProgress')} />
    <div className="job-meta"><span>{t('completed', { done: job.completed_items, total: job.total_items })}{job.failed_items > 0 && ` · ${t('failedCount', { count: job.failed_items })}`}</span><span>{Math.round(progress)}%</span></div>
    {streaming && connection === 'reconnecting' && <p className="hint" role="status">{t('reconnecting')}</p>}
    <details><summary>{t('videoDetails')}</summary><ul className="queue-items">{job.items.map((item) => <li key={item.id}>
      <div><strong>{item.title}</strong><span>{t(statusKeys[item.status])}</span></div><progress max={100} value={Math.max(0, Math.min(100, item.progress))} aria-label={`${item.title} ${t('overallProgress')}`} />
      {!terminal && item.status === 'downloading' && <small>{item.speed != null ? `${(item.speed / 1_000_000).toFixed(1)} MB/s` : t('speedCalculating')} · {item.eta != null ? t('secondsLeft', { count: Math.ceil(item.eta) }) : t('timeCalculating')}</small>}
      {item.error_message && <p className="error-text">{item.error_message}</p>}
    </li>)}</ul></details>
    <p className="job-path">{job.output_directory}</p>
    {job.error_message && <p className="error-text">{job.error_message}</p>}
    <div className="job-actions">{!terminal && <button className="secondary" disabled={cancel.isPending || cancelRequested} onClick={() => cancel.mutate(job.id)}>{cancelRequested ? t('cancelRequested') : t('cancel')}</button>}{job.status === 'failed' && <button className="secondary" disabled={retry.isPending} onClick={() => retry.mutate(job.id)}>{t('retryFailed')}</button>}</div>
    {(cancel.isError || retry.isError) && <p className="error-text" role="alert">{errorMessage(cancel.error || retry.error, t('operationError'))}</p>}
  </article>
}

export function DownloadQueue({ showEmpty = false }: { showEmpty?: boolean }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['downloads'], queryFn: async () => {
    const snapshot = await listDownloads()
    const current = new Map(client.getQueryData<DownloadJob[]>(['downloads'])?.map((job) => [job.id, job]))
    // A slow HTTP snapshot must not undo a terminal event already received over SSE.
    return snapshot.map((job) => {
      const cached = current.get(job.id)
      return cached && isTerminal(cached.status) && !isTerminal(job.status) ? cached : job
    })
  }, retry: false, refetchInterval: 15_000 })
  // Keep connections below browser HTTP/1 limits; queued work is discovered by the snapshot query.
  const streamingIds = new Set(query.data?.filter((job) => !isTerminal(job.status))
    .sort((a, b) => Number(a.status === 'queued') - Number(b.status === 'queued'))
    .slice(0, 2).map((job) => job.id))
  if (!query.data?.length && !query.isError) return showEmpty ? <section className="queue-empty"><span><Download size={22} /></span><h2>{t('noDownloads')}</h2><p>{t('noDownloadsHelp')}</p></section> : null
  return <section className="download-queue" aria-labelledby="queue-title"><div className="section-title"><span className="step-number">03</span><h2 id="queue-title">{t('downloads')}</h2></div>
    {query.isError && <div className="error" role="alert">{errorMessage(query.error, t('queueError'))} <button className="text-button" onClick={() => void query.refetch()}>{t('refresh')}</button></div>}
    {query.data?.map((job) => <JobCard key={job.id} job={job} streaming={streamingIds.has(job.id)} />)}
  </section>
}
