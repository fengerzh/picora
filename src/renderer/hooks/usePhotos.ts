import { useCallback, useState } from 'react'

export interface MonthData {
  year: number
  months: Array<{ month: number; count: number }>
}

export interface UsePhotosReturn {
  photos: Photo[]
  totalCount: number
  photosByMonth: MonthData[]
  loading: boolean
  refresh: () => Promise<void>
  deletePhoto: (id: string) => Promise<boolean>
  scrollTarget: { year: number; month: number } | null
  scrollToMonth: (year: number, month: number) => void
  clearScrollTarget: () => void
}

/** Compute year/month/count groups locally from a photo array */
function computeMonthData(photos: Photo[]): MonthData[] {
  const counts: Record<number, Record<number, number>> = {}
  for (const photo of photos) {
    const d = new Date(photo.dateTaken)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    if (!counts[y]) counts[y] = {}
    counts[y][m] = (counts[y][m] || 0) + 1
  }
  return Object.entries(counts)
    .map(([year, months]) => ({
      year: Number(year),
      months: Object.entries(months)
        .map(([month, count]) => ({ month: Number(month), count }))
        .sort((a, b) => b.month - a.month)
    }))
    .sort((a, b) => b.year - a.year)
}

export function usePhotos(): UsePhotosReturn {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [photosByMonth, setPhotosByMonth] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(false)
  const [scrollTarget, setScrollTarget] = useState<{
    year: number
    month: number
  } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // Single IPC call — compute month counts locally from the result
      const allPhotos = await window.picora.getAllPhotos()
      setPhotos(allPhotos)
      setTotalCount(allPhotos.length)
      setPhotosByMonth(computeMonthData(allPhotos))
    } catch (err) {
      console.error('刷新数据失败：', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const deletePhoto = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const ok = await window.picora.deletePhoto(id)
        if (ok) {
          // Update local state immediately (no extra IPC call)
          setPhotos((prev) => {
            const next = prev.filter((p) => p.id !== id)
            setPhotosByMonth(computeMonthData(next))
            return next
          })
          setTotalCount((prev) => prev - 1)
        }
        return ok
      } catch (err) {
        console.error('删除照片失败：', err)
        return false
      }
    },
    []
  )

  const scrollToMonth = useCallback((year: number, month: number) => {
    setScrollTarget({ year, month })
  }, [])

  const clearScrollTarget = useCallback(() => {
    setScrollTarget(null)
  }, [])

  return {
    photos,
    totalCount,
    photosByMonth,
    loading,
    refresh,
    deletePhoto,
    scrollTarget,
    scrollToMonth,
    clearScrollTarget
  }
}
