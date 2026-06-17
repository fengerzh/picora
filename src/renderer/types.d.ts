interface PicoraAPI {
  getConfig(): Promise<{
    folders: string[]
    thumbnailSize: number
    scanOnStartup: boolean
  }>
  saveConfig(config: {
    folders: string[]
    thumbnailSize: number
    scanOnStartup: boolean
  }): Promise<void>
  configExists(): Promise<boolean>
  startScan(): Promise<{ photos: Photo[]; total: number }>
  onScanProgress(
    callback: (progress: { phase: string; done: number; total: number }) => void
  ): () => void
  getPhotos(
    page: number,
    pageSize: number
  ): Promise<{ photos: Photo[]; total: number }>
  getPhotoCount(): Promise<number>
  getPhotosByMonth(): Promise<
    Array<{ year: number; months: Array<{ month: number; count: number }> }>
  >
  getThumbnailPath(photoId: string): Promise<string | null>
  getFullImagePath(photoId: string): Promise<string | null>
  deletePhoto(photoId: string): Promise<boolean>
  selectFolder(): Promise<string | null>
  onPhotosUpdated(callback: () => void): () => void
  onStartupScan(callback: () => void): () => void
}

interface Photo {
  id: string
  path: string
  dateTaken: string
  width: number
  height: number
  thumbGenerated: boolean
}

declare global {
  interface Window {
    picora: PicoraAPI
  }
}

export {}
