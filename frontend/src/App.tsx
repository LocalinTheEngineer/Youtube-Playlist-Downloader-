import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, Check, ChevronDown, CircleAlert, Code2, HardDrive, Layers, LoaderCircle, MonitorPlay, Play, ShieldCheck, Sparkles } from 'lucide-react'
import { UrlInput } from './components/UrlInput'
import { PlaylistPreview } from './components/PlaylistPreview'
import { DownloadSettings } from './components/DownloadSettings'
import { DownloadQueue } from './components/DownloadQueue'
import { checkSystem, errorMessage, inspectMedia } from './services/api'
import { useDownloadStore } from './stores/downloadStore'
import { demoMode } from './config'

export default function App() {
  const { media, sourceUrl, setMedia, reset } = useDownloadStore()
  const system = useQuery({ queryKey: ['system'], queryFn: checkSystem, retry: false, staleTime: 60_000, refetchOnWindowFocus: false })
  const inspection = useMutation({ mutationFn: inspectMedia, onSuccess: (result, url) => setMedia(result, url) })
  return <div className="app-shell">
    <div className="ambient ambient-one" aria-hidden="true" />
    <div className="ambient ambient-two" aria-hidden="true" />
    <header className="topbar">
      <a className="brand" href="/" aria-label="Playlist Studio ana sayfa"><span className="brand-icon"><Play size={17} fill="currentColor" /></span><strong>Playlist<span>Studio</span></strong></a>
      <div className="topbar-actions"><a className="github-link" href="https://github.com/LocalinTheEngineer/Youtube-Playlist-Downloader-" target="_blank" rel="noreferrer"><Code2 size={16} /> GitHub</a>
        <span className="local-badge"><span /> {demoMode ? 'CANLI DEMO · HESAPSIZ' : 'YEREL ÇALIŞMA ALANI'}</span></div>
    </header>
    <main>
      <section className="hero" aria-labelledby="page-title">
        <div className="page-heading"><p className="eyebrow"><Sparkles size={13} /> VİDEOLARIN, SENİN KOLEKSİYONUN</p><h1 id="page-title">İzlemeye değer ne varsa,<br /><span>hep elinin altında.</span></h1><p>YouTube video ve oynatma listelerini birkaç tıkla düzenle, seç ve cihazına kaydet.</p>
          <div className="trust-row"><span><ShieldCheck size={15} /> Hesap gerektirmez</span><span><HardDrive size={15} /> Yerel depolama</span></div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-orbit" />
          <div className="visual-card visual-card-back"><span>03</span><div /></div>
          <div className="visual-card visual-card-main"><span className="visual-play"><Play size={23} fill="currentColor" /></span><div className="visual-copy"><b>Haftanın seçkisi</b><span>12 video · 48 dk</span></div><span className="visual-wave" /></div>
          <span className="floating-pill"><ArrowDownToLine size={14} /> Hazır</span>
        </div>
      </section>
      {demoMode && <section className="demo-banner" aria-label="Demo bilgisi"><MonitorPlay size={21} /><div><strong>Etkileşimli ürün demosu</strong><p>Hesap gerekmez. Örnek veriler kullanılır ve cihazına gerçek medya indirilmez.</p></div></section>}
      <div className="workspace-grid">
        <div className="workspace-main">
          <section className="input-card" aria-label="Bağlantı inceleme"><div className="section-title"><span className="step-number">01</span><h2>Bağlantını ekle</h2></div>
            <UrlInput demo={demoMode} pending={inspection.isPending} onInspect={(url) => { reset(); inspection.mutate(url) }} />
            {inspection.isError && <div className="error" role="alert"><CircleAlert size={18} /><span>{errorMessage(inspection.error)}</span></div>}
          </section>
          {inspection.isPending && <div className="loading-preview" role="status"><LoaderCircle className="spin" size={26} /><p>Videoların bilgileri alınıyor…</p><span>Uzun playlistlerde bu işlem biraz sürebilir.</span></div>}
          {media && <><PlaylistPreview /><DownloadSettings key={sourceUrl} demo={demoMode} ready={system.data?.ready === true} /></>}
          {!media && !inspection.isPending && <section className="empty-preview"><div className="empty-art" aria-hidden="true"><div className="art-glow" /><div className="art-card back" /><div className="art-card front"><Layers size={30} /><div className="art-line" /><div className="art-line short" /></div></div><h2>Seçkini oluşturmaya hazırsın.</h2><p>Bağlantıyı eklediğinde tüm videolar burada görünür.<br />İstersen hepsini, istersen yalnızca favorilerini seç.</p><div className="empty-steps"><span><b>1</b> Bağlantıyı ekle</span><i /><span><b>2</b> Videoları seç</span><i /><span><b>3</b> İndir</span></div></section>}
          <DownloadQueue />
        </div>
        <aside>
          <section className="info-card"><span className="info-icon"><ShieldCheck size={23} /></span><span className="card-kicker">ÖZEL VE GÜVENLİ</span><h2>{demoMode ? 'Gizliliği önceleyen tasarım.' : 'Bilgisayarında kalır.'}</h2><p>{demoMode ? 'Bu web demosu hesap, şifre veya kişisel veri istemez. Gerçek uygulama indirmeleri kendi diskine kaydeder.' : 'İndirmelerin kendi diskine kaydedilir. Bir hesap açmana veya şifre paylaşmana gerek yok.'}</p><div className="info-divider" /><p className="small-note">Yalnızca indirme hakkına sahip olduğun içerikleri kullan.</p></section>
          {!demoMode && <details className="system-card"><summary><span className={`status-light ${system.data?.ready ? 'ready' : ''}`} /><span>{system.isPending ? 'Sistem kontrol ediliyor' : system.data?.ready ? 'Sistem hazır' : 'Sistem kontrolü gerekiyor'}</span><ChevronDown size={15} /></summary>
            {system.isError && <p className="error-text">{errorMessage(system.error)}</p>}
            {system.data?.components.map((component) => <div className="dependency" key={component.name}><div>{component.ready ? <Check size={14} /> : <CircleAlert size={14} />}<strong>{component.name}</strong><span>{component.version || 'Eksik'}</span></div>{!component.ready && <p>{component.message}</p>}</div>)}
            <button className="text-button" disabled={system.isFetching} onClick={() => void system.refetch()}>Yeniden kontrol et</button>
          </details>}
          {demoMode && <section className="demo-side-card"><strong>Gerçek uygulamayı dene</strong><p>Kaynak kodu indirip Windows bilgisayarında terminal veya yerel arayüzle çalıştırabilirsin.</p><a href="https://github.com/LocalinTheEngineer/Youtube-Playlist-Downloader-#kurulum" target="_blank" rel="noreferrer">Kurulum adımlarını aç <span aria-hidden="true">→</span></a></section>}
        </aside>
      </div>
      <footer><span className="footer-brand"><span className="footer-dot" /> Playlist Studio</span><span>{demoMode ? 'Demo · Gerçek indirme yapılmaz' : 'Basit. Yerel. Senin kontrolünde.'}</span></footer>
    </main>
  </div>
}
