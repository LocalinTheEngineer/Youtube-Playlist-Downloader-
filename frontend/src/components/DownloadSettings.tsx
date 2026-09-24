import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, CircleAlert, Folder, LoaderCircle } from 'lucide-react'
import { createDownload, errorMessage } from '../services/api'
import { useDownloadStore } from '../stores/downloadStore'
import type { DownloadJob, FormatPreset } from '../types/download'

export function DownloadSettings({ ready, demo = false }: { ready: boolean; demo?: boolean }) {
  const store = useDownloadStore()
  const client = useQueryClient()
  const submitting = useRef(false)
  const [pathError, setPathError] = useState('')
  const mutation = useMutation({
    mutationFn: createDownload,
    onSuccess: (job) => {
      store.setActiveJob(job.id)
      client.setQueryData<DownloadJob[]>(['downloads'], (jobs = []) => [job, ...jobs.filter((item) => item.id !== job.id)])
      void client.invalidateQueries({ queryKey: ['downloads'] })
    },
  })
  return <section className="download-settings" aria-labelledby="settings-title">
    <div className="section-title"><span className="step-number">02</span><h2 id="settings-title">İndirme ayarları</h2></div>
    <form onSubmit={async (event) => {
      event.preventDefault()
      if (submitting.current || !ready || !store.selectedIds.length) return
      const directory = store.outputDirectory.trim()
      if (/(^|[\\/])\.\.($|[\\/])|^[A-Za-z]:|^[\\/]|^~/.test(directory)) {
        setPathError('downloads klasörü içinde bir alt klasör adı girin. Örnek: Müzik/Favoriler')
        return
      }
      setPathError('')
      submitting.current = true
      try {
        await mutation.mutateAsync({ url: store.sourceUrl, video_ids: [...store.selectedIds], format_preset: store.formatPreset, output_directory: directory || '.' })
      } catch { /* The mutation error is rendered below. */ }
      finally { submitting.current = false }
    }}>
      <fieldset disabled={mutation.isPending}>
        <div className="settings-grid">
          <label>Çıktı biçimi<select value={store.formatPreset === 'audio' ? 'audio' : 'video'} onChange={(event) => store.setFormatPreset(event.target.value === 'audio' ? 'audio' : 'best')}>
            <option value="video">MP4 · Video</option><option value="audio">MP3 · Yalnızca ses</option>
          </select></label>
          <label>Kalite<select disabled={store.formatPreset === 'audio'} value={store.formatPreset} onChange={(event) => store.setFormatPreset(event.target.value as FormatPreset)}>
            <option value="best">En iyi kalite</option><option value="1080p">1080p’ye kadar</option><option value="720p">720p’ye kadar</option><option value="480p">480p’ye kadar</option>
            {store.formatPreset === 'audio' && <option value="audio">MP3 · 192 kbps</option>}
          </select></label>
        </div>
        <label htmlFor="output-directory">Hedef alt klasör</label>
        <div className="folder-field"><Folder size={17} aria-hidden="true" /><span>downloads /</span><input id="output-directory" value={store.outputDirectory} maxLength={2048} placeholder="Örn. Müzik/Favoriler" onChange={(event) => { store.setOutputDirectory(event.target.value); setPathError('') }} aria-invalid={!!pathError} aria-describedby="folder-hint" /></div>
        <p className="hint" id="folder-hint">Boş bırakırsan dosyalar downloads klasörüne kaydedilir.</p>
        <div className="download-action"><span>Seçilen: {store.selectedIds.length} video</span><button className="primary" disabled={!ready || !store.selectedIds.length || mutation.isPending} type="submit">
          {mutation.isPending ? <LoaderCircle className="spin" size={17} /> : <ArrowDownToLine size={17} />} {mutation.isPending ? 'Kuyruğa ekleniyor' : demo ? 'Demo akışını başlat' : 'İndirmeyi başlat'}
        </button></div>
      </fieldset>
      {!ready && <p className="hint">İndirmeden önce sistem kontrolündeki eksikleri giderin.</p>}
      {(pathError || mutation.isError) && <div className="error" role="alert"><CircleAlert size={18} /><span>{pathError || errorMessage(mutation.error, 'İndirme başlatılamadı. Yeniden denemeden önce kuyruğu kontrol edin.')}</span></div>}
      {mutation.isSuccess && <p className="success-message" role="status">{demo ? 'Demo başladı. Simüle edilen ilerlemeyi aşağıdan izleyebilirsin.' : 'İş kuyruğa eklendi. İlerlemeyi aşağıdan takip edebilirsin.'}</p>}
    </form>
  </section>
}
