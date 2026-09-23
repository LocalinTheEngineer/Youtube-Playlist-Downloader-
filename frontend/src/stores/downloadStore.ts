import { create } from 'zustand'
import type { MediaPreview } from '../types/media'
import type { FormatPreset } from '../types/download'

interface DownloadState {
  media: MediaPreview | null
  sourceUrl: string
  selectedIds: string[]
  formatPreset: FormatPreset
  outputDirectory: string
  activeJobId: string | null
  setFormatPreset: (preset: FormatPreset) => void
  setOutputDirectory: (directory: string) => void
  setActiveJob: (id: string) => void
  setMedia: (media: MediaPreview, sourceUrl: string) => void
  toggle: (id: string) => void
  selectAll: (checked: boolean) => void
  reset: () => void
}

export const useDownloadStore = create<DownloadState>((set) => ({
  media: null, sourceUrl: '', selectedIds: [],
  formatPreset: 'best', outputDirectory: '', activeJobId: null,
  setFormatPreset: (formatPreset) => set({ formatPreset }),
  setOutputDirectory: (outputDirectory) => set({ outputDirectory }),
  setActiveJob: (activeJobId) => set({ activeJobId }),
  setMedia: (media, sourceUrl) => set({
    media, sourceUrl,
    selectedIds: [...new Set(media.entries.filter((entry) => entry.available && entry.id).map((entry) => entry.id!))],
  }),
  toggle: (id) => set((state) => {
    if (!state.media?.entries.some((entry) => entry.id === id && entry.available)) return state
    return { selectedIds: state.selectedIds.includes(id) ? state.selectedIds.filter((selected) => selected !== id) : [...state.selectedIds, id] }
  }),
  selectAll: (checked) => set((state) => ({
    selectedIds: checked ? [...new Set(state.media?.entries.filter((entry) => entry.available && entry.id).map((entry) => entry.id!) ?? [])] : [],
  })),
  reset: () => set({ media: null, sourceUrl: '', selectedIds: [] }),
}))
