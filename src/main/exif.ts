import * as fs from 'fs/promises'
import exifr from 'exifr'

/**
 * Reads the EXIF date from an image file.
 * Falls back to file mtime if no EXIF date is present.
 */
export async function readExifDate(filePath: string): Promise<Date | null> {
  try {
    const exifData = await exifr.parse(filePath, {
      tiff: true,
      exif: true
    })

    if (exifData) {
      const dateValue = exifData.DateTimeOriginal ?? exifData.DateTimeDigitized ?? exifData.ModifyDate
      if (dateValue instanceof Date) {
        return dateValue
      }
      if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue)
        if (!isNaN(parsed.getTime())) {
          return parsed
        }
      }
    }
  } catch {
    // EXIF parsing failed — fall through to mtime
  }

  // Fall back to file modification time
  try {
    const stat = await fs.stat(filePath)
    return stat.mtime
  } catch {
    return null
  }
}

/**
 * Reads EXIF data (date, dimensions, GPS, camera info) from a batch of image files.
 */
export interface ExifResult {
  path: string
  dateTaken: Date
  width: number
  height: number
  latitude?: number
  longitude?: number
  make?: string
  model?: string
  fNumber?: number
  exposureTime?: number
  iso?: number
  focalLength?: number
}

export async function readExifBatch(filePaths: string[]): Promise<ExifResult[]> {
  const results: ExifResult[] = []

  for (const filePath of filePaths) {
    let dateTaken: Date
    let width = 0
    let height = 0
    let latitude: number | undefined
    let longitude: number | undefined
    let make: string | undefined
    let model: string | undefined
    let fNumber: number | undefined
    let exposureTime: number | undefined
    let iso: number | undefined
    let focalLength: number | undefined

    try {
      const exifData = await exifr.parse(filePath, {
        tiff: true,
        exif: true,
        gps: true
      })

      // Extract date
      const dateValue = exifData?.DateTimeOriginal ?? exifData?.DateTimeDigitized ?? exifData?.ModifyDate
      if (dateValue instanceof Date) {
        dateTaken = dateValue
      } else if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue)
        dateTaken = isNaN(parsed.getTime()) ? new Date() : parsed
      } else {
        const stat = await fs.stat(filePath)
        dateTaken = stat.mtime
      }

      // Extract dimensions
      width = exifData?.ImageWidth ?? exifData?.ExifImageWidth ?? 0
      height = exifData?.ImageHeight ?? exifData?.ExifImageHeight ?? 0

      // Extract GPS coordinates (exifr returns them as numbers when gps: true)
      if (exifData?.latitude != null && exifData?.longitude != null) {
        latitude = exifData.latitude
        longitude = exifData.longitude
      }

      // Extract camera info
      make = exifData?.Make ?? undefined
      model = exifData?.Model ?? undefined
      fNumber = exifData?.FNumber ?? undefined
      exposureTime = exifData?.ExposureTime ?? undefined
      iso = exifData?.ISO ?? undefined
      focalLength = exifData?.FocalLength ?? undefined
    } catch {
      // On any failure fall back to mtime and zero dimensions
      try {
        const stat = await fs.stat(filePath)
        dateTaken = stat.mtime
      } catch {
        dateTaken = new Date()
      }
    }

    results.push({ path: filePath, dateTaken, width, height, latitude, longitude, make, model, fNumber, exposureTime, iso, focalLength })
  }

  return results
}
