const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const apiBaseUrl = configuredApiUrl || 'http://127.0.0.1:8000/api'

// A production build without an API URL is a safe, static portfolio demo.
// Local development keeps using the real backend unless explicitly overridden.
export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
  || (import.meta.env.PROD && !configuredApiUrl)
