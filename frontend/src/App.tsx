import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, Check, ChevronDown, CircleAlert, HardDrive, Layers, LoaderCircle } from 'lucide-react'
import { UrlInput } from './components/UrlInput'
import { PlaylistPreview } from './components/PlaylistPreview'
import { DownloadSettings } from './components/DownloadSettings'
import { DownloadQueue } from './components/DownloadQueue'
import { checkSystem, errorMessage, inspectMedia } from './services/api'
import { useDownloadStore } from './stores/downloadStore'

export default function App() {
  const { media, sourceUrl, setMedia, reset } = useDownloadStore()
  const system = useQuery({ queryKey: ['system'], queryFn: checkSystem, retry: false, staleTime: 60_000, refetchOnWindowFocus: false })
  const inspection = useMutation({ mutationFn: inspectMedia, onSuccess: (result, url) => setMedia(result, url) })
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Playlist Studio ana sayfa"><span className="brand-icon"><ArrowDownToLine size={21} /></span><strong>Playlist<span>Studio</span></strong></a>
      <span className="local-badge"><span /> YEREL ÇALIŞMA ALANI</span>
    </header>
    <main>
      <div className="page-heading"><p className="eyebrow">SENİN LİSTEN. SENİN BİLGİSAYARIN.</p><h1>İyi içerik, <span>elinin altında.</span></h1><p>Bir YouTube bağlantısı ekle. İçeriğini incele, saklamak istediğin videoları seç.</p></div>
      <div className="workspace-grid">
        <div>
          <section className="input-card" aria-label="Bağlantı inceleme"><div className="section-title"><span className="step-number">01</span><h2>Bağlantını ekle</h2></div>
            <UrlInput pending={inspection.isPending} onInspect={(url) => { reset(); inspection.mutate(url) }} />
            {inspection.isError && <div className="error" role="alert"><CircleAlert size={18} /><span>{errorMessage(inspection.error)}</span></div>}
          </section>
          {inspection.isPending && <div className="loading-preview" role="status"><LoaderCircle className="spin" size={26} /><p>Videoların bilgileri alınıyor…</p><span>Uzun playlistlerde bu işlem biraz sürebilir.</span></div>}
          {media && <><PlaylistPreview /><DownloadSettings key={sourceUrl} ready={system.data?.ready === true} /></>}
          {!media && !inspection.isPending && <section className="empty-preview"><div className="empty-art" aria-hidden="true"><div className="art-card back" /><div className="art-card front"><Layers size={32} /><div className="art-line" /><div className="art-line short" /></div></div><h2>Bir bağlantıyla başlar.</h2><p>Videoların burada listelenecek.<br />İstersen tümünü, istersen yalnızca favorilerini seç.</p><span className="empty-tag">VİDEO & PLAYLIST</span></section>}
          <DownloadQueue />
        </div>
        <aside>
          <section className="info-card"><span className="info-icon"><HardDrive size={23} /></span><h2>Bilgisayarında kalır.</h2><p>İndirmelerin kendi diskine kaydedilir. Bir hesap açmana veya şifre paylaşmana gerek yok.</p><div className="info-divider" /><p className="small-note">Yalnızca indirme hakkına sahip olduğun içerikleri kullan.</p></section>
          <details className="system-card"><summary><span className={`status-light ${system.data?.ready ? 'ready' : ''}`} /><span>{system.isPending ? 'Sistem kontrol ediliyor' : system.data?.ready ? 'Sistem hazır' : 'Sistem kontrolü gerekiyor'}</span><ChevronDown size={15} /></summary>
            {system.isError && <p className="error-text">{errorMessage(system.error)}</p>}
            {system.data?.components.map((component) => <div className="dependency" key={component.name}><div>{component.ready ? <Check size={14} /> : <CircleAlert size={14} />}<strong>{component.name}</strong><span>{component.version || 'Eksik'}</span></div>{!component.ready && <p>{component.message}</p>}</div>)}
            <button className="text-button" disabled={system.isFetching} onClick={() => void system.refetch()}>Yeniden kontrol et</button>
          </details>
        </aside>
      </div>
      <footer><span>Playlist Studio</span><span>Basit. Yerel. Senin kontrolünde.</span></footer>
    </main>
  </div>
}
