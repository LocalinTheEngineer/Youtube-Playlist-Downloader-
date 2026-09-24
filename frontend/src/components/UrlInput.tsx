import { useState } from 'react'
import { ArrowRight, Link2, LoaderCircle } from 'lucide-react'

interface Props { pending: boolean; demo?: boolean; onInspect: (url: string) => void }

export function UrlInput({ pending, demo = false, onInspect }: Props) {
  const [url, setUrl] = useState('')
  return <form onSubmit={(event) => { event.preventDefault(); onInspect(url.trim()) }}>
    <label htmlFor="media-url">YouTube bağlantısı</label>
    <div className="url-field">
      <Link2 size={19} aria-hidden="true" />
      <input id="media-url" type="url" required value={url} maxLength={2048} disabled={pending}
        onChange={(event) => setUrl(event.target.value)} placeholder="Video veya playlist bağlantısını buraya yapıştır" />
      <button className="primary" type="submit" disabled={pending || !url.trim()}>
        {pending ? <><LoaderCircle size={17} className="spin" aria-hidden="true" /> İnceleniyor</> : <>İncele <ArrowRight size={17} aria-hidden="true" /></>}
      </button>
    </div>
    <div className="input-help"><p className="hint">Tek bir video ya da bir playlist. Önce içeriği gör, sonra seçimini yap.</p>
      {demo && <button className="text-button demo-example" type="button" disabled={pending}
        onClick={() => onInspect('https://www.youtube.com/playlist?list=PLAYLIST_STUDIO_DEMO')}>Örnek playlisti aç</button>}
    </div>
  </form>
}
