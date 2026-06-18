import sharp from 'sharp'
import * as path from 'path'
import * as fs from 'fs/promises'

/**
 * Generates a WebP thumbnail for a single image.
 * Uses .rotate() to auto-orient based on EXIF data.
 * Returns true on success, false on failure.
 */
export async function generateThumbnail(
  inputPath: string,
  outputPath: string,
  size: number
): Promise<boolean> {
  try {
    await sharp(inputPath)
      .rotate() // auto-orient based on EXIF
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(outputPath)
    return true
  } catch {
    return false
  }
}

/**
 * Gets the thumbnail path for a photo, generating it on-demand if it doesn't exist.
 * This enables lazy thumbnail generation — only photos visible on screen get thumbnails.
 */
export async function getOrGenerateThumbnail(
  photoId: string,
  photoPath: string,
  thumbDir: string,
  size: number
): Promise<string | null> {
  const thumbPath = path.join(thumbDir, `${photoId}.webp`)

  // Check if thumbnail already exists
  try {
    await fs.access(thumbPath)
    return thumbPath
  } catch {
    // Doesn't exist — generate it now
  }

  // Ensure thumbnail directory exists
  await fs.mkdir(thumbDir, { recursive: true })

  const success = await generateThumbnail(photoPath, thumbPath, size)
  return success ? thumbPath : null
}
