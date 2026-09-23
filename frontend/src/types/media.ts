export interface MediaEntry {
  id: string | null
  title: string
  url: string | null
  duration: number | null
  position: number
  available: boolean
  thumbnail: string | null
}

export interface MediaPreview {
  id: string | null
  title: string | null
  channel: string | null
  webpage_url: string | null
  is_playlist: boolean
  thumbnail: string | null
  item_count: number
  entries: MediaEntry[]
}

export interface SystemCheck {
  ready: boolean
  checked_at: string
  components: { name: string; ready: boolean; version: string | null; message: string }[]
}
