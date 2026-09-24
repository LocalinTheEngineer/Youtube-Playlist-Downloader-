import { Languages } from 'lucide-react'
import { languages, useI18n } from '../i18n/i18n'
import type { Language } from '../i18n/i18n'

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n()
  return <label className="language-selector" title={t('language')}>
    <Languages size={14} aria-hidden="true" />
    <span className="sr-only">{t('language')}</span>
    <select aria-label={t('language')} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
      {languages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select>
  </label>
}
