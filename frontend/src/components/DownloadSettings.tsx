import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, CircleAlert, Folder, FolderOpen, HardDrive, LoaderCircle } from 'lucide-react'
import { createDownload, errorMessage } from '../services/api'
import { useDownloadStore } from '../stores/downloadStore'
import type { DownloadJob, FormatPreset } from '../types/download'
import { estimateDownloadSize, formatBytes } from '../utils/sizeEstimate'
import { useI18n } from '../i18n/i18n'

export function DownloadSettings({ ready, demo = false }: { ready: boolean; demo?: boolean }) {
  const store = useDownloadStore()
  const { language, t } = useI18n()
  const client = useQueryClient()
  const submitting = useRef(false)
  const [pathError, setPathError] = useState('')
  const [selectingFolder, setSelectingFolder] = useState(false)
  const folderPicker = window.playlistStudio?.selectDownloadDirectory
  const selectedIds = new Set(store.selectedIds)
  const selectedEntries = store.media?.entries.filter((entry) => entry.id && selectedIds.has(entry.id)) ?? []
  const sizeEstimate = estimateDownloadSize(selectedEntries.map((entry) => entry.duration), store.formatPreset)
  const sizeRange = sizeEstimate.knownItems === 0 ? null : sizeEstimate.minimumBytes === sizeEstimate.maximumBytes
    ? formatBytes(sizeEstimate.minimumBytes, language)
    : `${formatBytes(sizeEstimate.minimumBytes, language)} – ${formatBytes(sizeEstimate.maximumBytes, language)}`
  const mutation = useMutation({
    mutationFn: createDownload,
    onSuccess: (job) => {
      store.setActiveJob(job.id)
      client.setQueryData<DownloadJob[]>(['downloads'], (jobs = []) => [job, ...jobs.filter((item) => item.id !== job.id)])
      void client.invalidateQueries({ queryKey: ['downloads'] })
    },
  })
  return <section className="download-settings" aria-labelledby="settings-title">
    <div className="section-title"><span className="step-number">02</span><h2 id="settings-title">{t('downloadSettings')}</h2></div>
    <form onSubmit={async (event) => {
      event.preventDefault()
      if (submitting.current || !ready || !store.selectedIds.length) return
      const directory = store.outputDirectory.trim()
      if (!folderPicker && /(^|[\\/])\.\.($|[\\/])|^[A-Za-z]:|^[\\/]|^~/.test(directory)) {
        setPathError(t('invalidFolder'))
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
          <label>{t('outputFormat')}<select value={store.formatPreset === 'audio' ? 'audio' : 'video'} onChange={(event) => store.setFormatPreset(event.target.value === 'audio' ? 'audio' : 'best')}>
            <option value="video">{t('video')}</option><option value="audio">{t('audio')}</option>
          </select></label>
          <label>{t('quality')}<select disabled={store.formatPreset === 'audio'} value={store.formatPreset} onChange={(event) => store.setFormatPreset(event.target.value as FormatPreset)}>
            <option value="best">{t('best')}</option><option value="1080p">{t('upTo1080')}</option><option value="720p">{t('upTo720')}</option><option value="480p">{t('upTo480')}</option>
            {store.formatPreset === 'audio' && <option value="audio">MP3 · 192 kbps</option>}
          </select></label>
        </div>
        <label htmlFor="output-directory">{t('targetFolder')}</label>
        <div className="folder-field"><Folder size={17} aria-hidden="true" />{!folderPicker && <span>downloads /</span>}<input id="output-directory" value={store.outputDirectory} maxLength={2048} placeholder={t('folderExample')} readOnly={!!folderPicker} onChange={(event) => { store.setOutputDirectory(event.target.value); setPathError('') }} aria-invalid={!!pathError} aria-describedby="folder-hint" />{folderPicker && <button type="button" className="folder-picker-button" disabled={selectingFolder} onClick={async () => {
          setSelectingFolder(true)
          try {
            const directory = await folderPicker()
            if (directory) { store.setOutputDirectory(directory); setPathError('') }
          } finally { setSelectingFolder(false) }
        }}>{selectingFolder ? <LoaderCircle className="spin" size={15} /> : <FolderOpen size={15} />} {selectingFolder ? t('choosingFolder') : t('chooseFolder')}</button>}</div>
        <p className="hint" id="folder-hint">{t('folderHint')}</p>
        <div className="size-estimate" aria-live="polite">
          <span className="size-estimate-icon"><HardDrive size={18} aria-hidden="true" /></span>
          <div><span>{t('estimatedSize')}</span><strong>{sizeRange ? t('approximately', { value: sizeRange }) : t('calculatingUnavailable')}</strong></div>
          <small>{sizeEstimate.unknownItems > 0 ? `${t('unknownDurations', { count: sizeEstimate.unknownItems })} ` : ''}{t('sizeVaries')}</small>
        </div>
        <div className="download-action"><span>{t('selected', { count: store.selectedIds.length })}</span><button className="primary" disabled={!ready || !store.selectedIds.length || mutation.isPending} type="submit">
          {mutation.isPending ? <LoaderCircle className="spin" size={17} /> : <ArrowDownToLine size={17} />} {mutation.isPending ? t('addingQueue') : demo ? t('startDemo') : t('startDownload')}
        </button></div>
      </fieldset>
      {!ready && <p className="hint">{t('systemFix')}</p>}
      {(pathError || mutation.isError) && <div className="error" role="alert"><CircleAlert size={18} /><span>{pathError || errorMessage(mutation.error, t('startError'))}</span></div>}
      {mutation.isSuccess && <p className="success-message" role="status">{demo ? t('demoSuccess') : t('queuedSuccess')}</p>}
    </form>
  </section>
}
