import { ListVideo, Music2 } from 'lucide-react'
import { useDownloadStore } from '../stores/downloadStore'

function duration(seconds: number | null) {
  if (seconds === null) return '—'
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  return hours ? `${hours}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function PlaylistPreview() {
  const { media, selectedIds, toggle, selectAll } = useDownloadStore()
  if (!media) return null
  const selectable = new Set(media.entries.filter((entry) => entry.available && entry.id).map((entry) => entry.id))
  return <section className="preview" aria-labelledby="preview-title">
    <div className="preview-header">
      <div className="cover"><Music2 size={34} aria-hidden="true" />{media.thumbnail && <img src={media.thumbnail} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</div>
      <div className="min-w-0"><p className="eyebrow">{media.is_playlist ? 'PLAYLIST' : 'TEK VİDEO'}</p><h2 id="preview-title">{media.title || 'Başlıksız içerik'}</h2><p className="muted">{media.channel || 'Kanal bilgisi yok'} <span className="dot">·</span> {media.item_count} video</p></div>
    </div>
    <div className="selection-bar">
      <label><input type="checkbox" checked={selectable.size > 0 && selectedIds.length === selectable.size}
        ref={(input) => { if (input) input.indeterminate = selectedIds.length > 0 && selectedIds.length < selectable.size }}
        disabled={!selectable.size} onChange={(event) => selectAll(event.target.checked)} /> Tümünü seç</label>
      <span className="selection-count">{selectedIds.length} video seçildi</span>
    </div>
    <ul className="video-list">
      {media.entries.map((entry, index) => <li key={`${entry.id}-${index}`} className={!entry.available ? 'unavailable' : ''}>
        <label className="video-row">
          <input type="checkbox" aria-label={entry.title} checked={!!entry.id && selectedIds.includes(entry.id)} disabled={!entry.available || !entry.id}
            onChange={() => { if (entry.id) toggle(entry.id) }} />
          <span className="video-position">{String(entry.position).padStart(2, '0')}</span>
          <span className="video-icon"><ListVideo size={18} aria-hidden="true" /></span>
          <span className="video-title">{entry.title}{!entry.available && <small>Kullanılamıyor</small>}</span>
          <span className="duration">{duration(entry.duration)}</span>
        </label>
      </li>)}
    </ul>
    {!media.entries.length && <p className="empty-message">Bu bağlantıda gösterilebilecek video bulunamadı.</p>}
  </section>
}
