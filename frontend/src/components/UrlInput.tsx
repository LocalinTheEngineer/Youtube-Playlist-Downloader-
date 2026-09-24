import { useState } from 'react'
import { ArrowRight, Link2, LoaderCircle } from 'lucide-react'
import { useI18n } from '../i18n/i18n'

interface Props { pending: boolean; demo?: boolean; onInspect: (url: string) => void }

export function UrlInput({ pending, demo = false, onInspect }: Props) {
  const [url, setUrl] = useState('')
  const { t } = useI18n()
  return <form onSubmit={(event) => { event.preventDefault(); onInspect(url.trim()) }}>
    <label htmlFor="media-url">{t('youtubeLink')}</label>
    <div className="url-field">
      <Link2 size={19} aria-hidden="true" />
      <input id="media-url" type="url" required value={url} maxLength={2048} disabled={pending}
        onChange={(event) => setUrl(event.target.value)} placeholder={t('urlPlaceholder')} />
      <button className="primary" type="submit" disabled={pending || !url.trim()}>
        {pending ? <><LoaderCircle size={17} className="spin" aria-hidden="true" /> {t('inspecting')}</> : <>{t('inspect')} <ArrowRight size={17} aria-hidden="true" /></>}
      </button>
    </div>
    <div className="input-help"><p className="hint">{t('urlHelp')}</p>
      {demo && <button className="text-button demo-example" type="button" disabled={pending}
        onClick={() => onInspect('https://www.youtube.com/playlist?list=PLAYLIST_STUDIO_DEMO')}>{t('openExample')}</button>}
    </div>
  </form>
}
