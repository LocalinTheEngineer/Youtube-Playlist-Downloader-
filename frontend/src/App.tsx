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
import { checkSystem, errorMessage, inspectMedia } from './services/api'
import { useDownloadStore } from './stores/downloadStore'
import { demoMode } from './config'

type View = 'download' | 'queue' | 'system'

const viewCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  download: { eyebrow: 'ÇALIŞMA ALANI', title: 'Yeni indirme', description: 'Bir YouTube bağlantısı ekle, içeriği seç ve indirmeyi başlat.' },
  queue: { eyebrow: 'AKTİVİTE', title: 'İndirmeler', description: 'Devam eden işleri ve tamamlanan indirmeleri buradan takip et.' },
  system: { eyebrow: 'UYGULAMA', title: 'Sistem durumu', description: 'İndirme bileşenlerini ve yerel çalışma bilgilerini kontrol et.' },
}

export default function App() {
  const [view, setView] = useState<View>('download')
  const { media, sourceUrl, setMedia, reset } = useDownloadStore()
  const system = useQuery({ queryKey: ['system'], queryFn: checkSystem, retry: false, staleTime: 60_000, refetchOnWindowFocus: false })
  const inspection = useMutation({ mutationFn: inspectMedia, onSuccess: (result, url) => setMedia(result, url) })
  const current = viewCopy[view]

  return <div className="desktop-shell">
    <aside className="app-sidebar">
      <div className="app-brand"><span className="app-brand-mark"><Play size={16} fill="currentColor" /></span><div><strong>Playlist Studio</strong><span>Masaüstü</span></div></div>
      <nav className="app-nav" aria-label="Ana navigasyon">
        <span className="nav-label">ÇALIŞMA ALANI</span>
        <button className={view === 'download' ? 'active' : ''} onClick={() => setView('download')}><Plus size={17} />Yeni indirme</button>
        <button className={view === 'queue' ? 'active' : ''} onClick={() => setView('queue')}><Download size={17} />İndirmeler</button>
        <span className="nav-label nav-label-secondary">UYGULAMA</span>
        <button className={view === 'system' ? 'active' : ''} onClick={() => setView('system')}><MonitorCog size={17} />Sistem durumu</button>
      </nav>
      <div className="sidebar-spacer" />
      <div className={`sidebar-status ${system.data?.ready ? 'ready' : ''}`}><span className="status-dot" /><div><strong>{system.isPending ? 'Kontrol ediliyor' : system.data?.ready ? 'İndirmeye hazır' : 'Kontrol gerekli'}</strong><span>{demoMode ? 'Demo modu' : 'Yerel servis'}</span></div></div>
      <a className="sidebar-link" href="https://github.com/LocalinTheEngineer/Youtube-Playlist-Downloader-" target="_blank" rel="noreferrer"><Code2 size={15} />GitHub’da görüntüle</a>
      <div className="sidebar-version">Playlist Studio · v0.1.0</div>
    </aside>

    <div className="app-surface">
      <header className="app-toolbar">
        <div className="toolbar-path"><LayoutDashboard size={15} /><span>Playlist Studio</span><i>/</i><strong>{current.title}</strong></div>
        <div className="toolbar-actions"><span className="privacy-chip"><ShieldCheck size={14} />Yerel ve özel</span><button className="icon-button" aria-label="Sistem ayarları" title="Sistem durumu" onClick={() => setView('system')}><Settings2 size={17} /></button></div>
      </header>

      <main className="app-content">
        <div className="view-heading"><div><span>{current.eyebrow}</span><h1>{current.title}</h1><p>{current.description}</p></div>{view !== 'download' && <button className="primary compact" onClick={() => setView('download')}><Plus size={16} />Yeni indirme</button>}</div>

        {view === 'download' && <div className="download-workspace">
          {demoMode && <div className="demo-notice"><CircleAlert size={17} /><span><strong>Demo modu:</strong> gerçek dosya indirilmez; örnek bir akış gösterilir.</span></div>}
          <section className="input-card" aria-label="Bağlantı inceleme"><div className="panel-heading"><span className="panel-icon"><Library size={18} /></span><div><h2>Kaynak ekle</h2><p>Video veya oynatma listesi bağlantısını yapıştır.</p></div></div><UrlInput demo={demoMode} pending={inspection.isPending} onInspect={(url) => { reset(); inspection.mutate(url) }} />{inspection.isError && <div className="error" role="alert"><CircleAlert size={18} /><span>{errorMessage(inspection.error)}</span></div>}</section>
          {inspection.isPending && <div className="loading-preview" role="status"><LoaderCircle className="spin" size={24} /><div><p>İçerik bilgileri alınıyor</p><span>Uzun oynatma listelerinde bu işlem biraz sürebilir.</span></div></div>}
          {media ? <div className="media-workspace"><PlaylistPreview /><DownloadSettings key={sourceUrl} demo={demoMode} ready={system.data?.ready === true} /></div> : !inspection.isPending && <section className="empty-preview"><div className="empty-window" aria-hidden="true"><span className="empty-window-bar"><i /><i /><i /></span><div><Library size={30} /><b>Bağlantı bekleniyor</b><small>İçerikler burada listelenecek</small></div></div><h2>Bir bağlantıyla başlayalım</h2><p>Bağlantıyı inceledikten sonra videoları tek tek seçebilir, biçim ve kalite ayarlarını belirleyebilirsin.</p><div className="feature-row"><span><Check size={14} />Video seçimi</span><span><Check size={14} />Kalite ayarı</span><span><Check size={14} />Klasör seçimi</span></div></section>}
        </div>}

        {view === 'queue' && <div className="queue-view"><div className="summary-strip"><div><span className="summary-icon green"><Download size={18} /></span><span><small>İNDİRME YÖNETİMİ</small><strong>Kuyruk ve geçmiş</strong></span></div><p>İlerleme bilgisi otomatik yenilenir.</p></div><DownloadQueue showEmpty /></div>}

        {view === 'system' && <div className="system-layout">
          <section className="system-overview"><div className={`system-hero-icon ${system.data?.ready ? 'ready' : ''}`}>{system.data?.ready ? <Check size={25} /> : <MonitorCog size={25} />}</div><div><span className="panel-kicker">GENEL DURUM</span><h2>{system.isPending ? 'Bileşenler kontrol ediliyor' : system.data?.ready ? 'Uygulama indirmeye hazır' : 'Bazı bileşenler ilgilenmeni bekliyor'}</h2><p>Playlist Studio indirmeleri doğrudan bu bilgisayarda işler ve dosyaları yerel diske kaydeder.</p></div><button className="secondary refresh-button" disabled={system.isFetching} onClick={() => void system.refetch()}><RotateCw className={system.isFetching ? 'spin' : ''} size={15} />Yeniden kontrol et</button></section>
          {system.isError && <div className="error" role="alert"><CircleAlert size={18} /><span>{errorMessage(system.error)}</span></div>}
          <section className="component-panel"><div className="panel-heading"><span className="panel-icon"><MonitorCog size={18} /></span><div><h2>İndirme bileşenleri</h2><p>Uygulamanın kullandığı yerel araçlar.</p></div></div><div className="component-list">{system.data?.components.map((component) => <div className="component-row" key={component.name}><span className={`component-check ${component.ready ? 'ready' : ''}`}>{component.ready ? <Check size={15} /> : <CircleAlert size={15} />}</span><div><strong>{component.name}</strong><p>{component.ready ? 'Kullanıma hazır' : component.message}</p></div><code>{component.version || 'Eksik'}</code></div>)}{system.isPending && <div className="component-loading"><LoaderCircle className="spin" size={18} />Bileşenler kontrol ediliyor…</div>}</div></section>
          <div className="system-cards"><section><span className="panel-icon pale"><FolderOpen size={18} /></span><small>VARSAYILAN KONUM</small><h3>Downloads / Playlist Studio</h3><p>Tamamlanan dosyaların yerel kayıt klasörü.</p></section><section><span className="panel-icon pale"><HardDrive size={18} /></span><small>DEPOLAMA</small><h3>Bu bilgisayarda</h3><p>İçerikler harici bir sunucuya yüklenmez.</p></section><section><span className="panel-icon pale"><Clock3 size={18} /></span><small>ÇALIŞMA BİÇİMİ</small><h3>Arka plan kuyruğu</h3><p>Birden fazla indirmeyi sırayla işler.</p></section></div>
          <details className="legal-note"><summary><ShieldCheck size={15} />Kullanım notu<ChevronDown size={15} /></summary><p>Yalnızca indirme ve saklama hakkına sahip olduğun içerikleri kullan.</p></details>
        </div>}
      </main>
    </div>
  </div>
}
