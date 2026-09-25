export {}

declare global {
  interface Window {
    playlistStudio?: {
      selectDownloadDirectory: () => Promise<string | null>
    }
  }
}
