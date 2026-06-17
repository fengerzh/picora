import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('picora', {
  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: any) => ipcRenderer.invoke('config:save', config),
  configExists: () => ipcRenderer.invoke('config:exists'),

  // Scan
  startScan: () => ipcRenderer.invoke('scan:start'),
  onScanProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on('scan:progress', handler)
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },

  // Photos
  getPhotos: (page: number, pageSize: number) =>
    ipcRenderer.invoke('photos:get', page, pageSize),
  getPhotoCount: () => ipcRenderer.invoke('photos:count'),
  getPhotosByMonth: () => ipcRenderer.invoke('photos:byMonth'),

  // Thumbnails
  getThumbnailPath: (photoId: string) =>
    ipcRenderer.invoke('thumbnail:get', photoId),

  // Full image
  getFullImagePath: (photoId: string) =>
    ipcRenderer.invoke('photo:fullPath', photoId),

  // Delete
  deletePhoto: (photoId: string) => ipcRenderer.invoke('photo:delete', photoId),

  // Folder selection
  selectFolder: () => ipcRenderer.invoke('folder:select'),

  // Events
  onPhotosUpdated: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('photos:updated', handler)
    return () => ipcRenderer.removeListener('photos:updated', handler)
  },

  onStartupScan: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('startup:scan', handler)
    return () => ipcRenderer.removeListener('startup:scan', handler)
  }
})
