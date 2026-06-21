import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

export interface FaceData {
  x: number
  y: number
  width: number
  height: number
  embedding: number[] // 128-dim face descriptor
  personId?: string
}

export interface Photo {
  id: string
  path: string
  dateTaken: string // ISO string
  width: number
  height: number
  thumbGenerated: boolean
  favorite?: boolean
  faceScanStatus?: 'pending' | 'done'
  faces?: FaceData[]
}

export interface Person {
  id: string
  name?: string // user-assigned name, undefined if not named yet
  faceCount: number
  representativePhotoId?: string
}

export interface PhotoIndex {
  version: number
  lastScan: string
  folders: string[]
  photos: Photo[]
  persons: Person[]
}

function emptyIndex(): PhotoIndex {
  return {
    version: 1,
    lastScan: new Date().toISOString(),
    folders: [],
    photos: [],
    persons: []
  }
}

export class PhotoIndexer {
  private readonly indexPath: string
  private index: PhotoIndex = emptyIndex()

  constructor(userDataPath: string) {
    this.indexPath = path.join(userDataPath, 'photos.json')
  }

  /**
   * Loads the index from disk, or returns an empty index if the file doesn't exist.
   */
  async load(): Promise<PhotoIndex> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8')
      this.index = JSON.parse(data) as PhotoIndex
    } catch {
      this.index = emptyIndex()
    }
    return this.index
  }

  /**
   * Persists the current index to disk.
   */
  async save(index: PhotoIndex): Promise<void> {
    this.index = index
    await fs.mkdir(path.dirname(this.indexPath), { recursive: true })
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8')
  }

  /**
   * Adds new photos to the index (skips duplicates by id), then saves.
   */
  async addPhotos(photos: Photo[]): Promise<void> {
    const existingIds = new Set(this.index.photos.map((p) => p.id))
    const newPhotos = photos.filter((p) => !existingIds.has(p.id))
    this.index.photos.push(...newPhotos)
    this.index.lastScan = new Date().toISOString()
    await this.save(this.index)
  }

  /**
   * Removes a photo by id. Returns true if found and removed.
   */
  async removePhoto(id: string): Promise<boolean> {
    const before = this.index.photos.length
    this.index.photos = this.index.photos.filter((p) => p.id !== id)
    if (this.index.photos.length !== before) {
      await this.save(this.index)
      return true
    }
    return false
  }

  /**
   * Validates that every photo path still exists on disk.
   * Removes dead entries and saves. Returns the number of removed entries.
   */
  async validatePaths(): Promise<number> {
    const alive: Photo[] = []
    let removedCount = 0

    for (const photo of this.index.photos) {
      try {
        await fs.access(photo.path)
        alive.push(photo)
      } catch {
        removedCount++
      }
    }

    if (removedCount > 0) {
      this.index.photos = alive
      await this.save(this.index)
    }

    return removedCount
  }

  /**
   * Generates a stable short MD5-based id for a file path.
   */
  generateId(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex').slice(0, 8)
  }

  /**
   * Returns photos sorted by dateTaken descending, paginated.
   */
  getPhotos(page: number, pageSize: number): { photos: Photo[]; total: number } {
    const sorted = [...this.index.photos].sort(
      (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
    )
    const start = (page - 1) * pageSize
    const paged = sorted.slice(start, start + pageSize)
    return { photos: paged, total: sorted.length }
  }

  /**
   * Returns ALL photos sorted by dateTaken descending (no pagination).
   * Suitable for the timeline view where the virtual scroll handles rendering.
   */
  getAllPhotos(): Photo[] {
    return [...this.index.photos].sort(
      (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
    )
  }

  /**
   * Returns the total number of indexed photos.
   */
  getPhotoCount(): number {
    return this.index.photos.length
  }

  /**
   * Looks up a single photo by its id.
   */
  getPhotoById(id: string): Photo | undefined {
    return this.index.photos.find((p) => p.id === id)
  }

  /**
   * Marks the given photo IDs as having thumbnails generated, then saves.
   */
  async markThumbnailsGenerated(ids: string[]): Promise<void> {
    const idSet = new Set(ids)
    for (const photo of this.index.photos) {
      if (idSet.has(photo.id)) {
        photo.thumbGenerated = true
      }
    }
    await this.save(this.index)
  }

  /**
   * Returns all photos (sorted by dateTaken descending).
   */
  getIndex(): Photo[] {
    return this.index.photos
  }

  /**
   * Groups photos by year-month (e.g. "2024-03") for the time tree view.
   * Returns a map of "YYYY-MM" → Photo[].
   */
  getByMonth(): Record<string, Photo[]> {
    const groups: Record<string, Photo[]> = {}

    for (const photo of this.index.photos) {
      const d = new Date(photo.dateTaken)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(photo)
    }

    // Sort each group by dateTaken descending
    for (const key of Object.keys(groups)) {
      groups[key].sort(
        (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
      )
    }

    return groups
  }

  /**
   * Toggles the favorite flag on a photo and saves.
   */
  async toggleFavorite(id: string): Promise<boolean | null> {
    const photo = this.index.photos.find((p) => p.id === id)
    if (!photo) return null
    photo.favorite = !photo.favorite
    await this.save(this.index)
    return photo.favorite
  }

  /**
   * Returns all favorite photos, sorted by dateTaken descending.
   */
  getFavorites(): Photo[] {
    return this.index.photos
      .filter((p) => p.favorite)
      .sort(
        (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
      )
  }

  /**
   * Returns photos that have not been face-scanned yet.
   */
  getUnscannedPhotos(): Photo[] {
    return this.index.photos.filter((p) => p.faceScanStatus !== 'done')
  }

  /**
   * Updates a photo's face scan result and saves.
   */
  async updatePhotoFaces(photoId: string, faces: FaceData[]): Promise<void> {
    const photo = this.index.photos.find((p) => p.id === photoId)
    if (!photo) return
    photo.faces = faces
    photo.faceScanStatus = 'done'
    await this.save(this.index)
  }

  /**
   * Returns all persons.
   */
  getPersons(): Person[] {
    return this.index.persons
  }

  /**
   * Updates persons list and saves.
   */
  async updatePersons(persons: Person[]): Promise<void> {
    this.index.persons = persons
    await this.save(this.index)
  }

  /**
   * Renames a person and saves.
   */
  async renamePerson(personId: string, name: string): Promise<void> {
    const person = this.index.persons.find((p) => p.id === personId)
    if (!person) return
    person.name = name
    await this.save(this.index)
  }

  /**
   * Resets face scan status for all photos, allowing a full re-scan.
   */
  async resetFaceScan(): Promise<void> {
    for (const photo of this.index.photos) {
      photo.faceScanStatus = 'pending'
      photo.faces = undefined
    }
    this.index.persons = []
    await this.save(this.index)
  }

  /**
   * Returns photos containing a specific person.
   */
  getPhotosByPerson(personId: string): Photo[] {
    return this.index.photos
      .filter((p) => p.faces?.some((f) => f.personId === personId))
      .sort(
        (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
      )
  }
}
