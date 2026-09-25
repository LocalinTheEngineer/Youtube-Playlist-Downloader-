import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('playlistStudio', {
  selectDownloadDirectory: () => ipcRenderer.invoke('playlist-studio:select-download-directory'),
})
