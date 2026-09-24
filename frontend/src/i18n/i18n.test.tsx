import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { LanguageSelector } from '../components/LanguageSelector'
import { I18nProvider, useI18n } from './i18n'

function Sample() {
  const { t } = useI18n()
  return <><LanguageSelector /><h1>{t('newDownload')}</h1></>
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.dir = 'ltr'
})

test('changes language, stores the preference and enables RTL for Arabic', async () => {
  const user = userEvent.setup()
  render(<I18nProvider><Sample /></I18nProvider>)
  const selector = screen.getByRole('combobox', { name: 'Dil' })
  await user.selectOptions(selector, 'en')
  expect(screen.getByRole('heading', { name: 'New download' })).toBeVisible()
  expect(localStorage.getItem('playlist-studio-language')).toBe('en')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'ar')
  expect(screen.getByRole('heading', { name: 'تنزيل جديد' })).toBeVisible()
  await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))
  expect(localStorage.getItem('playlist-studio-language')).toBe('ar')
})
