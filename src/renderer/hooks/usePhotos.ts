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

export function usePhotos(): UsePhotosReturn {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [photosByMonth, setPhotosByMonth] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(false)
  const [scrollTarget, setScrollTarget] = useState<{
    year: number
    month: number
  } | null>(null)

  const loadByMonth = useCallback(async () => {
    try {
      const data = await window.picora.getPhotosByMonth()
      setPhotosByMonth(data)
    } catch (err) {
      console.error('加载月份数据失败：', err)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [allPhotos, monthData] = await Promise.all([
        window.picora.getAllPhotos(),
        window.picora.getPhotosByMonth()
      ])
      setPhotos(allPhotos)
      setTotalCount(allPhotos.length)
      setPhotosByMonth(monthData)
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
          // Remove from local state immediately
          setPhotos((prev) => prev.filter((p) => p.id !== id))
          setTotalCount((prev) => prev - 1)
          // Refresh month data in background
          loadByMonth()
        }
        return ok
      } catch (err) {
        console.error('删除照片失败：', err)
        return false
      }
    },
    [loadByMonth]
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
