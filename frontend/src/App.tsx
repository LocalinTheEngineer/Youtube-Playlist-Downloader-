import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Check, ChevronDown, CircleAlert, Clock3, Code2, Download, FolderOpen,
  HardDrive, LayoutDashboard, Library, LoaderCircle, MonitorCog, Play,
  Plus, RotateCw, Settings2, ShieldCheck,
} from 'lucide-react'
import { UrlInput } from './components/UrlInput'
import { PlaylistPreview } from './components/PlaylistPreview'
import { DownloadSettings } from './components/DownloadSettings'
import { DownloadQueue } from './components/DownloadQueue'
import { LanguageSelector } from './components/LanguageSelector'
import { checkSystem, errorMessage, inspectMedia } from './services/api'
import { useDownloadStore } from './stores/downloadStore'
import { demoMode } from './config'
import { useI18n } from './i18n/i18n'

type View = 'download' | 'queue' | 'system'

export default function App() {
  const { language, t } = useI18n()
  const [view, setView] = useState<View>('download')
  const { media, sourceUrl, setMedia, reset } = useDownloadStore()
  const system = useQuery({ queryKey: ['system'], queryFn: checkSystem, retry: false, staleTime: 60_000, refetchOnWindowFocus: false })
  const inspection = useMutation({ mutationFn: inspectMedia, onSuccess: (result, url) => setMedia(result, url) })
  const viewCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
    download: { eyebrow: t('workspace'), title: t('newDownload'), description: t('newDescription') },
    queue: { eyebrow: t('activity'), title: t('downloads'), description: t('queueDescription') },
    system: { eyebrow: t('application'), title: t('systemStatus'), description: t('systemDescription') },
  }
  const current = viewCopy[view]

  return <div className="desktop-shell">
    <aside className="app-sidebar">
      <div className="app-brand"><span className="app-brand-mark"><Play size={16} fill="currentColor" /></span><div><strong>Playlist Studio</strong><span>{t('application')}</span></div></div>
      <nav className="app-nav" aria-label={t('workspace')}>
        <span className="nav-label">{t('workspace').toLocaleUpperCase(language)}</span>
        <button className={view === 'download' ? 'active' : ''} onClick={() => setView('download')}><Plus size={17} />{t('newDownload')}</button>
        <button className={view === 'queue' ? 'active' : ''} onClick={() => setView('queue')}><Download size={17} />{t('downloads')}</button>
        <span className="nav-label nav-label-secondary">{t('application').toLocaleUpperCase(language)}</span>
        <button className={view === 'system' ? 'active' : ''} onClick={() => setView('system')}><MonitorCog size={17} />{t('systemStatus')}</button>
      </nav>
      <div className="sidebar-spacer" />
      <div className={`sidebar-status ${system.data?.ready ? 'ready' : ''}`}><span className="status-dot" /><div><strong>{system.isPending ? t('checking') : system.data?.ready ? t('ready') : t('needsCheck')}</strong><span>{demoMode ? t('demoMode') : t('localService')}</span></div></div>
      <a className="sidebar-link" href="https://github.com/LocalinTheEngineer/Youtube-Playlist-Downloader-" target="_blank" rel="noreferrer"><Code2 size={15} />{t('github')}</a>
      <div className="sidebar-version">Playlist Studio · v0.2.0</div>
    </aside>

    <div className="app-surface">
      <header className="app-toolbar">
        <div className="toolbar-path"><LayoutDashboard size={15} /><span>Playlist Studio</span><i>/</i><strong>{current.title}</strong></div>
        <div className="toolbar-actions"><LanguageSelector /><span className="privacy-chip"><ShieldCheck size={14} />{t('localPrivate')}</span><button className="icon-button" aria-label={t('systemSettings')} title={t('systemStatus')} onClick={() => setView('system')}><Settings2 size={17} /></button></div>
      </header>

      <main className="app-content">
        <div className="view-heading"><div><span>{current.eyebrow.toLocaleUpperCase(language)}</span><h1>{current.title}</h1><p>{current.description}</p></div>{view !== 'download' && <button className="primary compact" onClick={() => setView('download')}><Plus size={16} />{t('newDownload')}</button>}</div>

        {view === 'download' && <div className="download-workspace">
          {demoMode && <div className="demo-notice"><CircleAlert size={17} /><span>{t('demoNotice')}</span></div>}
          <section className="input-card" aria-label={t('inspect')}><div className="panel-heading"><span className="panel-icon"><Library size={18} /></span><div><h2>{t('addSource')}</h2><p>{t('pasteSource')}</p></div></div><UrlInput demo={demoMode} pending={inspection.isPending} onInspect={(url) => { reset(); inspection.mutate(url) }} />{inspection.isError && <div className="error" role="alert"><CircleAlert size={18} /><span>{errorMessage(inspection.error)}</span></div>}</section>
          {inspection.isPending && <div className="loading-preview" role="status"><LoaderCircle className="spin" size={24} /><div><p>{t('inspectingContent')}</p><span>{t('longPlaylist')}</span></div></div>}
          {media ? <div className="media-workspace"><PlaylistPreview /><DownloadSettings key={sourceUrl} demo={demoMode} ready={system.data?.ready === true} /></div> : !inspection.isPending && <section className="empty-preview"><div className="empty-window" aria-hidden="true"><span className="empty-window-bar"><i /><i /><i /></span><div><Library size={30} /><b>{t('startWithLink')}</b><small>{t('pasteSource')}</small></div></div><h2>{t('startWithLink')}</h2><p>{t('startHelp')}</p><div className="feature-row"><span><Check size={14} />{t('videoSelection')}</span><span><Check size={14} />{t('qualitySetting')}</span><span><Check size={14} />{t('folderSelection')}</span></div></section>}
        </div>}

        {view === 'queue' && <div className="queue-view"><div className="summary-strip"><div><span className="summary-icon green"><Download size={18} /></span><span><small>{t('downloadManagement').toLocaleUpperCase(language)}</small><strong>{t('queueHistory')}</strong></span></div><p>{t('autoRefresh')}</p></div><DownloadQueue showEmpty /></div>}

        {view === 'system' && <div className="system-layout">
          <section className="system-overview"><div className={`system-hero-icon ${system.data?.ready ? 'ready' : ''}`}>{system.data?.ready ? <Check size={25} /> : <MonitorCog size={25} />}</div><div><span className="panel-kicker">{t('generalStatus').toLocaleUpperCase(language)}</span><h2>{system.isPending ? t('componentsChecking') : system.data?.ready ? t('appReady') : t('componentsNeedAttention')}</h2><p>{t('localProcessing')}</p></div><button className="secondary refresh-button" disabled={system.isFetching} onClick={() => void system.refetch()}><RotateCw className={system.isFetching ? 'spin' : ''} size={15} />{t('recheck')}</button></section>
          {system.isError && <div className="error" role="alert"><CircleAlert size={18} /><span>{errorMessage(system.error)}</span></div>}
          <section className="component-panel"><div className="panel-heading"><span className="panel-icon"><MonitorCog size={18} /></span><div><h2>{t('downloadComponents')}</h2><p>{t('localTools')}</p></div></div><div className="component-list">{system.data?.components.map((component) => <div className="component-row" key={component.name}><span className={`component-check ${component.ready ? 'ready' : ''}`}>{component.ready ? <Check size={15} /> : <CircleAlert size={15} />}</span><div><strong>{component.name}</strong><p>{component.ready ? t('available') : component.message}</p></div><code>{component.version || t('missing')}</code></div>)}{system.isPending && <div className="component-loading"><LoaderCircle className="spin" size={18} />{t('componentsChecking')}…</div>}</div></section>
          <div className="system-cards"><section><span className="panel-icon pale"><FolderOpen size={18} /></span><small>{t('defaultLocation').toLocaleUpperCase(language)}</small><h3>Downloads / Playlist Studio</h3><p>{t('completedLocation')}</p></section><section><span className="panel-icon pale"><HardDrive size={18} /></span><small>{t('storage').toLocaleUpperCase(language)}</small><h3>{t('thisComputer')}</h3><p>{t('noExternalUpload')}</p></section><section><span className="panel-icon pale"><Clock3 size={18} /></span><small>{t('operationMode').toLocaleUpperCase(language)}</small><h3>{t('backgroundQueue')}</h3><p>{t('sequentialJobs')}</p></section></div>
          <details className="legal-note"><summary><ShieldCheck size={15} />{t('usageNote')}<ChevronDown size={15} /></summary><p>{t('usageText')}</p></details>
        </div>}
      </main>
    </div>
  </div>
}
