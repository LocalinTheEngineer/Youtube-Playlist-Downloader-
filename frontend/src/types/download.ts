export type FormatPreset = 'best' | '1080p' | '720p' | '480p' | 'audio'
export type JobStatus = 'queued' | 'inspecting' | 'downloading' | 'postprocessing' | 'completed' | 'failed' | 'cancelled' | 'interrupted'

export interface CreateDownload {
  url: string
  video_ids: string[]
  format_preset: FormatPreset
  output_directory: string
}

export interface DownloadItem {
  id: number
  video_id: string | null
  title: string
  status: JobStatus | 'skipped'
  progress: number
  downloaded_bytes: number
  total_bytes: number | null
  speed: number | null
  eta: number | null
  error_message: string | null
}

export interface DownloadJob {
  id: string
  playlist_title: string | null
  status: JobStatus
  total_items: number
  completed_items: number
  failed_items: number
  output_directory: string
  format_preset: FormatPreset
  error_message: string | null
  items: DownloadItem[]
}

export const isTerminal = (status: JobStatus) => ['completed', 'failed', 'cancelled', 'interrupted'].includes(status)
