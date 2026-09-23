import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelDownload, errorMessage, listDownloads, retryDownload } from '../services/api'
import { isTerminal } from '../types/download'
import type { DownloadJob } from '../types/download'
import { useDownloadStore } from '../stores/downloadStore'

const labels: Record<string, string> = { queued: 'Sırada', inspecting: 'İnceleniyor', downloading: 'İndiriliyor', postprocessing: 'İşleniyor', completed: 'Tamamlandı', failed: 'Başarısız', cancelled: 'İptal edildi', interrupted: 'Kesintiye uğradı', skipped: 'Atlandı' }

function JobCard({ job }: { job: DownloadJob }) {
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
  return <article className={`job-card ${job.id === activeJobId ? 'active-job' : ''}`} aria-label={job.playlist_title || 'İndirme işi'}>
    <div className="job-heading"><h3>{job.playlist_title || 'İndirme işi'}</h3><span className={`job-status ${job.status}`}>{cancelRequested && !terminal ? 'İptal bekleniyor' : labels[job.status]}</span></div>
    <progress value={progress} max={100} aria-label="Genel ilerleme" />
    <div className="job-meta"><span>{job.completed_items} / {job.total_items} tamamlandı{job.failed_items > 0 && ` · ${job.failed_items} başarısız`}</span><span>{Math.round(progress)}%</span></div>
    <details><summary>Video ayrıntıları</summary><ul className="queue-items">{job.items.map((item) => <li key={item.id}>
      <div><strong>{item.title}</strong><span>{labels[item.status]}</span></div><progress max={100} value={Math.max(0, Math.min(100, item.progress))} aria-label={`${item.title} ilerleme`} />
      {!terminal && item.status === 'downloading' && <small>{item.speed != null ? `${(item.speed / 1_000_000).toFixed(1)} MB/sn` : 'Hız hesaplanıyor'} · {item.eta != null ? `${Math.ceil(item.eta)} sn kaldı` : 'Süre hesaplanıyor'}</small>}
      {item.error_message && <p className="error-text">{item.error_message}</p>}
    </li>)}</ul></details>
    <p className="job-path">{job.output_directory}</p>
    {job.error_message && <p className="error-text">{job.error_message}</p>}
    <div className="job-actions">{!terminal && <button className="secondary" disabled={cancel.isPending || cancelRequested} onClick={() => cancel.mutate(job.id)}>{cancelRequested ? 'İptal istendi' : 'İptal et'}</button>}{job.status === 'failed' && <button className="secondary" disabled={retry.isPending} onClick={() => retry.mutate(job.id)}>Başarısız videoları yeniden dene</button>}</div>
    {(cancel.isError || retry.isError) && <p className="error-text" role="alert">{errorMessage(cancel.error || retry.error, 'İşlem uygulanamadı. Yeniden deneyin.')}</p>}
  </article>
}

export function DownloadQueue() {
  const query = useQuery({ queryKey: ['downloads'], queryFn: listDownloads, retry: false, refetchInterval: 2000 })
  if (!query.data?.length && !query.isError) return null
  return <section className="download-queue" aria-labelledby="queue-title"><div className="section-title"><span className="step-number">03</span><h2 id="queue-title">İndirmeler</h2></div>
    {query.isError && <div className="error" role="alert">{errorMessage(query.error, 'Kuyruk bilgisi alınamadı.')} <button className="text-button" onClick={() => void query.refetch()}>Yenile</button></div>}
    {query.data?.map((job) => <JobCard key={job.id} job={job} />)}
  </section>
}
