const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('playlistStudio', {
  selectDownloadDirectory: () => ipcRenderer.invoke('playlist-studio:select-download-directory'),
})
