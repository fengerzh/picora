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
 * Reads EXIF data (date, dimensions) from a batch of image files.
 */
export async function readExifBatch(
  filePaths: string[]
): Promise<Array<{ path: string; dateTaken: Date; width: number; height: number }>> {
  const results: Array<{ path: string; dateTaken: Date; width: number; height: number }> = []

  for (const filePath of filePaths) {
    let dateTaken: Date
    let width = 0
    let height = 0

    try {
      const exifData = await exifr.parse(filePath, {
        tiff: true,
        exif: true
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
    } catch {
      // On any failure fall back to mtime and zero dimensions
      try {
        const stat = await fs.stat(filePath)
        dateTaken = stat.mtime
      } catch {
        dateTaken = new Date()
      }
    }

    results.push({ path: filePath, dateTaken, width, height })
  }

  return results
}
