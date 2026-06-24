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
  getAllPhotos(): Promise<Photo[]>
  getPhotosWithLocation(): Promise<Photo[]>
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
  toggleFavorite(photoId: string): Promise<boolean | null>
  getFavorites(): Promise<Photo[]>
  startFaceScan(): Promise<{ done: number; total: number; cancelled: boolean; error?: string }>
  cancelFaceScan(): Promise<boolean>
  getFaceScanStatus(): Promise<{ scanned: number; total: number; running: boolean }>
  resetFaceScan(): Promise<boolean>
  getPersons(): Promise<Person[]>
  renamePerson(personId: string, name: string): Promise<boolean>
  getPhotosByPerson(personId: string): Promise<Photo[]>
  removePhotoFromPerson(personId: string, photoId: string): Promise<boolean>
  onPhotosUpdated(callback: () => void): () => void
  onStartupScan(callback: () => void): () => void
}

interface FaceData {
  x: number
  y: number
  width: number
  height: number
  embedding: number[]
  personId?: string
}

interface Person {
  id: string
  name?: string
  faceCount: number
  representativePhotoId?: string
}

interface Photo {
  id: string
  path: string
  dateTaken: string
  width: number
  height: number
  thumbGenerated: boolean
  latitude?: number
  longitude?: number
  make?: string
  model?: string
  fNumber?: number
  exposureTime?: number
  iso?: number
  focalLength?: number
  favorite?: boolean
  faceScanStatus?: 'pending' | 'done'
  faces?: FaceData[]
  removedFromPersonIds?: string[]
}

declare global {
  interface Window {
    picora: PicoraAPI
  }
}

export {}
