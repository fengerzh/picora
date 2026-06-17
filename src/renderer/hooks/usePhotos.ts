import { useCallback, useState } from 'react'

const PAGE_SIZE = 200

export interface MonthData {
  year: number
  months: Array<{ month: number; count: number }>
}

export interface UsePhotosReturn {
  photos: Photo[]
  totalCount: number
  photosByMonth: MonthData[]
  currentPage: number
  loading: boolean
  loadPage: (page: number) => Promise<void>
  refresh: () => Promise<void>
  deletePhoto: (id: string) => Promise<boolean>
  scrollToMonth: (year: number, month: number) => void
  scrollTarget: { year: number; month: number } | null
  clearScrollTarget: () => void
}

export function usePhotos(): UsePhotosReturn {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [photosByMonth, setPhotosByMonth] = useState<MonthData[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [scrollTarget, setScrollTarget] = useState<{
    year: number
    month: number
  } | null>(null)

  const loadPage = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const result = await window.picora.getPhotos(page, PAGE_SIZE)
      setPhotos(result.photos)
      setTotalCount(result.total)
      setCurrentPage(page)
    } catch (err) {
      console.error('加载照片失败：', err)
    } finally {
      setLoading(false)
    }
  }, [])

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
      const [result, monthData] = await Promise.all([
        window.picora.getPhotos(currentPage, PAGE_SIZE),
        window.picora.getPhotosByMonth()
      ])
      setPhotos(result.photos)
      setTotalCount(result.total)
      setPhotosByMonth(monthData)
    } catch (err) {
      console.error('刷新数据失败：', err)
    } finally {
      setLoading(false)
    }
  }, [currentPage])

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
    currentPage,
    loading,
    loadPage,
    refresh,
    deletePhoto,
    scrollToMonth,
    scrollTarget,
    clearScrollTarget
  }
}
